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
        <div className="mt-3 space-y-2 z-10 relative">
            <ErrorBanner message={error} onClose={onClearError} />

            {storageUnavailable && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 backdrop-blur-sm">
                    <Icon name="exclamation" className="mt-0.5 text-[16px] text-amber-500/80" />
                    <div>
                        <p className="mb-0.5 text-[10px] uppercase text-amber-400 font-bold tracking-widest">Aviso de Armazenamento</p>
                        <p className="text-xs text-amber-200/80 font-medium">Persistência local indisponível neste navegador. Os vídeos ficam salvos apenas nesta sessão.</p>
                    </div>
                </div>
            )}

            {!directoryHandleSupported && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 backdrop-blur-sm">
                    <Icon name="exclamation" className="mt-0.5 text-[16px] text-amber-300" />
                    <div>
                        <p className="mb-0.5 text-[10px] uppercase text-amber-200 font-bold tracking-widest">Compatibilidade limitada (Firefox/Safari)</p>
                        <p className="text-xs text-amber-100/70 font-medium">Seu navegador não suporta conexão direta de pastas. Inicie o backend e use o botão <span className="font-bold text-emerald-300">BROWSE BRIDGE</span> para navegar sem limitações.</p>
                    </div>
                </div>
            )}

            {highVolumeHint && directoryHandleSupported && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--accent)/0.2)] bg-[hsl(var(--accent)/0.05)] px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <Icon name="info-circle" className="text-[16px] text-[hsl(var(--accent))]" />
                        <span className="text-xs font-medium text-[hsl(var(--accent-light))]">{highVolumeHint}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="rounded-xl border border-[hsl(var(--accent)/0.3)] bg-[hsl(var(--accent)/0.1)] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[hsl(var(--accent-light))] transition-colors hover:bg-[hsl(var(--accent)/0.15)] active:scale-95 shadow-[0_0_15px_rgba(var(--glow),0.1)]"
                            onClick={onTriggerDirectoryConnect}
                            type="button"
                        >
                            Conectar agora
                        </button>
                        <button
                            className="rounded-xl border border-slate-300/50 liquid-glass-inner px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-800 transition-colors hover:liquid-glass-inner active:scale-95"
                            onClick={onClearHighVolumeHint}
                            type="button"
                        >
                            Ignorar
                        </button>
                    </div>
                </div>
            )}

            {visibleVideosCount >= maxLibraryVideos && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 backdrop-blur-sm">
                    <Icon name="box-open" className="mt-0.5 text-[16px] text-amber-400" />
                    <div>
                        <p className="mb-0.5 text-[10px] uppercase text-amber-200 font-bold tracking-widest">Capacidade Máxima</p>
                        <p className="text-xs text-amber-100/70 font-medium">Limite operacional atingido: {maxLibraryVideos} vídeos. Remova itens para importar novos.</p>
                    </div>
                </div>
            )}

            {rejectedFiles.length > 0 && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 backdrop-blur-sm">
                    <Icon name="trash" className="mt-0.5 text-[16px] text-amber-300" />
                    <div>
                        <p className="mb-0.5 text-[10px] uppercase text-amber-200 font-bold tracking-widest">Filtro de Arquivos</p>
                        <p className="text-xs text-amber-100/70">Arquivos ignorados (nao sao video): {summarizeNames(rejectedFiles)}</p>
                    </div>
                </div>
            )}

            {statusMessage && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 backdrop-blur-sm">
                    <Icon name="check-circle" className="mt-0.5 text-[16px] text-emerald-400" />
                    <div>
                        <p className="mb-0.5 text-[10px] uppercase text-emerald-300 font-bold tracking-widest">Status do Operador</p>
                        <p className="text-xs text-emerald-100/80">{statusMessage}</p>
                    </div>
                </div>
            )}

            <div className="flex items-start gap-3 rounded-2xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 backdrop-blur-sm">
                <Icon name="device-hdd" className="mt-0.5 text-[16px] text-blue-300" />
                <div>
                    <p className="mb-0.5 text-[10px] uppercase text-blue-200 font-bold tracking-widest">Persistencia de dados</p>
                    <p className="text-xs text-blue-100/80">A biblioteca e salva no <strong>cache do navegador</strong>. Se voce limpar os dados do site, a biblioteca sera apagada. Use <strong>Backup</strong> regularmente.</p>
                </div>
            </div>
        </div>
    );
}
