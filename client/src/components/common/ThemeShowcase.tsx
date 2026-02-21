import { useCallback, useEffect, useRef, useState, memo } from "react";
import { useTheme, type ThemeId } from "../../contexts/ThemeContext";

/* ------------------------------------------------------------------ */
/*  Theme metadata for the showcase                                   */
/* ------------------------------------------------------------------ */

interface ThemeMeta {
    id: ThemeId;
    name: string;
    subtitle: string;
    color: string;       // hex
    glow: string;        // rgb for shadows
    bgImage: string;
    bgGradient?: string; // optional gradient fallback (used when bgImage is empty)
    icon: string;        // emoji
}

const THEME_METAS: ThemeMeta[] = [
    {
        id: "matrix",
        name: "MATRIX",
        subtitle: "Desperte na Simulação",
        color: "#00ff41",
        glow: "0, 255, 65",
        bgImage: "https://images6.alphacoders.com/550/550739.jpg",
        icon: "🟢",
    },
    {
        id: "naruto",
        name: "NARUTO",
        subtitle: "Caminho do Ninja",
        color: "#ff6400",
        glow: "255, 100, 0",
        bgImage: "/assets/themes/naruto.gif",
        icon: "🍥",
    },
    {
        id: "dragonball",
        name: "DRAGON BALL",
        subtitle: "Poder Além dos Limites",
        color: "#ffd700",
        glow: "255, 215, 0",
        bgImage: "/assets/themes/dragonball.gif",
        icon: "🐉",
    },
    {
        id: "sololeveling",
        name: "SOLO LEVELING",
        subtitle: "Surge, Despertar!",
        color: "#1a73e8",
        glow: "26, 115, 232",
        bgImage: "/assets/themes/sololeveling.gif",
        icon: "⚔️",
    },
    {
        id: "hxh",
        name: "HUNTER × HUNTER",
        subtitle: "Nen Despertado",
        color: "#dc143c",
        glow: "220, 20, 60",
        bgImage: "/assets/themes/hxh.gif",
        icon: "♠️",
    },
    {
        id: "lotr",
        name: "SENHOR DOS ANÉIS",
        subtitle: "Um Anel para Todos",
        color: "#c0c0c0",
        glow: "192, 192, 192",
        bgImage: "/assets/themes/lotr.gif",
        icon: "💍",
    },
    {
        id: "ios26",
        name: "iOS 26 LIQUID GLASS",
        subtitle: "Leve, Fluido e Premium",
        color: "#007AFF",
        glow: "0, 122, 255",
        bgImage: "",
        bgGradient: "radial-gradient(ellipse at 20% 0%, rgba(255,200,255,0.6) 0%, transparent 60%), radial-gradient(ellipse at 80% 10%, rgba(200,230,255,0.8) 0%, transparent 60%), linear-gradient(160deg, #f5f0ff 0%, #e8f4ff 100%)",
        icon: "🍎",
    },
];

/* ------------------------------------------------------------------ */
/*  Sound FX via Web Audio API                                        */
/* ------------------------------------------------------------------ */

let _audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
    try {
        if (!_audioCtx) {
            _audioCtx = new AudioContext();
        }
        return _audioCtx;
    } catch {
        return null;
    }
}

/** Short "power-up" sweep sound on theme selection */
function playSelectSound(baseFreq: number = 300) {
    const ctx = getAudioCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();

    osc.connect(gain);
    osc2.connect(gain2);
    gain.connect(ctx.destination);
    gain2.connect(ctx.destination);

    const now = ctx.currentTime;

    // Primary ascending tone
    osc.type = "sine";
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.5, now + 0.15);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 3, now + 0.25);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    // Harmonics for richness
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(baseFreq * 1.5, now);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 4, now + 0.2);
    gain2.gain.setValueAtTime(0.04, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + 0.35);
    osc2.stop(now + 0.3);
}

/** Short hover tick */
function playHoverSound() {
    const ctx = getAudioCtx();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.start(now);
    osc.stop(now + 0.06);
}

/* ------------------------------------------------------------------ */
/*  Animated theme card                                               */
/* ------------------------------------------------------------------ */

interface ThemeCardProps {
    meta: ThemeMeta;
    isActive: boolean;
    onSelect: () => void;
}

