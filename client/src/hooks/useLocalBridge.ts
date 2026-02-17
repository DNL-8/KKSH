
import { useState, useEffect, useCallback } from "react";

const BRIDGE_URL = "http://localhost:8765";

export interface BridgeItem {
    name: string;
    path: string;
    is_dir: boolean;
    size: number;
    mtime: number;
}

export function useLocalBridge() {
    const [isConnected, setIsConnected] = useState(false);
    const [drives, setDrives] = useState<string[]>([]);

    const checkConnection = useCallback(async () => {
        try {
            const res = await fetch(`${BRIDGE_URL}/health`);
            if (res.ok) {
                setIsConnected(true);
            } else {
                setIsConnected(false);
            }
        } catch {
            setIsConnected(false);
        }
    }, []);

    const listDrives = useCallback(async () => {
        try {
            const res = await fetch(`${BRIDGE_URL}/drives`);
            const data = await res.json();
            setDrives(data.drives);
            return data.drives;
        } catch (err) {
            console.error(err);
            return [];
        }
    }, []);

    const listPath = useCallback(async (path: string) => {
        try {
            const res = await fetch(`${BRIDGE_URL}/list?path=${encodeURIComponent(path)}`);
            if (!res.ok) throw new Error("Failed to list path");
            const data = await res.json();
            return data.items as BridgeItem[];
        } catch (err) {
            console.error(err);
            throw err;
        }
    }, []);

    const getStreamUrl = useCallback((path: string) => {
        return `${BRIDGE_URL}/stream?path=${encodeURIComponent(path)}`;
    }, []);

    // Auto-check on mount
    useEffect(() => {
        checkConnection();
        const interval = setInterval(checkConnection, 5000);
        return () => clearInterval(interval);
    }, [checkConnection]);

    return {
        isConnected,
        checkConnection,
        drives,
        listDrives,
        listPath,
        getStreamUrl,

        const scanFolder = useCallback(async (path: string) => {
            try {
                const res = await fetch(`${BRIDGE_URL}/library/scan`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path })
                });
                return res.ok;
            } catch {
                return false;
            }
        }, []);

        const getLibrary = useCallback(async () => {
            try {
                const res = await fetch(`${BRIDGE_URL}/library/videos`);
                if (!res.ok) return [];
                const data = await res.json();
                return data.videos;
            } catch {
                return [];
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
            bridgeUrl: BRIDGE_URL
        };
    }
