/**
 * Performance Monitoring Utilities
 * 
 * Utilities for tracking and optimizing app performance
 */

/**
 * Measure and log component render time
 */
export function measureRender(componentName: string, startTime: number): void {
  const endTime = performance.now();
  const renderTime = endTime - startTime;
  
  if (renderTime > 16) { // More than one frame (60fps = 16.67ms per frame)
    console.warn(`${componentName} render took ${renderTime.toFixed(2)}ms`);
  }
}

/**
 * Debounce function for expensive operations
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };
    
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function for limiting execution frequency
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Check if app is running in standalone mode (installed PWA)
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
}

/**
 * Get performance metrics
 */
export function getPerformanceMetrics() {
  if (!window.performance || !window.performance.getEntriesByType) {
    return null;
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  
  if (!navigation) {
    return null;
  }

  return {
    // Time to First Byte
    ttfb: navigation.responseStart - navigation.requestStart,
    
    // DOM Content Loaded
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
    
    // Page Load Time
    loadTime: navigation.loadEventEnd - navigation.loadEventStart,
    
    // Total Page Load
    totalTime: navigation.loadEventEnd - navigation.fetchStart,
    
    // DNS Lookup
    dnsTime: navigation.domainLookupEnd - navigation.domainLookupStart,
    
    // Connection Time
    connectionTime: navigation.connectEnd - navigation.connectStart,
  };
}

/**
 * Log performance metrics to console (development only)
 */
export function logPerformanceMetrics(): void {
  if (import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    setTimeout(() => {
      const metrics = getPerformanceMetrics();
      
      if (metrics) {
        // eslint-disable-next-line no-console
        console.group('⚡ Performance Metrics');
        // eslint-disable-next-line no-console
        console.log(`TTFB: ${metrics.ttfb.toFixed(2)}ms`);
        // eslint-disable-next-line no-console
        console.log(`DOM Content Loaded: ${metrics.domContentLoaded.toFixed(2)}ms`);
        // eslint-disable-next-line no-console
        console.log(`Page Load: ${metrics.loadTime.toFixed(2)}ms`);
        // eslint-disable-next-line no-console
        console.log(`Total Time: ${metrics.totalTime.toFixed(2)}ms`);
        // eslint-disable-next-line no-console
        console.log(`DNS Lookup: ${metrics.dnsTime.toFixed(2)}ms`);
        // eslint-disable-next-line no-console
        console.log(`Connection: ${metrics.connectionTime.toFixed(2)}ms`);
        // eslint-disable-next-line no-console
        console.groupEnd();
      }
    }, 0);
  });
}

/**
 * Preload critical resources
 */
export function preloadResource(href: string, as: string): void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = href;
  link.as = as;
  document.head.appendChild(link);
}

/**
 * Prefetch next page for faster navigation
 */
export function prefetchPage(path: string): void {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = path;
  document.head.appendChild(link);
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Get connection speed estimate
 */
export function getConnectionSpeed(): 'slow' | 'medium' | 'fast' | 'unknown' {
  const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  
  if (!connection) {
    return 'unknown';
  }

  const effectiveType = connection.effectiveType;
  
  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return 'slow';
  }
  
  if (effectiveType === '3g') {
    return 'medium';
  }
  
  return 'fast';
}

/**
 * Request idle callback wrapper with fallback
 */
export function requestIdleCallbackPolyfill(callback: () => void, timeout: number = 2000): void {
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(callback, { timeout });
  } else {
    setTimeout(callback, 1);
  }
}

/**
 * Measure First Input Delay (FID)
 */
export function measureFID(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // Type assertion for first-input entry which has processingStart
        const fidEntry = entry as PerformanceEntry & { processingStart: number };
        if ('processingStart' in entry) {
          const fid = fidEntry.processingStart - entry.startTime;
          // eslint-disable-next-line no-console
          console.log(`First Input Delay: ${fid.toFixed(2)}ms`);
        }
      }
    });

    observer.observe({ type: 'first-input', buffered: true });
  } catch (e) {
    // PerformanceObserver not supported
  }
}

/**
 * Measure Largest Contentful Paint (LCP)
 */
export function measureLCP(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        // eslint-disable-next-line no-console
        console.log(`Largest Contentful Paint: ${lastEntry.startTime.toFixed(2)}ms`);
      }
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    // PerformanceObserver not supported
  }
}

/**
 * Measure Cumulative Layout Shift (CLS)
 */
export function measureCLS(): void {
  if (!('PerformanceObserver' in window)) return;

  let clsValue = 0;

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          // eslint-disable-next-line no-console
          console.log(`Cumulative Layout Shift: ${clsValue.toFixed(4)}`);
        }
      }
    });

    observer.observe({ type: 'layout-shift', buffered: true });
  } catch (e) {
    // PerformanceObserver not supported
  }
}

/**
 * Initialize performance monitoring (development only)
 */
export function initPerformanceMonitoring(): void {
  if (import.meta.env.PROD) return;

  logPerformanceMetrics();
  measureFID();
  measureLCP();
  measureCLS();
  
  // eslint-disable-next-line no-console
  console.log('🚀 Performance monitoring enabled');
}
