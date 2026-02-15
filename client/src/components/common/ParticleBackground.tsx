import { memo, useMemo } from "react";

const PARTICLE_CLASSES: readonly string[] = Object.freeze(
    Array.from({ length: 30 }, (_, index) => `particle-dot-${index}`),
);

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

/**
 * Ambient floating particles rendered as CSS-only animated dots.
 * Uses the theme accent glow color via CSS variable --glow.
 * Mount once in the root layout (e.g. AppShell).
 */
export const ParticleBackground = memo(function ParticleBackground() {
    const particles = useMemo(() => PARTICLE_CLASSES, []);

    return (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
            {particles.map((className) => (
                <div
                    key={className}
                    className={`particle-dot absolute rounded-full ${className}`}
                />
            ))}
        </div>
    );
});

