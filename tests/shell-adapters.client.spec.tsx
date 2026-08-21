import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MissionControlNav } from '../src/client/MissionControlNav.tsx'
import { MissionControlOverlay } from '../src/client/MissionControlOverlay.tsx'
import { createMissionControlNavigation } from '../src/client/navigation.ts'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const emptySessions = {
  ids: [],
  byId: {},
  current: undefined,
  phase: 'ready',
  subagentsByParent: {},
  jobsBySession: {},
  currentAddress: undefined,
}

describe('shell adapters', () => {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  afterEach(() => {
    if (root !== undefined) act(() => { root?.unmount() })
    container?.remove()
    document.documentElement.lang = 'en'
    root = undefined
    container = undefined
  })

  it('keeps the legacy primary-page selection contract', () => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => {
      root?.render(<MissionControlNav
        wide
        primaryPage="mission-control"
        pageId="mission-control"
        open={vi.fn()}
      />)
    })
    expect(container.querySelector('[aria-current="page"]')).not.toBeNull()
  })

  it('opens and closes the official frame overlay through shared navigation state', () => {
    const navigation = createMissionControlNavigation()
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => {
      root?.render(<>
        <MissionControlNav
          wide
          pageId="mission-control"
          open={navigation.open}
          openState={navigation}
        />
        <MissionControlOverlay
          openState={navigation}
          close={navigation.close}
          useSessions={select => select(emptySessions as never)}
          getSession={() => undefined}
          getModelDirectory={() => undefined}
          listCommands={async () => []}
          openInMain={() => {}}
        />
      </>)
    })
    expect(container.querySelector('[data-mcp-overlay]')).toBeNull()

    act(() => { navigation.open() })
    expect(container.querySelector('[data-mcp-overlay]')).not.toBeNull()
    expect(container.querySelector('[aria-current="page"]')).not.toBeNull()

    const close = container.querySelector<HTMLButtonElement>('[aria-label="Close Mission Control"]')
    act(() => { close?.click() })
    expect(container.querySelector('[data-mcp-overlay]')).toBeNull()
  })

  it('keeps the official action immediately above the conversation list', async () => {
    container = document.createElement('div')
    container.innerHTML = '<div data-new-session></div><div data-workspaces><div data-slot="sidebar.workspaces"></div></div><div data-foot><div data-footer-actions><div data-slot="sidebar.footer.action"></div></div></div>'
    document.body.append(container)
    const footer = container.querySelector('[data-slot="sidebar.footer.action"]')
    if (!(footer instanceof HTMLDivElement)) throw new Error('missing footer fixture')
    root = createRoot(footer)
    act(() => {
      root?.render(<MissionControlNav
        wide
        pageId="mission-control"
        open={vi.fn()}
        placement="sidebar-upper"
      />)
    })
    const upper = container.querySelector('[data-mcp-sidebar-upper]')
    const workspaces = container.querySelector('[data-workspaces]')
    expect(upper?.nextElementSibling).toBe(workspaces)
    expect(upper?.querySelector('[data-mcp-sidebar-entry]')).not.toBeNull()
    expect(footer.querySelector('[data-mcp-sidebar-entry]')).toBeNull()

    const laterPlugin = document.createElement('div')
    laterPlugin.dataset.laterPlugin = ''
    container.insertBefore(laterPlugin, workspaces)
    await act(async () => { await Promise.resolve() })
    expect(laterPlugin.nextElementSibling).toBe(upper)
    expect(upper?.nextElementSibling).toBe(workspaces)
  })

  it('shows the empty-state instruction in Chinese when the UI language is Chinese', () => {
    document.documentElement.lang = 'zh-CN'
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    act(() => {
      root?.render(<MissionControlOverlay
        openState={{ subscribe: () => () => {}, getSnapshot: () => true }}
        close={() => {}}
        useSessions={select => select(emptySessions as never)}
        getSession={() => undefined}
        getModelDirectory={() => undefined}
        listCommands={async () => []}
        openInMain={() => {}}
      />)
    })
    expect(container.textContent).toContain('将左侧边栏中的对话拖到这里，即可开始多对话窗口视图。')
    expect(container.textContent).not.toContain('Drag a conversation here')
  })
})
