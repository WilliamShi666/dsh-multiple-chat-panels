import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MissionControlPage } from '../src/client/MissionControlPage.tsx'
import { placePane, setPanes } from '../src/client/pane-store.ts'

class TestResizeObserver implements ResizeObserver {
  readonly observe = vi.fn()
  readonly unobserve = vi.fn()
  readonly disconnect = vi.fn()
}

globalThis.ResizeObserver = TestResizeObserver
globalThis.IS_REACT_ACT_ENVIRONMENT = true
HTMLElement.prototype.scrollTo = vi.fn()

const sessions = {
  ids: ['one', 'two'],
  byId: {
    one: { id: 'one', title: 'One' },
    two: { id: 'two', title: 'Two' },
  },
}

describe('MissionControlPage', () => {
  let root: Root | undefined
  let container: HTMLDivElement | undefined

  afterEach(() => {
    if (root !== undefined) act(() => { root?.unmount() })
    container?.remove()
    root = undefined
    container = undefined
    setPanes([])
  })

  it('preserves a pane DOM subtree when moving it between rows', async () => {
    setPanes(['one', 'two'])
    placePane('one', 0)
    placePane('two', 1)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)

    await act(async () => {
      root?.render(React.createElement(MissionControlPage, {
        useSessions: (select: (state: typeof sessions) => unknown) => select(sessions),
        getSession: () => undefined,
        getModelDirectory: () => undefined,
        listCommands: async () => [],
        openInMain: () => {},
      } as never))
    })

    const before = container.querySelector('[data-mcp-session="two"]')
    expect(before).toBeInstanceOf(HTMLDivElement)

    act(() => { placePane('two', 0) })

    const after = container.querySelector('[data-mcp-session="two"]')
    expect(after).toBe(before)
    expect(after?.closest('[data-mcp-row]')?.getAttribute('data-mcp-row')).toBe('0')
  })
})
