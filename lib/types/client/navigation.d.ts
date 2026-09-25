/** Shared navigation state for the official Harness overlay adapter. */
import type { MissionControlOpenState } from './MissionControlNav.tsx';
/** Mutable controller plus the observable face consumed by React. */
export interface MissionControlNavigation extends MissionControlOpenState {
    readonly open: () => void;
    readonly close: () => void;
}
/** Create one plugin-lifecycle navigation controller. */
export declare function createMissionControlNavigation(): MissionControlNavigation;
