/**
 * Tiny module-level pane store for Mission Control.
 *
 * This is intentionally framework-free: the client plugin owns the pane set
 * and the page component subscribes through `useSyncExternalStore`. Pane ids,
 * per-pane sizes, row assignments, and composer heights are persisted to
 * localStorage so a reload restores the same view. Rows are dynamic: a new
 * row is created whenever the current row would overflow the available width.
 */
export declare const MIN_PANE_WIDTH = 360;
export declare const MIN_PANE_HEIGHT = 280;
export declare const FALLBACK_PANE_SIZE: PaneSize;
export declare const PANE_GAP = 14;
export declare const MIN_COMPOSER_HEIGHT = 48;
export declare const MAX_COMPOSER_HEIGHT = 280;
export type PaneRow = number;
export interface PaneSize {
    readonly width: number;
    readonly height: number;
    /** Vertical offset inside its row, created by top-edge resizes. */
    readonly top?: number;
}
/** Read the current pane session id list (stable reference until mutation). */
export declare function getPanes(): readonly string[];
/** Monotonic mutation counter; row/height changes bump it even when the pane list is unchanged. */
export declare function getPaneRevision(): number;
/** Read the persisted size of one pane. */
export declare function getPaneSize(sessionId: string): PaneSize | undefined;
/** Read the persisted row assignment of one pane; absent means the primary row. */
export declare function getPaneRow(sessionId: string): PaneRow;
/** Read the persisted composer height of one pane. */
export declare function getComposerHeight(sessionId: string): number;
/** Subscribe to pane list, size, row, or composer-height changes. @returns disposer. */
export declare function subscribePanes(listener: () => void): () => void;
/** Replace the whole pane list, pruning sizes, rows, and heights of removed panes. */
export declare function setPanes(next: readonly string[]): void;
/** Record a pane's user-resized dimensions, clamped to the pane minimums. */
export declare function setPaneSize(sessionId: string, size: PaneSize): void;
/** Record one pane's user-adjusted composer height. */
export declare function setComposerHeight(sessionId: string, height: number): void;
/** Move one pane to a specific row. */
export declare function setPaneRow(sessionId: string, row: PaneRow): void;
/** Append one session id when absent; new panes join the primary row. */
export declare function addPane(sessionId: string): void;
/** Remove one session id. */
export declare function removePane(sessionId: string): void;
/** Merge a set of session ids into the pane list, preserving existing order. */
export declare function mergePanes(sessionIds: readonly string[]): void;
/**
 * Recursively move the rightmost pane of any overflowing row to the next row
 * until every row fits the available width. Rows are renumbered contiguously.
 * @param viewportWidth - available grid width in px.
 */
export declare function reflowRows(viewportWidth: number): void;
/**
 * Insert or move one pane into a row at a specific horizontal position.
 * `beforeId` names the pane that should end up after the moved pane; omitted
 * means append to the row.
 * @param sessionId - pane to place (created if absent).
 * @param row - target row.
 * @param beforeId - existing pane that should follow the placed pane.
 */
export declare function placePane(sessionId: string, row: PaneRow, beforeId?: string): void;
