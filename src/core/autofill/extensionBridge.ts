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

interface BridgeCredential {
  username: string;
  password: string;
  title: string;
}

function respond(requestId: string, credentials: BridgeCredential[]): void {
  window.postMessage({ type: RESPONSE_TYPE, requestId, credentials }, window.location.origin);
}

async function handleRequest(event: MessageEvent): Promise<void> {
  // Only same-window, same-origin messages - i.e. the extension's
  // isolated-world content script, never a cross-origin page.
  if (event.source !== window || event.origin !== window.location.origin) {
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

  if (!isAutofillEnabledForOrigin(targetOrigin, loadAutofillSettings())) {
    respond(requestId, []);
    return;
  }

  const { vaultKey, user, isLocked } = useAuthStore.getState();
  if (!vaultKey || !user || isLocked) {
    respond(requestId, []);
    return;
  }

  try {
    const credentials = await credentialRepository.findAll(vaultKey, user.id);
    const matches = findMatchingCredentials(credentials, targetOrigin);

    respond(
      requestId,
      matches.map((m) => ({
        username: m.credential.username,
        password: m.credential.password,
        title: m.credential.title,
      }))
    );
  } catch (error) {
    console.error('Extension autofill bridge failed:', error);
    respond(requestId, []);
  }
}

/**
 * Start listening for credential requests from the TrustVault browser
 * extension's vault-bridge content script. Safe to call even if the
 * extension isn't installed - the listener simply never receives a matching
 * message.
 */
export function initExtensionBridge(): void {
  window.addEventListener('message', (event) => {
    void handleRequest(event);
  });
}
