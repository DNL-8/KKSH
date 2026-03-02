import { useCallback, useEffect, useState } from "react";

import { useLocalBridge, type BridgeItem } from "../../hooks/useLocalBridge";
import { Icon } from "../common/Icon";
import { useTheme } from "../../contexts/ThemeContext";
import { useToast } from "../common/Toast";

interface BridgeBrowserProps {
    onPlayVideo: (url: string, name: string, path: string) => void;
    onClose: () => void;
}

export function BridgeBrowser({ onPlayVideo, onClose }: BridgeBrowserProps) {
    const { isIosTheme } = useTheme();
    const { showToast } = useToast();
    const { listDrives, listPath, getStreamUrl, scanFolder, deletePath, drives } = useLocalBridge();
    const [currentPath, setCurrentPath] = useState<string>("");
    const [items, setItems] = useState<BridgeItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [deletingPath, setDeletingPath] = useState<string | null>(null);

    const loadDrives = useCallback(async () => {
        setLoading(true);
        try {
            await listDrives();
        } finally {
            setLoading(false);
        }
    }, [listDrives]);

    useEffect(() => {
        void loadDrives();
    }, [loadDrives]);

    const browse = useCallback(async (path: string) => {
        setLoading(true);
        try {
            const result = await listPath(path);
            setItems(result);
            setCurrentPath(path);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [listPath]);

    const goBack = useCallback(() => {
        if (!currentPath) return;

        const parts = currentPath.split(/[/\\]/);
        parts.pop();

        if (parts.length === 0 || (parts.length === 1 && parts[0] === "")) {
            setCurrentPath("");
            setItems([]);
            return;
        }

        const newPath = parts.join("/");
        if (drives.includes(currentPath) || currentPath.match(/^[A-Z]:\/?$/i)) {
            setCurrentPath("");
            setItems([]);
            return;
        }

        void browse(newPath);
    }, [browse, currentPath, drives]);

    const isVideo = (name: string) => /\.(mp4|mkv|avi|mov|webm)$/i.test(name);

    const handleScan = useCallback(async () => {
        if (!currentPath) return;
        setScanning(true);
        try {
            await scanFolder(currentPath);
        } finally {
            setScanning(false);
        }
    }, [currentPath, scanFolder]);

    const handleDelete = useCallback(async (item: BridgeItem) => {
        setDeletingPath(item.path);
        try {
            const deleted = await deletePath(item.path, item.is_dir);
            if (!deleted) {
                showToast("Nao foi possivel excluir o item no Bridge.", "error");
                return;
            }

            showToast(`${item.is_dir ? "Pasta" : "Arquivo"} excluido com sucesso.`, "success");

            if (currentPath) {
                await browse(currentPath);
            }
        } finally {
            setDeletingPath(null);
        }
    }, [browse, currentPath, deletePath, showToast]);

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [onClose]);

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${isIosTheme ? "ios26-section" : "liquid-glass backdrop-blur-sm"}`} role="dialog" aria-modal="true" aria-label="Navegador de arquivos Bridge">
            <div className={`flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl ${isIosTheme ? "ios26-section-hero" : "border border-cyan-500/25 bg-[#090b10]"}`}>
                <div className={`flex items-center justify-between border-b p-4 ${isIosTheme ? "ios26-divider" : "border-cyan-500/20 liquid-glass"}`}>
                    <div className="flex items-center gap-3">
                        <button
                            className={`rounded-lg p-2 disabled:opacity-50 ${isIosTheme ? "ios26-control ios26-focusable" : "text-slate-300 hover:bg-white/[0.08] hover:text-slate-100"}`}
                            disabled={!currentPath}
                            onClick={goBack}
                            type="button"
                            aria-label="Voltar"
                        >
                            <Icon name="arrow-left" />
                        </button>
                        <h2 className="max-w-md truncate font-bold text-slate-200">
                            {currentPath || "Selecione unidade"}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {currentPath && (
                            <button
                                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50 ${isIosTheme ? "ios26-control ios26-focusable ios26-status-success" : "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"}`}
                                disabled={scanning}
                                onClick={() => void handleScan()}
                                type="button"
                            >
                                {scanning ? <Icon name="spinner" className="animate-spin" /> : <Icon name="database" />}
                                {scanning ? "Escaneando..." : "Escanear para biblioteca"}
                            </button>
                        )}
                        <button
                            className={`rounded-lg p-2 ${isIosTheme ? "ios26-control ios26-focusable text-slate-700 hover:text-slate-900" : "text-slate-300 hover:bg-red-900/20 hover:text-red-300"}`}
                            onClick={onClose}
                            type="button"
                            aria-label="Fechar navegador Bridge"
                        >
                            <Icon name="x" />
                        </button>
                    </div>
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto p-4" aria-busy={loading ? "true" : "false"}>
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Icon name="spinner" className="text-3xl text-cyan-500 animate-spin" />
                        </div>
                    ) : !currentPath ? (
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            {drives.map((drive) => (
                                <button
                                    key={drive}
                                    className="flex flex-col items-center gap-3 rounded-xl border border-cyan-500/25 liquid-glass-inner p-6 transition-all hover:border-cyan-500/50 hover:bg-cyan-900/20"
                                    onClick={() => void browse(drive)}
                                    type="button"
                                >
                                    <Icon name="device-hdd" className="text-4xl text-slate-300" />
                                    <span className="font-bold text-slate-200">{drive}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {items.map((item) => {
                                const itemIsVideo = isVideo(item.name);
                                const actionable = item.is_dir || itemIsVideo;

                                return (
                                    <div
                                        key={`${item.path}::${item.name}`}
                                        className={`flex w-full items-center gap-2 rounded-lg border border-transparent p-1 transition-colors ${item.is_dir
                                            ? "hover:bg-white/[0.10]"
                                            : itemIsVideo
                                                ? "hover:border-emerald-500/30 hover:bg-emerald-900/20"
                                                : "opacity-80"
                                            }`}
                                    >
                                        <button
                                            className={`min-w-0 flex-1 rounded-md p-2 text-left ${item.is_dir
                                                ? "text-blue-200"
                                                : itemIsVideo
                                                    ? "text-emerald-100"
                                                    : "cursor-not-allowed text-slate-400 opacity-50"
                                                }`}
                                            disabled={!actionable}
                                            onClick={() => {
                                                if (item.is_dir) {
                                                    void browse(item.path);
                                                    return;
                                                }
                                                if (itemIsVideo) {
                                                    onPlayVideo(getStreamUrl(item.path), item.name, item.path);
                                                }
                                            }}
                                            type="button"
                                            aria-label={item.is_dir ? `Abrir pasta ${item.name}` : itemIsVideo ? `Reproduzir video ${item.name}` : `Arquivo nao suportado ${item.name}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Icon
                                                    name={item.is_dir ? "folder" : itemIsVideo ? "file-video" : "file"}
                                                    className={item.is_dir ? "text-blue-400" : itemIsVideo ? "text-emerald-400" : "text-slate-400"}
                                                />
                                                <span className="flex-1 truncate">{item.name}</span>
                                                <span className="text-xs font-mono opacity-50">
                                                    {item.is_dir ? "-" : `${(item.size / 1024 / 1024).toFixed(2)} MB`}
                                                </span>
                                            </div>
                                        </button>
                                        <button
                                            className={`shrink-0 rounded-md p-2 transition-colors disabled:opacity-50 ${isIosTheme ? "ios26-control ios26-focusable text-red-600 hover:text-red-700" : "text-red-300 hover:bg-red-900/20 hover:text-red-200"}`}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                void handleDelete(item);
                                            }}
                                            type="button"
                                            disabled={deletingPath === item.path}
                                            aria-label={`Excluir ${item.name}`}
                                            title={`Excluir ${item.name}`}
                                        >
                                            {deletingPath === item.path ? (
                                                <Icon name="spinner" className="animate-spin" />
                                            ) : (
                                                <Icon name="trash" />
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                            {items.length === 0 && (
                                <div className="py-10 text-center italic text-slate-400">Pasta vazia</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

