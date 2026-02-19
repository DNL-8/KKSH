import { useCallback, useEffect, useState } from "react";

export const LOCAL_BRIDGE_URL = "http://localhost:8765";

export interface BridgeItem {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    mtime: number;
}

export function buildBridgeStreamUrl(path: string): string {
    return `${LOCAL_BRIDGE_URL}/stream?path=${encodeURIComponent(path)}`;
}

export function useLocalBridge() {
    const [isConnected, setIsConnected] = useState(false);
    const [drives, setDrives] = useState<string[]>([]);

    const checkConnection = useCallback(async () => {
        try {
            const res = await fetch(`${LOCAL_BRIDGE_URL}/health`);
            setIsConnected(res.ok);
        } catch {
            setIsConnected(false);
        }
    }, []);

    const listDrives = useCallback(async () => {
        try {
            const res = await fetch(`${LOCAL_BRIDGE_URL}/drives`);
            if (!res.ok) {
                return [] as string[];
            }
            const data = (await res.json()) as { drives?: unknown };
            const nextDrives = Array.isArray(data.drives)
                ? data.drives.filter((item): item is string => typeof item === "string")
                : [];
            setDrives(nextDrives);
            return nextDrives;
        } catch {
            return [] as string[];
        }
    }, []);

    const listPath = useCallback(async (path: string) => {
        const res = await fetch(`${LOCAL_BRIDGE_URL}/list?path=${encodeURIComponent(path)}`);
        if (!res.ok) {
            throw new Error("Failed to list path");
        }
        const data = (await res.json()) as { items?: unknown };
        if (!Array.isArray(data.items)) {
            return [] as BridgeItem[];
        }
        return data.items as BridgeItem[];
    }, []);

    const getStreamUrl = useCallback((path: string) => {
        return buildBridgeStreamUrl(path);
    }, []);

    useEffect(() => {
        void checkConnection();
        const interval = setInterval(() => {
            void checkConnection();
        }, 5000);
        return () => clearInterval(interval);
    }, [checkConnection]);

    const scanFolder = useCallback(async (path: string) => {
        try {
            const res = await fetch(`${LOCAL_BRIDGE_URL}/library/scan`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path }),
            });
            return res.ok;
        } catch {
            return false;
        }
    }, []);

    const getLibrary = useCallback(async () => {
        try {
            const res = await fetch(`${LOCAL_BRIDGE_URL}/library/videos`);
            if (!res.ok) {
                return [] as unknown[];
            }
            const data = (await res.json()) as { videos?: unknown };
            return Array.isArray(data.videos) ? data.videos : [];
        } catch {
            return [] as unknown[];
        }
    }, []);

    return {
        isConnected,
        checkConnection,
        drives,
        listDrives,
        listPath,
        getStreamUrl,
        scanFolder,
        getLibrary,
        bridgeUrl: LOCAL_BRIDGE_URL,
    };
}
