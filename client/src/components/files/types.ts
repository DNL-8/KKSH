
import type { StoredVideo } from "../../lib/localVideosStore";

export interface FolderSection {
    path: string;
    pathId: string;
    lessons: StoredVideo[];
}

export type OrderMode = "source" | "newest" | "oldest" | "name_asc" | "name_desc" | "size_desc" | "size_asc";
export type TabMode = "overview" | "metadata";

