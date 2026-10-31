/**
 * Compact per-pane controls: permission preset, model route, and reasoning
 * effort. All three write through the same public surfaces as the main
 * conversation (session.command('/permission ...') and the shared
 * ModelDirectory), so the pane and the main view stay on one source of truth.
 */
import React from 'react';
import type { SessionFace } from '@deepseek-ai/dsh-api-session-controller/client';
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client';
/** One selectable permission preset from the process catalog. */
export interface PermissionOption {
    readonly value: string;
    readonly name: string;
}
interface PaneToolbarProps {
    readonly session: SessionFace;
    readonly directory: ModelDirectory | undefined;
    readonly permissionOptions: readonly PermissionOption[];
}
/** Compact toolbar for the per-pane permission/model/thinking choices. */
export declare function PaneToolbar({ session, directory, permissionOptions }: PaneToolbarProps): React.JSX.Element;
export {};
