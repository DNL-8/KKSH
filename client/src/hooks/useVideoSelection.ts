import { useCallback, useEffect, useMemo, useState } from "react";
import { type AuthUser } from "../layout/types";
import {
    ApiRequestError,
    createSession,
    listVideoSessions,
} from "../lib/api";
import {
    type StoredVideo,
    DEFAULT_RELATIVE_PATH,
} from "../lib/localVideosStore";
import {
    VIDEO_COMPLETION_PREFIX,
    buildVideoRef,
    extractVideoRefFromNotes,
    resolvePlayableFile,
    resolveVideoCompletionRef,
    subjectFromRelativePath,
    toErrorMessage,
} from "../components/files/utils";
import type { FolderSection } from "../components/files/types";
import { buildBridgeStreamUrl } from "./useLocalBridge";
import { trackFilesTelemetry } from "../lib/filesTelemetry";

const MAX_SESSION_PAGES = 300;

interface UseVideoSelectionProps {
    visibleVideos: StoredVideo[];
    folderSections: FolderSection[];
    selectedLessonId: string | null;
    setSelectedLessonId: (id: string | null) => void;
    authUser: AuthUser | null;
    openAuthPanel: () => void;
    invalidateProgressCaches: () => Promise<void>;
}

export function useVideoSelection({
    visibleVideos,
    folderSections,
    selectedLessonId,
    setSelectedLessonId,
    authUser,
    openAuthPanel,
    invalidateProgressCaches,
}: UseVideoSelectionProps) {
    const [selectedVideoUrl, setSelectedVideoUrl] = useState("");
    const [selectedDurationSec, setSelectedDurationSec] = useState<number | null>(null);

    const [completedVideoRefs, setCompletedVideoRefs] = useState<Set<string>>(new Set());
    const [resolvedVideoRefsById, setResolvedVideoRefsById] = useState<Record<string, string>>({});
    const [selectedVideoRef, setSelectedVideoRef] = useState<string | null>(null);
    const [resolvingSelectedVideoRef, setResolvingSelectedVideoRef] = useState(false);
    const [loadingCompletions, setLoadingCompletions] = useState(false);
    const [completingLesson, setCompletingLesson] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);

    const authUserId = authUser?.id ?? null;

    const selectedVideo = useMemo<StoredVideo | null>(() => {
        if (!selectedLessonId) {
            return null;
        }
        return visibleVideos.find((video) => video.id === selectedLessonId) ?? null;
    }, [selectedLessonId, visibleVideos]);

    const isVideoCompleted = useCallback(
        (video: StoredVideo | null): boolean => {
            if (!video) {
                return false;
            }
            const legacyRef = buildVideoRef(video);
            if (completedVideoRefs.has(legacyRef)) {
                return true;
            }
            const resolvedRef = resolvedVideoRefsById[video.id];
            return Boolean(resolvedRef && completedVideoRefs.has(resolvedRef));
        },
        [completedVideoRefs, resolvedVideoRefsById],
    );

    const selectedVideoCompleted = isVideoCompleted(selectedVideo);

    const loadCompletedVideoRefs = useCallback(async () => {
        if (!authUserId) {
            setCompletedVideoRefs(new Set());
            setLoadingCompletions(false);
            return;
        }

        setLoadingCompletions(true);
        try {
            const refs = new Set<string>();
            let cursor: string | undefined;
            let pageIndex = 0;

            while (pageIndex < MAX_SESSION_PAGES) {
                const payload = await listVideoSessions(cursor);

                for (const row of payload.sessions) {
                    const ref = extractVideoRefFromNotes(row.notes);
                    if (ref) {
                        refs.add(ref);
                    }
                }

                pageIndex += 1;
                if (!payload.nextCursor) {
                    cursor = undefined;
                    break;
                }
                cursor = payload.nextCursor;
            }

            setCompletedVideoRefs(refs);
            if (cursor) {
                setStatusMessage(
                    `Sincronizacao parcial de aulas concluidas: limite de ${MAX_SESSION_PAGES} paginas atingido.`,
                );
            }
        } catch (loadError) {
            setError(toErrorMessage(loadError, "Nao foi possivel sincronizar o progresso das aulas."));
        } finally {
            setLoadingCompletions(false);
        }
    }, [authUserId]);

    useEffect(() => {
        void loadCompletedVideoRefs();
    }, [loadCompletedVideoRefs]);

    useEffect(() => {
        if (!selectedVideo) {
            setSelectedVideoRef(null);
            setResolvingSelectedVideoRef(false);
            return;
        }

        const legacyRef = buildVideoRef(selectedVideo);
        const selectedId = selectedVideo.id;
        let cancelled = false;

        if (resolvedVideoRefsById[selectedId]) {
            setSelectedVideoRef(resolvedVideoRefsById[selectedId]);
            setResolvingSelectedVideoRef(false);
            return;
        }

        if (completedVideoRefs.has(legacyRef)) {
            setSelectedVideoRef(legacyRef);
            setResolvingSelectedVideoRef(false);
            return;
        }

        setResolvingSelectedVideoRef(true);
        resolveVideoCompletionRef(selectedVideo)
            .then((ref) => {
                if (cancelled) return;
                setResolvedVideoRefsById((current) => ({
                    ...current,
                    [selectedId]: ref,
                }));
                setSelectedVideoRef(ref);
            })
            .finally(() => {
                if (cancelled) return;
                setResolvingSelectedVideoRef(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedVideo, completedVideoRefs, resolvedVideoRefsById]);

    useEffect(() => {
        setSelectedVideoUrl("");
        if (!selectedVideo) {
            return;
        }

        let closed = false;
        let objectUrl: string | null = null;

        const loadPlayableSource = async () => {
            try {
                if (selectedVideo.storageKind === "bridge") {
                    if (!selectedVideo.bridgePath) {
                        throw new Error("Caminho do video Bridge indisponivel.");
                    }
                    setSelectedVideoUrl(buildBridgeStreamUrl(selectedVideo.bridgePath));
                    trackFilesTelemetry("files.bridge.play.success", {
                        source: "bridge",
                        path: selectedVideo.bridgePath,
                        videoId: selectedVideo.id,
                        trigger: "playlist",
                    });
                    return;
                }

                const playableFile = await resolvePlayableFile(selectedVideo);
                if (closed) {
                    return;
                }
                objectUrl = URL.createObjectURL(playableFile);
                setSelectedVideoUrl(objectUrl);
            } catch (loadError) {
                if (closed) {
                    return;
                }
                setSelectedVideoUrl("");
                const message = toErrorMessage(loadError, "Nao foi possivel abrir o video selecionado.");
                if (selectedVideo.storageKind === "bridge") {
                    trackFilesTelemetry("files.bridge.play.error", {
                        source: "bridge",
                        path: selectedVideo.bridgePath ?? null,
                        videoId: selectedVideo.id,
                        error: message,
                    });
                }
                setError(message);
            }
        };

        void loadPlayableSource();

        return () => {
            closed = true;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [selectedVideo]);

    useEffect(() => {
        setSelectedDurationSec(null);
    }, [selectedVideo?.id]);

    const handleCompleteLesson = useCallback(async () => {
        if (!selectedVideo) {
            return;
        }

        if (resolvingSelectedVideoRef || !selectedVideoRef) {
            setStatusMessage("Preparando identificador estavel da aula para dedupe.");
            return;
        }

        if (!authUser) {
            setStatusMessage("Faca login no topo para contabilizar XP e nivel.");
            openAuthPanel();
            return;
        }

        if (loadingCompletions) {
            setStatusMessage("Sincronizando progresso de aulas concluidas. Tente novamente em instantes.");
            return;
        }

        if (selectedVideoCompleted) {
            setStatusMessage("Essa aula ja foi concluida e ja gerou XP nesta conta.");
            return;
        }

        let durationSec = selectedDurationSec;
        let usedFallbackDuration = false;

        if (typeof durationSec !== "number" || !Number.isFinite(durationSec) || durationSec <= 0) {
            durationSec = 60;
            usedFallbackDuration = true;
        }

        const minutes = Math.max(1, Math.ceil(durationSec / 60));
        const subject = subjectFromRelativePath(selectedVideo.relativePath || DEFAULT_RELATIVE_PATH);

        setCompletingLesson(true);
        setError(null);
        setStatusMessage(null);
        try {
            const output = await createSession({
                subject,
                minutes,
                mode: "video_lesson",
                notes: `${VIDEO_COMPLETION_PREFIX}${selectedVideoRef}`,
            });

            setCompletedVideoRefs((current) => {
                const next = new Set(current);
                next.add(selectedVideoRef);
                next.add(buildVideoRef(selectedVideo));
                return next;
            });

            setStatusMessage(
                output.xpEarned <= 0 && output.goldEarned <= 0
                    ? "Essa aula ja havia sido concluida nesta conta. Nenhum novo XP ou historico foi gerado."
                    : usedFallbackDuration
                        ? `Aula concluida: +${output.xpEarned} XP | ${minutes} min contabilizados (duracao minima aplicada).`
                        : `Aula concluida: +${output.xpEarned} XP | ${minutes} min contabilizados.`,
            );
            await invalidateProgressCaches();
        } catch (completeError) {
            if (completeError instanceof ApiRequestError && completeError.status === 401) {
                setError("Sessao expirada. Faca login novamente.");
                await invalidateProgressCaches();
                return;
            }
            setError(toErrorMessage(completeError, "Falha ao registrar conclusao da aula."));
        } finally {
            setCompletingLesson(false);
        }
    }, [
        authUser,
        invalidateProgressCaches,
        loadingCompletions,
        openAuthPanel,
        resolvingSelectedVideoRef,
        selectedDurationSec,
        selectedVideo,
        selectedVideoCompleted,
        selectedVideoRef,
    ]);

    const handleVideoEnded = useCallback(() => {
        if (!selectedLessonId) return;

        for (const section of folderSections) {
            const idx = section.lessons.findIndex((lesson) => lesson.id === selectedLessonId);
            if (idx !== -1) {
                if (idx < section.lessons.length - 1) {
                    const nextLesson = section.lessons[idx + 1];
                    setSelectedLessonId(nextLesson.id);
                }
                break;
            }
        }
    }, [selectedLessonId, folderSections, setSelectedLessonId]);

    return {
        selectedVideo,
        selectedVideoUrl,
        selectedDurationSec,
        setSelectedDurationSec,
        completedVideoRefs,
        resolvedVideoRefsById,
        loadingCompletions,
        completingLesson,
        error,
        statusMessage,
        setSelectedLessonId,
        handleCompleteLesson,
        handleVideoEnded,
        isVideoCompleted,
        setError,
        setStatusMessage,
        resolvingSelectedVideoRef,
        selectedVideoRef,
    };
}
