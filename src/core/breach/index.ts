// Public API — Safe for external use
export {
  checkPasswordBreach,
  checkEmailBreach,
  getRangeResponse,
  parseRangeResponse,
} from './hibpService';

export {
  computeSha1Prefix,
  saveBreachPrefix,
  deleteBreachPrefix,
  getAllBreachPrefixes,
} from './breachPrefixStore';

export {
  checkPasswordWithCache,
  isCachedResponseFresh,
} from './rangeCache';

export {
  runUnlockBreachRefresh,
} from './unlockBreachRefresh';

// Types — Safe for external use
export type {
  BreachCheckResult,
  BreachCheckOptions,
  BreachData,
  BreachSeverity,
  HibpError,
  RateLimitState,
  StoredBreachResult,
} from './breachTypes';
