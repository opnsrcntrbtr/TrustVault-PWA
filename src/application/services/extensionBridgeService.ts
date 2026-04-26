import { listDecryptedCredentials } from './credentialService';

interface ExtensionBridgeOptions {
  isAuthenticated: boolean;
  isLocked: boolean;
  vaultKey: CryptoKey | null;
}

interface ChromeRuntimeBridge {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback?: (response: unknown) => void
  ) => void;
}

interface ChromeBridgeGlobal {
  runtime?: ChromeRuntimeBridge | undefined;
}

interface BridgeCredential {
  title: string;
  username: string;
  password: string;
  url?: string | undefined;
}

export async function handleExtensionCredentialBridge({
  isAuthenticated,
  isLocked,
  vaultKey,
}: ExtensionBridgeOptions): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const nonce = params.get('extensionRequest');
  const origin = params.get('origin');
  const extensionId = params.get('extensionId');

  if (!nonce || !origin || !extensionId) {
    return;
  }

  if (!isAuthenticated || isLocked || !vaultKey) {
    return;
  }

  const chromeBridge = (globalThis as { chrome?: ChromeBridgeGlobal | undefined }).chrome;
  if (!chromeBridge?.runtime?.sendMessage) {
    return;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    throw new Error('Invalid extension fill origin');
  }

  const approved = window.confirm(
    `Allow TrustVault to send matching credentials for ${normalizedOrigin} to the browser extension?`
  );

  if (!approved) {
    clearBridgeParams();
    return;
  }

  const credentials = await listDecryptedCredentials(vaultKey);
  const scopedCredentials: BridgeCredential[] = credentials
    .filter((credential) => normalizeOrigin(credential.url) === normalizedOrigin)
    .map((credential) => ({
      title: credential.title,
      username: credential.username,
      password: credential.password,
      url: credential.url,
    }));

  chromeBridge.runtime.sendMessage(
    extensionId,
    {
      type: 'TRUSTVAULT_CREDENTIAL_RESPONSE',
      nonce,
      credentials: scopedCredentials,
    },
    () => undefined
  );

  clearBridgeParams();
}

function normalizeOrigin(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function clearBridgeParams(): void {
  const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.hash}`;
  window.history.replaceState({}, document.title, cleanUrl);
}
