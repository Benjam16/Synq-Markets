/**
 * Client-side caching with localStorage for instant loading
 * Provides sub-100ms data access for cached responses
 */

const CACHE_PREFIX = 'pm_cache_';
const CACHE_VERSION = 'v1';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
}

/**
 * Get cached data from localStorage
 */
export function getCached<T>(key: string, maxAge: number = 30000): T | null {
  try {
    const cached = localStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    
    // Check version
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    // Check age
    const age = Date.now() - entry.timestamp;
    if (age > maxAge) {
      localStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn('[Client Cache] Failed to read cache:', error);
    return null;
  }
}

/**
 * Set cached data in localStorage
 */
export function setCached<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch (error) {
    // localStorage might be full - clear old entries
    if (error instanceof DOMException && error.code === 22) {
      clearOldCache();
      try {
        const entry: CacheEntry<T> = {
          data,
          timestamp: Date.now(),
          version: CACHE_VERSION,
        };
        localStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
      } catch (retryError) {
        console.warn('[Client Cache] Failed to cache after cleanup:', retryError);
      }
    } else {
      console.warn('[Client Cache] Failed to cache:', error);
    }
  }
}

/**
 * Clear old cache entries to free up space
 */
function clearOldCache(): void {
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    
    // Sort by timestamp (oldest first)
    const entries = cacheKeys.map(key => {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const entry = JSON.parse(cached);
          return { key, timestamp: entry.timestamp };
        }
      } catch {
        return null;
      }
      return null;
    }).filter(Boolean) as Array<{ key: string; timestamp: number }>;

    entries.sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest 50% of entries
    const toRemove = Math.floor(entries.length / 2);
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(entries[i].key);
    }
  } catch (error) {
    console.warn('[Client Cache] Failed to clear old cache:', error);
  }
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.filter(k => k.startsWith(CACHE_PREFIX)).forEach(key => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.warn('[Client Cache] Failed to clear cache:', error);
  }
}

/**
 * Fetch with automatic caching
 */
export async function cachedFetch<T>(
  url: string,
  options?: RequestInit,
  maxAge: number = 30000
): Promise<T> {
  // Try cache first
  const cacheKey = `fetch_${url}_${JSON.stringify(options?.body || '')}`;
  const cached = getCached<T>(cacheKey, maxAge);
  
  if (cached) {
    // Return cached immediately, then refresh in background
    fetch(url, options)
      .then(res => res.json())
      .then(data => setCached(cacheKey, data))
      .catch(() => {}); // Silently fail background refresh
    
    return cached;
  }

  // Fetch fresh data
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status}`);
  }
  
  const data = await res.json();
  setCached(cacheKey, data);
  
  return data;
}
