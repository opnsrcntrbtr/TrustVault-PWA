# Breach Detection - Have I Been Pwned Integration

## Overview

This document describes the implementation of breach detection using the Have I Been Pwned (HIBP) API to detect if user passwords or emails appear in known data breaches.

## Features Implemented

### 1. HIBP Service Layer (`src/core/breach/`)

#### `breachTypes.ts`
Defines TypeScript interfaces for:
- `BreachData` - Breach information from HIBP API
- `BreachCheckResult` - Result of a breach check
- `StoredBreachResult` - Persistent storage format
- `BreachSeverity` - Severity levels (critical, high, medium, low, safe)
- `BreachCheckOptions` - Configuration for breach checks

#### `hibpService.ts`
Core service implementing:
- **k-anonymity password checking** - Only sends first 5 characters of SHA-1 hash to HIBP
- **Rate limiting** - 1500ms between requests per HIBP guidelines
- **In-memory caching** - 24-hour cache to minimize API calls
- **Exponential backoff** - Handles rate limit errors (429) with retry logic
- **Password breach checking** (`checkPasswordBreach`) - Uses Pwned Passwords API
- **Email breach checking** (`checkEmailBreach`) - Requires HIBP API key (optional)

**Security Features:**
- SHA-1 hashing using `@noble/hashes`
- k-anonymity: Only first 5 hash characters sent to API
- Add-Padding header for additional privacy
- Local caching to reduce external requests

### 2. Database Integration

#### Updated `database.ts`
- Added `StoredBreachResult` table to IndexedDB schema (version 2)
- Indexes: `id`, `credentialId`, `checkType`, `breached`, `severity`, `checkedAt`, `expiresAt`
- Automatic cache expiration (24 hours)

#### `breachResultsRepository.ts`
Repository pattern implementation:
- `saveBreachResult` - Store breach check results
- `getBreachResult` - Retrieve cached results
- `getAllBreachedCredentials` - Get all breached items
- `getBreachStatistics` - Aggregate statistics
- `deleteBreachResults` - Remove results for credential
- `cleanupExpiredResults` - Remove expired cache entries

### 3. UI Components

#### `BreachAlertBanner.tsx`
Prominent alert banner shown on dashboard:
- Auto-displays when breached credentials detected
- Dismissable (7-day reminder)
- Shows count of breached passwords
- Quick navigation to Security Audit page
- Color-coded severity (critical/warning)

#### `BreachDetailsModal.tsx`
Detailed breach information dialog:
- Lists all breaches for a credential
- Shows breach date, affected accounts, data classes
- Displays recommended security actions
- Links to HIBP website for more info
- HIBP attribution and credits

### 4. Security Audit Page Integration

Enhanced `SecurityAuditPage.tsx` with:
- **Breach Detection Card** - Summary statistics
- **Manual Scan Button** - Scan all credentials for breaches
- **Breach Issues** - Added "breached" issue type
- **Visual Indicators** - Red "BREACHED" chip for affected credentials
- **View Details Button** - Opens BreachDetailsModal
- **Statistics Display**:
  - Breached passwords count
  - Safe passwords count
  - Total checked count
- **Priority Recommendations** - Breached passwords shown first

### 5. Dashboard Integration

Updated `DashboardPage.tsx`:
- Added `BreachAlertBanner` component
- Displays at top of dashboard for immediate visibility
- Auto-refreshes when breach data updates

### 6. Environment Configuration

Updated `.env.example`:
```bash
# Have I Been Pwned (HIBP) API Configuration
VITE_HIBP_API_ENABLED=true
VITE_HIBP_USER_AGENT=TrustVault-PWA
# VITE_HIBP_API_KEY=your-api-key-here  # Optional for email checking
```

## Usage

### Setup

1. **Enable Breach Detection**:
   ```bash
   cp .env.example .env
   # Edit .env and set:
   VITE_HIBP_API_ENABLED=true
   VITE_HIBP_USER_AGENT=TrustVault-PWA
   ```

2. **(Optional) Enable Email Breach Checking**:
   - Get API key from https://haveibeenpwned.com/API/Key
   - Add to `.env`: `VITE_HIBP_API_KEY=your-key`

### Using the Feature

1. **Manual Scan**:
   - Navigate to Security Audit page
   - Click "Scan All" button in Breach Detection card
   - Wait for scan to complete (rate-limited)
   - Review results in the issues list

2. **View Breach Details**:
   - Click "View Breach Details" on any breached credential
   - Review breach information and recommendations
   - Take action (change password, enable 2FA, etc.)

