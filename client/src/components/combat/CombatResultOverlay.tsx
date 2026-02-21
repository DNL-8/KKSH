import { Icon } from "../common/Icon";
import { StatPill } from "../common";

interface CombatResultOverlayProps {
    result: "victory" | "defeat";
    bossName: string;
    onRetry: () => void;
    onNext: () => void;
    onBack: () => void;
}

export function CombatResultOverlay({ result, bossName, onRetry, onNext, onBack }: CombatResultOverlayProps) {
    if (result === "victory") {
        return (
            <div
                className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-1000"
                data-testid="combat-victory-overlay"
            >
                <div className="absolute inset-0 bg-emerald-950/20 backdrop-blur-xl mix-blend-overlay" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050813]/80 to-[#050813]" />

                <div className="relative z-10 flex flex-col items-center gap-6 text-center">
                    <div className="rounded-full bg-emerald-500/20 p-8 shadow-[0_0_100px_rgba(16,185,129,0.5),inset_0_0_30px_rgba(16,185,129,0.3)] border border-emerald-500/30">
                        <Icon name="trophy" className="text-emerald-400 text-[56px] drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
                    </div>
                    <h2 className="text-5xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-emerald-200 drop-shadow-[0_0_20px_rgba(16,185,129,0.5)] md:text-7xl">Vitoria!</h2>
                    <p className="text-sm font-black uppercase tracking-[0.4em] text-emerald-300 drop-shadow-md">{bossName} derrotado</p>
                    <div className="flex gap-4 mt-2">
                        <StatPill label="XP ganho" value="Backend" color="text-yellow-400" />
                        <StatPill label="Loot" value="Sincronizado" color="text-purple-400" />
                    </div>
                    <div className="flex gap-5 mt-4">
                        <button
                            onClick={onRetry}
                            className="mt-4 flex items-center gap-3 rounded-[32px] border border-emerald-500/40 bg-emerald-900/40 px-8 py-5 text-[11px] font-black uppercase tracking-[0.3em] text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.15)] transition-all hover:bg-emerald-800/60 hover:shadow-[0_0_40px_rgba(16,185,129,0.3)] hover:-translate-y-1"
                            type="button"
                            data-testid="combat-victory-retry"
                        >
                            <Icon name="crossed-swords" className="text-[18px]" />
                            Batalhar novamente
                        </button>
                        <button
                            onClick={onNext}
                            className="mt-4 flex items-center gap-3 rounded-[32px] bg-gradient-to-r from-emerald-600 to-emerald-400 px-12 py-5 text-xs font-black uppercase tracking-[0.3em] text-black shadow-[0_20px_60px_rgba(16,185,129,0.5)] transition-all hover:scale-105 hover:shadow-[0_20px_80px_rgba(16,185,129,0.7)] active:scale-95"
                            type="button"
                            data-testid="combat-victory-next-module"
                        >
                            <Icon name="bolt" className="text-[20px]" />
                            Proximo modulo
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-1000"
            data-testid="combat-defeat-overlay"
        >
            <div className="absolute inset-0 bg-red-950/20 backdrop-blur-xl mix-blend-overlay" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0505]/80 to-[#0a0505]" />

            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
                <div className="rounded-full bg-red-500/20 p-8 shadow-[0_0_100px_rgba(239,68,68,0.5),inset_0_0_30px_rgba(239,68,68,0.3)] border border-red-500/30">
                    <Icon name="skull" className="text-red-400 text-[56px] drop-shadow-[0_0_15px_rgba(248,113,113,0.8)]" />
                </div>
                <h2 className="text-5xl font-black uppercase italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-red-200 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)] md:text-7xl">Derrota</h2>
                <p className="text-sm font-black uppercase tracking-[0.4em] text-red-300 drop-shadow-md">Sincronia Interrompida</p>
                <div className="flex gap-5 mt-6">
                    <button
                        onClick={onRetry}
                        className="mt-4 flex items-center gap-3 rounded-[32px] border border-red-500/40 bg-red-900/40 px-8 py-5 text-[11px] font-black uppercase tracking-[0.3em] text-red-200 shadow-[0_0_30px_rgba(239,68,68,0.15)] transition-all hover:bg-red-800/60 hover:shadow-[0_0_40px_rgba(239,68,68,0.3)] hover:-translate-y-1"
                        type="button"
                        data-testid="combat-defeat-retry"
                    >
                        <Icon name="crossed-swords" className="text-[18px]" />
                        Tentar novamente
                    </button>
                    <button
                        onClick={onBack}
                        className="mt-4 flex items-center gap-3 rounded-[32px] border border-white/5 bg-white/[0.05] backdrop-blur-md px-12 py-5 text-xs font-black uppercase tracking-[0.3em] text-white shadow-xl transition-all hover:bg-white/[0.1] hover:scale-105 active:scale-95"
                        type="button"
                        data-testid="combat-defeat-back"
                    >
                        <Icon name="bolt" className="text-[20px]" />
                        Voltar revisoes
                    </button>
                </div>
            </div>
        </div>
    );
}
