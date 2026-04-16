/**
 * TrustVault Autofill - Content Script
 * Detects login forms and provides autofill functionality
 */

// Track detected forms
const detectedForms = new Map();
let autofillOverlay = null;

/**
 * Detect login forms on the page
 */
function detectLoginForms() {
  const forms = document.querySelectorAll('form');
  const loginForms = [];

  forms.forEach((form, index) => {
    const usernameField = findUsernameField(form);
    const passwordField = findPasswordField(form);

    if (usernameField && passwordField) {
      const formId = `form-${index}`;
      loginForms.push({
        id: formId,
        form,
        usernameField,
        passwordField,
      });

      detectedForms.set(formId, {
        form,
        usernameField,
        passwordField,
      });
    }
  });

  return loginForms;
}

/**
 * Find username/email field in form
 */
function findUsernameField(form) {
  // Try autocomplete attribute first
  let field = form.querySelector('[autocomplete="username"]') ||
              form.querySelector('[autocomplete="email"]');

  if (field) return field;

  // Try common input types and names
  const selectors = [
    'input[type="email"]',
    'input[type="text"][name*="user"]',
    'input[type="text"][name*="email"]',
    'input[type="text"][id*="user"]',
    'input[type="text"][id*="email"]',
    'input[type="text"][placeholder*="user" i]',
    'input[type="text"][placeholder*="email" i]',
  ];

  for (const selector of selectors) {
    field = form.querySelector(selector);
    if (field) return field;
  }

  // Fallback: first text input before password
  const passwordField = findPasswordField(form);
  if (passwordField) {
    const inputs = form.querySelectorAll('input[type="text"], input[type="email"]');
    for (const input of inputs) {
      if (input.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING) {
        return input;
      }
    }
  }

  return null;
}

/**
 * Find password field in form
 */
function findPasswordField(form) {
  // Try autocomplete attribute first
  let field = form.querySelector('[autocomplete="current-password"]') ||
              form.querySelector('[autocomplete="password"]');

  if (field) return field;

  // Try password input type
  field = form.querySelector('input[type="password"]');
  if (field) return field;

  return null;
}

/**
 * Create autofill suggestion overlay
 */
function createAutofillOverlay(field, credentials) {
  // Remove existing overlay
  removeAutofillOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'trustvault-autofill-overlay';
  overlay.style.cssText = `
    position: absolute;
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    z-index: 999999;
    max-height: 200px;
    overflow-y: auto;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  // Position below the field
  const rect = field.getBoundingClientRect();
  overlay.style.left = `${rect.left + window.scrollX}px`;
  overlay.style.top = `${rect.bottom + window.scrollY + 2}px`;
  overlay.style.width = `${Math.max(rect.width, 200)}px`;

  // Add credential options
  credentials.forEach((cred, index) => {
    const option = document.createElement('div');
    option.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid #eee;
      display: flex;
      align-items: center;
      gap: 8px;
    `;

    option.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
      <div style="flex: 1;">
        <div style="font-weight: 500; font-size: 14px;">${escapeHtml(cred.title)}</div>
        <div style="font-size: 12px; color: #666;">${escapeHtml(cred.username)}</div>
      </div>
    `;

    option.addEventListener('click', () => {
      fillCredential(cred);
      removeAutofillOverlay();
    });

    option.addEventListener('mouseenter', () => {
      option.style.background = '#f0f0f0';
    });

    option.addEventListener('mouseleave', () => {
      option.style.background = 'white';
    });

    overlay.appendChild(option);
  });

  // Add "Manage in TrustVault" footer
  const footer = document.createElement('div');
  footer.style.cssText = `
    padding: 8px 12px;
    background: #f9f9f9;
    border-top: 1px solid #eee;
    font-size: 12px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
  `;
  footer.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
    </svg>
    Manage in TrustVault
  `;
  footer.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_TRUSTVAULT' });
    removeAutofillOverlay();
  });
  overlay.appendChild(footer);

  document.body.appendChild(overlay);
  autofillOverlay = overlay;

  // Close on click outside
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 0);
}

/**
 * Remove autofill overlay
 */
function removeAutofillOverlay() {
  if (autofillOverlay) {
    autofillOverlay.remove();
    autofillOverlay = null;
    document.removeEventListener('click', handleOutsideClick);
  }
}

/**
 * Handle click outside overlay
 */
function handleOutsideClick(event) {
  if (autofillOverlay && !autofillOverlay.contains(event.target)) {
    removeAutofillOverlay();
  }
}

/**
 * Fill credential into form
 */
function fillCredential(credential) {
  detectedForms.forEach(formData => {
    if (formData.usernameField) {
      formData.usernameField.value = credential.username;
      formData.usernameField.dispatchEvent(new Event('input', { bubbles: true }));
      formData.usernameField.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (formData.passwordField) {
      formData.passwordField.value = credential.password;
      formData.passwordField.dispatchEvent(new Event('input', { bubbles: true }));
      formData.passwordField.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  console.log('Credential filled from TrustVault');
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Request credentials from background script
 */
async function requestCredentials() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: 'GET_CREDENTIALS',
        origin: window.location.origin,
      },
      (response) => {
        if (response && response.success) {
          resolve(response.credentials);
        } else {
          resolve([]);
        }
      }
    );
  });
}

/**
 * Initialize autofill for detected forms
 */
async function initializeAutofill() {
  const forms = detectLoginForms();

  if (forms.length === 0) {
    return;
  }

  console.log(`TrustVault: Detected ${forms.length} login form(s)`);

  // Get credentials for current origin
  const credentials = await requestCredentials();

  if (credentials.length === 0) {
    console.log('TrustVault: No credentials found for this site');
    return;
  }

  console.log(`TrustVault: Found ${credentials.length} matching credential(s)`);

  // Add focus listeners to username fields
  forms.forEach(formData => {
    if (formData.usernameField) {
      formData.usernameField.addEventListener('focus', () => {
        createAutofillOverlay(formData.usernameField, credentials);
      });
    }
  });
}

/**
 * Watch for dynamically added forms
 */
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    if (mutation.addedNodes.length > 0) {
      initializeAutofill();
      break;
    }
  }
});

/**
 * Start observing
 */
function startObserving() {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Initialize on page load
 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeAutofill();
    startObserving();
  });
} else {
  initializeAutofill();
  startObserving();
}

console.log('TrustVault Autofill content script loaded');
