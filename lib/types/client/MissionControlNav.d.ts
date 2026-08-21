/**
 * Sidebar first-level action that opens the Mission Control main page.
 */
import React from 'react';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
/** Registration-side navigation action. */
export interface MissionControlNavInjected {
    readonly pageId: string;
    readonly open: () => void;
}
/** Full props of the sidebar first-level Mission Control entry. */
export type MissionControlNavProps = PropsRuntime<'sidebar.primary.action'> & InjectFace<MissionControlNavInjected>;
/** First-level sidebar entry that opens the Mission Control page. */
export declare function MissionControlNav({ wide, primaryPage, pageId, open }: MissionControlNavProps): React.JSX.Element;
