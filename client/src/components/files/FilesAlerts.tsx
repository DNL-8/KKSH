import { Icon } from "../common/Icon";
import { ErrorBanner } from "../common/ErrorBanner";
import { summarizeNames } from "./utils";

interface FilesAlertsProps {
    error: string | null;
    onClearError: () => void;
    storageUnavailable: boolean;
    directoryHandleSupported: boolean;
    highVolumeHint: string | null;
    onTriggerDirectoryConnect: () => void;
    onClearHighVolumeHint: () => void;
    visibleVideosCount: number;
    maxLibraryVideos: number;
    rejectedFiles: string[];
    statusMessage: string | null;
}

export function FilesAlerts({
    error,
    onClearError,
    storageUnavailable,
    directoryHandleSupported,
    highVolumeHint,
    onTriggerDirectoryConnect,
    onClearHighVolumeHint,
    visibleVideosCount,
    maxLibraryVideos,
    rejectedFiles,
    statusMessage,
}: FilesAlertsProps) {
    return (
        <div className="mt-4 space-y-3 z-10 relative">
            <ErrorBanner message={error} onClose={onClearError} />

            {storageUnavailable && (
                <div className="files-alert files-alert-warning flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                        <Icon name="exclamation" className="text-[14px] text-amber-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="mb-0.5 text-[10px] uppercase text-amber-300 font-black tracking-widest">Aviso de Armazenamento</p>
                        <p className="text-xs text-amber-200/80 font-medium leading-relaxed">Persistencia local indisponivel neste navegador. Os videos ficam salvos apenas nesta sessao.</p>
                    </div>
                </div>
            )}

            {!directoryHandleSupported && (
                <div className="files-alert files-alert-warning flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                        <Icon name="exclamation" className="text-[14px] text-amber-300" />
                    </div>
                    <div className="min-w-0">
                        <p className="mb-0.5 text-[10px] uppercase text-amber-200 font-black tracking-widest">Compatibilidade limitada (Firefox/Safari)</p>
                        <p className="text-xs text-amber-100/70 font-medium leading-relaxed">Seu navegador nao suporta conexao direta de pastas. Inicie o backend e use o botao <span className="font-bold text-emerald-300">Abrir Bridge</span> para navegar sem limitacoes.</p>
                    </div>
                </div>
            )}

            {highVolumeHint && directoryHandleSupported && (
                <div
                    className="files-alert files-alert-info flex flex-wrap items-center justify-between gap-3"
                    data-testid="high-volume-banner"
                >
                    <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--accent)/0.15)]">
                            <Icon name="info-circle" className="text-[14px] text-[hsl(var(--accent))]" />
                        </div>
                        <span className="text-xs font-medium text-[hsl(var(--accent-light))]">{highVolumeHint}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="rounded-xl border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.1)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[hsl(var(--accent-light))] transition-colors hover:bg-[hsl(var(--accent)/0.15)] active:scale-95 shadow-[0_0_15px_rgba(var(--glow),0.1)]"
                            data-testid="switch-to-directory-handle"
                            onClick={onTriggerDirectoryConnect}
                            type="button"
                        >
                            Conectar agora
                        </button>
                        <button
                            className="rounded-xl border border-cyan-500/20 liquid-glass-inner px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-200 transition-colors hover:bg-white/[0.08] hover:text-slate-50 active:scale-95"
                            onClick={onClearHighVolumeHint}
                            type="button"
                        >
                            Ignorar
                        </button>
                    </div>
                </div>
            )}

            {visibleVideosCount >= maxLibraryVideos && (
                <div className="files-alert files-alert-warning flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                        <Icon name="box-open" className="text-[14px] text-amber-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="mb-0.5 text-[10px] uppercase text-amber-200 font-black tracking-widest">Capacidade Maxima</p>
                        <p className="text-xs text-amber-100/70 font-medium leading-relaxed">Limite operacional atingido: {maxLibraryVideos} videos. Remova itens para importar novos.</p>
                    </div>
                </div>
            )}

            {rejectedFiles.length > 0 && (
                <div className="files-alert files-alert-warning flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                        <Icon name="trash" className="text-[14px] text-amber-300" />
                    </div>
                    <div className="min-w-0">
                        <p className="mb-0.5 text-[10px] uppercase text-amber-200 font-black tracking-widest">Filtro de Arquivos</p>
                        <p className="text-xs text-amber-100/70 leading-relaxed">Arquivos ignorados (nao sao video): {summarizeNames(rejectedFiles)}</p>
                    </div>
                </div>
            )}

            {statusMessage && (
                <div className="files-alert files-alert-success flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15">
                        <Icon name="check-circle" className="text-[14px] text-emerald-400" />
                    </div>
                    <div className="min-w-0">
                        <p className="mb-0.5 text-[10px] uppercase text-emerald-300 font-black tracking-widest">Status do Operador</p>
                        <p className="text-xs text-emerald-100/80 leading-relaxed">{statusMessage}</p>
                    </div>
                </div>
            )}

            <div className="files-alert files-alert-info flex items-start gap-3 opacity-70 hover:opacity-100 transition-opacity">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
                    <Icon name="device-hdd" className="text-[14px] text-blue-300" />
                </div>
                <div className="min-w-0">
                    <p className="mb-0.5 text-[10px] uppercase text-blue-200 font-black tracking-widest">Persistencia de dados</p>
                    <p className="text-xs text-blue-100/80 leading-relaxed">A biblioteca e salva no <strong>cache do navegador</strong>. Se voce limpar os dados do site, a biblioteca sera apagada. Use <strong>Backup</strong> regularmente.</p>
                </div>
            </div>
        </div>
    );
}

