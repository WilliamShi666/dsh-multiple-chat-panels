import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** First-level sidebar entry that opens the Mission Control page. */
export function MissionControlNav({ wide, primaryPage, pageId, open }) {
    const selected = primaryPage === pageId;
    return (_jsxs("button", { type: "button", "aria-current": selected ? 'page' : undefined, "aria-label": "Mission Control", title: "Mission Control", onClick: open, style: {
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
}
//# sourceMappingURL=MissionControlNav.js.map