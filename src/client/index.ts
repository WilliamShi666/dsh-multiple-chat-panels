/**
 * multiple-chat-panels client entry.
 *
 * Registers the Mission Control first-level sidebar action, the matching
 * `main.page`, and the document-level drag/drop bridge that opens Mission
 * Control when a sidebar session is dropped onto the center column.
 */
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { MissionControlNav, type MissionControlNavInjected } from './MissionControlNav.tsx'
import { MissionControlPage, type MissionControlPageInjected } from './MissionControlPage.tsx'
import { PANE_DRAG_MIME } from './drag.ts'
import { getPaneSize, PANE_GAP, placePane, type PaneRow } from './pane-store.ts'

export const PAGE_ID = 'mission-control'

export const inject = ['slots', 'layout', 'sessions', 'modelDirectories', 'remote', 'remote.commands']

function isCenterTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest('[class*="centerSurface"]') !== null
}

function gridRowElement(grid: Element, row: PaneRow): Element | null {
  return grid.querySelector(`:scope > [data-mcp-row="${row}"]`)
}

/** Horizontal insertion point in one row, expressed as the pane that follows it. */
function beforeIdForDrop(rowElement: Element, clientX: number, excludeId: string): string | undefined {
  const panes = [...rowElement.querySelectorAll('[data-mcp-pane]')]
  for (const pane of panes) {
    const sessionId = pane.getAttribute('data-mcp-session')
    if (sessionId === null || sessionId === excludeId) continue
    const rect = pane.getBoundingClientRect()
    if (clientX < rect.left + rect.width / 2) return sessionId
  }
  return undefined
}

/** Width a pane will claim when it sits on a row: persisted size, else its DOM width. */
function paneGridWidth(pane: Element, sessionId: string): number {
  const persisted = getPaneSize(sessionId)
  if (persisted !== undefined) return persisted.width
  return pane.getBoundingClientRect().width
}

/** Whether inserting `draggedId` at `beforeId` fits the row's available width. */
function rowFitsAfterInsert(rowElement: Element, draggedId: string, draggedWidth: number, beforeId: string | undefined): boolean {
  const ids: string[] = []
  for (const pane of rowElement.querySelectorAll('[data-mcp-pane]')) {
    const sessionId = pane.getAttribute('data-mcp-session')
    if (sessionId === null || sessionId === draggedId) continue
    if (beforeId === sessionId) ids.push(draggedId)
    ids.push(sessionId)
  }
  if (beforeId === undefined) ids.push(draggedId)
  const width = ids.reduce((sum, id, index) => {
    if (id === draggedId) return sum + draggedWidth
    const pane = rowElement.querySelector(`[data-mcp-session="${CSS.escape(id)}"]`)
    return sum + (pane === null ? 0 : paneGridWidth(pane, id))
  }, PANE_GAP * Math.max(0, ids.length - 1))
  return width <= rowElement.clientWidth + 1
}

/** Row chosen by the drop point; below the last row creates a new row. */
function rowForDrop(grid: Element, clientY: number): PaneRow {
  const rows = [...grid.querySelectorAll(':scope > [data-mcp-row]')]
    .sort((left, right) => Number(left.getAttribute('data-mcp-row')) - Number(right.getAttribute('data-mcp-row')))
  if (rows.length === 0) return 0
  for (const row of rows) {
    const rect = row.getBoundingClientRect()
    if (clientY < rect.bottom - 12) return Number(row.getAttribute('data-mcp-row') ?? 0)
  }
  return Number(rows[rows.length - 1]?.getAttribute('data-mcp-row') ?? 0) + 1
}

