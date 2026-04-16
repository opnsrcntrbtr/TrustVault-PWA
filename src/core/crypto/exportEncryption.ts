/**
 * Export Encryption Utilities
 * Handles encryption and decryption of vault exports with a separate password
 */

import { deriveKeyFromPassword, encrypt, decrypt } from './encryption';
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
    iterations: number;
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

  // Derive encryption key from export password
  const key = await deriveKeyFromPassword(exportPassword, salt);

  // Prepare data to encrypt
  const exportData: ExportData = {
    credentials: credentials.map((cred) => ({
      ...cred,
      // Convert dates to ISO strings for JSON serialization
      createdAt: cred.createdAt.toISOString(),
      updatedAt: cred.updatedAt.toISOString(),
    })) as any, // Type assertion needed for date conversion
  };

  // Encrypt the data
  const dataString = JSON.stringify(exportData);
  const encryptedData = await encrypt(dataString, key);

  // Create export object
  const vaultExport: VaultExport = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    salt: btoa(String.fromCharCode(...salt)),
    encryptedData: JSON.stringify(encryptedData),
    encryptionParams: {
      algorithm: 'AES-256-GCM',
      iterations: 600000, // PBKDF2 iterations
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
  if (vaultExport.version !== '1.0') {
    throw new Error(`Unsupported export version: ${vaultExport.version}`);
  }

  // Decode salt
  const saltString = atob(vaultExport.salt);
  const salt = new Uint8Array(saltString.length);
  for (let i = 0; i < saltString.length; i++) {
    salt[i] = saltString.charCodeAt(i);
  }

  // Derive decryption key
  const key = await deriveKeyFromPassword(exportPassword, salt);

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
    decryptedString = await decrypt(encryptedData, key);
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
