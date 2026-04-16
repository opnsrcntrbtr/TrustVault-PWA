# Content Security Policy (CSP) Troubleshooting

## Overview

TrustVault PWA implements strict Content Security Policy headers for security. This document explains common CSP errors and how to resolve them.

## Common CSP Error: Browser Extensions

### Error Message
```
Refused to load the font 'https://r2cdn.perplexity.ai/fonts/FKGroteskNeue.woff2'
because it violates the following Content Security Policy directive:
"font-src 'self' https://fonts.gstatic.com"
```

### Root Cause
This error is **NOT a bug in TrustVault**. It's caused by browser extensions (like Perplexity) trying to inject content into the page.

### Why This Happens
1. Browser extensions can inject scripts, styles, and fonts into web pages
2. TrustVault's CSP headers block unauthorized third-party content for security
3. The CSP is working correctly by blocking the extension's font injection

### Solutions

#### Option 1: Disable Browser Extensions (Recommended for Testing)
1. Open browser in **Incognito/Private mode** (extensions disabled by default)
2. Visit http://localhost:4173
3. Error should disappear

#### Option 2: Disable Specific Extension
1. Go to browser extensions (chrome://extensions or about:addons)
2. Disable Perplexity extension (or other extensions)
3. Refresh the page

#### Option 3: Allow Extension in CSP (NOT RECOMMENDED)
Only do this for development testing:

**vite.config.ts:**
```typescript
'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://r2cdn.perplexity.ai; font-src 'self' https://fonts.gstatic.com https://r2cdn.perplexity.ai; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:;"
```

**⚠️ WARNING:** Never add third-party domains to production CSP headers.

## Current CSP Configuration

### Development Server (npm run dev)
Located in `vite.config.ts` → `server.headers`:

```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com
img-src 'self' data: blob:
connect-src 'self'
worker-src 'self' blob:
```

### Preview Server (npm run preview)
Located in `vite.config.ts` → `preview.headers`:

Same as development server configuration.

### Production (Vercel)
Located in `vercel.json` → `headers`:

Same CSP policy applies to all routes.

## Allowed Sources

### Fonts
- ✅ `'self'` - Fonts served from TrustVault domain
- ✅ `https://fonts.gstatic.com` - Google Fonts CDN
- ❌ `https://r2cdn.perplexity.ai` - Blocked (browser extension)
- ❌ Any other third-party font CDN

### Scripts
- ✅ `'self'` - Scripts from TrustVault
- ✅ `'unsafe-inline'` - Inline scripts (required for React)
- ✅ `'unsafe-eval'` - Dynamic evaluation (required for dev)
- ❌ External script CDNs

### Styles
- ✅ `'self'` - Stylesheets from TrustVault
- ✅ `'unsafe-inline'` - Inline styles (required for MUI)
- ✅ `https://fonts.googleapis.com` - Google Fonts CSS
- ❌ Other external stylesheets

### Images
- ✅ `'self'` - Images from TrustVault
- ✅ `data:` - Data URIs (base64 images)
- ✅ `blob:` - Blob URLs
- ❌ External image CDNs

## Testing CSP Compliance

### 1. Check Headers in Browser
**Chrome DevTools:**
1. Open DevTools (F12)
2. Network tab → Select any request
3. Headers tab → Look for "Content-Security-Policy"

### 2. Verify No CSP Violations
**Console:**
1. Open DevTools Console
2. Should see NO red CSP errors (except extension-related)
3. Extension errors are safe to ignore

### 3. Test in Clean Environment
```bash
# Chrome Incognito
open -na "Google Chrome" --args --incognito http://localhost:4173

# Firefox Private Window
open -na "Firefox" --args -private-window http://localhost:4173
```

## Known Extension Conflicts

Extensions that commonly trigger CSP warnings:
- ✋ **Perplexity** - Injects fonts from r2cdn.perplexity.ai
- ✋ **Grammarly** - Injects scripts and styles
- ✋ **LastPass/1Password** - Injects password manager UI
- ✋ **AdBlock/uBlock** - Injects blocking scripts
- ✋ **React DevTools** - Injects debugging scripts
- ✋ **Redux DevTools** - Injects debugging scripts

These are **SAFE TO IGNORE** in development. The CSP is correctly blocking them.

## Modifying CSP Headers

### For Development Only
Edit `vite.config.ts`:

```typescript
server: {
  headers: {
    'Content-Security-Policy': "your-csp-here"
  }
},
preview: {
  headers: {
    'Content-Security-Policy': "your-csp-here"
  }
}
```

### For Production (Vercel)
Edit `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "your-csp-here"
        }
      ]
    }
  ]
}
```

## CSP Directives Reference

- `default-src` - Fallback for all resource types
- `script-src` - JavaScript sources
- `style-src` - CSS stylesheets
- `font-src` - Web fonts (@font-face)
- `img-src` - Images and favicons
- `connect-src` - XMLHttpRequest, fetch, WebSocket
- `worker-src` - Service workers and web workers
- `frame-src` - Embedded frames (iframes)
- `object-src` - <object>, <embed>, <applet>

## Security Best Practices

### ✅ DO:
- Use `'self'` for same-origin resources
- Whitelist specific trusted CDNs (fonts.gstatic.com)
- Test in incognito mode without extensions
- Keep CSP as strict as possible
- Update CSP when adding new external resources

### ❌ DON'T:
- Use `'unsafe-inline'` in production (if possible)
- Use `'unsafe-eval'` in production (if possible)
- Add random third-party domains to fix extension errors
- Use `*` wildcards for sources
- Disable CSP entirely

## Debugging CSP Violations

### 1. Identify the Source
**Console Error Format:**
```
Refused to load [TYPE] '[URL]'
because it violates the following CSP directive: "[DIRECTIVE]"
```

- **TYPE**: font, script, style, image, etc.
- **URL**: The blocked resource
- **DIRECTIVE**: Which CSP rule blocked it

### 2. Determine if Legitimate
**Questions to ask:**
- Is this resource loaded by TrustVault code?
  - YES → Add to CSP whitelist
  - NO → It's a browser extension (ignore)
- Is this resource necessary for functionality?
  - YES → Add to CSP whitelist
  - NO → Remove the code loading it

### 3. Fix the Issue
**If legitimate resource:**
```typescript
// Add the domain to appropriate directive
'font-src': "'self' https://fonts.gstatic.com https://new-cdn.com"
```

**If browser extension:**
- Ignore the error (CSP is working correctly)
- Or test in incognito mode

## Production Deployment

Before deploying, verify:

1. ✅ CSP headers in `vercel.json` match `vite.config.ts`
2. ✅ No CSP errors in incognito mode
3. ✅ All legitimate resources whitelisted
4. ✅ No `'unsafe-*'` directives (if possible)
5. ✅ Service worker can load (worker-src includes 'self' and blob:)

## Testing Checklist

- [ ] Load app in Chrome incognito: http://localhost:4173
- [ ] Load app in Firefox private: http://localhost:4173
- [ ] Check console for CSP violations (should be none)
- [ ] Install PWA and verify it works
- [ ] Test service worker update mechanism
- [ ] Verify icons display correctly
- [ ] Check biometric authentication works

## Support

If you encounter CSP errors that are NOT from extensions:

1. Check if the resource is loaded by TrustVault code
2. Review the code to see why it's loading
3. Determine if it's necessary
4. Add to CSP whitelist if legitimate
5. Otherwise, remove the code loading it

---

**Last Updated**: 2025-11-09
**Applies To**: TrustVault PWA v1.0.0+
