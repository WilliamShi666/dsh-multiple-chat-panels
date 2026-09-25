/** Sidebar action shared by the legacy primary-action and official footer slots. */
import React from 'react';
/** Registration-side navigation action. */
export interface MissionControlNavInjected {
    readonly pageId: string;
    readonly open: () => void;
    readonly openState?: MissionControlOpenState;
    /** Official Harness mounts through the footer slot, then portals above the session list. */
    readonly placement?: 'inline' | 'sidebar-upper';
}
/** Observable open state used by the official Harness overlay adapter. */
export interface MissionControlOpenState {
    readonly getSnapshot: () => boolean;
    readonly subscribe: (listener: () => void) => () => void;
}
/** Props supplied by either supported sidebar slot. */
export interface MissionControlNavProps extends MissionControlNavInjected {
    readonly wide: boolean;
    readonly primaryPage?: string;
}
/** First-level sidebar entry that opens the Mission Control page. */
export declare function MissionControlNav({ wide, primaryPage, pageId, open, openState, placement, }: MissionControlNavProps): React.JSX.Element;
