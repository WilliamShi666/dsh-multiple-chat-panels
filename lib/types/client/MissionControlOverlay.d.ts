/** Official Harness carrier: Mission Control as a frame-wide additive overlay. */
import React from 'react';
import type { MissionControlOpenState } from './MissionControlNav.tsx';
import { type MissionControlPageProps } from './MissionControlPage.tsx';
/** Official overlay registration props. */
export interface MissionControlOverlayProps extends MissionControlPageProps {
    readonly close: () => void;
    readonly openState: MissionControlOpenState;
}
/** Render the page above the official three-column frame while open. */
export declare function MissionControlOverlay({ close, openState, ...page }: MissionControlOverlayProps): React.JSX.Element | null;
