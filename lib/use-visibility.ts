/**
 * Hook to detect when the page is visible/hidden
 * Useful for pausing polling when tab is not active
 */
import { useEffect, useState } from 'react';

export function usePageVisibility() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    // Check initial state
    setIsVisible(!document.hidden);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}
