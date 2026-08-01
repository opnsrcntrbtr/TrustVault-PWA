# Biometric Authentication Setup Guide

## Overview
TrustVault supports biometric authentication using WebAuthn/FIDO2 standard. This allows you to unlock your vault using:

- **Touch ID** (macOS)
- **Face ID** (iOS/iPadOS)  
- **Windows Hello** (Windows)
- **Android Biometric** (Android)
- **Hardware Security Keys** (YubiKey, Titan Key)

## Requirements

### For Development/Testing
**CRITICAL:** WebAuthn requires HTTPS or `localhost` to work.

#### Option 1: Use HTTPS (Recommended)
```bash
npm run dev:https
```
Then access: `https://localhost:3000`

#### Option 2: Use localhost HTTP
```bash
npm run dev
```
Then access: `http://localhost:3000` (NOT `http://127.0.0.1:3000`)

### Browser Support
- ✅ Chrome 67+ (macOS, Windows, Android)
- ✅ Safari 13+ (macOS, iOS)
- ✅ Firefox 60+ (macOS, Windows)
- ✅ Edge 18+ (Windows)

## Setup Instructions

### 1. Create Account & Login
- Sign up with email and master password
- Log in with your master password

### 2. Navigate to Settings
- Click your profile/avatar → **Settings**
- Scroll to **Biometric Authentication** section

### 3. Register Your Device
- Click **"Manage Biometric Devices"**
- Click **"Register New Device"**
- Follow your device's biometric prompt:
  - **Mac:** Touch ID sensor or watch
  - **iPhone/iPad:** Face ID or Touch ID
  - **Windows:** Windows Hello (face/fingerprint/PIN)
  - **Android:** Fingerprint or face unlock

### 4. Verify Registration
- Device appears in "Registered Devices" list
- Shows device name, registration date, last used

### 5. Test Biometric Login
- Sign out
- On login page, click **Biometric Login** button (fingerprint icon)
- Complete biometric prompt
- Vault unlocks without typing password

## Troubleshooting

### "NotAllowedError: The operation either timed out or was not allowed"

**Cause:** Not using HTTPS or proper localhost configuration

**Solution:**
1. Stop dev server (`Ctrl+C`)
2. Run `npm run dev:https`
3. Access `https://localhost:3000` (accept self-signed certificate warning)
4. Try registering again

### "Biometric authentication is not available on this device"

**Cause:** Device doesn't support platform authenticator

**Solution:**
- Verify your device has biometric hardware (Touch ID, Face ID, fingerprint reader)
- Enable biometric unlock in system settings
- Try a hardware security key (YubiKey) instead

### "The script has an unsupported MIME type ('text/html')"

**Cause:** Dev server error or build cache issue

**Solution:**
1. Clear browser cache
2. Hard refresh (`Cmd+Shift+R` or `Ctrl+Shift+R`)
3. Restart dev server
4. Clear `node_modules/.vite` cache

### "This biometric credential is already registered"

**Cause:** Trying to register the same device twice

**Solution:**
- Each physical device can only be registered once
- Remove the existing credential first, then re-register
- Or use a different device

### Registration prompt doesn't appear

**Cause:** Browser blocked the WebAuthn prompt

**Solution:**
- Check browser console for errors
- Ensure site permissions allow biometric access
- Try different browser
- Verify HTTPS or localhost URL

## Security Notes

### Master Password Still Required
- Biometric is for **convenience**, not primary security
- Master password still needed for:
  - Initial account setup
  - Changing settings
  - Exporting vault
  - Account recovery

### Device-Specific Credentials
- Each device creates a unique cryptographic key pair
- Private key never leaves your device
- Public key stored in TrustVault database
- Credentials are NOT synced between devices

### Multiple Devices
- You can register multiple devices (laptop, phone, tablet)
- Each shows in "Registered Devices" with:
  - Device name
  - Registration date
  - Last used timestamp

### Counter Replay Protection
- Each authentication increments a counter
- Prevents cloned authenticators
- If counter doesn't increase, authentication fails

### Removing Devices
- Click **trash icon** next to device in "Registered Devices"
- Immediately revokes that device's access
- Device can be re-registered later

## Hardware Security Keys

### Supported Keys
- YubiKey 5 Series (NFC, USB-A, USB-C)
- YubiKey Bio (fingerprint)
- Google Titan Security Key
- Feitian ePass FIDO keys
- Any FIDO2/WebAuthn compatible key

### Registration
1. Click "Register New Device"
2. **Insert key** when prompted
3. **Touch gold disk** on YubiKey (or button on other keys)
4. Device name shows as "Biometric Device" (rename recommended)

### Usage
- Biometric login → Insert key → Touch button
- Works across all devices (cross-platform)
- No batteries needed
- Extremely secure (FIPS 140-2 Level 2 on YubiKey 5 FIPS)

## Supported Platforms

| Platform | Authenticator Type | Supported |
|----------|-------------------|-----------|
| macOS (Touch ID) | Platform | ✅ |
| macOS (Apple Watch) | Platform | ✅ |
| iOS (Face ID) | Platform | ✅ |
| iOS (Touch ID) | Platform | ✅ |
| iPadOS (Face ID/Touch ID) | Platform | ✅ |
| Windows (Hello Face) | Platform | ✅ |
| Windows (Hello Fingerprint) | Platform | ✅ |
| Windows (Hello PIN) | Platform | ✅ |
| Android (Fingerprint) | Platform | ✅ |
| Android (Face Unlock) | Platform | ✅ |
| YubiKey (USB/NFC) | Cross-platform | ✅ |
| Titan Key | Cross-platform | ✅ |
| Feitian ePass | Cross-platform | ✅ |

## Privacy Considerations

### What Data is Stored?
- **Public key** (base64 encoded)
- **Credential ID** (random identifier)
- **Counter** (for replay protection)
- **Device name** (user-provided or auto-detected)
- **Timestamps** (created, last used)

### What is NOT Stored?
- ❌ Biometric data (fingerprints, face scans)
- ❌ Private keys (stays on device)
- ❌ Master password (only scrypt hash stored)
- ❌ Vault keys in plaintext

### Origin Verification
- WebAuthn verifies domain origin
- Prevents phishing attacks
- Credential only works on registered domain
- TrustVault checks `window.location.hostname`

## Advanced Configuration

### Custom rpId (Production)
Edit `src/data/repositories/UserRepositoryImpl.ts`:
```typescript
const rpId = 'yourdomain.com'; // Must match actual domain
```

### Timeout Settings
Edit `src/core/auth/webauthn.ts`:
```typescript
timeout: 60000, // 60 seconds (adjust as needed)
```

### User Verification
Current setting: `'required'` (always asks for biometric)
Options: `'required'`, `'preferred'`, `'discouraged'`

## References

- [WebAuthn Specification](https://www.w3.org/TR/webauthn-2/)
- [FIDO2 Overview](https://fidoalliance.org/fido2/)
- [SimpleWebAuthn Docs](https://simplewebauthn.dev/)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

---

**Last Updated:** October 25, 2025  
**TrustVault Version:** 1.0.0
