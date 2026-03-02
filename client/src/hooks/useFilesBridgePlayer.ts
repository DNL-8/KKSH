import { useCallback, useState } from "react";
import type { StoredVideo } from "../lib/localVideosStore";
import { trackFilesTelemetry } from "../lib/filesTelemetry";
import { deriveBridgeRelativePath } from "../lib/bridgePath";

export function useFilesBridgePlayer() {
    const [showBridgeBrowser, setShowBridgeBrowser] = useState(false);
    const [bridgeVideo, setBridgeVideo] = useState<{ video: StoredVideo; url: string } | null>(null);

    const handleBridgePlay = useCallback((url: string, name: string, path: string) => {
        const now = Date.now();

        if (!url) {
            trackFilesTelemetry("files.bridge.play.error", {
                source: "bridge",
                name,
                path,
                error: "empty_stream_url",
            });
            return;
        }

        const mockVideo: StoredVideo = {
            id: `bridge::${path || name}`,
            name,
            relativePath: deriveBridgeRelativePath(path, "Bridge"),
            size: 0,
            type: "video/mp4",
            lastModified: now,
            createdAt: now,
            sourceKind: "file",
            storageKind: "bridge",
            importSource: "input_file",
            bridgePath: path,
        };

        setBridgeVideo({ video: mockVideo, url });
        setShowBridgeBrowser(false);

        trackFilesTelemetry("files.bridge.play.success", {
            source: "bridge",
            name,
            path,
            trigger: "bridge_browser",
        });
    }, []);

    const openBridgeBrowser = useCallback(() => {
        setShowBridgeBrowser(true);
    }, []);

    const closeBridgeBrowser = useCallback(() => {
        setShowBridgeBrowser(false);
    }, []);

    const clearBridgeVideo = useCallback(() => {
        setBridgeVideo(null);
    }, []);

    return {
        showBridgeBrowser,
        bridgeVideo,
        handleBridgePlay,
        openBridgeBrowser,
        closeBridgeBrowser,
        clearBridgeVideo,
    };
}
