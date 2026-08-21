/**
 * Client helper for the host git-info RPC.
 */
const API_BASE = '/multiple-chat-panels/api/git-info';
const cache = new Map();
/** Fetch git branch/worktree info for a directory, cached per path. */
export async function fetchGitInfo(path) {
    const cached = cache.get(path);
    if (cached !== undefined)
        return cached;
    try {
        const response = await fetch(`${API_BASE}?path=${encodeURIComponent(path)}`, { credentials: 'same-origin' });
        if (!response.ok)
            throw new Error(`git-info request failed: ${String(response.status)}`);
        const value = (await response.json());
        const normalized = {
            isRepo: value.isRepo === true,
            branch: typeof value.branch === 'string' ? value.branch : null,
            worktree: typeof value.worktree === 'string' ? value.worktree : null,
        };
        cache.set(path, normalized);
        return normalized;
    }
    catch {
        const fallback = { isRepo: false, branch: null, worktree: null };
        cache.set(path, fallback);
        return fallback;
    }
}
//# sourceMappingURL=git-info.js.map