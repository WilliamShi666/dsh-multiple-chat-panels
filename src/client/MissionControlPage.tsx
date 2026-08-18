/**
 * Mission Control main page.
 *
 * Panes live in dynamic horizontal rows: a row that would overflow the
 * available width moves its rightmost pane to a new row, and a manual header
 * drag can place a pane in any row. Panes with no persisted size split their
 * row's width evenly; each row scrolls horizontally instead of auto-wrapping.
 * Panes are resizable through every edge and corner. Left-edge resizes
 * compensate the previous pane's width; top-edge resizes add a vertical
 * offset inside the row. A bottom-edge resize may grow past the current row:
 * the pane draws on top while dragging and the row height allocation below
 * gives way on commit, so taller panes squeeze the rows underneath instead of
 * being clamped at the row boundary.
 */
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionFace } from '@deepseek-ai/dsh-client-runtime/client'
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { PANE_DRAG_MIME } from './drag.ts'
import { fetchGitInfo, type GitInfo } from './git-info.ts'
import {
  addPane, FALLBACK_PANE_SIZE, getPaneRevision, getPaneRow, getPaneSize, getPanes,
  MIN_PANE_HEIGHT, MIN_PANE_WIDTH, PANE_GAP, reflowRows, removePane, setPaneSize,
  subscribePanes, type PaneRow, type PaneSize,
} from './pane-store.ts'
import { MiniChatPane } from './MiniChatPane.tsx'

/** One host slash command surfaced in the pane input menu. */
export interface PaneCommand {
  readonly name: string
  readonly description: string
  readonly hint?: string
}

/** Registration-side page face: resolves session services for panes. */
export interface MissionControlPageInjected {
  readonly getSession: (sessionId: string) => SessionFace | undefined
  readonly getModelDirectory: (sessionId: string) => ModelDirectory | undefined
  readonly listCommands: (sessionId: string) => Promise<readonly PaneCommand[]>
  readonly openInMain: (sessionId: string) => void
}

/** Full props of the Mission Control main page. */
export type MissionControlPageProps =
  PropsRuntime<'main.page'>
  & InjectFace<MissionControlPageInjected>

const DROP_PREVIEW_CSS = `
[data-mcp-row].mcp-drop-target {
  outline: 2px dashed var(--dsw-alias-button-primary-fill, #1f2328);
  outline-offset: -2px;
  border-radius: 8px;
}
[data-mcp-row].mcp-drop-reject {
  outline: 2px dashed var(--dsw-alias-state-error-primary, #d1242f);
  outline-offset: -2px;
  border-radius: 8px;
  background: rgba(209, 36, 47, 0.06);
}
[data-mcp-grid][data-mcp-new-row]::after {
  content: 'Drop to create a new row';
  display: block;
  padding: 10px;
  border: 2px dashed var(--dsw-alias-border-l3, #a8b0b8);
  border-radius: 8px;
  color: var(--dsw-alias-label-primary-dimmed, #656d76);
  font-size: 12px;
  text-align: center;
}
/* While a pane is actively resized its live height may exceed its row, so the
 * row and grid stop clipping and the pane paints above the rows underneath. */
[data-mcp-row]:has([data-mcp-resizing]),
[data-mcp-grid]:has([data-mcp-resizing]) {
  overflow: visible !important;
}
[data-mcp-pane][data-mcp-resizing] {
  z-index: 10;
}
`

interface GridViewport {
  readonly width: number
  readonly height: number
}

function baseName(cwd: string | undefined): string {
  if (cwd === undefined || cwd === '') return ''
  return cwd.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? ''
}

/** Directory + git branch/worktree line for one pane. */
function GitInfoLine({ cwd }: { cwd: string | undefined }) {
  const [info, setInfo] = useState<GitInfo | null>(null)

  useEffect(() => {
    if (cwd === undefined || cwd === '') return
    let cancelled = false
    void fetchGitInfo(cwd).then((value) => {
      if (!cancelled) setInfo(value)
    })
    return () => {
      cancelled = true
    }
  }, [cwd])

  const base = baseName(cwd)
  if (cwd === undefined || cwd === '') return null
  if (info === null) return <span>{base}</span>
  const parts = [base]
  if (info.isRepo && info.branch !== null) parts.push(info.branch)
  if (info.worktree !== null) parts.push(info.worktree)
  return <span>{parts.join(' · ')}</span>
}

