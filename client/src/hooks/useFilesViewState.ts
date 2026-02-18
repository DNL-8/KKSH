// ... (imports remain)
import { useState, useEffect } from "react";
import { ORDER_MODES, TAB_MODES } from "../components/files/constants";
import type { OrderMode, TabMode } from "../components/files/types";

const FILES_VIEW_STATE_STORAGE_PREFIX = "cmd8_files_view_state_v1";

interface FilesViewStateSnapshot {
    selectedLessonId: string | null;
    collapsedFolders: Record<string, boolean>;
    orderMode: OrderMode;
    activeTab: TabMode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOrderMode(value: string): value is OrderMode {
    return ORDER_MODES.includes(value as OrderMode);
}

function isTabMode(value: string): value is TabMode {
    return TAB_MODES.includes(value as TabMode);
}

function viewStateStorageKey(scope: string): string {
    return `${FILES_VIEW_STATE_STORAGE_PREFIX}:${scope}`;
}

function sanitizeBooleanMap(value: unknown): Record<string, boolean> {
    if (!isRecord(value)) {
        return {};
    }
    const next: Record<string, boolean> = {};
    for (const [key, item] of Object.entries(value)) {
        if (typeof item === "boolean") {
            next[key] = item;
        }
    }
    return next;
}

function readFilesViewState(scope: string): FilesViewStateSnapshot | null {
    if (typeof window === "undefined") {
        return null;
    }

    try {
        const raw = window.localStorage.getItem(viewStateStorageKey(scope));
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw) as unknown;
        if (!isRecord(parsed)) {
            return null;
        }

        const selectedLessonId =
            typeof parsed.selectedLessonId === "string"
                ? parsed.selectedLessonId
                : parsed.selectedLessonId === null
                    ? null
                    : null;

        const orderMode =
            typeof parsed.orderMode === "string" && isOrderMode(parsed.orderMode)
                ? parsed.orderMode
                : "newest";

        const activeTab =
            typeof parsed.activeTab === "string" && isTabMode(parsed.activeTab)
                ? parsed.activeTab
                : "overview";

        return {
            selectedLessonId,
            collapsedFolders: sanitizeBooleanMap(parsed.collapsedFolders),
            orderMode,
            activeTab,
        };
    } catch {
        return null;
    }
}

export function useFilesViewState(authUserId: string | null) {
    const viewStateScope = authUserId ?? "guest";
    const currentViewStateKey = viewStateStorageKey(viewStateScope);

    const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
    const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
    const [orderMode, setOrderMode] = useState<OrderMode>("newest");
    const [activeTab, setActiveTab] = useState<TabMode>("overview");
    const [viewStateReadyKey, setViewStateReadyKey] = useState<string | null>(null);

    // Read state from storage
    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        setViewStateReadyKey(null);
        const snapshot = readFilesViewState(viewStateScope);
        if (snapshot) {
            setSelectedLessonId(snapshot.selectedLessonId);
            setCollapsedFolders(snapshot.collapsedFolders);
            setOrderMode(snapshot.orderMode);
            setActiveTab(snapshot.activeTab);
        }
        setViewStateReadyKey(currentViewStateKey);
    }, [currentViewStateKey, viewStateScope]);

    // Write state to storage
    useEffect(() => {
        if (typeof window === "undefined" || viewStateReadyKey !== currentViewStateKey) {
            return;
        }

        const snapshot: FilesViewStateSnapshot = {
            selectedLessonId,
            collapsedFolders,
            orderMode,
            activeTab,
        };
        try {
            window.localStorage.setItem(currentViewStateKey, JSON.stringify(snapshot));
        } catch {
            // Ignore storage write failures.
        }
    }, [
        activeTab,
        collapsedFolders,
        currentViewStateKey,
        orderMode,
        selectedLessonId,
        viewStateReadyKey,
    ]);

    return {
        selectedLessonId,
        setSelectedLessonId,
        collapsedFolders,
        setCollapsedFolders,
        orderMode,
        setOrderMode,
        activeTab,
        setActiveTab,
    };
}
