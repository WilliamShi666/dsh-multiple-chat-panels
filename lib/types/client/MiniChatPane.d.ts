/**
 * Mini chat pane: a lightweight, live conversation renderer for one session.
 *
 * Uses the public `SessionFace` observable plus the runtime-internal `open()`
 * bridge to load the history window and receive live session events. This is
 * the documented v1 internal-API bridge; see FUTURE_UPSTREAM.md for the
 * upstream-public API proposal.
 *
 * The pane ships its own compact slash menu, permission/model/thinking
 * toolbar, and a bottom-anchored composer so it stays usable at pane scale.
 */
import React from 'react';
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client';
import type { SessionFace } from '@deepseek-ai/dsh-client-runtime/client';
/** One host slash command surfaced in the pane input menu. */
export interface PaneCommand {
    readonly name: string;
    readonly description: string;
    readonly hint?: string;
}
interface MiniChatPaneProps {
    readonly sessionId: string;
    readonly session: SessionFace | undefined;
    readonly directory: ModelDirectory | undefined;
    readonly listCommands: (sessionId: string) => Promise<readonly PaneCommand[]>;
    readonly openInMain: () => void;
}
/** Render one session's conversation with an input box and live controls. */
export declare function MiniChatPane({ sessionId, session, directory, listCommands, openInMain }: MiniChatPaneProps): React.JSX.Element;
export {};
