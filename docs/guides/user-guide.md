# TrustVault User Guide

**Version:** 1.0.0
**Last Updated:** 2025-10-25

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Your Account](#creating-your-account)
3. [Understanding Your Dashboard](#understanding-your-dashboard)
4. [Managing Credentials](#managing-credentials)
5. [Password Generator](#password-generator)
6. [Two-Factor Authentication (TOTP)](#two-factor-authentication-totp)
7. [Import & Export](#import--export)
8. [Security Settings](#security-settings)
9. [Biometric Authentication](#biometric-authentication)
10. [Troubleshooting](#troubleshooting)
11. [Security Best Practices](#security-best-practices)

---

## Getting Started

TrustVault is a secure, offline-first password manager that runs entirely in your browser. Your data never leaves your device and is protected by military-grade encryption.

### Installation

#### As a Web App
1. Visit the TrustVault URL in your browser
2. Bookmark for easy access

#### As a Progressive Web App (PWA)
1. Visit TrustVault in Chrome, Edge, or Safari
2. Look for the install prompt or click the install button
3. TrustVault will be added to your home screen/applications

**Benefits of Installing:**
- Offline access to all credentials
- Faster load times
- Native app-like experience
- Quick access shortcuts

### Browser Compatibility

- ✅ Chrome/Edge 90+
- ✅ Safari 14+
- ✅ Firefox 88+
- ❌ Internet Explorer (not supported)

---

## Creating Your Account

### First-Time Setup

1. Navigate to the signup page
2. Enter your email address
3. Create a **strong master password**
4. Confirm your master password
5. Click "Create Account"

### Master Password Guidelines

Your master password is the **only** key to your vault. Choose wisely:

- ✅ Minimum 12 characters
- ✅ Mix of uppercase, lowercase, numbers, symbols
- ✅ Avoid dictionary words
- ✅ Don't reuse from other accounts
- ❌ TrustVault cannot recover your master password if forgotten

**Example Strong Password:**
`Tr0p1c@l-S3nse-9B4nk!`

### What Happens During Signup?

1. Your master password is hashed using Scrypt (N=32768)
2. A unique vault encryption key is generated
3. All data is encrypted locally before storage
4. You're automatically signed in

---

## Understanding Your Dashboard

### Main View

The dashboard displays all your credentials in a card grid:

- **Title** - Name of the account/service
- **Username** - Login identifier
- **Category Badge** - Login, Payment, Identity, etc.
- **Favorite Star** - Quick access for important credentials
- **Last Updated** - Timestamp of last modification

### Navigation

- **Dashboard** - View all credentials
- **Add Credential** (+ button) - Create new entry
- **Settings** - Configure security and preferences
- **Sign Out** - Lock your vault

### Search & Filter

**Search Bar:**
- Real-time search across titles, usernames, and websites
- Case-insensitive
- Debounced for performance

**Filters:**
- Category: All, Login, Payment, Identity, Note
- Favorites: Show only starred credentials
- Tags: Filter by custom tags

**Sort Options:**
- Title A-Z / Z-A
- Recently Updated
- Recently Created
- Favorites First

---

## Managing Credentials

### Adding a New Credential

1. Click the **"Add Credential"** button (+ icon)
2. Fill in the form:
   - **Title*** (required) - e.g., "Gmail Account"
   - **Username** - email or login name
   - **Password*** (required) - or use generator
   - **Website URL** - e.g., https://gmail.com
   - **Notes** - Additional info (encrypted)
   - **Category** - Login/Payment/Identity/Note
   - **Tags** - Custom labels (comma-separated)
   - **Favorite** - Toggle star for quick access
3. Click **"Save"**

### Editing a Credential

1. Click on the credential card
2. Click the **Edit** icon
3. Modify fields as needed
4. Click **"Save Changes"**

### Deleting a Credential

1. Click on the credential card
2. Click the **Delete** icon
3. Confirm deletion (cannot be undone)

### Copying Credentials

**Copy Username:**
- Click the "Copy Username" button
- Copied to clipboard for 30 seconds

**Copy Password:**
- Click the "Copy Password" button
- Copied to clipboard for 30 seconds
- **Auto-clears** after timeout for security

### Categories

| Category | Use Case | Icon |
|----------|----------|------|
| Login | Website/app accounts | 🔑 |
| Payment | Credit cards, bank info | 💳 |
| Identity | SSN, passport, licenses | 👤 |
| Note | Secure notes | 📝 |
| Secure Note | Highly sensitive info | 🔒 |

### Tags

Organize credentials with custom tags:

- Examples: `work`, `personal`, `important`, `2fa-enabled`
- Autocomplete suggests existing tags
- Filter dashboard by tags
- Add multiple tags per credential

---

## Password Generator

### Opening the Generator

1. Navigate to **Add Credential** or **Edit Credential**
2. Click the **"Generate"** button next to the password field
3. Generator dialog opens

### Configuration Options

**Length Slider:**
- Range: 12-32 characters
- Default: 20 characters

**Character Types:**
- ✅ Uppercase (A-Z)
- ✅ Lowercase (a-z)
- ✅ Numbers (0-9)
- ✅ Symbols (!@#$%^&*)
- ⚠️ At least one type must be selected

**Advanced Options:**
- **Exclude Ambiguous Characters** - Removes 0/O, l/I/1 for clarity

### Using Generated Passwords

1. Adjust settings to your preference
2. Click **"Regenerate"** until satisfied
3. View password strength indicator
4. Click **"Copy"** to clipboard (optional)
5. Click **"Use Password"** to fill form field
6. Preferences auto-save for next time

### Password Strength Indicator

- **Very Weak** - Red - < 6 characters or poor complexity
- **Weak** - Orange - 6-11 characters
- **Fair** - Yellow - 12-15 characters
- **Strong** - Green - 16+ characters, good mix
- **Very Strong** - Dark Green - 20+ chars, all types

---

## Two-Factor Authentication (TOTP)

TrustVault supports Time-based One-Time Passwords (TOTP) for services like Google Authenticator.

### Adding TOTP to a Credential

1. Enable 2FA on the target service
2. When shown a QR code, look for "Enter code manually"
3. Copy the secret key (e.g., `JBSWY3DPEHPK3PXP`)
4. In TrustVault, edit the credential
5. Paste the secret into the **"TOTP Secret"** field
6. Save

### Viewing TOTP Codes

- Credential cards with TOTP show a **6-digit code**
- Code refreshes every 30 seconds
- Circular progress indicator shows remaining time
- Format: `000 000` (space for readability)

### Using TOTP Codes

1. Open the service requiring 2FA
2. Find the credential in TrustVault
3. Click **"Copy TOTP Code"**
4. Paste into the 2FA prompt
5. Code valid for 30 seconds

### Supported Services

TrustVault TOTP is compatible with:
- Google Authenticator
- Microsoft Authenticator
- Authy
- Any RFC 6238-compliant service

---

## Import & Export

### Exporting Your Vault

**When to Export:**
- Before major system changes
- Regular backups (monthly recommended)
- Migrating to another device

**How to Export:**

1. Navigate to **Settings**
2. Scroll to **Data Management** section
3. Click **"Export Vault"**
4. Enter a **strong export password** (min 12 chars)
5. Confirm the export password
6. Check the **"I have stored the export password"** box
7. Click **"Export"**
8. Save the `.tvault` file securely

**Security Notes:**
- Export file is **encrypted** with AES-256-GCM
- Export password is **separate** from master password
- Store export password in a safe place (cannot be recovered)
- Filename format: `trustvault-backup-YYYY-MM-DD.tvault`

### Importing a Vault

**Before Importing:**
- Decide: **Replace** all credentials or **Merge** with existing

**How to Import:**

1. Navigate to **Settings**
2. Scroll to **Data Management**
3. Click **"Import Vault"**
4. Select your `.tvault` file
5. Enter the **export password** used during export
6. Choose **Import Mode:**
   - **Merge** - Keep existing, add new, skip duplicates
   - **Replace** - Delete all existing, import new (⚠️ dangerous)
7. Review preview: `X credentials found`
8. Click **"Import"**

**Duplicate Detection:**
- Duplicates matched by: Title + Username
- Options: Skip, Overwrite, Keep Both

**Progress:**
- Shows: `Importing X of Y credentials...`
- Decryption happens in real-time

---

## Security Settings

### Session Timeout (Auto-Lock)

**Purpose:** Automatically lock vault after inactivity

**Configuration:**
1. Settings → Security → Session Timeout
2. Options: 1, 5, 15, 30 minutes, Never
3. Default: 15 minutes

**How It Works:**
- Tracks mouse/keyboard/touch activity
- Resets timer on any interaction
- Locks immediately when tab hidden (optional)
- Clears decrypted data from memory

### Clipboard Auto-Clear

**Purpose:** Prevent password exposure via clipboard

**Configuration:**
1. Settings → Security → Clipboard Auto-Clear
2. Options: 15s, 30s, 60s, 120s, Never
3. Default: 30 seconds

**How It Works:**
- Starts countdown after copying password
- Shows notification: `Clipboard clears in 25s`
- Automatically clears clipboard after timeout
- Cancels if you copy something else

### Change Master Password

**⚠️ Important:** This re-encrypts **all** credentials

**Steps:**
1. Settings → Account → Change Master Password
2. Enter **current** master password
3. Enter **new** master password (min 12 chars)
4. Confirm new master password
5. Read warning about re-encryption
6. Click **"Change Password"**
7. Wait for progress: `Re-encrypting 5 of 23 credentials...`
8. Automatically signed out after completion
9. Sign in with **new** master password

**What Happens:**
1. Current password verified
2. All credentials decrypted with old key
3. New vault key derived from new password
4. All credentials re-encrypted with new key
5. Old key securely erased

---

## Biometric Authentication

TrustVault supports WebAuthn for fingerprint/face recognition signin.

### Enabling Biometric

**Requirements:**
- Device with biometric sensor (Touch ID, Face ID, Windows Hello)
- Supported browser (Chrome, Edge, Safari)

**Setup Steps:**
1. Sign in with master password
2. Navigate to **Settings**
3. Security → Biometric Authentication
4. Toggle **"Enable Biometric"**
5. Follow browser prompt to register biometric
6. Success! Biometric signin now available

### Using Biometric Signin

1. Navigate to signin page
2. Click **"Use Biometric"** button
3. Authenticate via fingerprint/face
4. Automatically signed in (no password entry)

### Disabling Biometric

1. Settings → Security → Biometric Authentication
2. Toggle **"Disable Biometric"**
3. Confirm

**Note:** Master password always available as fallback

---

## Troubleshooting

### Forgot Master Password

**⚠️ Critical:** TrustVault **cannot** recover your master password.

**Options:**
1. Try variations you might have used
2. If you have a vault export, create new account and import
3. Last resort: Create new account (all data lost)

**Prevention:**
- Export vault regularly
- Store export file + password securely offline

### Cannot Sign In

**Symptoms:** "Invalid email or password" error

**Solutions:**
1. Double-check email spelling
2. Ensure Caps Lock is off
3. Try typing password in notepad first (verify)
4. Clear browser cache and reload
5. Try different browser

### Credentials Not Decrypting

**Symptoms:** Password shows as gibberish or encrypted data

**Causes:**
- Session corrupted
- Vault key not loaded

**Solutions:**
1. Sign out completely
2. Clear browser data
3. Sign in again
4. If persists, check browser console for errors

### App Not Loading

**Symptoms:** Stuck on loading spinner

**Solutions:**
1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear browser cache
3. Check browser console for JavaScript errors
4. Try incognito/private mode
5. Update browser to latest version

### Service Worker Issues

**Symptoms:** Updates not applying, offline mode broken

**Solutions:**
1. DevTools → Application → Service Workers
2. Click "Unregister" on old service worker
3. Hard refresh page
4. New service worker will install

### IndexedDB Quota Exceeded

**Symptoms:** Cannot save new credentials

**Solutions:**
1. Browser storage limit reached (rare)
2. Export vault
3. Delete old credentials
4. Clear other browser data
5. Re-import if needed

---

## Security Best Practices

### Master Password

✅ **Do:**
- Use 16+ characters
- Include all character types
- Make it memorable but unique
- Change every 6-12 months
- Use password generator for creation

❌ **Don't:**
- Reuse from other accounts
- Share with anyone
- Store in plain text
- Use personal info (birthdays, names)
- Write down unless stored securely

### Vault Backups

✅ **Do:**
- Export monthly
- Store export file offline (USB drive)
- Test imports periodically
- Use strong export password (different from master)
- Keep multiple backup copies

❌ **Don't:**
- Store in cloud without encryption
- Email to yourself
- Store export password with file
- Forget export password (write down securely)

### Credential Management

✅ **Do:**
- Use unique password per service
- Enable TOTP where available
- Update compromised passwords immediately
- Mark favorites for important accounts
- Review and delete old credentials

❌ **Don't:**
- Reuse passwords across services
- Store credit card CVV (regenerate each time)
- Share credentials via insecure channels
- Leave sensitive credentials unfavorited

### Device Security

✅ **Do:**
- Enable auto-lock (15 min max)
- Enable clipboard auto-clear (30s)
- Sign out on shared devices
- Use biometric on trusted devices
- Keep browser updated

❌ **Don't:**
- Leave vault unlocked unattended
- Disable security features for convenience
- Use on untrusted public computers
- Install TrustVault on malware-infected systems

### Network Security

✅ **Do:**
- Use HTTPS-only sites
- Verify TrustVault URL before signin
- Use VPN on public WiFi
- Keep browser extensions minimal

❌ **Don't:**
- Enter credentials on HTTP sites
- Use on compromised networks
- Trust unknown WiFi hotspots
- Install untrusted browser extensions

### Incident Response

**If You Suspect Compromise:**

1. **Immediately:**
   - Sign out of TrustVault
   - Change master password
   - Export vault for backup

2. **Within 1 Hour:**
   - Change passwords for all critical accounts
   - Enable 2FA on all services
   - Review account activity for breaches

3. **Within 24 Hours:**
   - Scan device for malware
   - Check haveibeenpwned.com
   - Contact services if unauthorized access detected

4. **Within 1 Week:**
   - Change all remaining passwords
   - Review and update security settings
   - Create fresh vault export

---

## Frequently Asked Questions

### Is my data uploaded to the cloud?

No. TrustVault is **offline-first**. All data is stored locally in your browser's IndexedDB. Nothing is transmitted to any server.

### What if I lose my device?

If you have vault exports, you can import into TrustVault on a new device. Without exports, data is unrecoverable.

### Can I use TrustVault on multiple devices?

Yes, but sync is manual:
1. Export from Device A
2. Transfer `.tvault` file securely (USB, encrypted cloud)
3. Import on Device B

### How secure is TrustVault?

- **Encryption:** AES-256-GCM (military-grade)
- **Hashing:** Scrypt (N=32768, memory-hard)
- **Key Derivation:** PBKDF2 (600k iterations)
- **Audited:** OWASP Mobile Top 10 compliant
- **Open Source:** Fully transparent

### Does TrustVault work offline?

Yes! As a PWA, TrustVault works completely offline once installed. No internet required.

### What happens if I forget my master password?

Your data is **unrecoverable**. This is by design - zero-knowledge architecture means TrustVault cannot access your vault. Export backups are your only recovery option.

### Can I export to other password managers?

Currently, TrustVault uses a proprietary encrypted format. Future versions may support CSV export (unencrypted - use with caution).

---

## Support & Resources

- **Documentation:** [CLAUDE.md](./CLAUDE.md)
- **Security Policy:** [SECURITY.md](./SECURITY.md)
- **Deployment Guide:** [DEPLOYMENT.md](./DEPLOYMENT.md)
- **GitHub Issues:** Report bugs and request features

---

**Last Updated:** 2025-10-25
**Version:** 1.0.0
