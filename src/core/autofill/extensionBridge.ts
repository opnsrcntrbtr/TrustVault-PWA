/**
 * Extension Autofill Bridge
 *
 * Wires the secure dot-boundary matcher (`findMatchingCredentials` in
 * credentialManagementService.ts) to the TrustVault browser extension's fill
 * path (GAP_ANALYSIS.md Section 17 #4). The extension's vault-bridge content
 * script posts a request here when a content script on another site asks for
 * credentials; this listener answers only if the vault is unlocked and the
 * target origin is autofill-enabled, and only with the matched
 * username/password/title - never persisted by the extension.
 */

import { useAuthStore } from '@/presentation/store/authStore';
import { credentialRepository } from '@/data/repositories/CredentialRepositoryImpl';
import { findMatchingCredentials } from './credentialManagementService';
import { isAutofillEnabledForOrigin, loadAutofillSettings } from './autofillSettings';

const REQUEST_TYPE = 'TRUSTVAULT_EXTENSION_REQUEST_CREDENTIALS';
const RESPONSE_TYPE = 'TRUSTVAULT_EXTENSION_CREDENTIALS_RESPONSE';

let bridgeInitialized = false;

interface BridgeCredential {
  username: string;
  password: string;
  title: string;
}

function respond(requestId: string, credentials: BridgeCredential[]): void {
  // Use '*' targetOrigin so the isolated-world vault-bridge content script
  // can receive the response regardless of jsdom/extension environment quirks.
  // The real security gate is the event.source === window check in handleRequest,
  // not the targetOrigin on the outgoing response.
  window.postMessage({ type: RESPONSE_TYPE, requestId, credentials }, '*');
}

/**
 * Core resolver: given a target origin, return the credentials the extension
 * is allowed to fill there. Returns an empty array if the vault is locked or
 * the origin is not autofill-enabled. Exported for unit testing.
 */
export async function resolveCredentialsForOrigin(targetOrigin: string): Promise<BridgeCredential[]> {
  if (!isAutofillEnabledForOrigin(targetOrigin, loadAutofillSettings())) {
    return [];
  }

  const { vaultKey, user, isLocked } = useAuthStore.getState();
  if (!vaultKey || !user || isLocked) {
    return [];
  }

  try {
    const credentials = await credentialRepository.findAll(vaultKey, user.id);
    const matches = findMatchingCredentials(credentials, targetOrigin);

    return matches.map((m) => ({
      username: m.credential.username,
      password: m.credential.password,
      title: m.credential.title,
    }));
  } catch (error) {
    console.error('Extension autofill bridge failed:', error);
    return [];
  }
}

async function handleRequest(event: MessageEvent): Promise<void> {
  // Only same-window messages - the isolated-world vault-bridge content script
  // shares the same window object, so event.source === window distinguishes it
  // from cross-origin frames.
  if (event.source !== window) {
    return;
  }

  const data = event.data as { type?: unknown; requestId?: unknown; origin?: unknown } | null;
  if (
    !data ||
    data.type !== REQUEST_TYPE ||
    typeof data.requestId !== 'string' ||
    typeof data.origin !== 'string'
  ) {
    return;
  }

  const { requestId, origin: targetOrigin } = data as { requestId: string; origin: string };
  const credentials = await resolveCredentialsForOrigin(targetOrigin);
  respond(requestId, credentials);
}

/**
 * Start listening for credential requests from the TrustVault browser
 * extension's vault-bridge content script. Safe to call even if the
 * extension isn't installed - the listener simply never receives a matching
 * message.
 */
export function initExtensionBridge(): void {
  if (bridgeInitialized) return;
  bridgeInitialized = true;
  window.addEventListener('message', (event) => {
    void handleRequest(event);
  });
}

/** Exposed for tests: reset the idempotency guard. */
export function _resetBridgeForTesting(): void {
  bridgeInitialized = false;
}
