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
import React from 'react';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionFace } from '@deepseek-ai/dsh-client-runtime/client';
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client';
/** One host slash command surfaced in the pane input menu. */
export interface PaneCommand {
    readonly name: string;
    readonly description: string;
    readonly hint?: string;
}
/** Registration-side page face: resolves session services for panes. */
export interface MissionControlPageInjected {
    readonly getSession: (sessionId: string) => SessionFace | undefined;
    readonly getModelDirectory: (sessionId: string) => ModelDirectory | undefined;
    readonly listCommands: (sessionId: string) => Promise<readonly PaneCommand[]>;
    readonly openInMain: (sessionId: string) => void;
}
/** Full props of the Mission Control main page. */
export type MissionControlPageProps = PropsRuntime<'main.page'> & InjectFace<MissionControlPageInjected>;
/** Mission Control page with a row-based pane layout. */
export declare function MissionControlPage({ useSessions, getSession, getModelDirectory, listCommands, openInMain, }: MissionControlPageProps): React.JSX.Element;
