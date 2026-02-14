import { memo, useEffect, useRef } from "react";
import { useTheme } from "../../contexts/ThemeContext";

/* ------------------------------------------------------------------ */
/*  Matrix character set                                               */
/* ------------------------------------------------------------------ */

const MATRIX_CHARS =
    "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン" +
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ@#$%&*<>{}[]";

const FONT_SIZE = 14;
const FADE_ALPHA = 0.04;

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

/**
 * Full-screen Matrix digital rain rendered on a canvas.
 * Only mounts when the "matrix" theme is selected.
 */
export const MatrixRain = memo(function MatrixRain() {
    const { themeId } = useTheme();
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (themeId !== "matrix") return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let animationId: number;
        let columns: number;
        let drops: number[];

        function resize() {
            if (!canvas) return;
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            columns = Math.floor(canvas.width / FONT_SIZE);
            drops = Array.from({ length: columns }, () =>
                Math.random() * -100,
            );
        }

        resize();
        window.addEventListener("resize", resize);

        let lastTime = 0;
        const fps = 30; // Control speed
        const interval = 1000 / fps;

        function draw(timeStamp: number) {
            if (!ctx || !canvas) return;

            const deltaTime = timeStamp - lastTime;

            if (deltaTime > interval) {
                lastTime = timeStamp - (deltaTime % interval);

                // Semi-transparent black to create trails
                ctx.fillStyle = `rgba(0, 0, 0, ${FADE_ALPHA})`;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.font = `${FONT_SIZE}px "Courier New", monospace`;

                for (let i = 0; i < drops.length; i++) {
                    const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
                    const x = i * FONT_SIZE;
                    const y = drops[i] * FONT_SIZE;

                    // Head character — bright green/white
                    if (Math.random() > 0.3) {
                        ctx.fillStyle = "#ffffff";
                        ctx.fillText(char, x, y);
                    }

                    // Trail — varying green intensities
                    const greenIntensity = 100 + Math.floor(Math.random() * 155);
                    ctx.fillStyle = `rgba(0, ${greenIntensity}, 0, 0.85)`;
                    ctx.fillText(char, x, y);

                    // Reset drop when it goes off screen, with randomness
                    if (y > canvas.height && Math.random() > 0.975) {
                        drops[i] = 0;
                    }
                    drops[i]++;
                }
            }

            animationId = requestAnimationFrame(draw);
        }

        animationId = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener("resize", resize);
        };
    }, [themeId]);

    if (themeId !== "matrix") return null;

    return (
        <canvas
            ref={canvasRef}
            className="pointer-events-none fixed inset-0 z-0 opacity-40"
            aria-hidden="true"
        />
    );
});
