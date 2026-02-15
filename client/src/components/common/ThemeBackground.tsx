import { useTheme } from "../../contexts/ThemeContext";
import { MatrixRain } from "./MatrixRain";
import { ParticleBackground } from "./ParticleBackground";

export function ThemeBackground() {
    const { themeId, theme } = useTheme();

    return (
        <div className="fixed inset-0 -z-50 overflow-hidden">
            {/* Background Image Layer */}
            {/* Background Layer (Gradient + Image) */}
            <div
                className="absolute inset-0 transition-all duration-1000 ease-in-out"
                style={{ background: theme.bgGradient }}
            >
                {theme.bgImage && (
                    <div
                        data-testid="theme-background-image"
                        data-theme-id={themeId}
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-100 transition-opacity duration-700"
                        style={{ backgroundImage: `url(${theme.bgImage})` }}
                    />
                )}
                {/* Subtle slow zoom animation for immersion */}
                <div className="absolute inset-0 animate-pulse-slow bg-black/10" />
            </div>

            {/* Overlay Color Layer */}
            <div
                className="absolute inset-0 transition-colors duration-700"
                style={{ backgroundColor: theme.overlayColor }}
            />

            {/* Special Effects Layer */}
            {themeId === "matrix" && (
                <div className="absolute inset-0 opacity-40">
                    <MatrixRain />
                </div>
            )}

            {themeId === "sololeveling" && (
                <>
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] opacity-80" />
                    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-900/20 to-transparent" />
                </>
            )}

            {themeId === "naruto" && (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,100,0,0.15),transparent_50%)]" />
            )}

            {themeId === "dragonball" && (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.1),transparent_70%)] animate-pulse" />
            )}

            {themeId === "hxh" && (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(220,20,60,0.15),transparent_60%)]" />
            )}

            {/* Global Particle Dust (Subtle) */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
                <ParticleBackground />
            </div>

            {/* Vignette */}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.8)_100%)]" />
        </div>
    );
}
