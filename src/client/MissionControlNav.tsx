/** Sidebar action shared by the legacy primary-action and official footer slots. */
import React, { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

/** Registration-side navigation action. */
export interface MissionControlNavInjected {
  readonly pageId: string
  readonly open: () => void
  readonly openState?: MissionControlOpenState
  /** Official Harness mounts through the footer slot, then portals above the session list. */
  readonly placement?: 'inline' | 'sidebar-upper'
}

/** Observable open state used by the official Harness overlay adapter. */
export interface MissionControlOpenState {
  readonly getSnapshot: () => boolean
  readonly subscribe: (listener: () => void) => () => void
}

/** Props supplied by either supported sidebar slot. */
export interface MissionControlNavProps extends MissionControlNavInjected {
  readonly wide: boolean
  readonly primaryPage?: string
}

const subscribeClosed = (): (() => void) => () => {}
const getClosed = (): boolean => false

/**
 * The official sidebar currently exposes only a footer action slot. Locate the
 * workspace region from that declared mount point and insert a plugin-owned
 * host immediately before it (below New Session, above the conversation list).
 */
function useSidebarUpperHost(enabled: boolean): {
  readonly marker: React.RefObject<HTMLSpanElement>
  readonly host: HTMLDivElement | null
} {
  const marker = useRef<HTMLSpanElement>(null)
  const [host, setHost] = useState<HTMLDivElement | null>(null)
  useLayoutEffect(() => {
    if (!enabled) return
    let foot = marker.current?.parentElement ?? null
    while (foot !== null) {
      const candidate = foot.previousElementSibling
      if (candidate?.matches('[data-workspaces]') === true
        || candidate?.querySelector('[data-slot="sidebar.workspaces"]') != null) break
      foot = foot.parentElement
    }
    const sidebar = foot?.parentElement ?? null
    const workspaceRegion = foot?.previousElementSibling ?? null
    if (sidebar === null || workspaceRegion === null) return
    const nextHost = document.createElement('div')
    nextHost.dataset.mcpSidebarUpper = ''
    Object.assign(nextHost.style, {
      display: 'flex',
      flex: 'none',
      width: '100%',
      minWidth: '0',
      marginBottom: '8px',
    })
    const keepImmediatelyAboveWorkspace = (): void => {
      if (nextHost.nextElementSibling !== workspaceRegion) {
        sidebar.insertBefore(nextHost, workspaceRegion)
      }
    }
    keepImmediatelyAboveWorkspace()
    // A plugin loaded later may insert another entry before the workspace.
    // Re-anchor after it so Mission Control remains the last entry before the
    // workspace/session browser, independent of plugin activation order.
    const observer = new MutationObserver(keepImmediatelyAboveWorkspace)
    observer.observe(sidebar, { childList: true })
    setHost(nextHost)
    return () => {
      observer.disconnect()
      nextHost.remove()
    }
  }, [enabled])
  return { marker, host }
}

/** First-level sidebar entry that opens the Mission Control page. */
export function MissionControlNav({
  wide,
  primaryPage,
  pageId,
  open,
  openState,
  placement = 'inline',
}: MissionControlNavProps) {
  const overlayOpen = useSyncExternalStore(
    openState?.subscribe ?? subscribeClosed,
    openState?.getSnapshot ?? getClosed,
    getClosed,
  )
  const selected = primaryPage === pageId || overlayOpen
  const { marker, host } = useSidebarUpperHost(placement === 'sidebar-upper')
  const button = (
    <button
      type="button"
      data-mcp-sidebar-entry
      aria-current={selected ? 'page' : undefined}
      aria-label="Mission Control"
      title="Mission Control"
      onClick={open}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '8px 12px',
        border: 0,
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: 14,
      }}
    >
      <span aria-hidden="true">▦</span>
      {wide ? <span>Mission Control</span> : null}
    </button>
  )
  if (placement === 'inline') return button
  return (
    <>
      <span ref={marker} hidden />
      {host === null ? null : createPortal(button, host)}
    </>
  )
}
