import changelogRaw from "../../../CHANGELOG.md?raw";

export interface ChangelogReleaseVM {
  id: string;
  title: string;
  items: string[];
}

function toReleaseId(title: string, index: number): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  if (!slug) {
    return `release-${index + 1}`;
  }
  return `${slug}-${index + 1}`;
}

export function parseChangelog(raw: string): ChangelogReleaseVM[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const releases: Array<{ title: string; items: string[] }> = [];
  let current: { title: string; items: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (trimmed.startsWith("## ")) {
      if (current) {
        releases.push(current);
      }
      current = {
        title: trimmed.slice(3).trim(),
        items: [],
      };
      continue;
    }

    if (trimmed.startsWith("- ") && current) {
      current.items.push(trimmed.slice(2).trim());
    }
  }

  if (current) {
    releases.push(current);
  }

  return releases.map((release, index) => ({
    id: toReleaseId(release.title, index),
    title: release.title,
    items: release.items,
  }));
}

export function getChangelogFingerprint(raw: string): string {
  let hash = 5381;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 33) ^ raw.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

export const CHANGELOG_RELEASES = parseChangelog(changelogRaw);
export const CHANGELOG_FINGERPRINT = getChangelogFingerprint(changelogRaw);
