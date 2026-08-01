# Database Migration Required

## What Happened

The password hashing library has been changed from `argon2-browser` to `scrypt` (from `@noble/hashes`) to resolve CSP and WASM loading issues.

## Why This Change

- **argon2-browser** required WebAssembly which was blocked by Content Security Policy
- Multiple attempts to load the WASM module failed with MIME type errors
- **scrypt** is pure JavaScript, OWASP-recommended, and already in dependencies

## Action Required

The database contains passwords hashed with the old argon2 format. These cannot be verified with the new scrypt implementation.

### Clear the Database

Open the Chrome DevTools Console (F12) and run:

```javascript
window.debugDB.clearAllData()
```

This will clear all users and credentials from IndexedDB.

### Create a New Account

1. Go to http://localhost:3000/signup
2. Enter your email and a password (12+ characters)
3. Click "Create Account"
4. You'll be automatically signed in and redirected to the dashboard

### Sign In

1. Go to http://localhost:3000/signin
2. Enter your email and password
3. Click "Sign In"

## Security Notes

- **scrypt** parameters: N=32768, r=8, p=1, dkLen=32
- These are OWASP-recommended settings for password hashing
- Memory-hard algorithm resistant to GPU attacks
- Hash format: `scrypt$N$r$p$salt$hash`

## Troubleshooting

### "Invalid hash format" Error

This means you're trying to sign in with an account that has an old argon2 hash. Clear the database as shown above.

### "The script has an unsupported MIME type" Error

This is a browser cache issue with the old argon2-loader.js. Steps to fix:

1. Hard refresh the page: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. Clear browser cache: Chrome Settings > Privacy > Clear browsing data > Cached images and files
3. Unregister service worker:
   - Open DevTools > Application tab
   - Click "Service Workers" in the left sidebar
   - Click "Unregister" next to the TrustVault service worker
   - Refresh the page

### Check Available Debug Commands

```javascript
window.debugDB
// Should show: { clearAllData, listUsers, deleteUserByEmail }
```

## Files Removed

- `public/argon2-bundled.min.js` (45KB)
- `public/argon2-loader.js` (884 bytes)
- `public/argon2.wasm` (25KB)

## Files Modified

- `src/core/crypto/password.ts` - Replaced argon2 with scrypt
- `src/data/storage/debugUtils.ts` - Added database management utilities
- `src/main.tsx` - Auto-load debug utils in development
- `index.html` - Removed argon2 script loading

---

**Summary**: Clear the database with `window.debugDB.clearAllData()`, then create a new account at `/signup`.