/**
 * Equal-size default for a pane with no persisted size: the row's width is
 * split evenly across its panes, and the grid height is split evenly across
 * the populated rows.
 * @param count - number of panes in the row.
 * @param viewport - measured rows area, or null before the first measure.
 * @param rowCount - total populated rows.
 * @returns the pane size to use until the user resizes it.
 */
function rowDefaultSize(count: number, viewport: GridViewport | null, rowCount: number): PaneSize {
  if (viewport === null || viewport.width <= 0 || viewport.height <= 0) return FALLBACK_PANE_SIZE
  const height = Math.max(
    MIN_PANE_HEIGHT,
    Math.floor((viewport.height - PANE_GAP * (rowCount - 1)) / rowCount),
  )
  return {
    width: Math.max(MIN_PANE_WIDTH, Math.floor((viewport.width - PANE_GAP * (count - 1)) / count)),
    height,
  }
}

type ResizeAxis = 'e' | 'w' | 's' | 'n' | 'ne' | 'nw' | 'se' | 'sw'

/**
 * Desired height of each row: never less than its even split of the grid, and
 * grown to fit the tallest persisted pane in that row. Rows with a taller pane
 * therefore push the rows below down; when the rows no longer fit the grid
 * view the grid scrolls vertically instead of clamping the pane.
 * @param rowIdsByNumber - pane ids per row, in row order.
 * @param viewport - measured grid area, or null before the first measure.
 * @returns height per row, in the same order as `rowIdsByNumber`.
 */
function desiredRowHeights(
  rowIdsByNumber: readonly (readonly string[])[],
  viewport: GridViewport | null,
): number[] {
  if (viewport === null || viewport.width <= 0 || viewport.height <= 0) {
    return rowIdsByNumber.map(() => FALLBACK_PANE_SIZE.height)
  }
  const even = Math.max(
    MIN_PANE_HEIGHT,
    Math.floor((viewport.height - PANE_GAP * (rowIdsByNumber.length - 1)) / rowIdsByNumber.length),
  )
  return rowIdsByNumber.map((ids) => {
    let tallest = even
    for (const id of ids) {
      const persisted = getPaneSize(id)
      if (persisted === undefined) continue
      const bottom = (persisted.top ?? 0) + persisted.height
      if (bottom > tallest) tallest = bottom
    }
    return tallest
  })
}

