/**
 * Request deduplication - prevents duplicate concurrent requests
 * If multiple components request the same data simultaneously, only one request is made
 */

const pendingRequests = new Map<string, Promise<any>>();

/**
 * Deduplicated fetch - if a request is already in flight, returns the same promise
 */
export async function deduplicatedFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const key = `${url}_${JSON.stringify(options?.body || '')}_${options?.method || 'GET'}`;
  
  // If request is already pending, return the same promise
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }

  // Create new request
  const promise = fetch(url, options)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }
      return res.json();
    })
    .finally(() => {
      // Remove from pending after completion
      pendingRequests.delete(key);
    });

  // Store promise
  pendingRequests.set(key, promise);

  return promise;
}

/**
 * Clear all pending requests (useful for cleanup)
 */
export function clearPendingRequests(): void {
  pendingRequests.clear();
}
