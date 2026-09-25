import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/** Sidebar action shared by the legacy primary-action and official footer slots. */
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
const subscribeClosed = () => () => { };
const getClosed = () => false;
/**
 * The official sidebar currently exposes only a footer action slot. Locate the
 * workspace region from that declared mount point and insert a plugin-owned
 * host immediately before it (below New Session, above the conversation list).
 */
function useSidebarUpperHost(enabled) {
    const marker = useRef(null);
    const [host, setHost] = useState(null);
    useLayoutEffect(() => {
        if (!enabled)
            return;
        let foot = marker.current?.parentElement ?? null;
        while (foot !== null) {
            const candidate = foot.previousElementSibling;
            if (candidate?.matches('[data-workspaces]') === true
                || candidate?.querySelector('[data-slot="sidebar.workspaces"]') != null)
                break;
            foot = foot.parentElement;
        }
        const sidebar = foot?.parentElement ?? null;
        const workspaceRegion = foot?.previousElementSibling ?? null;
        if (sidebar === null || workspaceRegion === null)
            return;
        const nextHost = document.createElement('div');
        nextHost.dataset.mcpSidebarUpper = '';
        Object.assign(nextHost.style, {
            display: 'flex',
            flex: 'none',
            width: '100%',
            minWidth: '0',
            marginBottom: '8px',
        });
        const keepImmediatelyAboveWorkspace = () => {
            if (nextHost.nextElementSibling !== workspaceRegion) {
                sidebar.insertBefore(nextHost, workspaceRegion);
            }
        };
        keepImmediatelyAboveWorkspace();
        // A plugin loaded later may insert another entry before the workspace.
        // Re-anchor after it so Mission Control remains the last entry before the
        // workspace/session browser, independent of plugin activation order.
        const observer = new MutationObserver(keepImmediatelyAboveWorkspace);
        observer.observe(sidebar, { childList: true });
        setHost(nextHost);
        return () => {
            observer.disconnect();
            nextHost.remove();
        };
    }, [enabled]);
    return { marker, host };
}
/** First-level sidebar entry that opens the Mission Control page. */
export function MissionControlNav({ wide, primaryPage, pageId, open, openState, placement = 'inline', }) {
    const overlayOpen = useSyncExternalStore(openState?.subscribe ?? subscribeClosed, openState?.getSnapshot ?? getClosed, getClosed);
    const selected = primaryPage === pageId || overlayOpen;
    const { marker, host } = useSidebarUpperHost(placement === 'sidebar-upper');
    const button = (_jsxs("button", { type: "button", "data-mcp-sidebar-entry": true, "aria-current": selected ? 'page' : undefined, "aria-label": "Mission Control", title: "Mission Control", onClick: open, style: {
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '8px 12px',
            border: 0,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 14,
        }, children: [_jsx("span", { "aria-hidden": "true", children: "\u25A6" }), wide ? _jsx("span", { children: "Mission Control" }) : null] }));
    if (placement === 'inline')
        return button;
    return (_jsxs(_Fragment, { children: [_jsx("span", { ref: marker, hidden: true }), host === null ? null : createPortal(button, host)] }));
}
//# sourceMappingURL=MissionControlNav.js.map