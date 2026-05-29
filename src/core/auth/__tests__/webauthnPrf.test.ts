/**
 * S1 — WebAuthn PRF native-API helpers
 *
 * Verifies isPRFSupported / registerCredentialWithPRF / getPRFOutput against a
 * fake native authenticator (navigator.credentials.create / .get). The fake
 * authenticator simply echoes the PRF salt as the PRF output, which is enough to
 * verify the plumbing (option shape, result extraction, replay verification).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isPRFSupported,
  detectPRFSupport,
  registerCredentialWithPRF,
  getPRFOutput,
} from '@/core/auth/webauthn';
import { encodeUint8ArrayToBase64Url } from '@/core/utils/base64';

const ORIGIN = 'http://localhost:3000';

interface CapsShape {
  getClientCapabilities?: () => Promise<Record<string, boolean | undefined>>;
}

function installWindow(caps?: CapsShape): void {
  const PublicKeyCredentialMock = function PublicKeyCredentialMock(): void {
    /* constructor stub */
  } as unknown as CapsShape & ((...args: unknown[]) => void);
  if (caps?.getClientCapabilities) {
    PublicKeyCredentialMock.getClientCapabilities = caps.getClientCapabilities;
  }
  (global as unknown as { window: unknown }).window = {
    PublicKeyCredential: PublicKeyCredentialMock,
    location: { hostname: 'localhost', origin: ORIGIN },
  };
}

function installNavigator(credentials: Partial<CredentialsContainer>): void {
  Object.defineProperty(global, 'navigator', {
    value: { credentials },
    configurable: true,
    writable: true,
  });
}

/** Builds a fake attestation credential for navigator.credentials.create. */
function fakeAttestation(rawId: Uint8Array, prfEnabled: boolean | undefined): PublicKeyCredential {
  return {
    rawId: rawId.buffer,
    id: encodeUint8ArrayToBase64Url(rawId),
    type: 'public-key',
    authenticatorAttachment: 'platform',
    getClientExtensionResults: () =>
      (prfEnabled === undefined ? {} : { prf: { enabled: prfEnabled } }) as AuthenticationExtensionsClientOutputs,
    response: {
      getTransports: () => ['internal'],
      getPublicKey: () => new Uint8Array([1, 2, 3]).buffer,
    } as unknown as AuthenticatorAttestationResponse,
  } as unknown as PublicKeyCredential;
}

