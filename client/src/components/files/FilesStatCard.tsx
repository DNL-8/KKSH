import { Icon } from "../common/Icon";

export interface FilesStatCardProps {
    label: string;
    value: string;
    subtext: string;
    icon: string;
}

export function FilesStatCard({ label, value, subtext, icon }: FilesStatCardProps) {
    return (
        <div className="group relative overflow-hidden rounded-2xl border border-slate-300/50 liquid-glass/40 backdrop-blur-md p-4 transition-all duration-300 hover:bg-white/[0.03] hover:border-[hsl(var(--accent)/0.3)] hover:shadow-[0_0_24px_rgba(var(--glow),0.1)]">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[hsl(var(--accent)/0.06)] via-transparent to-amber-300/6 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex items-center gap-3">
                <div className="rounded-xl border border-cyan-500/25 bg-[#071427] p-2.5 text-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.16)]">
                    <Icon name={icon} className="text-[18px]" />
                </div>
                <div className="min-w-0">
                    <h4 className="files-display truncate text-[9px] uppercase text-slate-600">{label}</h4>
                    <div className="mt-1 flex items-end gap-2">
                        <span className="truncate text-xl font-black tracking-tight text-slate-900">{value}</span>
                        <span className="truncate text-[10px] font-mono uppercase text-slate-500">{subtext}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
