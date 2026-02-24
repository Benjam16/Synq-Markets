/**
 * Smart polling hook that:
 * - Pauses when tab is hidden
 * - Uses exponential backoff on errors
 * - Respects network status
 */
import { useEffect, useRef, useState } from 'react';
import { usePageVisibility } from './use-visibility';

interface UseSmartPollingOptions {
  enabled?: boolean;
  interval: number;
  onPoll: () => Promise<void> | void;
  onError?: (error: Error) => void;
  immediate?: boolean;
}

export function useSmartPolling({
  enabled = true,
  interval,
  onPoll,
  onError,
  immediate = true,
}: UseSmartPollingOptions) {
  const isVisible = usePageVisibility();
  const [backoffMultiplier, setBackoffMultiplier] = useState(1);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const poll = async () => {
      if (isPollingRef.current) return; // Prevent concurrent polls
      
      isPollingRef.current = true;
      try {
        await onPoll();
        // Reset backoff on success
        setBackoffMultiplier(1);
      } catch (error) {
        // Exponential backoff on error (max 4x interval)
        setBackoffMultiplier(prev => Math.min(prev * 1.5, 4));
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      } finally {
        isPollingRef.current = false;
      }
    };

    // Clear existing intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only poll when visible
    if (isVisible) {
      // Immediate poll if requested
      if (immediate) {
        poll();
      }

      // Set up interval with backoff
      const effectiveInterval = interval * backoffMultiplier;
      intervalRef.current = setInterval(poll, effectiveInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, interval, isVisible, backoffMultiplier, onPoll, onError, immediate]);

  // Poll immediately when tab becomes visible again
  useEffect(() => {
    if (isVisible && enabled && immediate) {
      const result = onPoll();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
    }
  }, [isVisible, enabled, immediate, onPoll]);
}
