import { useCallback, useEffect, useState } from "react";

import { useLocalBridge, type BridgeItem } from "../../hooks/useLocalBridge";
import { Icon } from "../common/Icon";

interface BridgeBrowserProps {
    onPlayVideo: (url: string, name: string, path: string) => void;
    onClose: () => void;
}

export function BridgeBrowser({ onPlayVideo, onClose }: BridgeBrowserProps) {
    const { listDrives, listPath, getStreamUrl, scanFolder, drives } = useLocalBridge();
    const [currentPath, setCurrentPath] = useState<string>("");
    const [items, setItems] = useState<BridgeItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [scanning, setScanning] = useState(false);

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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#090b10]">
                <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/50 p-4">
                    <div className="flex items-center gap-3">
                        <button
                            className="rounded-lg p-2 hover:bg-slate-800 disabled:opacity-50"
                            disabled={!currentPath}
                            onClick={goBack}
                            type="button"
                        >
                            <Icon name="arrow-left" className="text-slate-400" />
                        </button>
                        <h2 className="max-w-md truncate font-bold text-slate-200">
                            {currentPath || "Select Drive"}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {currentPath && (
                            <button
                                className="flex items-center gap-2 rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 transition-colors hover:bg-emerald-600/30 disabled:opacity-50"
                                disabled={scanning}
                                onClick={() => void handleScan()}
                                type="button"
                            >
                                {scanning ? <Icon name="spinner" className="animate-spin" /> : <Icon name="database" />}
                                {scanning ? "Scanning..." : "Scan to Library"}
                            </button>
                        )}
                        <button
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-900/20 hover:text-red-400"
                            onClick={onClose}
                            type="button"
                        >
                            <Icon name="x" />
                        </button>
                    </div>
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Icon name="spinner" className="text-3xl text-cyan-500 animate-spin" />
                        </div>
                    ) : !currentPath ? (
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            {drives.map((drive) => (
                                <button
                                    key={drive}
                                    className="flex flex-col items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/50 p-6 transition-all hover:border-cyan-500/50 hover:bg-cyan-900/20"
                                    onClick={() => void browse(drive)}
                                    type="button"
                                >
                                    <Icon name="device-hdd" className="text-4xl text-slate-500" />
                                    <span className="font-bold text-slate-200">{drive}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {items.map((item) => (
                                <div
                                    key={`${item.path}::${item.name}`}
                                    className={`cursor-pointer rounded-lg border border-transparent p-3 transition-colors ${item.is_dir
                                        ? "text-blue-200 hover:bg-slate-800/80"
                                        : isVideo(item.name)
                                            ? "text-emerald-100 hover:border-emerald-500/30 hover:bg-emerald-900/20"
                                            : "cursor-not-allowed text-slate-500 opacity-50"
                                        }`}
                                    onClick={() => {
                                        if (item.is_dir) {
                                            void browse(item.path);
                                            return;
                                        }
                                        if (isVideo(item.name)) {
                                            onPlayVideo(getStreamUrl(item.path), item.name, item.path);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon
                                            name={item.is_dir ? "folder" : isVideo(item.name) ? "file-video" : "file"}
                                            className={item.is_dir ? "text-blue-400" : isVideo(item.name) ? "text-emerald-400" : "text-slate-600"}
                                        />
                                        <span className="flex-1 truncate">{item.name}</span>
                                        <span className="text-xs font-mono opacity-50">
                                            {item.is_dir ? "-" : `${(item.size / 1024 / 1024).toFixed(2)} MB`}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {items.length === 0 && (
                                <div className="py-10 text-center italic text-slate-500">Empty folder</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
