import { Icon } from "../common/Icon";
import { HoldButton } from "../common/HoldButton";

interface SettingsDangerZoneProps {
    dangerBusy: "logout" | "reset" | null;
    executeHardReset: () => void;
    handleLogout: () => void;
}

export function SettingsDangerZone({ dangerBusy, executeHardReset, handleLogout }: SettingsDangerZoneProps) {
    return (
        <section className="relative overflow-hidden rounded-[40px] border border-red-500/30 bg-[#0a0f1d]/90 p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_80px_rgba(220,38,38,0.15)] backdrop-blur-xl">
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_15px,rgba(220,38,38,0.03)_15px,rgba(220,38,38,0.03)_30px)] pointer-events-none mix-blend-overlay opacity-80" />
            <div className="absolute -left-32 -top-32 h-64 w-64 rounded-full bg-red-600/20 blur-[100px] pointer-events-none" />

            <div className="relative z-10">
                <div className="mb-8 flex items-center gap-4 text-red-500">
                    <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                        <Icon name="exclamation" className="animate-pulse text-[24px]" />
                    </div>
                    <h2 className="text-xl font-black uppercase tracking-[0.2em] drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">Zona de Perigo</h2>
                </div>

                <div className="space-y-5">
                    <div className="flex flex-col gap-5 rounded-[24px] border border-red-900/40 bg-red-950/20 p-8 md:flex-row md:items-center md:justify-between shadow-[inset_0_2px_15px_rgba(220,38,38,0.05)] transition-all hover:bg-red-950/30">
                        <div>
                            <h3 className="font-bold text-white text-[15px] mb-1 drop-shadow-sm">Resetar Progresso Local</h3>
                            <p className="text-[13px] text-red-200/60 font-medium">Limpa dados locais e zera progresso da conta. Nao apaga o usuario.</p>
                        </div>
                        <HoldButton
                            label="SEGURE PARA DELETAR TUDO"
                            onComplete={executeHardReset}
                            loading={dangerBusy === "reset"}
                            holdDuration={1000}
                            progressLabel="CONFIRMANDO"
                            className="w-full rounded-[16px] border border-red-400/50 bg-red-600 px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all active:scale-95 disabled:opacity-50 disabled:grayscale md:w-auto hover:bg-red-500 hover:shadow-[0_0_30px_rgba(220,38,38,0.8)]"
                        />
                    </div>

                    <div className="flex flex-col gap-5 rounded-[24px] border border-red-900/40 bg-red-950/20 p-8 md:flex-row md:items-center md:justify-between shadow-[inset_0_2px_15px_rgba(220,38,38,0.05)] transition-all hover:bg-red-950/30">
                        <div>
                            <h3 className="font-bold text-white text-[15px] mb-1 drop-shadow-sm">Encerrar Sessao</h3>
                            <p className="text-[13px] text-red-200/60 font-medium">Desconecta do terminal com seguranca.</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            disabled={dangerBusy === "logout"}
                            className="flex items-center justify-center gap-3 w-full rounded-[16px] border border-red-500/30 bg-black/40 px-8 py-4 text-[11px] font-black uppercase tracking-[0.2em] text-red-400 transition-all hover:bg-red-950/50 hover:border-red-500/60 hover:text-red-300 hover:shadow-[0_0_20px_rgba(220,38,38,0.2)] active:scale-95 md:w-auto shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
                            type="button"
                        >
                            <Icon name="trash" className="text-[18px]" />
                            Desconectar
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