/** One resizable, row-movable pane frame. */
function ResizablePane({ sessionId, title, cwd, row, defaultSize, rowHeight, onClose, onOpenSingle, children }: {
  sessionId: string
  title: string
  cwd: string | undefined
  row: PaneRow
  defaultSize: PaneSize
  rowHeight: number
  onClose: () => void
  onOpenSingle: () => void
  children: React.ReactNode
}) {
  const persisted = useSyncExternalStore(subscribePanes, () => getPaneSize(sessionId), () => undefined)
  const frameRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    axis: ResizeAxis
    x: number
    y: number
    width: number
    height: number
    top: number
    prevElement?: HTMLDivElement
    prevSessionId?: string
    prevPersisted?: PaneSize
    prevWidth?: number
    prevHeight?: number
  } | null>(null)
  const liveRef = useRef<PaneSize | null>(null)
  const [live, setLive] = useState<PaneSize | null>(null)

  const effectiveSize = live ?? persisted ?? defaultSize
  const top = live?.top ?? persisted?.top ?? 0
  const size = live !== null
    ? live
    : { ...effectiveSize, height: Math.min(effectiveSize.height, rowHeight - top) }

  const axisUsesLeft = (axis: ResizeAxis): boolean => axis === 'w' || axis === 'nw' || axis === 'sw'
  const axisUsesRight = (axis: ResizeAxis): boolean => axis === 'e' || axis === 'ne' || axis === 'se'
  const axisUsesTop = (axis: ResizeAxis): boolean => axis === 'n' || axis === 'ne' || axis === 'nw'
  const axisUsesBottom = (axis: ResizeAxis): boolean => axis === 's' || axis === 'se' || axis === 'sw'

  const nextSize = (clientX: number, clientY: number): { size: PaneSize; prevWidth?: number } | null => {
    const start = dragRef.current
    if (start === null) return null
    let width = start.width
    let height = start.height
    let top = start.top
    let prevWidth: number | undefined
    if (axisUsesRight(start.axis)) {
      width = Math.max(MIN_PANE_WIDTH, start.width + clientX - start.x)
    } else if (axisUsesLeft(start.axis)) {
      if (start.prevElement !== undefined && start.prevWidth !== undefined) {
        const delta = start.x - clientX
        width = Math.max(MIN_PANE_WIDTH, start.width + delta)
        prevWidth = Math.max(MIN_PANE_WIDTH, start.prevWidth - delta)
      } else {
        width = Math.max(MIN_PANE_WIDTH, start.width + clientX - start.x)
      }
    }
    if (axisUsesTop(start.axis)) {
      const deltaY = clientY - start.y
      const maxTop = start.top + start.height - MIN_PANE_HEIGHT
      top = Math.max(0, Math.min(start.top + deltaY, maxTop))
      height = start.top + start.height - top
    } else if (axisUsesBottom(start.axis)) {
      height = Math.max(MIN_PANE_HEIGHT, start.height + clientY - start.y)
    }
    return { size: { width, height, ...(top === 0 ? {} : { top }) }, prevWidth }
  }

  const startResize = (event: React.PointerEvent<HTMLDivElement>, axis: ResizeAxis): void => {
    event.preventDefault()
    event.stopPropagation()
    const frame = frameRef.current
    if (frame === null) return
    const rect = frame.getBoundingClientRect()
    const top = parseFloat(frame.style.marginTop || '0') || 0
    const start: NonNullable<typeof dragRef.current> = {
      pointerId: event.pointerId,
      axis,
      x: event.clientX,
      y: event.clientY,
      width: rect.width,
      height: rect.height,
      top,
    }
    if (axisUsesLeft(axis)) {
      const prev = frame.previousElementSibling
      if (prev instanceof HTMLDivElement && prev.getAttribute('data-mcp-pane') !== null) {
        const prevSessionId = prev.getAttribute('data-mcp-session')
        if (prevSessionId !== null) {
          const prevRect = prev.getBoundingClientRect()
          start.prevElement = prev
          start.prevSessionId = prevSessionId
          start.prevPersisted = getPaneSize(prevSessionId)
          start.prevWidth = prevRect.width
          start.prevHeight = prevRect.height
        }
      }
    }
    dragRef.current = start
    liveRef.current = { width: rect.width, height: rect.height, ...(top === 0 ? {} : { top }) }
    setLive(liveRef.current)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (dragRef.current === null || dragRef.current.pointerId !== event.pointerId) return
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const next = nextSize(event.clientX, event.clientY)
    if (next === null) return
    liveRef.current = next.size
    setLive(next.size)
    if (next.prevWidth !== undefined && dragRef.current.prevElement !== undefined) {
      dragRef.current.prevElement.style.width = `${next.prevWidth}px`
    }
  }

  const finishResize = (event: React.PointerEvent<HTMLDivElement>, commit: boolean): void => {
    const start = dragRef.current
    if (start === null || start.pointerId !== event.pointerId) return
    const next = commit ? liveRef.current : null
    dragRef.current = null
    liveRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    const prevElement = start.prevElement
    const prevWidth = prevElement === undefined
      ? undefined
      : parseFloat(prevElement.style.width || '0')
    if (prevElement !== undefined) prevElement.style.width = ''
    if (commit && next !== null
      && (next.width !== start.width || next.height !== start.height || (next.top ?? 0) !== start.top)) {
      setPaneSize(sessionId, next)
    }
    if (commit && prevElement !== undefined && start.prevSessionId !== undefined
      && prevWidth !== undefined && Number.isFinite(prevWidth) && prevWidth !== start.prevWidth) {
      const prevPersisted = start.prevPersisted
      setPaneSize(start.prevSessionId, {
        width: prevWidth,
        height: prevPersisted?.height ?? start.prevHeight ?? MIN_PANE_HEIGHT,
        ...(prevPersisted?.top === undefined ? {} : { top: prevPersisted.top }),
      })
    }
    setLive(null)
  }

  const startPaneDrag = (event: React.DragEvent<HTMLDivElement>): void => {
    if (event.target instanceof Element && event.target.closest('button') !== null) {
      event.preventDefault()
      return
    }
    event.dataTransfer.setData(PANE_DRAG_MIME, sessionId)
    event.dataTransfer.effectAllowed = 'move'
    const frame = frameRef.current
    if (frame !== null) {
      const rect = frame.getBoundingClientRect()
      event.dataTransfer.setDragImage(frame, event.clientX - rect.left, event.clientY - rect.top)
    }
  }

  const edgeStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 2,
    touchAction: 'none',
  }
  // Top corners sit inside the 8px header padding strip only, so they never
  // cover the header buttons; bottom corners get a larger grip area.
  const topCornerStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 3,
    touchAction: 'none',
    width: 14,
    height: 6,
  }
  const bottomCornerStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 3,
    touchAction: 'none',
    width: 20,
    height: 20,
  }

  return (
    <div
      ref={frameRef}
      data-mcp-pane
      data-mcp-session={sessionId}
      data-mcp-row={row}
      data-mcp-resizing={live !== null || undefined}
      style={{
        width: size.width,
        height: size.height,
        marginTop: top,
        boxSizing: 'border-box',
        flexShrink: 0,
        border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
        borderRadius: 10,
        background: 'var(--dsw-alias-bg-layer-1, #fff)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        userSelect: live !== null ? 'none' : undefined,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.06)',
      }}
    >
      <div
        data-mcp-row-handle
        draggable
        title={row === 0 ? 'Drag to reorder, or downward to open the second row' : 'Drag to reorder, or upward to return to the first row'}
        onDragStart={startPaneDrag}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
          background: 'var(--dsw-alias-bg-layer-2, #f6f8fa)',
          flexShrink: 0,
          cursor: 'grab',
        }}
      >
        <strong
          style={{
            fontSize: 13,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
            flex: 1,
          }}
        >
          {title}
        </strong>
        <span
          aria-hidden="true"
          data-mcp-drag-handle
          title="Drag to move between rows"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'var(--dsw-alias-label-primary, #1f2328)',
            letterSpacing: 2,
            opacity: 0.55,
          }}
        >
          ⋮⋮
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            data-mcp-open-single
            aria-label={`Open ${title} in single conversation view`}
            title="Open in single conversation view"
            onClick={onOpenSingle}
            style={{
              border: 0,
              background: 'transparent',
              color: 'var(--dsw-alias-label-primary-dimmed, #656d76)',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ⤢
          </button>
          <button
            type="button"
            aria-label={`Close ${title}`}
            onClick={onClose}
            style={{
              border: 0,
              background: 'transparent',
              color: 'var(--dsw-alias-label-primary-dimmed, #656d76)',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: 2,
            }}
          >
            ×
          </button>
        </span>
      </div>
      <div
        style={{
          padding: '6px 12px',
          color: 'var(--dsw-alias-label-primary-dimmed, #656d76)',
          fontSize: 12,
          borderBottom: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
          flexShrink: 0,
        }}
      >
        <GitInfoLine cwd={cwd} />
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      <div
        data-mcp-resize-edge="e"
        aria-hidden="true"
        onPointerDown={event => startResize(event, 'e')}
        onPointerMove={moveResize}
        onPointerUp={event => finishResize(event, true)}
        onPointerCancel={event => finishResize(event, false)}
        style={{ ...edgeStyle, top: 8, bottom: 8, right: 0, width: 8, cursor: 'ew-resize' }}
      />
      <div
        data-mcp-resize-edge="w"
        aria-hidden="true"
        onPointerDown={event => startResize(event, 'w')}
        onPointerMove={moveResize}
        onPointerUp={event => finishResize(event, true)}
        onPointerCancel={event => finishResize(event, false)}
        style={{ ...edgeStyle, top: 8, bottom: 8, left: 0, width: 8, cursor: 'ew-resize' }}
      />
      <div
        data-mcp-resize-edge="s"
        aria-hidden="true"
        onPointerDown={event => startResize(event, 's')}
        onPointerMove={moveResize}
        onPointerUp={event => finishResize(event, true)}
        onPointerCancel={event => finishResize(event, false)}
        style={{ ...edgeStyle, left: 8, right: 8, bottom: 0, height: 8, cursor: 'ns-resize' }}
      />
      <div
        data-mcp-resize-edge="n"
        aria-hidden="true"
        onPointerDown={event => startResize(event, 'n')}
        onPointerMove={moveResize}
        onPointerUp={event => finishResize(event, true)}
        onPointerCancel={event => finishResize(event, false)}
        style={{ ...edgeStyle, left: 8, right: 8, top: 0, height: 8, cursor: 'ns-resize' }}
      />
      <div
        data-mcp-resize-corner
        data-mcp-resize-axis="nw"
        aria-label={`Resize ${title} from top-left`}
        title={`Resize ${title} from top-left`}
        onPointerDown={event => startResize(event, 'nw')}
        onPointerMove={moveResize}
        onPointerUp={event => finishResize(event, true)}
        onPointerCancel={event => finishResize(event, false)}
        style={{ ...topCornerStyle, left: 0, top: 0, cursor: 'nwse-resize' }}
      />
      <div
        data-mcp-resize-corner
        data-mcp-resize-axis="ne"
        aria-label={`Resize ${title} from top-right`}
        title={`Resize ${title} from top-right`}
        onPointerDown={event => startResize(event, 'ne')}
        onPointerMove={moveResize}
        onPointerUp={event => finishResize(event, true)}
        onPointerCancel={event => finishResize(event, false)}
        style={{ ...topCornerStyle, right: 0, top: 0, cursor: 'nesw-resize' }}
      />
      <div
        data-mcp-resize-corner
        data-mcp-resize-axis="sw"
        aria-label={`Resize ${title} from bottom-left`}
        title={`Resize ${title} from bottom-left`}
        onPointerDown={event => startResize(event, 'sw')}
        onPointerMove={moveResize}
        onPointerUp={event => finishResize(event, true)}
        onPointerCancel={event => finishResize(event, false)}
        style={{ ...bottomCornerStyle, left: 0, bottom: 0, cursor: 'nesw-resize' }}
      />
      <div
        data-mcp-resize-handle
        data-mcp-resize-axis="se"
        aria-label={`Resize ${title}`}
        title={`Resize ${title}`}
        onPointerDown={event => startResize(event, 'se')}
        onPointerMove={moveResize}
        onPointerUp={event => finishResize(event, true)}
        onPointerCancel={event => finishResize(event, false)}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 22,
          height: 22,
          cursor: 'nwse-resize',
          touchAction: 'none',
          zIndex: 3,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: 4,
            bottom: 4,
            width: 12,
            height: 12,
            borderRight: '2px solid var(--dsw-alias-border-l3, #a8b0b8)',
            borderBottom: '2px solid var(--dsw-alias-border-l3, #a8b0b8)',
            borderRadius: '0 0 4px 0',
          }}
        />
      </div>
    </div>
  )
}

