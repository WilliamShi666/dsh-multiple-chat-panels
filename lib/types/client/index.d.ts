import type { Context as ClientContext } from '@deepseek-ai/cordis';
/**
 * Retain-source identity for this plugin's per-pane session references. DSH
 * 0.2 counts local retention per consumer, so the plugin must name itself
 * through the Session Controller's merge-extensible source map.
 */
declare module '@deepseek-ai/dsh-api-session-controller/client' {
    interface SessionReferenceSourceMap {
        multipleChatPanels: unknown;
    }
}
export declare const PAGE_ID = "mission-control";
/**
 * Services this plugin reads through proxies.
 *
 * Cordis evaluates nested service reads of a called service against the
 * CALLER's fiber, so the dotted Remote namespaces consumed indirectly through
 * the Model Directory (`remote.session`) and the permission catalog
 * (`remote.permissionPresets`) must be declared here as well.
 */
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
