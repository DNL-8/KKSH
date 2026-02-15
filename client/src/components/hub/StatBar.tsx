
interface StatBarProps {
    label: string;
    percent: number;
    gradientClass: string;
    sub: string;
    valueTestId?: string;
}

export function StatBar({ label, percent, gradientClass, sub, valueTestId }: StatBarProps) {
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                <span>{label}</span>
                <span data-testid={valueTestId}>{percent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full border border-white/10 bg-black/40">
                <div className={`h-full rounded-full bg-gradient-to-r ${gradientClass}`} style={{ width: `${percent}%` }} />
            </div>
            <div className="text-right text-[9px] text-slate-500">{sub}</div>
        </div>
    );
}
