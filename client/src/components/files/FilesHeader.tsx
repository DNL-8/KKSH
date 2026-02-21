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
            <div className="rounded-[26px] border border-white/10 bg-slate-950/60 backdrop-blur-2xl px-5 py-6 md:px-8 shadow-2xl">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
                    <div className="min-w-0 space-y-2">
                        <div className="files-chip files-pulse-glow w-fit">
                            <Icon name="activity" className="text-[12px]" />
                            Operacao ativa
                        </div>
                        <p className="files-display flex items-center gap-2 text-[10px] uppercase text-cyan-200/80">
                            <span>uplink_on</span>
                            <Icon name="angle-right" className="text-[10px]" />
                            <span>biblioteca local</span>
                        </p>
                        <h2 className="files-display text-2xl font-extrabold uppercase tracking-[0.14em] text-white md:text-4xl">
                            Arquivos <span className="text-cyan-300">Avulsos</span>
                        </h2>
                        <p className="max-w-2xl text-xs text-slate-400 md:text-sm">
                            Player local com progresso RPG, trilha por pasta e conclusao com XP em tempo real.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-slate-900/40 backdrop-blur-md flex w-full flex-wrap items-center gap-5 px-5 py-4 xl:w-auto shadow-inner">
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
