/**
 * Client helper for the host git-info RPC.
 */
export interface GitInfo {
    readonly isRepo: boolean;
    readonly branch: string | null;
    readonly worktree: string | null;
}
/** Fetch git branch/worktree info for a directory, cached per path. */
export declare function fetchGitInfo(path: string): Promise<GitInfo>;
