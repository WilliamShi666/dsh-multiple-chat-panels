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
import type { ConversationNode, PartialAssistant, SessionFace } from '@deepseek-ai/dsh-client-runtime/client';
/** One host slash command surfaced in the pane input menu. */
export interface PaneCommand {
    readonly name: string;
    readonly description: string;
    readonly hint?: string;
}
/**
 * Read face of one session's assembled Chat view.
 *
 * DSH 0.1.5 moved conversation content out of `SessionFace` into the
 * Conversation assembly: `SessionSnapshot` now carries lifecycle and control
 * state only, while the transcript lives behind a per-target view. The Chat
 * view exposes the materialized transcript under `legacy`, which is the flat
 * node list this pane renders. Declared structurally so the pane does not
 * depend on a package that only newer shells ship.
 */
export interface PaneChatSnapshot {
    readonly legacy: {
        readonly nodes: readonly ConversationNode[];
        readonly partial: PartialAssistant | null;
    };
}
/** Observable source of one session's Chat view snapshot (getSnapshot + subscribe). */
export interface PaneChatObservable {
    /** @returns the current snapshot, or the stable empty value before materialization. */
    readonly getSnapshot: () => PaneChatSnapshot;
    readonly subscribe: (listener: () => void) => () => void;
}
/**
 * Stable empty Chat snapshot.
 *
 * `useSyncExternalStore` compares snapshots by identity, so a source must never
 * hand back a freshly built object for an unmaterialized target — that spins
 * the render loop. The shell's own Chat consumer falls back to a frozen
 * constant for exactly this reason.
 */
export declare const EMPTY_CHAT_SNAPSHOT: PaneChatSnapshot;
interface MiniChatPaneProps {
    readonly sessionId: string;
    readonly session: SessionFace | undefined;
    /** Chat view snapshot; absent on shells that predate the Conversation assembly. */
    readonly chat: PaneChatObservable | undefined;
    readonly directory: ModelDirectory | undefined;
    readonly listCommands: (sessionId: string) => Promise<readonly PaneCommand[]>;
    readonly openInMain: () => void;
}
/** Render one session's conversation with an input box and live controls. */
export declare function MiniChatPane({ sessionId, session, chat, directory, listCommands, openInMain }: MiniChatPaneProps): React.JSX.Element;
export {};
