import { MissionControlNav } from "./MissionControlNav.js";
import { MissionControlOverlay } from "./MissionControlOverlay.js";
import { MissionControlPage } from "./MissionControlPage.js";
import { EMPTY_CHAT_SNAPSHOT } from "./MiniChatPane.js";
import { PANE_DRAG_MIME } from "./drag.js";
import { createMissionControlNavigation } from "./navigation.js";
import { getPaneSize, PANE_GAP, placePane } from "./pane-store.js";
export const PAGE_ID = 'mission-control';
export const inject = ['slots', 'layout', 'sessions', 'modelDirectories', 'remote', 'remote.commands'];
/**
 * A drop belongs to an open grid, the legacy center, or the current center column.
 *
 * Three shell generations are recognised, tried from the most specific to the
 * most generic so a drop is still accepted when one generation's anchor is
 * absent:
 *  - an open Mission Control grid owns the drop;
 *  - the pre-0.1.1 shell's `centerSurface` class;
 *  - the 0.1.1-era `[data-slot="conversation"]` inside a collapsible center;
 *  - the current shell, whose conversation column is `[data-dsh-center-col]`.
 *
 * The last case deliberately does not require any particular attribute on an
 * ancestor: DSH has already moved this anchor once, and the conversation column
 * is the element that actually receives the drop.
 */
