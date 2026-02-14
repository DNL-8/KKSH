import { memo, useEffect, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Particle config                                                   */
/* ------------------------------------------------------------------ */

interface Particle {
    id: number;
    x: number;
    y: number;
    size: number;
    duration: number;
    delay: number;
    opacity: number;
}

const PARTICLE_COUNT = 30;

function generateParticles(): Particle[] {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 20 + 15,
        delay: Math.random() * -20,
        opacity: Math.random() * 0.3 + 0.05,
    }));
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

/**
 * Ambient floating particles rendered as CSS-only animated dots.
 * Uses the theme accent glow color via CSS variable --glow.
 * Mount once in the root layout (e.g. AppShell).
 */
export const ParticleBackground = memo(function ParticleBackground() {
    const [particles] = useState(generateParticles);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Delay mount to avoid layout shift on initial render
        const id = requestAnimationFrame(() => setMounted(true));
        return () => cancelAnimationFrame(id);
    }, []);

    if (!mounted) return null;

    return (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute rounded-full"
                    style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                        opacity: p.opacity,
                        backgroundColor: `rgba(var(--glow), 0.6)`,
                        boxShadow: `0 0 ${p.size * 3}px rgba(var(--glow), 0.3)`,
                        animation: `particle-float ${p.duration}s ease-in-out ${p.delay}s infinite`,
                    }}
                />
            ))}
        </div>
    );
});

