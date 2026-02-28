import { useTheme } from "../../contexts/ThemeContext";
import { MatrixRain } from "./MatrixRain";
import { ParticleBackground } from "./ParticleBackground";

export function ThemeBackground() {
    const { themeId, theme, isLightTheme } = useTheme();

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
                        aria-hidden="true"
                    />
                )}
                {/* Subtle motion layer */}
                {themeId === "ios26" ? (
                    <div
                        data-testid="theme-background-ios26-sheen"
                        aria-hidden="true"
                        className="ios26-sheen absolute inset-0 bg-[radial-gradient(circle_at_16%_-8%,rgba(255,255,255,0.46),transparent_46%),radial-gradient(circle_at_86%_14%,rgba(122,181,255,0.20),transparent_48%),radial-gradient(circle_at_48%_100%,rgba(255,220,244,0.14),transparent_55%)]"
                    />
                ) : (
                    <div aria-hidden="true" className="absolute inset-0 animate-pulse-slow liquid-glass/10" />
                )}
            </div>

            {/* Overlay Color Layer */}
            <div
                data-testid="theme-background-overlay"
                className="absolute inset-0 transition-colors duration-700"
                style={{ backgroundColor: theme.overlayColor }}
                aria-hidden="true"
            />

            {/* Special Effects Layer */}
            {themeId === "matrix" && (
                <div className="absolute inset-0 opacity-40" aria-hidden="true">
                    <MatrixRain />
                </div>
            )}

            {themeId === "sololeveling" && (
                <>
                    <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000_100%)] opacity-80" />
                    <div aria-hidden="true" className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-900/20 to-transparent" />
                </>
            )}

            {themeId === "naruto" && (
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,100,0,0.15),transparent_50%)]" />
            )}

            {themeId === "dragonball" && (
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.1),transparent_70%)] animate-pulse" />
            )}

            {themeId === "hxh" && (
                <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(220,20,60,0.15),transparent_60%)]" />
            )}

            {/* Global Particle Dust (Subtle) */}
            <div aria-hidden="true" className={`absolute inset-0 pointer-events-none ${isLightTheme ? "opacity-10" : "opacity-20"}`}>
                <ParticleBackground />
            </div>

            {/* Vignette / highlight */}
            {isLightTheme ? (
                <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_10%_-10%,rgba(255,255,255,0.42),transparent_38%),radial-gradient(circle_at_85%_0%,rgba(123,179,255,0.16),transparent_42%)]" />
            ) : (
                <div aria-hidden="true" className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_50%,rgba(0,0,0,0.8)_100%)]" />
            )}
        </div>
    );
}
