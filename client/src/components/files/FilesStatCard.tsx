
import { Icon } from "../common/Icon";

export interface FilesStatCardProps {
    label: string;
    value: string;
    subtext: string;
    icon: string;
}

export function FilesStatCard({ label, value, subtext, icon }: FilesStatCardProps) {
    return (
        <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 backdrop-blur-md transition-all duration-300 hover:border-cyan-500/40">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-violet-500/5 opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative flex items-center gap-4">
                <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-3 shadow-inner transition-transform duration-300 group-hover:scale-105">
                    <Icon name={icon} className="text-cyan-400 text-[22px]" />
                </div>
                <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</h4>
                    <div className="mt-0.5 flex items-baseline gap-2">
                        <span className="text-2xl font-black tracking-tight text-white transition-colors group-hover:text-cyan-300">{value}</span>
                        <span className="text-[10px] font-mono text-slate-500">{subtext}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
