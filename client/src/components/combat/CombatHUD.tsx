import { Icon } from "../common/Icon";
import { widthPercentClass } from "../../lib/percentClasses";

interface CombatHUDProps {
    enemyHp: number;
    enemyMaxHp: number;
    playerHp: number;
    playerMaxHp: number;
    hpPercent: number;
    playerHpPercent: number;
}

export function CombatHUD({ enemyHp, enemyMaxHp, playerHp, playerMaxHp, hpPercent, playerHpPercent }: CombatHUDProps) {
    return (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-4">
                <div className="flex items-end justify-between px-4">
                    <span className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-red-500 drop-shadow-sm">
                        <Icon name="skull" className="text-[18px]" />
                        HP boss
                    </span>
                    <span className="font-mono text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-red-100 drop-shadow-sm">
                        <span data-testid="enemy-hp-value">{enemyHp}</span>/<span data-testid="enemy-hp-max">{enemyMaxHp}</span>
                    </span>
                </div>
                <div className="h-8 w-full overflow-hidden rounded-3xl border border-red-950/50 liquid-glass/80 shadow-[inset_0_5px_15px_rgba(0,0,0,0.8)] ring-2 ring-red-950/30 backdrop-blur-sm p-1">
                    <div
                        className={`relative h-full rounded-2xl bg-gradient-to-r from-red-900 via-red-600 to-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6),inset_0_2px_4px_rgba(255,255,255,0.4)] transition-all duration-700 ease-out ${widthPercentClass(hpPercent)}`}
                        data-testid="enemy-hp-bar"
                    >
                        <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-end justify-between px-4">
                    <span className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-400 drop-shadow-sm">
                        <Icon name="shield" className="text-[18px]" />
                        HP Operador
                    </span>
                    <span className="font-mono text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-100 drop-shadow-sm">
                        <span data-testid="player-hp-value">{playerHp}</span>/<span data-testid="player-hp-max">{playerMaxHp}</span>
                    </span>
                </div>
                <div className="h-8 w-full overflow-hidden rounded-3xl border border-cyan-950/50 liquid-glass/80 shadow-[inset_0_5px_15px_rgba(0,0,0,0.8)] ring-2 ring-cyan-950/30 backdrop-blur-sm p-1">
                    <div
                        className={`relative h-full rounded-2xl bg-gradient-to-r from-blue-900 via-blue-500 to-cyan-400 shadow-[0_0_20px_rgba(59,130,246,0.6),inset_0_2px_4px_rgba(255,255,255,0.4)] transition-all duration-700 ease-out ${widthPercentClass(playerHpPercent)}`}
                        data-testid="player-hp-bar"
                    >
                        <div className="absolute inset-0 animate-shimmer bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
                    </div>
                </div>
            </div>
        </div>
    );
}
