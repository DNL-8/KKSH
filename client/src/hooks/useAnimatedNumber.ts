import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from its previous value to the new target.
 * Returns the current animated value (rounded integer).
 *
 * @example
 * const animatedXp = useAnimatedNumber(globalStats.xp, 600);
 */
export function useAnimatedNumber(target: number, duration = 500): number {
    const [current, setCurrent] = useState(target);
    const prevRef = useRef(target);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        const from = prevRef.current;
        const to = target;
        prevRef.current = target;

        if (from === to) return;

        const start = performance.now();
        const diff = to - from;

        function tick(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            setCurrent(Math.round(from + diff * eased));

            if (progress < 1) {
                rafRef.current = requestAnimationFrame(tick);
            }
        }

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [target, duration]);

    return current;
}
