/**
 * Biometric Vault Key Management
 * Handles secure storage and retrieval of vault keys for biometric authentication
 *
 * Strategy:
 * 1. When user enables biometric, encrypt their vault key with a device-specific key
 * 2. Store the encrypted vault key with the WebAuthn credential
 * 3. On biometric auth, decrypt the vault key using the device-specific key
 *
 * The device-specific key is derived from:
 * - Credential ID (unique per device/biometric)
 * - User ID
 * - A random salt stored with the credential
 */

import { encrypt, decrypt } from '@/core/crypto/encryption';
import type { EncryptedData } from '@/core/crypto/encryption';

/**
 * Derives a device-specific encryption key from credential metadata
 * This key is deterministic based on the credential ID and user ID
 */
async function deriveDeviceKey(
  credentialId: string,
  userId: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Combine credential ID and user ID
  const keyMaterial = `${credentialId}:${userId}`;
  const encoder = new TextEncoder();
  const keyMaterialBytes = encoder.encode(keyMaterial);

  // Import as key material
  const importedKey = await crypto.subtle.importKey(
    'raw',
    keyMaterialBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000, // OWASP minimum for 2023
      hash: 'SHA-256',
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    false, // Not extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a vault key for storage with a biometric credential
 * Returns the encrypted data as a JSON string
 */
export async function encryptVaultKeyForBiometric(
  vaultKey: CryptoKey,
  credentialId: string,
  userId: string
): Promise<{ encryptedVaultKey: string; salt: string }> {
  // Generate a random salt for this credential
  const salt = new Uint8Array(32);
  crypto.getRandomValues(salt);

  // Derive device-specific key
  const deviceKey = await deriveDeviceKey(credentialId, userId, salt);

  // Export the vault key to encrypt it
  const vaultKeyData = await crypto.subtle.exportKey('raw', vaultKey);
  const vaultKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(vaultKeyData)));

  // Encrypt the vault key
  const encrypted = await encrypt(vaultKeyBase64, deviceKey);

  // Return encrypted data and salt (both base64 encoded)
  return {
    encryptedVaultKey: JSON.stringify(encrypted),
    salt: btoa(String.fromCharCode(...salt)),
  };
}

/**
 * Decrypts a vault key from biometric credential storage
 * Returns the decrypted vault key
 */
export async function decryptVaultKeyFromBiometric(
  encryptedVaultKeyJson: string,
  salt: string,
  credentialId: string,
  userId: string
): Promise<CryptoKey> {
  // Parse encrypted data
  const encryptedData = JSON.parse(encryptedVaultKeyJson) as EncryptedData;

  // Decode salt
  const saltBytes = Uint8Array.from(atob(salt), c => c.charCodeAt(0));

  // Derive the same device-specific key
  const deviceKey = await deriveDeviceKey(credentialId, userId, saltBytes);

  // Decrypt the vault key
  const vaultKeyBase64 = await decrypt(encryptedData, deviceKey);

  // Convert from base64 to bytes
  const vaultKeyBytes = Uint8Array.from(atob(vaultKeyBase64), c => c.charCodeAt(0));

  // Import as CryptoKey
  const vaultKey = await crypto.subtle.importKey(
    'raw',
    vaultKeyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return vaultKey;
}

/**
 * Stores encrypted vault key in IndexedDB with the credential
 * This is called when user enables biometric authentication
 */
export async function storeBiometricVaultKey(
  userId: string,
  credentialId: string,
  vaultKey: CryptoKey
): Promise<{ encryptedVaultKey: string; salt: string }> {
  return encryptVaultKeyForBiometric(vaultKey, credentialId, userId);
}

/**
 * Retrieves and decrypts vault key from IndexedDB credential
 * This is called during biometric authentication
 */
export async function retrieveBiometricVaultKey(
  userId: string,
  credentialId: string,
  encryptedVaultKey: string,
  salt: string
): Promise<CryptoKey> {
  return decryptVaultKeyFromBiometric(encryptedVaultKey, salt, credentialId, userId);
}
