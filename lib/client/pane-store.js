/**
 * Tiny module-level pane store for Mission Control.
 *
 * This is intentionally framework-free: the client plugin owns the pane set
 * and the page component subscribes through `useSyncExternalStore`. Pane ids,
 * per-pane sizes, row assignments, and composer heights are persisted to
 * localStorage so a reload restores the same view. Rows are dynamic: a new
 * row is created whenever the current row would overflow the available width.
 */
const STORAGE_KEY = 'dsh.multiple-tui-simulator.v5';
const LEGACY_KEYS = [
    'dsh.multiple-tui-simulator.v4',
    'dsh.multiple-tui-simulator.v3',
    'dsh.multiple-tui-simulator.v2',
    'dsh.multiple-tui-simulator.v1',
];
export const MIN_PANE_WIDTH = 360;
export const MIN_PANE_HEIGHT = 280;
export const FALLBACK_PANE_SIZE = { width: 720, height: 520 };
export const PANE_GAP = 14;
export const MIN_COMPOSER_HEIGHT = 48;
export const MAX_COMPOSER_HEIGHT = 280;
const listeners = new Set();
let state = loadInitial();
let revision = 0;
function readRaw(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? null : JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function normalizeSizes(value) {
    const sizes = {};
    if (typeof value !== 'object' || value === null)
        return sizes;
    for (const [id, entry] of Object.entries(value)) {
        if (typeof entry !== 'object' || entry === null)
            continue;
        const candidate = entry;
        if (typeof candidate.width !== 'number' || typeof candidate.height !== 'number')
            continue;
        if (!Number.isFinite(candidate.width) || !Number.isFinite(candidate.height))
            continue;
        const top = typeof candidate.top === 'number' && Number.isFinite(candidate.top)
            ? Math.max(0, Math.round(candidate.top))
            : 0;
        sizes[id] = {
            width: Math.max(MIN_PANE_WIDTH, Math.round(candidate.width)),
            height: Math.max(MIN_PANE_HEIGHT, Math.round(candidate.height)),
            ...(top === 0 ? {} : { top }),
        };
    }
    return sizes;
}
function normalizeRows(value) {
    const rows = {};
    if (typeof value !== 'object' || value === null)
        return rows;
    for (const [id, row] of Object.entries(value)) {
        if (typeof row === 'number' && Number.isFinite(row) && row >= 0)
            rows[id] = Math.floor(row);
    }
    return rows;
}
function normalizeComposerHeights(value) {
    const heights = {};
    if (typeof value !== 'object' || value === null)
        return heights;
    for (const [id, height] of Object.entries(value)) {
        if (typeof height !== 'number' || !Number.isFinite(height))
            continue;
        heights[id] = Math.min(MAX_COMPOSER_HEIGHT, Math.max(MIN_COMPOSER_HEIGHT, Math.round(height)));
    }
    return heights;
}
function normalizePanes(value) {
    if (!Array.isArray(value))
        return [];
    return value.filter((item) => typeof item === 'string');
}
function parseState(raw) {
    if (typeof raw !== 'object' || raw === null)
        return null;
    const record = raw;
    if (!Array.isArray(record.panes))
        return null;
    return {
        panes: normalizePanes(record.panes),
        sizes: normalizeSizes(record.sizes),
        rows: normalizeRows(record.rows),
        composerHeights: normalizeComposerHeights(record.composerHeights),
    };
}
function loadInitial() {
    const current = parseState(readRaw(STORAGE_KEY));
    if (current !== null)
        return current;
    // Older layouts used fixed/default sizes; the row-based layout starts from
    // the pane list only.
    for (const key of LEGACY_KEYS) {
        const raw = readRaw(key);
        if (Array.isArray(raw)) {
            const panes = normalizePanes(raw);
            if (panes.length > 0)
                return { panes, sizes: {}, rows: {}, composerHeights: {} };
        }
        const parsed = parseState(raw);
        if (parsed !== null && parsed.panes.length > 0) {
            return { panes: parsed.panes, sizes: {}, rows: {}, composerHeights: {} };
        }
    }
    return { panes: [], sizes: {}, rows: {}, composerHeights: {} };
}
function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
    catch {
        // Persistence is best-effort (private mode / quota); the in-memory view still works.
    }
}
function emit() {
    for (const listener of [...listeners])
        listener();
}
/** Read the current pane session id list (stable reference until mutation). */
export function getPanes() {
    return state.panes;
}
/** Monotonic mutation counter; row/height changes bump it even when the pane list is unchanged. */
export function getPaneRevision() {
    return revision;
}
/** Read the persisted size of one pane. */
export function getPaneSize(sessionId) {
    return state.sizes[sessionId];
}
/** Read the persisted row assignment of one pane; absent means the primary row. */
export function getPaneRow(sessionId) {
    return state.rows[sessionId] ?? 0;
}
/** Read the persisted composer height of one pane. */
export function getComposerHeight(sessionId) {
    return state.composerHeights[sessionId] ?? MIN_COMPOSER_HEIGHT;
}
/** Subscribe to pane list, size, row, or composer-height changes. @returns disposer. */
export function subscribePanes(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
/** Replace the whole pane list, pruning sizes, rows, and heights of removed panes. */
export function setPanes(next) {
    const sizes = {};
    const rows = {};
    const composerHeights = {};
    for (const id of next) {
        const size = state.sizes[id];
        if (size !== undefined)
            sizes[id] = size;
        rows[id] = state.rows[id] ?? 0;
        composerHeights[id] = state.composerHeights[id] ?? MIN_COMPOSER_HEIGHT;
    }
    state = { panes: next, sizes, rows, composerHeights };
    revision += 1;
    persist();
    emit();
}
/** Record a pane's user-resized dimensions, clamped to the pane minimums. */
export function setPaneSize(sessionId, size) {
    if (!state.panes.includes(sessionId))
        return;
    const top = Math.max(0, Math.round(size.top ?? 0));
    const clamped = {
        width: Math.max(MIN_PANE_WIDTH, Math.round(size.width)),
        height: Math.max(MIN_PANE_HEIGHT, Math.round(size.height)),
        ...(top === 0 ? {} : { top }),
    };
    state = { ...state, sizes: { ...state.sizes, [sessionId]: clamped } };
    revision += 1;
    persist();
    emit();
}
/** Record one pane's user-adjusted composer height. */
export function setComposerHeight(sessionId, height) {
    if (!state.panes.includes(sessionId))
        return;
    const clamped = Math.min(MAX_COMPOSER_HEIGHT, Math.max(MIN_COMPOSER_HEIGHT, Math.round(height)));
    if (state.composerHeights[sessionId] === clamped)
        return;
    state = { ...state, composerHeights: { ...state.composerHeights, [sessionId]: clamped } };
    revision += 1;
    persist();
    emit();
}
/** Move one pane to a specific row. */
export function setPaneRow(sessionId, row) {
    if (!state.panes.includes(sessionId))
        return;
    if (state.rows[sessionId] === row)
        return;
    state = { ...state, rows: { ...state.rows, [sessionId]: row } };
    revision += 1;
    persist();
    emit();
}
/** Append one session id when absent; new panes join the primary row. */
export function addPane(sessionId) {
    if (state.panes.includes(sessionId))
        return;
    setPanes([...state.panes, sessionId]);
}
/** Remove one session id. */
export function removePane(sessionId) {
    if (!state.panes.includes(sessionId))
        return;
    setPanes(state.panes.filter(id => id !== sessionId));
}
/** Merge a set of session ids into the pane list, preserving existing order. */
export function mergePanes(sessionIds) {
    const merged = [...state.panes];
    for (const id of sessionIds) {
        if (!merged.includes(id))
            merged.push(id);
    }
    setPanes(merged);
}
/** Width used by the fit computation: persisted width, or the row's even share. */
function paneFitWidth(sessionId, count, viewportWidth) {
    const persisted = state.sizes[sessionId];
    if (persisted !== undefined)
        return Math.min(persisted.width, Math.max(MIN_PANE_WIDTH, viewportWidth));
    return Math.max(MIN_PANE_WIDTH, Math.floor((viewportWidth - PANE_GAP * (count - 1)) / count));
}
/**
 * Recursively move the rightmost pane of any overflowing row to the next row
 * until every row fits the available width. Rows are renumbered contiguously.
 * @param viewportWidth - available grid width in px.
 */
export function reflowRows(viewportWidth) {
    if (!Number.isFinite(viewportWidth) || viewportWidth <= 0 || state.panes.length === 0)
        return;
    const rows = new Map();
    for (const id of state.panes) {
        const row = state.rows[id] ?? 0;
        const list = rows.get(row) ?? [];
        list.push(id);
        rows.set(row, list);
    }
    let changed = false;
    for (let guard = 0; guard < state.panes.length; guard += 1) {
        const rowNumbers = [...rows.keys()].sort((left, right) => left - right);
        let moved = false;
        for (const row of rowNumbers) {
            const ids = rows.get(row);
            if (ids === undefined || ids.length <= 1)
                continue;
            const total = ids.reduce((sum, id) => sum + paneFitWidth(id, ids.length, viewportWidth), 0)
                + PANE_GAP * (ids.length - 1);
            if (total <= viewportWidth)
                continue;
            const lastId = ids[ids.length - 1];
            if (lastId === undefined)
                continue;
            ids.splice(ids.length - 1, 1);
            const nextRow = rows.get(row + 1) ?? [];
            nextRow.unshift(lastId);
            rows.set(row + 1, nextRow);
            changed = true;
            moved = true;
            break;
        }
        if (!moved)
            break;
    }
    if (!changed)
        return;
    const nextRows = {};
    const orderedRows = [...rows.keys()].sort((left, right) => left - right);
    orderedRows.forEach((row, index) => {
        for (const id of rows.get(row) ?? [])
            nextRows[id] = index;
    });
    state = { ...state, rows: nextRows };
    revision += 1;
    persist();
    emit();
}
/**
 * Insert or move one pane into a row at a specific horizontal position.
 * `beforeId` names the pane that should end up after the moved pane; omitted
 * means append to the row.
 * @param sessionId - pane to place (created if absent).
 * @param row - target row.
 * @param beforeId - existing pane that should follow the placed pane.
 */
export function placePane(sessionId, row, beforeId) {
    const next = state.panes.filter(id => id !== sessionId);
    const beforeIndex = beforeId === undefined || beforeId === sessionId ? -1 : next.indexOf(beforeId);
    if (beforeIndex === -1) {
        next.push(sessionId);
    }
    else {
        next.splice(beforeIndex, 0, sessionId);
    }
    const composerHeights = state.composerHeights[sessionId] === undefined
        ? state.composerHeights
        : { ...state.composerHeights };
    state = {
        panes: next,
        sizes: state.sizes,
        rows: { ...state.rows, [sessionId]: row },
        composerHeights,
    };
    revision += 1;
    persist();
    emit();
}
//# sourceMappingURL=pane-store.js.map