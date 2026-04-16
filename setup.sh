#!/bin/bash

# TrustVault PWA - Setup Script
# Automates initial project setup

set -e  # Exit on error

echo "🔒 TrustVault PWA - Setup Script"
echo "================================"
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Error: Node.js 20.0.0 or higher is required"
    echo "   Current version: $(node -v)"
    echo "   Please upgrade: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Check npm version
echo "📦 Checking npm version..."
NPM_VERSION=$(npm -v | cut -d'.' -f1)
if [ "$NPM_VERSION" -lt 10 ]; then
    echo "❌ Error: npm 10.0.0 or higher is required"
    echo "   Current version: $(npm -v)"
    echo "   Please upgrade: npm install -g npm@latest"
    exit 1
fi
echo "✅ npm version: $(npm -v)"

echo ""
echo "📥 Installing dependencies..."
npm install

echo ""
echo "⚙️  Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env file from .env.example"
else
    echo "ℹ️  .env file already exists"
fi

echo ""
echo "🔍 Running type check..."
npm run type-check || echo "⚠️  Type check found issues (expected before first build)"

echo ""
echo "🎨 Checking code formatting..."
npm run format:check || npm run format

echo ""
echo "✅ Setup Complete!"
echo ""
echo "🚀 Next Steps:"
echo "   1. Review the .env file and adjust settings if needed"
echo "   2. Start development server:"
echo "      npm run dev              (HTTP mode)"
echo "      npm run dev:https        (HTTPS mode for WebAuthn)"
echo ""
echo "📚 Documentation:"
echo "   • Quick Start: QUICKSTART.md"
echo "   • README: README.md"
echo "   • Security: SECURITY.md"
echo ""
echo "🔒 Security Note:"
echo "   This app handles sensitive data. Please review"
echo "   SECURITY.md before deployment."
echo ""
echo "Happy secure coding! 🎉"
