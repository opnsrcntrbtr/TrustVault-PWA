// Public API — Safe for external use
export {
  findMatchingCredentials,
  calculateMatchConfidence,
  getCredentialWithUI,
  getCredentialFromBrowser,
  batchStoreCredentials,
  extractOrigin,
  validateDomain,
} from './credentialManagementService';

export {
  loadAutofillSettings,
  saveAutofillSettings,
  isAutofillEnabledForOrigin,
  includeOrigin,
  excludeOrigin,
  toggleAutofill,
} from './autofillSettings';

export {
  sendMessageToExtension,
  receiveMessageFromExtension,
  registerExtensionBridge,
} from './extensionBridge';

// Types — Safe for external use
export type {
  AutofillSettings,
  AutofillMatch,
  BrowserCredential,
  AutofillSettingsPageProps,
} from './types';
