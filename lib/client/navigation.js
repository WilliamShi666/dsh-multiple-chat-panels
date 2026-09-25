/** Create one plugin-lifecycle navigation controller. */
export function createMissionControlNavigation() {
    let open = false;
    const listeners = new Set();
    const set = (next) => {
        if (open === next)
            return;
        open = next;
        for (const listener of [...listeners])
            listener();
    };
    return {
        getSnapshot: () => open,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
        open: () => { set(true); },
        close: () => { set(false); },
    };
}
//# sourceMappingURL=navigation.js.map