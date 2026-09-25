import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Official Harness carrier: Mission Control as a frame-wide additive overlay. */
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { MissionControlPage } from "./MissionControlPage.js";
/** Render the page above the official three-column frame while open. */
export function MissionControlOverlay({ close, openState, ...page }) {
    const open = useSyncExternalStore(openState.subscribe, openState.getSnapshot, openState.getSnapshot);
    const root = useRef(null);
    const [inset, setInset] = useState({ left: 0, right: 0 });
    useLayoutEffect(() => {
        if (!open)
            return;
        const slot = root.current?.parentElement;
        const overlayLayer = slot?.parentElement;
        const frame = overlayLayer?.parentElement;
        const center = frame?.children.item(1);
        if (!(frame instanceof HTMLElement) || !(center instanceof HTMLElement))
            return;
        const measure = () => {
            const frameRect = frame.getBoundingClientRect();
            const centerRect = center.getBoundingClientRect();
            setInset({
                left: Math.max(0, centerRect.left - frameRect.left),
                right: Math.max(0, frameRect.right - centerRect.right),
            });
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(frame);
        observer.observe(center);
        return () => { observer.disconnect(); };
    }, [open]);
    if (!open)
        return null;
    return (_jsxs("div", { ref: root, "data-mcp-overlay": true, style: {
            position: 'absolute',
            top: 0,
            right: inset.right,
            bottom: 0,
            left: inset.left,
            zIndex: 1,
            pointerEvents: 'auto',
            overflow: 'hidden',
            background: 'var(--dsw-alias-bg-base, #fff)',
        }, children: [_jsx("button", { type: "button", "aria-label": "Close Mission Control", title: "Close Mission Control", onClick: close, style: {
                    position: 'absolute',
                    zIndex: 2,
                    top: 18,
                    right: 20,
                    width: 28,
                    height: 28,
                    border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
                    borderRadius: 6,
                    background: 'var(--dsw-alias-bg-layer-2, #fff)',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 18,
                    lineHeight: '24px',
                }, children: "\u00D7" }), _jsx(MissionControlPage, { ...page })] }));
}
//# sourceMappingURL=MissionControlOverlay.js.map