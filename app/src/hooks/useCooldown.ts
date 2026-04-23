import { useCallback, useRef, useState } from 'react';

/**
 * Client-side rate limiting for actions like verify, report, review.
 * Prevents accidental double-taps and rapid-fire submissions.
 *
 * Usage:
 *   const { isOnCooldown, trigger } = useCooldown(3000);
 *   <Pressable disabled={isOnCooldown} onPress={() => trigger(() => doThing())} />
 */
export function useCooldown(cooldownMs: number = 3000) {
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(
    async (action: () => void | Promise<void>) => {
      if (isOnCooldown) return;

      setIsOnCooldown(true);
      try {
        await action();
      } finally {
        timerRef.current = setTimeout(() => {
          setIsOnCooldown(false);
        }, cooldownMs);
      }
    },
    [isOnCooldown, cooldownMs]
  );

  return { isOnCooldown, trigger };
}