/** Builds a fake assertion that echoes the challenge and the PRF salt as output. */
function makeFakeGet(counter: number, returnPrf: boolean) {
  return vi.fn((opts: { publicKey: PublicKeyCredentialRequestOptions }) => {
    const pk = opts.publicKey;
    const challenge = new Uint8Array(pk.challenge as ArrayBuffer);
    const clientData = {
      type: 'webauthn.get',
      challenge: encodeUint8ArrayToBase64Url(challenge),
      origin: ORIGIN,
    };
    const clientDataJSON = new TextEncoder().encode(JSON.stringify(clientData));
    const authData = new Uint8Array([
      ...Array<number>(33).fill(0),
      (counter >>> 24) & 0xff,
      (counter >>> 16) & 0xff,
      (counter >>> 8) & 0xff,
      counter & 0xff,
    ]);
    const extIn = pk.extensions as unknown as { prf?: { eval?: { first?: ArrayBuffer } } };
    const salt = new Uint8Array(extIn.prf?.eval?.first ?? new ArrayBuffer(0));

    const assertion = {
      id: 'assertion-id',
      rawId: new Uint8Array([9, 9]).buffer,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      getClientExtensionResults: () =>
        (returnPrf ? { prf: { results: { first: salt } } } : {}) as AuthenticationExtensionsClientOutputs,
      response: {
        clientDataJSON: clientDataJSON.buffer,
        authenticatorData: authData.buffer,
        signature: new Uint8Array([7]).buffer,
        userHandle: null,
      } as unknown as AuthenticatorAssertionResponse,
    } as unknown as PublicKeyCredential;

    return Promise.resolve(assertion);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isPRFSupported', () => {
  it('returns true when client capabilities report extension:prf', async () => {
    installWindow({ getClientCapabilities: () => Promise.resolve({ 'extension:prf': true }) });
    installNavigator({});
    expect(await isPRFSupported()).toBe(true);
  });

  it('returns false when client capabilities report no prf', async () => {
    installWindow({ getClientCapabilities: () => Promise.resolve({ 'extension:prf': false }) });
    installNavigator({});
    expect(await isPRFSupported()).toBe(false);
  });

  it('is optimistic (true) when capabilities cannot be queried but WebAuthn exists', async () => {
    installWindow(); // no getClientCapabilities
    installNavigator({});
    expect(await isPRFSupported()).toBe(true);
  });

  it('returns false when WebAuthn is unsupported', async () => {
    (global as unknown as { window: unknown }).window = { location: { origin: ORIGIN } };
    expect(await isPRFSupported()).toBe(false);
  });
});

describe('registerCredentialWithPRF', () => {
  beforeEach(() => {
    installWindow();
  });

  it('returns prfEnabled=true and a base64url credentialId when the authenticator enables PRF', async () => {
    const rawId = new Uint8Array([10, 20, 30, 40]);
    installNavigator({
      create: vi.fn(() => Promise.resolve(fakeAttestation(rawId, true))) as unknown as CredentialsContainer['create'],
    });

    const result = await registerCredentialWithPRF({
      rpName: 'TrustVault',
      rpId: 'localhost',
      userId: 'user-1',
      userName: 'a@b.com',
      userDisplayName: 'A',
    });

    expect(result.prfEnabled).toBe(true);
    expect(result.credentialId).toBe(encodeUint8ArrayToBase64Url(rawId));
    expect(result.transports).toEqual(['internal']);
  });

  it('returns prfEnabled=false when the authenticator does not enable PRF', async () => {
    installNavigator({
      create: vi.fn(() => Promise.resolve(fakeAttestation(new Uint8Array([1]), false))) as unknown as CredentialsContainer['create'],
    });

    const result = await registerCredentialWithPRF({
      rpName: 'TrustVault', rpId: 'localhost', userId: 'u', userName: 'n', userDisplayName: 'd',
    });
    expect(result.prfEnabled).toBe(false);
  });

  it('passes the prf extension and requires user verification', async () => {
    const create = vi.fn(() => Promise.resolve(fakeAttestation(new Uint8Array([2]), true)));
    installNavigator({ create: create as unknown as CredentialsContainer['create'] });

    await registerCredentialWithPRF({
      rpName: 'TrustVault', rpId: 'localhost', userId: 'u', userName: 'n', userDisplayName: 'd',
    });

    const firstCall = create.mock.calls[0];
    const opts = firstCall?.[0] as { publicKey: PublicKeyCredentialCreationOptions };
    const ext = opts.publicKey.extensions as unknown as { prf?: unknown };
    expect(ext.prf).toBeDefined();
    expect(opts.publicKey.authenticatorSelection?.userVerification).toBe('required');
  });
});

describe('getPRFOutput', () => {
  beforeEach(() => {
    installWindow();
  });

  it('returns the PRF output and verified counter', async () => {
    installNavigator({ get: makeFakeGet(6, true) as unknown as CredentialsContainer['get'] });

    const credentialId = encodeUint8ArrayToBase64Url(new Uint8Array([1, 2, 3, 4]));
    const salt = new Uint8Array(32).fill(5);
    const { prfOutput, counter } = await getPRFOutput(credentialId, salt, 'localhost', 5);

    expect(counter).toBe(6);
    expect(prfOutput).toEqual(salt); // fake authenticator echoes the salt
  });

  it('throws when the authenticator returns no PRF result', async () => {
    installNavigator({ get: makeFakeGet(6, false) as unknown as CredentialsContainer['get'] });
    const credentialId = encodeUint8ArrayToBase64Url(new Uint8Array([1, 2, 3, 4]));
    await expect(getPRFOutput(credentialId, new Uint8Array(32), 'localhost', 5)).rejects.toThrow(/PRF/);
  });

  it('enforces replay protection (counter must increase)', async () => {
    installNavigator({ get: makeFakeGet(3, true) as unknown as CredentialsContainer['get'] });
    const credentialId = encodeUint8ArrayToBase64Url(new Uint8Array([1, 2, 3, 4]));
    await expect(getPRFOutput(credentialId, new Uint8Array(32), 'localhost', 5)).rejects.toThrow(/Counter/);
  });
});

describe('detectPRFSupport (tri-state)', () => {
  it("returns 'supported' when capabilities report extension:prf", async () => {
    installWindow({ getClientCapabilities: () => Promise.resolve({ 'extension:prf': true }) });
    installNavigator({});
    expect(await detectPRFSupport()).toBe('supported');
  });

  it("returns 'unsupported' when capabilities report no prf", async () => {
    installWindow({ getClientCapabilities: () => Promise.resolve({ 'extension:prf': false }) });
    installNavigator({});
    expect(await detectPRFSupport()).toBe('unsupported');
  });

  it("returns 'unknown' when capabilities cannot be queried", async () => {
    installWindow(); // no getClientCapabilities
    installNavigator({});
    expect(await detectPRFSupport()).toBe('unknown');
  });

  it("returns 'unsupported' when WebAuthn is absent", async () => {
    (global as unknown as { window: unknown }).window = { location: { origin: ORIGIN } };
    expect(await detectPRFSupport()).toBe('unsupported');
  });

  it('isPRFSupported is false only when known-unsupported (optimistic on unknown)', async () => {
    installWindow(); // unknown
    installNavigator({});
    expect(await isPRFSupported()).toBe(true);
    installWindow({ getClientCapabilities: () => Promise.resolve({ 'extension:prf': false }) });
    expect(await isPRFSupported()).toBe(false);
  });
});

describe('error translation', () => {
  beforeEach(() => {
    installWindow();
  });

  function rejectWith(name: string) {
    return vi.fn(() => Promise.reject(Object.assign(new Error('low-level DOMException'), { name })));
  }

  it('registerCredentialWithPRF maps NotAllowedError to an actionable message', async () => {
    installNavigator({ create: rejectWith('NotAllowedError') as unknown as CredentialsContainer['create'] });
    await expect(
      registerCredentialWithPRF({ rpName: 'TrustVault', rpId: 'localhost', userId: 'u', userName: 'n', userDisplayName: 'd' }),
    ).rejects.toThrow(/cancelled|HTTPS/i);
  });

  it('registerCredentialWithPRF maps NotSupportedError', async () => {
    installNavigator({ create: rejectWith('NotSupportedError') as unknown as CredentialsContainer['create'] });
    await expect(
      registerCredentialWithPRF({ rpName: 'TrustVault', rpId: 'localhost', userId: 'u', userName: 'n', userDisplayName: 'd' }),
    ).rejects.toThrow(/does not support/i);
  });

  it('registerCredentialWithPRF maps InvalidStateError', async () => {
    installNavigator({ create: rejectWith('InvalidStateError') as unknown as CredentialsContainer['create'] });
    await expect(
      registerCredentialWithPRF({ rpName: 'TrustVault', rpId: 'localhost', userId: 'u', userName: 'n', userDisplayName: 'd' }),
    ).rejects.toThrow(/already registered/i);
  });

  it('getPRFOutput maps NotAllowedError (cancel/timeout)', async () => {
    installNavigator({ get: rejectWith('NotAllowedError') as unknown as CredentialsContainer['get'] });
    const credentialId = encodeUint8ArrayToBase64Url(new Uint8Array([1, 2, 3, 4]));
    await expect(getPRFOutput(credentialId, new Uint8Array(32), 'localhost', 5)).rejects.toThrow(/cancelled|timed out/i);
  });
});
