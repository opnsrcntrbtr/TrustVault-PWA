/**
 * Canonical Additional Authenticated Data (AAD) for AES-GCM.
 *
 * Binds each ciphertext to where it belongs, so a blob moved to another user,
 * record or column fails authentication. Each part is encoded as a 4-byte
 * big-endian length followed by its UTF-8 bytes, which keeps part boundaries
 * unambiguous.
 */

export const CREDENTIAL_FIELDS = [
  'encryptedPassword',
  'encryptedTitle',
  'encryptedUsername',
  'encryptedUrl',
  'encryptedTags',
  'encryptedNotes',
  'encryptedTotpSecret',
  'encryptedCardNumber',
  'encryptedCvv',
  'encryptedCardholderName',
  'encryptedExpiryMonth',
  'encryptedExpiryYear',
  'encryptedCardType',
  'encryptedBillingAddress',
  'encryptedBackupCodes',
] as const;

export type CredentialField = (typeof CREDENTIAL_FIELDS)[number];

export interface ExportHeader {
  version: string;
  exportDate: string;
  salt: string;
  kdf: 'scrypt';
  kdfParams: { N: number; r: number; p: number; dkLen: number };
}

export type AadContext =
  | { purpose: 'credential-field'; userId: string; recordId: string; field: CredentialField }
  | { purpose: 'profile-name'; userId: string; recordId: string }
  | { purpose: 'vault-key-wrap'; userId: string }
  | { purpose: 'export'; header: ExportHeader };

function contextParts(ctx: AadContext): string[] {
  switch (ctx.purpose) {
    case 'credential-field':
      return [ctx.purpose, ctx.userId, ctx.recordId, ctx.field];
    case 'profile-name':
      return [ctx.purpose, ctx.userId, ctx.recordId];
    case 'vault-key-wrap':
      return [ctx.purpose, ctx.userId];
    case 'export': {
      const { version, exportDate, salt, kdf, kdfParams } = ctx.header;
      const { N, r, p, dkLen } = kdfParams;
      return [ctx.purpose, version, exportDate, salt, kdf, ...[N, r, p, dkLen].map(String)];
    }
  }
}

export function buildAad(ctx: AadContext): Uint8Array {
  const encoder = new TextEncoder();
  const encoded = ['tv-aad', '2', ...contextParts(ctx)].map((part) => encoder.encode(part));
  const out = new Uint8Array(encoded.reduce((n, bytes) => n + 4 + bytes.length, 0));
  const view = new DataView(out.buffer);
  let offset = 0;
  for (const bytes of encoded) {
    view.setUint32(offset, bytes.length);
    out.set(bytes, offset + 4);
    offset += 4 + bytes.length;
  }
  return out;
}
