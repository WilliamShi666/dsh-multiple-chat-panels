/**
 * Sidebar first-level action that opens the Mission Control main page.
 */
import React from 'react'
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'

/** Registration-side navigation action. */
export interface MissionControlNavInjected {
  readonly pageId: string
  readonly open: () => void
}

/** Full props of the sidebar first-level Mission Control entry. */
export type MissionControlNavProps =
  PropsRuntime<'sidebar.primary.action'>
  & InjectFace<MissionControlNavInjected>

/** First-level sidebar entry that opens the Mission Control page. */
export function MissionControlNav({ wide, primaryPage, pageId, open }: MissionControlNavProps) {
  const selected = primaryPage === pageId
  return (
    <button
      type="button"
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
}
