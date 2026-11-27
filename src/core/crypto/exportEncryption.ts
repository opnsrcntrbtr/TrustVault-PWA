/**
 * Export Encryption Utilities
 * Handles encryption and decryption of vault exports with a separate password
 */

import { deriveKeyFromPassword, deriveScryptKey, encrypt, decrypt, VAULT_SCRYPT_PARAMS } from './encryption';
import { buildAad, type ExportHeader } from './aad';
import { encodeUint8ArrayToBase64, decodeBase64ToUint8Array } from '@/core/utils/base64';
import type { Credential } from '@/domain/entities/Credential';

/**
 * Export file format
 */
export interface VaultExport {
  version: string;
  exportDate: string;
  salt: string; // Base64 encoded salt for key derivation
  encryptedData: string; // JSON stringified encrypted data
  encryptionParams: {
    algorithm: string;
    // 1.1
    kdf?: string;
    N?: number;
    r?: number;
    p?: number;
    dkLen?: number;
    // 1.0
    iterations?: number;
  };
}

const MAX_SCRYPT_N = 1 << 20;
const MAX_SCRYPT_P = 4;

/**
 * Validates untrusted 1.1 KDF settings before any key derivation: the floor
 * stops a weakened KDF, the ceiling stops a crafted file exhausting memory.
 */
function readHeader(vaultExport: VaultExport): ExportHeader {
  const { kdf, N, r, p, dkLen } = vaultExport.encryptionParams;
  const isPowerOfTwo = (n: number) => Number.isInteger(n) && (n & (n - 1)) === 0;
  if (
    kdf !== 'scrypt' ||
    typeof N !== 'number' || !isPowerOfTwo(N) || N < VAULT_SCRYPT_PARAMS.N || N > MAX_SCRYPT_N ||
    r !== VAULT_SCRYPT_PARAMS.r ||
    typeof p !== 'number' || !Number.isInteger(p) || p < 1 || p > MAX_SCRYPT_P ||
    dkLen !== VAULT_SCRYPT_PARAMS.dkLen
  ) {
    throw new Error('Unsupported export encryption parameters');
  }
  return {
    version: vaultExport.version,
    exportDate: vaultExport.exportDate,
    salt: vaultExport.salt,
    kdf,
    kdfParams: { N, r, p, dkLen },
  };
}

/**
 * Decrypted export data
 */
interface ExportData {
  credentials: Credential[];
}

/**
 * Encrypt credentials for export
 * @param credentials - Array of credentials to export
 * @param exportPassword - Password to encrypt the export (separate from master password)
 * @returns JSON string of encrypted export
 */
export async function encryptExport(
  credentials: Credential[],
  exportPassword: string
): Promise<string> {
  // Generate random salt for key derivation
  const salt = new Uint8Array(32);
  crypto.getRandomValues(salt);

  const header: ExportHeader = {
    version: '1.1',
    exportDate: new Date().toISOString(),
    salt: encodeUint8ArrayToBase64(salt),
    kdf: 'scrypt',
    kdfParams: { ...VAULT_SCRYPT_PARAMS },
  };

  // Derive encryption key from export password
  const key = await deriveScryptKey(exportPassword, salt, header.kdfParams);

  // Prepare data to encrypt
  const exportData: ExportData = {
    // Integrity-failed rows hold no real data and must not enter a backup.
    credentials: credentials.filter((cred) => !cred.integrityError).map((cred) => ({
      ...cred,
      // Convert dates to ISO strings for JSON serialization
      createdAt: cred.createdAt.toISOString(),
      updatedAt: cred.updatedAt.toISOString(),
    })) as any, // Type assertion needed for date conversion
  };

  // Encrypt the data
  const dataString = JSON.stringify(exportData);
  const encryptedData = await encrypt(dataString, key, buildAad({ purpose: 'export', header }));

  // Create export object
  const vaultExport: VaultExport = {
    version: header.version,
    exportDate: header.exportDate,
    salt: header.salt,
    encryptedData: JSON.stringify(encryptedData),
    encryptionParams: {
      algorithm: 'AES-256-GCM',
      kdf: header.kdf,
      ...header.kdfParams,
    },
  };

  return JSON.stringify(vaultExport, null, 2);
}

/**
 * Decrypt and parse imported vault
 * @param exportJson - JSON string of the encrypted export
 * @param exportPassword - Password used to encrypt the export
 * @returns Array of decrypted credentials
 */
export async function decryptImport(
  exportJson: string,
  exportPassword: string
): Promise<Credential[]> {
  // Parse export JSON
  let vaultExport: VaultExport;
  try {
    vaultExport = JSON.parse(exportJson);
  } catch (error) {
    throw new Error('Invalid export file format');
  }

  // Validate export format
  if (
    !vaultExport.version ||
    !vaultExport.salt ||
    !vaultExport.encryptedData ||
    !vaultExport.encryptionParams
  ) {
    throw new Error('Invalid export file structure');
  }

  // Check version compatibility
  if (vaultExport.version !== '1.0' && vaultExport.version !== '1.1') {
    throw new Error(`Unsupported export version: ${vaultExport.version}`);
  }

  const header = vaultExport.version === '1.1' ? readHeader(vaultExport) : null;

  // Decode salt
  const salt = decodeBase64ToUint8Array(vaultExport.salt);

  // Derive decryption key
  const key = header
    ? await deriveScryptKey(exportPassword, salt, header.kdfParams)
    : await deriveKeyFromPassword(exportPassword, salt); // 1.0 files

  // Parse encrypted data
  let encryptedData;
  try {
    encryptedData = JSON.parse(vaultExport.encryptedData);
  } catch (error) {
    throw new Error('Invalid encrypted data format');
  }

  // Decrypt the data
  let decryptedString: string;
  try {
    // A 1.1 payload must be bound to this exact header; a 1.0 payload is unbound,
    // so a 1.1 file relabelled as 1.0 cannot decrypt.
    if (header && encryptedData.v !== 2) throw new Error('Unbound payload');
    decryptedString = await decrypt(
      encryptedData,
      key,
      header ? buildAad({ purpose: 'export', header }) : undefined
    );
  } catch (error) {
    throw new Error('Failed to decrypt export. Invalid password or corrupted file.');
  }

  // Parse decrypted data
  let exportData: ExportData;
  try {
    exportData = JSON.parse(decryptedString);
  } catch (error) {
    throw new Error('Invalid export data structure');
  }

  // Validate credentials array
  if (!Array.isArray(exportData.credentials)) {
    throw new Error('Invalid credentials data');
  }

  // Convert date strings back to Date objects
  const credentials = exportData.credentials.map((cred) => ({
    ...cred,
    createdAt: new Date(cred.createdAt),
    updatedAt: new Date(cred.updatedAt),
  }));

  return credentials;
}

/**
 * Generate filename for export
 * @returns Filename with current date
 */
export function generateExportFilename(): string {
  const date = new Date();
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
  return `trustvault-backup-${dateStr}.tvault`;
}

/**
 * Download export file
 * @param exportJson - JSON string of the export
 * @param filename - Filename for the download
 */
export function downloadExportFile(exportJson: string, filename: string): void {
  const blob = new Blob([exportJson], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read import file
 * @param file - File object from input
 * @returns Promise that resolves to file content as string
 */
export function readImportFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === 'string') {
        resolve(content);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => { reject(new Error('Failed to read file')); };
    reader.readAsText(file);
  });
}