/** Mission Control page with a row-based pane layout. */
export function MissionControlPage({
  useSessions, getSession, getModelDirectory, listCommands, openInMain,
}: MissionControlPageProps) {
  const sessions = useSessions(s => s)
  // Row/height changes keep the pane list reference identical, so this
  // revision subscription is the render trigger for row re-parenting.
  const paneRevision = useSyncExternalStore(subscribePanes, getPaneRevision, () => 0)
  const panes = useSyncExternalStore(subscribePanes, getPanes, getPanes)
  const gridRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<GridViewport | null>(null)
  const availableIds = useMemo(
    () => sessions.ids.filter(id => !panes.includes(id)),
    [sessions.ids, panes],
  )
  const availableKey = availableIds.join('\u0000')
  const [selected, setSelected] = useState('')
  useEffect(() => {
    if (selected !== '' && availableIds.includes(selected)) return
    setSelected(availableIds[0] ?? '')
    // The key is the real dependency; availableIds is derived from it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableKey])

  useEffect(() => {
    const grid = gridRef.current
    if (grid === null) return
    const measure = (): void => {
      setViewport({ width: grid.clientWidth, height: grid.clientHeight })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    if (viewport === null || panes.length === 0) return
    reflowRows(viewport.width)
  }, [paneRevision, panes, viewport])

  const rowMap = new Map<number, string[]>()
  for (const id of panes) {
    const row = getPaneRow(id)
    const list = rowMap.get(row) ?? []
    list.push(id)
    rowMap.set(row, list)
  }
  const rowNumbers = [...rowMap.keys()].sort((left, right) => left - right)
  const rowCount = rowNumbers.length
  const rowIdsByNumber = rowNumbers.map(row => rowMap.get(row) ?? [])
  const rowHeights = desiredRowHeights(rowIdsByNumber, viewport)

  const renderRow = (ids: readonly string[], row: PaneRow, rowHeight: number): React.ReactNode => {
    const defaultSize = rowDefaultSize(ids.length, viewport, rowCount)
    return (
      <div
        data-mcp-row={row}
        style={{
          display: 'flex',
          gap: PANE_GAP,
          alignItems: 'stretch',
          overflow: 'auto',
          minHeight: 0,
          height: rowHeight,
          flexShrink: 0,
          ...(ids.length === 0 ? { height: 0, overflow: 'hidden' } : {}),
        }}
      >
        {ids.map((sessionId) => {
          const summary = sessions.byId[sessionId]
          const title = summary?.title ?? summary?.displayTitle ?? sessionId
          return (
            <ResizablePane
              key={sessionId}
              sessionId={sessionId}
              title={title}
              cwd={summary?.cwd}
              row={row}
              defaultSize={defaultSize}
              rowHeight={rowHeight}
              onClose={() => removePane(sessionId)}
              onOpenSingle={() => openInMain(sessionId)}
            >
              <MiniChatPane
                sessionId={sessionId}
                session={getSession(sessionId)}
                directory={getModelDirectory(sessionId)}
                listCommands={listCommands}
                openInMain={() => openInMain(sessionId)}
              />
            </ResizablePane>
          )
        })}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 24,
        boxSizing: 'border-box',
        fontFamily: 'var(--dsw-font-family, system-ui, sans-serif)',
        height: '100%',
        minHeight: 0,
        background: 'var(--dsw-alias-bg-base, #fff)',
        color: 'var(--dsw-alias-label-primary, #1f2328)',
        overflow: 'hidden',
      }}
    >
      <style>{DROP_PREVIEW_CSS}</style>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <h1 style={{ fontSize: 20, margin: 0, fontWeight: 600 }}>Mission Control</h1>
        {availableIds.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              data-mcp-picker
              value={selected}
              onChange={event => setSelected(event.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: 13,
                background: 'var(--dsw-alias-bg-layer-2, #fff)',
                color: 'var(--dsw-alias-label-primary, #1f2328)',
                border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
                borderRadius: 6,
              }}
            >
              {availableIds.map((id) => {
                const summary = sessions.byId[id]
                const label = summary?.title ?? summary?.displayTitle ?? id
                return <option key={id} value={id}>{label}</option>
              })}
            </select>
            <button
              type="button"
              data-mcp-add-pane
              disabled={selected === ''}
              onClick={() => addPane(selected)}
              style={{
                padding: '4px 10px',
                fontSize: 13,
                cursor: 'pointer',
                background: 'var(--dsw-alias-button-primary-fill, #1f2328)',
                color: 'var(--dsw-alias-button-primary-foreground, #fff)',
                border: 0,
                borderRadius: 6,
                fontWeight: 600,
              }}
            >
              Add
            </button>
          </div>
        )}
      </div>
      <div
        ref={gridRef}
        data-mcp-grid
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: PANE_GAP,
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {panes.length === 0 ? (
          <p style={{ color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', margin: 0 }}>
            Drag a conversation here to start a multi-pane view.
          </p>
        ) : rowNumbers.map((row, index) => renderRow(
          rowIdsByNumber[index] ?? [],
          row,
          rowHeights[index] ?? FALLBACK_PANE_SIZE.height,
        ))}
      </div>
    </div>
  )
}
