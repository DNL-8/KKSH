import { Icon } from "../common/Icon";
import { ThemeShowcase } from "../common";
import type { ClientPreferences } from "../../contexts/PreferencesContext";
import { useTheme } from "../../contexts/ThemeContext";

interface SettingsSidebarProps {
    preferences: ClientPreferences;
    updatePreference: <K extends keyof ClientPreferences>(key: K, value: ClientPreferences[K]) => void;
}

export function SettingsSidebar({ preferences, updatePreference }: SettingsSidebarProps) {
    const { isIosTheme } = useTheme();
    return (
        <div className="sticky top-24 space-y-6">
            <div className={`rounded-[40px] p-8 ${isIosTheme ? "ios26-section" : "border border-slate-300/50 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/90 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"}`}>
                <div className="mb-8 flex items-center gap-4">
                    <div className="rounded-xl border border-orange-500/30 bg-orange-950/40 p-3 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                        <Icon name="bolt" className="text-[24px]" />
                    </div>
                    <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 drop-shadow-sm">Dificuldade</h2>
                </div>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => updatePreference("difficulty", "casual")}
                        className={`rounded-[20px] p-5 border transition-all text-left group ${preferences.difficulty === "casual"
                            ? isIosTheme ? "ios26-chip-active ios26-focusable opacity-100" : "bg-[#142618] border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)] opacity-100"
                            : isIosTheme ? "ios26-chip ios26-focusable opacity-90" : "bg-white/[0.02] border-slate-300/50  opacity-60 grayscale hover:grayscale-0 hover:opacity-100 hover:bg-white/[0.05]"
                            }`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-[13px] font-black uppercase tracking-[0.2em] ${preferences.difficulty === "casual" ? "text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]" : "text-slate-900"
                                }`}>Casual</span>
                            {preferences.difficulty === "casual" && (
                                <Icon name="check-circle" className="text-emerald-500 text-[20px] drop-shadow-sm" />
                            )}
                        </div>
                        <p className="text-[11px] font-medium text-slate-500">Modo historia sem desafios punitivos.</p>
                    </button>

                    <button
                        onClick={() => updatePreference("difficulty", "hardcore")}
                        className={`rounded-[20px] p-5 border transition-all text-left relative overflow-hidden group ${preferences.difficulty === "hardcore"
                            ? isIosTheme ? "ios26-status-danger ios26-focusable" : "bg-[#251010] border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                            : isIosTheme ? "ios26-chip ios26-focusable opacity-90" : "bg-white/[0.02] border-slate-300/50 hover:bg-red-950/20 hover:border-red-500/30 opacity-80 hover:opacity-100"
                            }`}
                    >
                        {preferences.difficulty === "hardcore" && (
                            <div className="absolute -right-3 -top-3 h-20 w-20 rounded-full bg-red-600/10 blur-[20px]" />
                        )}
                        {preferences.difficulty === "hardcore" && (
                            <div className="absolute top-0 right-0 p-4 text-red-500">
                                <Icon name="skull" className="text-[16px] animate-pulse drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]" />
                            </div>
                        )}
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-[13px] font-black uppercase tracking-[0.2em] ${preferences.difficulty === "hardcore" ? "text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" : "text-red-400"
                                }`}>Hardcore</span>
                        </div>
                        <p className="text-[11px] font-medium text-red-200/60 relative z-10">Dano permanente. Boot loops reais.</p>
                    </button>
                </div>
            </div>

            <div data-testid="settings-theme-section" className={`rounded-[40px] p-8 ${isIosTheme ? "ios26-section" : "border border-slate-300/50 bg-gradient-to-b from-[#0a0f1d]/90 to-[#050813]/90 shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"}`}>
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-lg font-black uppercase tracking-widest text-slate-900 drop-shadow-sm">Tema</h2>
                    <Icon name="refresh" className="text-[hsl(var(--accent)/0.6)] animate-spin-slow text-[20px]" />
                </div>

                <ThemeShowcase />
            </div>

            <div className={`rounded-[40px] p-10 text-center group ${isIosTheme ? "ios26-section-hero" : "bg-gradient-to-b from-[#0a0f1d]/90 to-[#03050a]/95 border border-slate-300/50 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl"}`}>
                <div className="mb-6 rounded-full border border-red-500/20 bg-red-950/40 p-6 text-red-500 shadow-[inset_0_2px_10px_rgba(220,38,38,0.2),0_0_30px_rgba(220,38,38,0.1)] inline-block transition-transform duration-700 group-hover:scale-110">
                    <Icon name="skull" className="text-[48px] drop-shadow-[0_0_15px_rgba(220,38,38,0.6)]" />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter mb-2 drop-shadow-sm">Build v0.9.4</h3>
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-slate-500">COMPILADO: 2024-05-20</p>
                <div className="mt-8 flex justify-center gap-3">
                    <span className="h-2 w-2 rounded-full bg-slate-700 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]" />
                    <span className="h-2 w-2 rounded-full bg-slate-700 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]" />
                    <span className="h-2 w-2 rounded-full bg-slate-700 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]" />
                </div>
            </div>
        </div>
    );
}
