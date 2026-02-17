import type { FolderSection, OrderMode } from "./types";
import { DEFAULT_RELATIVE_PATH, type StoredVideo } from "../../lib/localVideosStore";
import { sortGroupPaths } from "./utils";

export interface FolderSectionWithMeta extends FolderSection {
    totalSize: number;
    newestCreatedAt: number;
    oldestCreatedAt: number;
}

export function compareVideos(left: StoredVideo, right: StoredVideo, mode: OrderMode): number {
    const compareNameNatural = (a: StoredVideo, b: StoredVideo) => {
        const primary = a.name.localeCompare(b.name, "pt-BR", {
            sensitivity: "base",
            numeric: true,
        });
        if (primary !== 0) {
            return primary;
        }
        return a.name.localeCompare(b.name, "pt-BR", {
            sensitivity: "variant",
            numeric: true,
        });
    };

    const leftPath = left.relativePath || DEFAULT_RELATIVE_PATH;
    const rightPath = right.relativePath || DEFAULT_RELATIVE_PATH;
    const bySourcePath = sortGroupPaths(leftPath, rightPath);
    const bySourceName = compareNameNatural(left, right);

    switch (mode) {
        case "source":
            return (
                bySourcePath ||
                bySourceName ||
                left.lastModified - right.lastModified ||
                left.createdAt - right.createdAt
            );
        case "newest":
            return right.createdAt - left.createdAt || compareNameNatural(left, right);
        case "oldest":
            return left.createdAt - right.createdAt || compareNameNatural(left, right);
        case "name_asc":
            return compareNameNatural(left, right) || right.createdAt - left.createdAt;
        case "name_desc":
            return compareNameNatural(right, left) || right.createdAt - left.createdAt;
        case "size_desc":
            return right.size - left.size || compareNameNatural(left, right) || right.createdAt - left.createdAt;
        case "size_asc":
            return left.size - right.size || compareNameNatural(left, right) || right.createdAt - left.createdAt;
        default:
            return right.createdAt - left.createdAt;
    }
}

export function compareFolderSections(left: FolderSectionWithMeta, right: FolderSectionWithMeta, mode: OrderMode): number {
    const byNameAsc = sortGroupPaths(left.path, right.path);

    switch (mode) {
        case "source":
            return byNameAsc;
        case "newest":
            return right.newestCreatedAt - left.newestCreatedAt || byNameAsc;
        case "oldest":
            return left.oldestCreatedAt - right.oldestCreatedAt || byNameAsc;
        case "name_asc":
            return byNameAsc;
        case "name_desc":
            return -byNameAsc;
        case "size_desc":
            return right.totalSize - left.totalSize || byNameAsc;
        case "size_asc":
            return left.totalSize - right.totalSize || byNameAsc;
        default:
            return byNameAsc;
    }
}
