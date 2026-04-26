/**
 * TrustVault Autofill - On-demand Content Script
 * Receives credentials from the background bridge and renders an explicit
 * user-clicked fill menu. Secrets are kept only in this page context.
 */

const detectedForms = new Map();
let autofillOverlay = null;

function detectLoginForms() {
  detectedForms.clear();
  const forms = Array.from(document.querySelectorAll('form'));

  forms.forEach((form, index) => {
    const usernameField = findUsernameField(form);
    const passwordField = findPasswordField(form);

    if (usernameField && passwordField) {
      detectedForms.set(`form-${index}`, {
        form,
        usernameField,
        passwordField,
      });
    }
  });

  return Array.from(detectedForms.values());
}

function findUsernameField(form) {
  const selectors = [
    '[autocomplete="username"]',
    '[autocomplete="email"]',
    'input[type="email"]',
    'input[type="text"][name*="user" i]',
    'input[type="text"][name*="email" i]',
    'input[type="text"][id*="user" i]',
    'input[type="text"][id*="email" i]',
    'input[type="text"][placeholder*="user" i]',
    'input[type="text"][placeholder*="email" i]',
  ];

  for (const selector of selectors) {
    const field = form.querySelector(selector);
    if (field) return field;
  }

  const passwordField = findPasswordField(form);
  if (!passwordField) return null;

  const inputs = Array.from(form.querySelectorAll('input[type="text"], input[type="email"]'));
  return inputs.find((input) =>
    input.compareDocumentPosition(passwordField) & Node.DOCUMENT_POSITION_FOLLOWING
  ) || null;
}

function findPasswordField(form) {
  return form.querySelector('[autocomplete="current-password"]') ||
    form.querySelector('[autocomplete="password"]') ||
    form.querySelector('input[type="password"]');
}

function createTextNodeElement(tagName, text, className) {
  const element = document.createElement(tagName);
  element.textContent = text;
  if (className) {
    element.className = className;
  }
  return element;
}

function createAutofillOverlay(field, credentials) {
  removeAutofillOverlay();

  const overlay = document.createElement('div');
  overlay.id = 'trustvault-autofill-overlay';
  overlay.style.cssText = [
    'position:absolute',
    'background:white',
    'border:1px solid #ccc',
    'border-radius:4px',
    'box-shadow:0 2px 8px rgba(0,0,0,0.15)',
    'z-index:999999',
    'max-height:240px',
    'overflow-y:auto',
    'font-family:system-ui,-apple-system,sans-serif',
  ].join(';');

  const rect = field.getBoundingClientRect();
  overlay.style.left = `${rect.left + window.scrollX}px`;
  overlay.style.top = `${rect.bottom + window.scrollY + 2}px`;
  overlay.style.width = `${Math.max(rect.width, 240)}px`;

  if (credentials.length === 0) {
    const empty = createTextNodeElement('div', 'No matching TrustVault credentials', '');
    empty.style.cssText = 'padding:10px 12px;font-size:13px;color:#666';
    overlay.appendChild(empty);
  }

  credentials.forEach((credential) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.style.cssText = [
      'width:100%',
      'padding:10px 12px',
      'border:0',
      'border-bottom:1px solid #eee',
      'background:white',
      'display:flex',
      'align-items:center',
      'gap:8px',
      'cursor:pointer',
      'text-align:left',
    ].join(';');

    const text = document.createElement('div');
    text.style.cssText = 'display:flex;flex-direction:column;min-width:0';
    const title = createTextNodeElement('span', credential.title || 'Untitled', '');
    title.style.cssText = 'font-weight:600;font-size:14px;color:#222';
    const username = createTextNodeElement('span', credential.username || '', '');
    username.style.cssText = 'font-size:12px;color:#666;overflow:hidden;text-overflow:ellipsis';
    text.append(title, username);
    option.appendChild(text);

    option.addEventListener('click', () => {
      fillCredential(credential);
      removeAutofillOverlay();
      scrubCredential(credential);
    });

    overlay.appendChild(option);
  });

  document.body.appendChild(overlay);
  autofillOverlay = overlay;
  setTimeout(() => document.addEventListener('click', handleOutsideClick), 0);
}

function removeAutofillOverlay() {
  if (autofillOverlay) {
    autofillOverlay.remove();
    autofillOverlay = null;
    document.removeEventListener('click', handleOutsideClick);
  }
}

function handleOutsideClick(event) {
  if (autofillOverlay && !autofillOverlay.contains(event.target)) {
    removeAutofillOverlay();
  }
}

function fillCredential(credential) {
  for (const formData of detectedForms.values()) {
    formData.usernameField.value = credential.username || '';
    formData.usernameField.dispatchEvent(new Event('input', { bubbles: true }));
    formData.usernameField.dispatchEvent(new Event('change', { bubbles: true }));

    formData.passwordField.value = credential.password || '';
    formData.passwordField.dispatchEvent(new Event('input', { bubbles: true }));
    formData.passwordField.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function scrubCredential(credential) {
  credential.password = '';
}

function handleCredentialsAvailable(message) {
  detectLoginForms();
  const firstForm = detectedForms.values().next().value;
  if (!firstForm) return;
  createAutofillOverlay(firstForm.usernameField, message.credentials || []);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'TRUSTVAULT_REQUEST_STARTED') {
    detectLoginForms();
    return false;
  }

  if (message.type === 'TRUSTVAULT_CREDENTIALS_AVAILABLE') {
    handleCredentialsAvailable(message);
    return false;
  }

  return false;
});

detectLoginForms();
