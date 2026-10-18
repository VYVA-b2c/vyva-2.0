export const CARE_FINDER_PATH = "/care-finder";

export function careFinderTaskPath(taskId?: string | null): string {
  return taskId ? `${CARE_FINDER_PATH}/${encodeURIComponent(taskId)}` : CARE_FINDER_PATH;
}
