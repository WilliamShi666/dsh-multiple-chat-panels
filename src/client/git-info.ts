/**
 * Client helper for the host git-info RPC.
 */

export interface GitInfo {
  readonly isRepo: boolean
  readonly branch: string | null
  readonly worktree: string | null
}

const API_BASE = '/multiple-chat-panels/api/git-info'
const cache = new Map<string, GitInfo>()

/** Fetch git branch/worktree info for a directory, cached per path. */
export async function fetchGitInfo(path: string): Promise<GitInfo> {
  const cached = cache.get(path)
  if (cached !== undefined) return cached
  try {
    const response = await fetch(`${API_BASE}?path=${encodeURIComponent(path)}`, { credentials: 'same-origin' })
    if (!response.ok) throw new Error(`git-info request failed: ${String(response.status)}`)
    const value = (await response.json()) as GitInfo
    const normalized: GitInfo = {
      isRepo: value.isRepo === true,
      branch: typeof value.branch === 'string' ? value.branch : null,
      worktree: typeof value.worktree === 'string' ? value.worktree : null,
    }
    cache.set(path, normalized)
    return normalized
  } catch {
    const fallback: GitInfo = { isRepo: false, branch: null, worktree: null }
    cache.set(path, fallback)
    return fallback
  }
}