/** Clear any drag-over row preview class left by a cancelled drag. */
function clearDropPreview(): void {
  const grid = document.querySelector<HTMLElement>('[data-mcp-grid]')
  if (grid !== null) {
    delete grid.dataset.mcpNewRow
    for (const row of grid.querySelectorAll(':scope > [data-mcp-row]')) {
      row.classList.remove('mcp-drop-target')
      row.classList.remove('mcp-drop-reject')
    }
  }
}

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.primary.action', () => ctx.slots.register({
    name: 'sidebar.primary.action',
    id: PAGE_ID,
    order: 30,
    inject: (): MissionControlNavInjected => ({
      pageId: PAGE_ID,
      open: () => { ctx.layout.openPrimaryPage(PAGE_ID) },
    }),
  }, MissionControlNav))

  ctx.slots.inject('main.page', () => ctx.slots.register({
    name: 'main.page',
    key: PAGE_ID,
    inject: (): MissionControlPageInjected => ({
      getSession: (sessionId) => ctx.sessions.binding(sessionId as SessionId)?.session,
      getModelDirectory: (sessionId): ModelDirectory | undefined => {
        try {
          return ctx.modelDirectories.directoryFor(sessionId as SessionId)
        } catch {
          return undefined
        }
      },
      listCommands: async (sessionId) => {
        try {
          const result = await ctx.remote.commands.list(sessionId as SessionId)
          if (!result.ok) return []
          return result.value.map(command => ({
            name: command.name,
            description: command.description,
            ...command.input?.hint === undefined ? {} : { hint: command.input.hint },
          }))
        } catch {
          return []
        }
      },
      openInMain: (sessionId) => {
        ctx.sessions.open(sessionId as SessionId)
        ctx.layout.closePrimaryPage()
      },
    }),
  }, MissionControlPage))

  const onDragOver = (event: DragEvent): void => {
    if (!isCenterTarget(event.target)) return
    if (event.dataTransfer === null) return
    if (!event.dataTransfer.types.includes('text/plain') && !event.dataTransfer.types.includes(PANE_DRAG_MIME)) return
    event.preventDefault()
    if (!event.dataTransfer.types.includes(PANE_DRAG_MIME)) return
    const grid = document.querySelector<HTMLElement>('[data-mcp-grid]')
    if (grid === null) return
    const row = rowForDrop(grid, event.clientY)
    for (const rowElement of grid.querySelectorAll(':scope > [data-mcp-row]')) {
      rowElement.classList.remove('mcp-drop-target')
      rowElement.classList.remove('mcp-drop-reject')
    }
    delete grid.dataset.mcpNewRow
    const target = gridRowElement(grid, row)
    if (target === null) {
      grid.dataset.mcpNewRow = '1'
      return
    }
    const draggedId = event.dataTransfer.getData(PANE_DRAG_MIME)
    const before = beforeIdForDrop(target, event.clientX, draggedId)
    const draggedPane = document.querySelector(`[data-mcp-session="${CSS.escape(draggedId)}"]`)
    const draggedWidth = draggedPane === null
      ? getPaneSize(draggedId)?.width ?? 360
      : draggedPane.getBoundingClientRect().width
    if (rowFitsAfterInsert(target, draggedId, draggedWidth, before)) {
      target.classList.add('mcp-drop-target')
    } else {
      target.classList.add('mcp-drop-reject')
    }
  }

  const onDrop = (event: DragEvent): void => {
    if (!isCenterTarget(event.target)) return
    if (event.dataTransfer === null) return
    const paneDragged = event.dataTransfer.types.includes(PANE_DRAG_MIME)
    const dragged = paneDragged
      ? event.dataTransfer.getData(PANE_DRAG_MIME)
      : event.dataTransfer.getData('text/plain')
    if (dragged === '') return
    event.preventDefault()
    clearDropPreview()
    const current = ctx.sessions.list.getSnapshot().current
    const grid = document.querySelector<HTMLElement>('[data-mcp-grid]')
    if (grid === null) {
      // First drop opens Mission Control: keep the current session and put
      // the dragged session left or right of it based on the drop point.
      if (!paneDragged && current !== undefined && current !== dragged) placePane(current, 0)
      const center = event.target instanceof Element
        ? event.target.closest('[class*="centerSurface"]')?.getBoundingClientRect()
        : undefined
      const before = current !== undefined && center !== undefined && event.clientX < center.left + center.width / 2
        ? current
        : undefined
      placePane(dragged, 0, before)
      ctx.layout.openPrimaryPage(PAGE_ID)
      return
    }
    const row = rowForDrop(grid, event.clientY)
    const rowElement = gridRowElement(grid, row)
    const before = rowElement === null ? undefined : beforeIdForDrop(rowElement, event.clientX, dragged)
    if (paneDragged && rowElement !== null) {
      const draggedPane = document.querySelector(`[data-mcp-session="${CSS.escape(dragged)}"]`)
      const draggedWidth = draggedPane === null
        ? getPaneSize(dragged)?.width ?? 360
        : draggedPane.getBoundingClientRect().width
      if (!rowFitsAfterInsert(rowElement, dragged, draggedWidth, before)) return
    }
    placePane(dragged, row, before)
  }

  ctx.effect(() => {
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('drop', onDrop)
    document.addEventListener('dragend', clearDropPreview)
    return () => {
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('drop', onDrop)
      document.removeEventListener('dragend', clearDropPreview)
    }
  }, 'multiple-chat-panels: drag-drop')
}