3. **Dismiss Alerts**:
   - Click X on BreachAlertBanner to dismiss
   - Banner will re-appear after 7 days if issue persists

## Architecture

### Data Flow

```
User Action (Scan)
  ↓
SecurityAuditPage.scanForBreaches()
  ↓
For each credential:
  checkPasswordBreach(password)
    ↓
  SHA-1 Hash → Send first 5 chars to HIBP
    ↓
  Match suffix → Count occurrences
    ↓
  Save to breachResultsRepository
    ↓
  Store in IndexedDB (24hr cache)

Display Results:
  ↓
SecurityAuditPage (issues list)
DashboardPage (alert banner)
```

### Security Considerations

1. **k-anonymity**: Never sends full password or hash to HIBP
2. **Local Hashing**: SHA-1 computed client-side using `@noble/hashes`
3. **Rate Limiting**: Prevents API abuse, respects HIBP guidelines
4. **Caching**: Reduces external requests, improves performance
5. **Offline Support**: Cached results available offline
6. **No Email Tracking**: Email checks require explicit API key

### Performance Optimizations

- **In-memory cache**: Fast lookups for repeated checks
- **IndexedDB persistence**: 24-hour cache reduces API calls
- **Rate limiting**: 1500ms between requests
- **Batch scanning**: Process all credentials sequentially
- **Lazy loading**: Components loaded on-demand

## API Reference

### HIBP Service

```typescript
// Check if password is breached
const result = await checkPasswordBreach('myPassword123', {
  forceRefresh: false  // Use cache if available
});

// Result structure
{
  breached: boolean,
  breaches: BreachData[],  // Empty for password checks
  severity: 'critical' | 'high' | 'medium' | 'low' | 'safe',
  checkedAt: number,
  breachCount: number  // Times seen in breaches
}

// Check if email is breached (requires API key)
const result = await checkEmailBreach('user@example.com', {
  includeUnverified: false,  // Filter unverified breaches
  truncateResponse: false    // Get full breach details
});
```

### Repository

```typescript
// Save breach result
await saveBreachResult(credentialId, 'password', result);

// Get cached result
const cached = await getBreachResult(credentialId, 'password');

// Get all breached credentials
const breached = await getAllBreachedCredentials();

// Get statistics
const stats = await getBreachStatistics();
// Returns: { total, breached, safe, bySeverity: {...} }
```

## Testing

### Test Passwords

For testing breach detection:
- **Breached**: `password123` (seen millions of times)
- **Safe**: Use password generator for unique password

### Manual Testing

1. Add test credential with known breached password
2. Navigate to Security Audit
3. Click "Scan All"
4. Verify breach detected and severity displayed
5. Click "View Breach Details"
6. Verify modal shows correct information
7. Check dashboard shows BreachAlertBanner

### Type Safety

All code passes TypeScript strict mode:
```bash
npm run type-check  # Must pass
npm run build       # Must complete successfully
```

## Files Created/Modified

### New Files
- `src/core/breach/breachTypes.ts` - Type definitions
- `src/core/breach/hibpService.ts` - HIBP API integration
- `src/data/repositories/breachResultsRepository.ts` - Data access layer
- `src/presentation/components/BreachAlertBanner.tsx` - Alert banner component
- `src/presentation/components/BreachDetailsModal.tsx` - Details modal component

### Modified Files
- `src/data/storage/database.ts` - Added BreachResults table
- `src/presentation/pages/SecurityAuditPage.tsx` - Breach detection UI
- `src/presentation/pages/DashboardPage.tsx` - Alert banner integration
- `.env.example` - HIBP configuration

## Dependencies

- `@noble/hashes` - SHA-1 hashing (already in project)
- No additional dependencies required

## Future Enhancements

Potential improvements:
1. **Background Scanning**: Automatic periodic scans
2. **Email Breach Checks**: Integrate with email credentials
3. **Breach Notifications**: Push notifications for new breaches
4. **Export Reports**: PDF/CSV export of breach audit
5. **Breach History**: Track breach detection over time
6. **Auto-Remediation**: Prompt to change password immediately
7. **Breach Severity Badges**: Visual indicators on credential cards

## Credits

- Breach data provided by [Have I Been Pwned](https://haveibeenpwned.com/)
- Created by Troy Hunt
- k-anonymity implementation based on [HIBP Pwned Passwords API](https://haveibeenpwned.com/API/v3#PwnedPasswords)

## License

This implementation follows TrustVault PWA's license and respects HIBP's acceptable use policy.
