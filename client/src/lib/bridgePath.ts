function normalizeBridgePath(path: string): string {
    return path.replace(/\\/g, "/").replace(/\/+/g, "/").trim();
}

export function deriveBridgeName(path: string, fallback = "video-bridge.mp4"): string {
    const normalized = normalizeBridgePath(path);
    if (!normalized) {
        return fallback;
    }

    const parts = normalized.split("/").filter(Boolean);
    return parts[parts.length - 1] || fallback;
}

export function deriveBridgeRelativePath(path: string, rootLabel: string): string {
    const normalized = normalizeBridgePath(path);
    if (!normalized) {
        return rootLabel;
    }

    const parts = normalized.split("/").filter(Boolean);
    if (parts.length <= 1) {
        return rootLabel;
    }

    parts.pop();
    return parts.join("/") || rootLabel;
}
