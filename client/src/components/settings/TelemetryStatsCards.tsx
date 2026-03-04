import { useTheme } from "../../contexts/ThemeContext";

interface TelemetryStatsCardsProps {
    total: number;
    errors: number;
    importEvents: number;
    bridgeEvents: number;
}

export function TelemetryStatsCards({ total, errors, importEvents, bridgeEvents }: TelemetryStatsCardsProps) {
    const { isIosTheme } = useTheme();

    return (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                <p className={`text-[10px] font-bold uppercase tracking-wider ${isIosTheme ? "text-slate-500" : "text-slate-400"}`}>Total</p>
                <p className={`mt-1 text-xl font-black ${isIosTheme ? "text-slate-900" : "text-slate-100"}`}>{total}</p>
            </div>
            <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-300/70">Erros</p>
                <p className="mt-1 text-xl font-black text-red-300">{errors}</p>
            </div>
            <div className="rounded-xl border border-cyan-900/40 bg-cyan-950/20 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/70">Imports</p>
                <p className="mt-1 text-xl font-black text-cyan-300">{importEvents}</p>
            </div>
            <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">Bridge Play</p>
                <p className="mt-1 text-xl font-black text-emerald-300">{bridgeEvents}</p>
            </div>
        </div>
    );
}
