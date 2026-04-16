/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_SESSION_TIMEOUT_MINUTES: string;
  readonly VITE_CLIPBOARD_CLEAR_SECONDS: string;
  readonly VITE_WEBAUTHN_RP_NAME: string;
  readonly VITE_WEBAUTHN_RP_ID: string;
  readonly VITE_API_URL?: string;
  readonly VITE_ENABLE_BIOMETRIC: string;
  readonly VITE_ENABLE_EXPORT: string;
  readonly VITE_ENABLE_IMPORT: string;
  readonly VITE_DEV_TOOLS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
