// Request cache and deduplication for API calls
const cache = new Map<string, { data: any; timestamp: number; promise?: Promise<any> }>();
const CACHE_TTL = 2000; // 2 seconds cache

export async function cachedFetch(
  url: string,
  options?: RequestInit,
  ttl: number = CACHE_TTL
): Promise<Response> {
  const cacheKey = `${url}_${JSON.stringify(options?.body || '')}`;
  const cached = cache.get(cacheKey);
  const now = Date.now();

  // Return cached data if still valid
  if (cached && (now - cached.timestamp) < ttl && cached.data) {
    return new Response(JSON.stringify(cached.data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // If there's an in-flight request, return that promise
  if (cached?.promise) {
    return cached.promise;
  }

  // Make new request
  const promise = fetch(url, options)
    .then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        cache.set(cacheKey, {
          data,
          timestamp: now,
        });
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return res;
    })
    .catch((error) => {
      cache.delete(cacheKey);
      throw error;
    });

  // Store promise for deduplication
  cache.set(cacheKey, {
    data: cached?.data,
    timestamp: cached?.timestamp || 0,
    promise,
  });

  return promise;
}

// Clear cache for a specific URL pattern
export function clearCache(pattern?: string) {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

// Clean up old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL * 10) {
      cache.delete(key);
    }
  }
}, 30000); // Clean every 30 seconds
