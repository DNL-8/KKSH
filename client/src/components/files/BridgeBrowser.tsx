
import { useState, useEffect } from "react";
import { useLocalBridge, BridgeItem } from "../../hooks/useLocalBridge";
import { Icon } from "../common/Icon";

interface BridgeBrowserProps {
    onPlayVideo: (url: string, name: string, path: string) => void;
    onClose: () => void;
}

export function BridgeBrowser({ onPlayVideo, onClose }: BridgeBrowserProps) {
    const { listDrives, listPath, getStreamUrl, scanFolder } = useLocalBridge();
    const [currentPath, setCurrentPath] = useState<string>("");
    // ... existing state ...
    const [scanning, setScanning] = useState(false);

    // ... existing loadDrives ...

    const handleScan = async () => {
        if (!currentPath) return;
        setScanning(true);
        await scanFolder(currentPath);
        setScanning(false);
        // Maybe show toast? For now just visual feedback on button
    };

    // ... existing browse ...

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-4xl bg-[#090b10] border border-slate-800 rounded-2xl overflow-hidden flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        {/* ... existing back button and title ... */}
                        <button onClick={goBack} disabled={!currentPath} className="p-2 hover:bg-slate-800 rounded-lg disabled:opacity-50">
                            <Icon name="arrow-left" className="text-slate-400" />
                        </button>
                        <h2 className="font-bold text-slate-200 truncate max-w-md">
                            {currentPath || "Select Drive"}
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {currentPath && (
                            <button
                                onClick={handleScan}
                                disabled={scanning}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                            >
                                {scanning ? <Icon name="spinner" className="animate-spin" /> : <Icon name="database" />}
                                {scanning ? "Scanning..." : "Scan to Library"}
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-red-900/20 text-slate-400 hover:text-red-400 rounded-lg">
                            <Icon name="x" />
                        </button>
                    </div>
                </div>

                {/* Content... */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-10">
                            <Icon name="spinner" className="animate-spin text-cyan-500 text-3xl" />
                        </div>
                    ) : !currentPath ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {drives.map(drive => (
                                <button
                                    key={drive}
                                    onClick={() => browse(drive)}
                                    className="p-6 bg-slate-800/50 hover:bg-cyan-900/20 border border-slate-700 hover:border-cyan-500/50 rounded-xl flex flex-col items-center gap-3 transition-all"
                                >
                                    <Icon name="device-hdd" className="text-4xl text-slate-500" />
                                    <span className="font-bold text-slate-200">{drive}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {items.map(item => (
                                <div
                                    key={item.name}
                                    className={`flex items-center gap-3 p-3 rounded-lg border border-transparent transition-colors cursor-pointer ${item.is_dir
                                        ? "hover:bg-slate-800/80 text-blue-200"
                                        : isVideo(item.name)
                                            ? "hover:bg-emerald-900/20 text-emerald-100 hover:border-emerald-500/30"
                                            : "opacity-50 cursor-not-allowed text-slate-500"
                                        }`}
                                    onClick={() => {
                                        if (item.is_dir) browse(item.path);
                                        else if (isVideo(item.name)) onPlayVideo(getStreamUrl(item.path), item.name, item.path);
                                    }}
                                >
                                    <Icon
                                        name={item.is_dir ? "folder" : isVideo(item.name) ? "file-video" : "file"}
                                        className={item.is_dir ? "text-blue-400" : isVideo(item.name) ? "text-emerald-400" : "text-slate-600"}
                                    />
                                    <span className="flex-1 truncate">{item.name}</span>
                                    <span className="text-xs font-mono opacity-50">
                                        {item.is_dir ? "-" : (item.size / 1024 / 1024).toFixed(2) + " MB"}
                                    </span>
                                </div>
                            ))}
                            {items.length === 0 && (
                                <div className="text-center text-slate-500 py-10 italic">Empty folder</div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
