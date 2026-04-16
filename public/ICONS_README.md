# TrustVault PWA Icons

## Design

The TrustVault icon features a professional vault shield design with "TV" initials:

- **Shield Shape**: Classic vault shield representing security and protection
- **Color Scheme**:
  - Background: Dark navy (#1a1a2e)
  - Border/Text: Teal accent (#16c79a)
  - Stroke: Deep blue accent (#0f3460)
- **Typography**: Bold "TV" initials in the center
- **Security Element**: Keyhole detail at the bottom of the shield
- **Design Philosophy**: Professional, modern, security-focused

## Icon Specifications

### Standard Icons (icon-template.svg)
- Full shield design with border
- Used for regular display contexts
- Sizes: 32x32 (favicon), 180x180 (Apple), 192x192, 512x512

### Maskable Icons (icon-maskable-template.svg)
- Scaled-down version fitting within safe zone
- 40% padding from edges (per PWA spec)
- Ensures icon isn't clipped on any platform
- Used for adaptive icons on Android
- Sizes: 192x192, 512x512

## Generated Files

```
public/
├── icon-template.svg              # Source SVG for standard icons
├── icon-maskable-template.svg     # Source SVG for maskable icons
├── favicon.ico                    # 32x32 ICO format
├── favicon-32x32.png              # 32x32 PNG (for ICO generation)
├── apple-touch-icon.png           # 180x180 for iOS
├── pwa-192x192.png                # 192x192 standard
├── pwa-512x512.png                # 512x512 standard
├── pwa-maskable-192x192.png       # 192x192 maskable
└── pwa-maskable-512x512.png       # 512x512 maskable
```

## Regenerating Icons

If you need to modify the icon design:

### 1. Edit SVG Templates
Edit either:
- `public/icon-template.svg` (for standard icons)
- `public/icon-maskable-template.svg` (for maskable icons)

### 2. Generate PNGs
Run the generation script:
```bash
npm run pwa:icons
```

This will automatically generate all required PNG sizes.

### 3. Rebuild & Deploy
```bash
npm run build
# Then deploy to Vercel
```

## Icon Requirements (PWA Compliance)

### Required Sizes
- ✅ 32x32 (favicon.ico)
- ✅ 180x180 (apple-touch-icon.png)
- ✅ 192x192 (pwa-192x192.png)
- ✅ 512x512 (pwa-512x512.png)
- ✅ 192x192 maskable (pwa-maskable-192x192.png)
- ✅ 512x512 maskable (pwa-maskable-512x512.png)

### Maskable Icon Guidelines
- Content must stay within 40% safe zone from edges
- Prevents clipping on platforms with rounded/shaped icons
- Test at https://maskable.app/editor

### Platform-Specific Behavior
- **iOS**: Uses apple-touch-icon.png (180x180)
- **Android**: Uses 192x192 or 512x512, prefers maskable
- **Desktop**: Uses favicon.ico (32x32)
- **PWA Install**: Uses largest available icon (512x512)

## Testing Icons

### Local Testing
1. Run preview server: `npm run preview`
2. Open http://localhost:4173
3. Check browser tab for favicon
4. Install PWA and check app icon
5. View manifest: http://localhost:4173/manifest.webmanifest

### Production Testing
After deploying to Vercel:
1. Visit https://trust-vault-pwa.vercel.app
2. Install PWA on multiple devices:
   - iOS (iPhone/iPad)
   - Android
   - Windows
   - macOS
3. Verify icon appears correctly on home screen/app drawer

### PWA Audit
Run Lighthouse audit to verify icon compliance:
```bash
npm run lighthouse
```

Check for:
- "Manifest has a maskable icon" ✅
- "Web app manifest meets the installability requirements" ✅

## Icon Troubleshooting

### Icon Not Updating After Changes
1. Clear browser cache (Cmd+Shift+R / Ctrl+Shift+R)
2. Uninstall and reinstall PWA
3. Check service worker updated: DevTools → Application → Service Workers
4. Verify files in dist/ folder after build

### Maskable Icon Clipped
- Ensure content is within 40% safe zone
- Test at https://maskable.app/editor
- Increase padding in icon-maskable-template.svg

### Icon Looks Blurry
- Verify PNG generation used correct dimensions
- Re-run `npm run pwa:icons`
- Check source SVG has sufficient detail

## Color Customization

To change colors, edit the SVG templates:

```svg
<!-- Background -->
<circle fill="#1a1a2e" />

<!-- Border/Accent -->
<path stroke="#16c79a" />

<!-- Text -->
<text fill="#16c79a">TV</text>
```

**Brand Colors:**
- Primary Dark: #1a1a2e
- Accent Teal: #16c79a
- Deep Blue: #0f3460

## Dependencies

Icon generation requires:
- `sharp` - High-performance image processing
- `png-to-ico` - PNG to ICO conversion

These are installed as devDependencies automatically.

## Version History

- **v1.0.0** (2025-11-09): Initial vault shield icon with TV initials
  - Replaced green fill icon with bordered shield design
  - Added professional security-focused aesthetic
  - Implemented proper maskable icon support
  - Full PWA compliance across all platforms

---

**Last Updated**: 2025-11-09
**Created By**: Claude Code (Anthropic)
**License**: Proprietary (TrustVault PWA)