const ThemeCard = memo(function ThemeCard({ meta, isActive, onSelect }: ThemeCardProps) {
    const cardRef = useRef<HTMLButtonElement>(null);
    const [isFlashing, setIsFlashing] = useState(false);
    const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

    const handleClick = useCallback(() => {
        if (isActive) return;
        setIsFlashing(true);
        playSelectSound();
        onSelect();
        setTimeout(() => setIsFlashing(false), 600);
    }, [isActive, onSelect]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMousePos({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
        });
    }, []);

    return (
        <button
            ref={cardRef}
            type="button"
            onClick={handleClick}
            onMouseEnter={playHoverSound}
            onMouseMove={handleMouseMove}
            className={`
        theme-showcase-card group relative overflow-hidden rounded-2xl border text-left
        transition-all duration-500 ease-out cursor-pointer
        ${isActive
                    ? "border-white/30 scale-[1.02] z-10"
                    : "border-white/[0.06] hover:border-white/15 hover:scale-[1.01]"
                }
        ${isFlashing ? "theme-card-flash" : ""}
      `}
            style={{
                boxShadow: isActive
                    ? `0 0 40px rgba(${meta.glow}, 0.25), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)`
                    : "0 10px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
            }}
        >
            {/* Background image preview */}
            <div className="relative h-28 overflow-hidden">
                <div
                    className={`absolute inset-0 bg-cover bg-center transition-all duration-700 ${isActive ? "scale-110 opacity-80" : "scale-100 opacity-40 group-hover:scale-105 group-hover:opacity-60"
                        }`}
                    style={{ backgroundImage: meta.bgImage ? `url(${meta.bgImage})` : meta.bgGradient ?? undefined }}
                />
                {/* Spotlight follow cursor */}
                <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                    style={{
                        background: `radial-gradient(circle 120px at ${mousePos.x}% ${mousePos.y}%, rgba(${meta.glow}, 0.15), transparent)`,
                    }}
                />
                {/* Gradient fade */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#080a10] via-[#080a10]/60 to-transparent" />

                {/* Active glow ring */}
                {isActive && (
                    <div
                        className="absolute inset-0 animate-pulse pointer-events-none"
                        style={{
                            boxShadow: `inset 0 0 60px rgba(${meta.glow}, 0.15)`,
                        }}
                    />
                )}

                {/* Theme emoji */}
                <div className={`absolute top-3 right-3 text-xl transition-all duration-500 ${isActive ? "scale-125 drop-shadow-lg" : "scale-100 opacity-60 group-hover:opacity-100"
                    }`}>
                    {meta.icon}
                </div>
            </div>

            {/* Card body */}
            <div className={`relative p-4 transition-colors duration-500 ${isActive ? "bg-black/80" : "bg-[#080a10]/90"
                }`}>
                {/* Name + subtitle */}
                <div className="flex items-center gap-2.5 mb-1.5">
                    <div
                        className={`h-2.5 w-2.5 rounded-full transition-all duration-500 ${isActive ? "animate-pulse shadow-lg scale-110" : "opacity-40 scale-90"
                            }`}
                        style={{
                            backgroundColor: meta.color,
                            boxShadow: isActive ? `0 0 12px ${meta.color}, 0 0 24px rgba(${meta.glow}, 0.4)` : "none",
                        }}
                    />
                    <span
                        className={`text-xs font-black uppercase tracking-[0.15em] transition-colors duration-300 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"
                            }`}
                        style={isActive ? { textShadow: `0 0 20px rgba(${meta.glow}, 0.5)` } : {}}
                    >
                        {meta.name}
                    </span>
                </div>
                <p className={`text-[10px] font-medium transition-colors duration-300 ${isActive ? "text-slate-300" : "text-slate-600 group-hover:text-slate-500"
                    }`}>
                    {meta.subtitle}
                </p>

                {/* Active badge */}
                {isActive && (
                    <div className="mt-3 flex items-center gap-2">
                        <div
                            className="rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.2em] border animate-in fade-in slide-in-from-bottom-2 duration-500"
                            style={{
                                backgroundColor: `rgba(${meta.glow}, 0.1)`,
                                borderColor: `rgba(${meta.glow}, 0.3)`,
                                color: meta.color,
                            }}
                        >
                            ● ATIVO
                        </div>
                    </div>
                )}

                {/* Scan line animation on active */}
                {isActive && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div
                            className="absolute left-0 right-0 h-px opacity-30"
                            style={{
                                backgroundColor: meta.color,
                                animation: "theme-scanline 3s linear infinite",
                                boxShadow: `0 0 8px rgba(${meta.glow}, 0.5)`,
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Full-card flash effect on click */}
            {isFlashing && (
                <div
                    className="absolute inset-0 pointer-events-none z-50 animate-in fade-in duration-100"
                    style={{
                        background: `radial-gradient(circle at center, rgba(${meta.glow}, 0.4), transparent 70%)`,
                        animation: "theme-flash 0.6s ease-out forwards",
                    }}
                />
            )}
        </button>
    );
});

/* ------------------------------------------------------------------ */
/*  Main showcase component                                           */
/* ------------------------------------------------------------------ */

export const ThemeShowcase = memo(function ThemeShowcase() {
    const { themeId, setTheme } = useTheme();
    const [transitioning, setTransitioning] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleSelect = useCallback((id: ThemeId) => {
        if (id === themeId) return;
        setTransitioning(true);
        setTheme(id);

        // Reset transition after animation
        setTimeout(() => setTransitioning(false), 800);
    }, [themeId, setTheme]);

    // Add dynamic CSS for animations
    useEffect(() => {
        const style = document.createElement("style");
        style.id = "theme-showcase-styles";
        style.textContent = `
      @keyframes theme-scanline {
        0% { top: 0%; }
        100% { top: 100%; }
      }
      @keyframes theme-flash {
        0% { opacity: 1; }
        100% { opacity: 0; }
      }
      @keyframes theme-card-flash {
        0% { filter: brightness(1); }
        15% { filter: brightness(1.8); }
        100% { filter: brightness(1); }
      }
      .theme-card-flash {
        animation: theme-card-flash 0.6s ease-out;
      }
      .theme-showcase-card {
        will-change: transform, box-shadow;
      }
      .theme-showcase-card:active {
        transform: scale(0.98) !important;
      }
    `;
        if (!document.getElementById("theme-showcase-styles")) {
            document.head.appendChild(style);
        }
        return () => {
            const existing = document.getElementById("theme-showcase-styles");
            if (existing) existing.remove();
        };
    }, []);

    return (
        <div ref={containerRef} className={`transition-opacity duration-500 ${transitioning ? "opacity-80" : "opacity-100"}`}>
            <div className="grid grid-cols-1 gap-3">
                {THEME_METAS.map((meta) => (
                    <ThemeCard
                        key={meta.id}
                        meta={meta}
                        isActive={themeId === meta.id}
                        onSelect={() => handleSelect(meta.id)}
                    />
                ))}
            </div>
        </div>
    );
});