function dropSurface(target) {
    if (!(target instanceof Element))
        return null;
    const grid = target.closest('[data-mcp-grid]');
    if (grid !== null)
        return grid;
    const legacy = target.closest('[class*="centerSurface"]');
    if (legacy !== null)
        return legacy;
    const conversation = target.closest('[data-phase]');
    if (conversation === null)
        return null;
    const slot = conversation.closest('[data-slot="conversation"]');
    const center = slot?.parentElement;
    if (center instanceof HTMLElement && center.parentElement?.hasAttribute('data-details-collapsed') === true) {
        return center;
    }
    return conversation.closest('[data-dsh-center-col]');
}
function gridRowElement(grid, row) {
    return grid.querySelector(`:scope > [data-mcp-row="${row}"]`);
}
/** Horizontal insertion point in one row, expressed as the pane that follows it. */
function beforeIdForDrop(rowElement, clientX, excludeId) {
    const panes = [...rowElement.querySelectorAll('[data-mcp-pane]')];
    for (const pane of panes) {
        const sessionId = pane.getAttribute('data-mcp-session');
        if (sessionId === null || sessionId === excludeId)
            continue;
        const rect = pane.getBoundingClientRect();
        if (clientX < rect.left + rect.width / 2)
            return sessionId;
    }
    return undefined;
}
/** Width a pane will claim when it sits on a row: persisted size, else its DOM width. */
function paneGridWidth(pane, sessionId) {
    const persisted = getPaneSize(sessionId);
    if (persisted !== undefined)
        return persisted.width;
    return pane.getBoundingClientRect().width;
}
/** Whether inserting `draggedId` at `beforeId` fits the row's available width. */
function rowFitsAfterInsert(rowElement, draggedId, draggedWidth, beforeId) {
    const ids = [];
    for (const pane of rowElement.querySelectorAll('[data-mcp-pane]')) {
        const sessionId = pane.getAttribute('data-mcp-session');
        if (sessionId === null || sessionId === draggedId)
            continue;
        if (beforeId === sessionId)
            ids.push(draggedId);
        ids.push(sessionId);
    }
    if (beforeId === undefined)
        ids.push(draggedId);
    const width = ids.reduce((sum, id, index) => {
        if (id === draggedId)
            return sum + draggedWidth;
        const pane = rowElement.querySelector(`[data-mcp-session="${CSS.escape(id)}"]`);
        return sum + (pane === null ? 0 : paneGridWidth(pane, id));
    }, PANE_GAP * Math.max(0, ids.length - 1));
    return width <= rowElement.clientWidth + 1;
}
/** Row chosen by the drop point; below the last row creates a new row. */
function rowForDrop(grid, clientY) {
    const rows = [...grid.querySelectorAll(':scope > [data-mcp-row]')]
        .sort((left, right) => Number(left.getAttribute('data-mcp-row')) - Number(right.getAttribute('data-mcp-row')));
    if (rows.length === 0)
        return 0;
    for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (clientY < rect.bottom - 12)
            return Number(row.getAttribute('data-mcp-row') ?? 0);
    }
    return Number(rows[rows.length - 1]?.getAttribute('data-mcp-row') ?? 0) + 1;
}
/** Clear any drag-over row preview class left by a cancelled drag. */
function clearDropPreview() {
    const grid = document.querySelector('[data-mcp-grid]');
    if (grid !== null) {
        delete grid.dataset.mcpNewRow;
        for (const row of grid.querySelectorAll(':scope > [data-mcp-row]')) {
            row.classList.remove('mcp-drop-target');
            row.classList.remove('mcp-drop-reject');
        }
    }
}
export function apply(ctx) {
    const navigation = createMissionControlNavigation();
    const layout = ctx.layout;
    const legacyShell = typeof layout.openPrimaryPage === 'function';
    /** One identity-stable Chat source per session, so pane subscriptions never churn. */
    const chatSources = new Map();
    const open = () => {
        if (typeof layout.openPrimaryPage === 'function')
            layout.openPrimaryPage(PAGE_ID);
        else
            navigation.open();
    };
    const close = () => {
        if (typeof layout.closePrimaryPage === 'function')
            layout.closePrimaryPage();
        else
            navigation.close();
    };
    const pageFace = () => ({
        getSession: (sessionId) => ctx.sessions.binding(sessionId)?.session,
        getChat: (sessionId) => {
            const cached = chatSources.get(sessionId);
            if (cached !== undefined)
                return cached;
            try {
                // Resolved per call rather than declared as a hard dependency: the
                // Conversation assembly is a shell service that older and newer builds
                // may name differently, and losing it must degrade one pane to its
                // empty state rather than block Mission Control from loading at all.
                const uiConversation = ctx
                    .get?.('uiConversation');
                if (uiConversation === undefined)
                    return undefined;
                const sessionBinding = ctx.sessions.binding(sessionId);
                if (sessionBinding === undefined)
                    return undefined;
                const target = uiConversation.binding(sessionBinding).target('chat');
                // Subscribing activates per-session assembly, which is what makes a
                // non-current session render live rather than static. The snapshot must
                // fall back to one frozen constant: useSyncExternalStore compares by
                // identity, so building a fresh object per read spins the render loop.
                const source = {
                    getSnapshot: () => target.getSnapshot() ?? EMPTY_CHAT_SNAPSHOT,
                    subscribe: (listener) => target.subscribe(listener),
                };
                chatSources.set(sessionId, source);
                return source;
            }
            catch {
                return undefined;
            }
        },
        getModelDirectory: (sessionId) => {
            try {
                return ctx.modelDirectories.directoryFor(sessionId);
            }
            catch {
                return undefined;
            }
        },
        listCommands: async (sessionId) => {
            try {
                const result = await ctx.remote.commands.list(sessionId);
                if (!result.ok)
                    return [];
                return result.value.map(command => ({
                    name: command.name,
                    description: command.description,
                    ...command.input?.hint === undefined ? {} : { hint: command.input.hint },
                }));
            }
            catch {
                return [];
            }
        },
        openInMain: (sessionId) => {
            ctx.sessions.open(sessionId);
            close();
        },
    });
    if (legacyShell) {
        ctx.slots.inject('main.page', () => ctx.slots.register({
            name: 'main.page', key: PAGE_ID, inject: pageFace,
        }, MissionControlPage));
        ctx.slots.inject('sidebar.primary.action', () => ctx.slots.register({
            name: 'sidebar.primary.action',
            id: PAGE_ID,
            order: 30,
            inject: () => ({ pageId: PAGE_ID, open }),
        }, MissionControlNav));
    }
    else {
        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
            name: 'shell.overlay',
            id: PAGE_ID,
            order: 30,
            label: 'Mission Control',
            inject: () => ({
                ...pageFace(), close, openState: navigation,
            }),
        }, MissionControlOverlay));
        ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
            name: 'sidebar.footer.action',
            id: PAGE_ID,
            order: 30,
            label: 'Mission Control',
            inject: () => ({
                pageId: PAGE_ID,
                open,
                openState: navigation,
                placement: 'sidebar-upper',
            }),
        }, MissionControlNav));
    }
    const onDragOver = (event) => {
        if (dropSurface(event.target) === null)
            return;
        if (event.dataTransfer === null)
            return;
        if (!event.dataTransfer.types.includes('text/plain') && !event.dataTransfer.types.includes(PANE_DRAG_MIME))
            return;
        event.preventDefault();
        if (!event.dataTransfer.types.includes(PANE_DRAG_MIME))
            return;
        const grid = document.querySelector('[data-mcp-grid]');
        if (grid === null)
            return;
        const row = rowForDrop(grid, event.clientY);
        for (const rowElement of grid.querySelectorAll(':scope > [data-mcp-row]')) {
            rowElement.classList.remove('mcp-drop-target');
            rowElement.classList.remove('mcp-drop-reject');
        }
        delete grid.dataset.mcpNewRow;
        const target = gridRowElement(grid, row);
        if (target === null) {
            grid.dataset.mcpNewRow = '1';
            return;
        }
        const draggedId = event.dataTransfer.getData(PANE_DRAG_MIME);
        const before = beforeIdForDrop(target, event.clientX, draggedId);
        const draggedPane = document.querySelector(`[data-mcp-session="${CSS.escape(draggedId)}"]`);
        const draggedWidth = draggedPane === null
            ? getPaneSize(draggedId)?.width ?? 360
            : draggedPane.getBoundingClientRect().width;
        if (rowFitsAfterInsert(target, draggedId, draggedWidth, before)) {
            target.classList.add('mcp-drop-target');
        }
        else {
            target.classList.add('mcp-drop-reject');
        }
    };
    const onDrop = (event) => {
        const surface = dropSurface(event.target);
        if (surface === null)
            return;
        if (event.dataTransfer === null)
            return;
        const paneDragged = event.dataTransfer.types.includes(PANE_DRAG_MIME);
        const dragged = paneDragged
            ? event.dataTransfer.getData(PANE_DRAG_MIME)
            : event.dataTransfer.getData('text/plain');
        if (dragged === '')
            return;
        event.preventDefault();
        clearDropPreview();
        const current = ctx.sessions.list.getSnapshot().current;
        const grid = document.querySelector('[data-mcp-grid]');
        if (grid === null) {
            // First drop opens Mission Control: keep the current session and put
            // the dragged session left or right of it based on the drop point.
            if (!paneDragged && current !== undefined && current !== dragged)
                placePane(current, 0);
            const center = surface.getBoundingClientRect();
            const before = current !== undefined && center !== undefined && event.clientX < center.left + center.width / 2
                ? current
                : undefined;
            placePane(dragged, 0, before);
            open();
            return;
        }
        const row = rowForDrop(grid, event.clientY);
        const rowElement = gridRowElement(grid, row);
        const before = rowElement === null ? undefined : beforeIdForDrop(rowElement, event.clientX, dragged);
        if (paneDragged && rowElement !== null) {
            const draggedPane = document.querySelector(`[data-mcp-session="${CSS.escape(dragged)}"]`);
            const draggedWidth = draggedPane === null
                ? getPaneSize(dragged)?.width ?? 360
                : draggedPane.getBoundingClientRect().width;
            if (!rowFitsAfterInsert(rowElement, dragged, draggedWidth, before))
                return;
        }
        placePane(dragged, row, before);
    };
    ctx.effect(() => {
        document.addEventListener('dragover', onDragOver);
        document.addEventListener('drop', onDrop);
        document.addEventListener('dragend', clearDropPreview);
        return () => {
            document.removeEventListener('dragover', onDragOver);
            document.removeEventListener('drop', onDrop);
            document.removeEventListener('dragend', clearDropPreview);
        };
    }, 'multiple-chat-panels: drag-drop');
}
//# sourceMappingURL=index.js.map