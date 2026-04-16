#!/bin/bash

# TrustVault PWA - Vercel Deployment Fix Script
# This script automates the deployment configuration update

set -e

echo "🔧 TrustVault PWA - Vercel Deployment Fix"
echo "=========================================="
echo ""

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not in a git repository"
    echo "Please run this script from your TrustVault-PWA repository root"
    exit 1
fi

# Check if this is the TrustVault-PWA repository
if ! git remote -v | grep -q "TrustVault-PWA"; then
    echo "⚠️  Warning: This doesn't appear to be the TrustVault-PWA repository"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "📋 Step 1: Backing up existing files..."
if [ -f "vercel.json" ]; then
    cp vercel.json vercel.json.backup
    echo "   ✓ Backed up vercel.json → vercel.json.backup"
fi
if [ -f "vite.config.ts" ]; then
    cp vite.config.ts vite.config.ts.backup
    echo "   ✓ Backed up vite.config.ts → vite.config.ts.backup"
fi

echo ""
echo "📝 Step 2: Creating vercel.json..."
cat > vercel.json << 'EOL'
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=0, must-revalidate"
        },
        {
          "key": "Service-Worker-Allowed",
          "value": "/"
        }
      ]
    },
    {
      "source": "/(.*).js",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*).css",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
EOL
echo "   ✓ Created vercel.json"

echo ""
echo "🔍 Step 3: Checking vite.config.ts..."
if grep -q "base:.*'/TrustVault-PWA/'" vite.config.ts 2>/dev/null; then
    echo "   ⚠️  Found GitHub Pages base path"
    echo "   Updating to Vercel-compatible configuration..."
    
    # Create a backup
    cp vite.config.ts vite.config.ts.pre-fix
    
    # Update the base path
    sed -i.bak "s|base: '/TrustVault-PWA/'|base: '/'|g" vite.config.ts
    rm vite.config.ts.bak
    
    echo "   ✓ Updated vite.config.ts (base: '/' for Vercel)"
else
    echo "   ✓ vite.config.ts appears correct"
fi

echo ""
echo "📦 Step 4: Git status..."
git status --short

echo ""
echo "🚀 Step 5: Ready to commit and push"
echo ""
read -p "Commit and push changes? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git add vercel.json vite.config.ts
    git commit -m "fix: Configure for Vercel deployment with correct base path

- Add vercel.json for SPA routing and security headers
- Update vite.config.ts base path from '/TrustVault-PWA/' to '/'
- Configure asset caching and service worker headers
- Implement OWASP security best practices"
    
    echo ""
    echo "📤 Pushing to GitHub..."
    git push origin main
    
    echo ""
    echo "✅ DEPLOYMENT FIX COMPLETE!"
    echo ""
    echo "Vercel will automatically deploy the changes."
    echo "Visit https://trust-vault-pwa.vercel.app in 1-2 minutes"
    echo ""
    echo "Post-deployment checklist:"
    echo "  □ Check console for errors (should be clean)"
    echo "  □ Verify PWA is installable"
    echo "  □ Test offline functionality"
    echo "  □ Run Lighthouse audit"
else
    echo ""
    echo "⏸️  Changes prepared but not committed"
    echo "Review the files and commit manually when ready:"
    echo ""
    echo "  git add vercel.json vite.config.ts"
    echo "  git commit -m 'fix: Configure for Vercel deployment'"
    echo "  git push origin main"
fi

echo ""
echo "📚 For more details, see DEPLOYMENT_GUIDE.md"
