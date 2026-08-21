/** Shared navigation state for the official Harness overlay adapter. */
import type { MissionControlOpenState } from './MissionControlNav.tsx'

/** Mutable controller plus the observable face consumed by React. */
export interface MissionControlNavigation extends MissionControlOpenState {
  readonly open: () => void
  readonly close: () => void
}

/** Create one plugin-lifecycle navigation controller. */
export function createMissionControlNavigation(): MissionControlNavigation {
  let open = false
  const listeners = new Set<() => void>()
  const set = (next: boolean): void => {
    if (open === next) return
    open = next
    for (const listener of [...listeners]) listener()
  }
  return {
    getSnapshot: () => open,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    open: () => { set(true) },
    close: () => { set(false) },
  }
}
