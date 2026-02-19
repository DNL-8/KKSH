
import { Icon } from "../common/Icon";
import type { GlobalStats } from "../../layout/types";
import { HudProgressBar } from "./HudProgressBar";
import { FilesStatCard } from "./FilesStatCard";

interface FilesHeaderProps {
    globalStats: GlobalStats;
}

export function FilesHeader({ globalStats }: FilesHeaderProps) {
    return (
        <>
            <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-4 backdrop-blur-md">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                        <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-cyan-500/30 bg-cyan-950/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                            <Icon name="activity" className="animate-pulse text-[12px]" />
                            System Ready
                        </div>
                        <div className="mb-1 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                            <span>UPLINK_ON</span>
                            <Icon name="angle-right" className="text-[12px]" />
                            <span>Arquivos de Sincronia</span>
                        </div>
                        <h2 className="text-3xl font-black uppercase italic tracking-tighter text-white">
                            Biblioteca de <span className="text-cyan-400">Aulas</span>
                        </h2>
                        <p className="mt-1 text-xs font-medium text-slate-500">
                            Player local com progresso RPG, playlist por pasta e conclusao com XP.
                        </p>
                    </div>

                    <div className="ml-auto flex flex-wrap items-center gap-5 rounded-2xl border border-slate-800 bg-black/40 px-4 py-3 shadow-lg">
                        <HudProgressBar value={globalStats.hp} max={100} tone="red" label="HP" textValue={`${Math.round(globalStats.hp)}%`} />
                        <HudProgressBar value={globalStats.mana} max={100} tone="blue" label="MP" textValue={`${Math.round(globalStats.mana)}%`} />
                        <HudProgressBar
                            value={globalStats.xp}
                            max={globalStats.maxXp}
                            tone="yellow"
                            label="EXP"
                            textValue={`LVL ${globalStats.level}`}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <FilesStatCard label="Nivel Atual" value={String(globalStats.level)} subtext="Iniciado" icon="shield-check" />
                <FilesStatCard label="Rank" value={globalStats.rank} subtext="Sistema" icon="trophy" />
                <FilesStatCard label="Experiencia" value={`${globalStats.xp}/${globalStats.maxXp}`} subtext="XP total" icon="bolt" />
                <FilesStatCard label="Gold" value={String(globalStats.gold)} subtext="Creditos" icon="coins" />
            </div>
        </>
    );
}

