import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Compact per-pane controls: permission preset, model route, and reasoning
 * effort. All three write through the same public surfaces as the main
 * conversation (session.command('/permission ...') and the shared
 * ModelDirectory), so the pane and the main view stay on one source of truth.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
const EMPTY_MODELS = {
    current: null,
    routable: null,
    groups: [],
    failures: [],
    status: 'idle',
    error: null,
};
/** Bind a bare observable to React without pulling in web-react. */
function useObservable(source, fallback) {
    const subscribe = useMemo(() => (source === undefined ? () => () => { } : (fn) => source.subscribe(fn)), [source]);
    const getSnapshot = useMemo(() => (source === undefined ? () => fallback : () => source.getSnapshot()), [source, fallback]);
    return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}
/** Stable key for one provider/model row. */
function modelKey(providerId, modelId) {
    return `${providerId}\u0000${modelId}`;
}
function groupModels(groups) {
    const rows = [];
    for (const group of groups) {
        const models = (group.models ?? []);
        for (const model of models) {
            rows.push({
                provider: group.id,
                modelId: model.id,
                name: model.name,
                reasoningEfforts: model.reasoning?.efforts.map(effort => effort.id) ?? [],
                defaultEffort: model.reasoning?.defaultEffort,
            });
        }
    }
    return rows;
}
/** Display label for one permission preset option. */
function permissionLabel(value, name) {
    if (value === 'read-only')
        return 'Read-only';
    if (value === 'workspace-write')
        return 'Workspace write';
    if (value === 'danger-full-access')
        return 'Full access';
    return name;
}
/** Compact toolbar for the per-pane permission/model/thinking choices. */
export function PaneToolbar({ session, directory }) {
    const permissionFace = session.projections.faceOf('permissions');
    const permission = useObservable(permissionFace, undefined);
    const models = useObservable(directory?.store, EMPTY_MODELS);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (directory === undefined)
            return;
        let cancelled = false;
        void directory.load().catch(() => {
            if (!cancelled)
                setError('Model catalog failed to load');
        });
        return () => { cancelled = true; };
    }, [directory]);
    const rows = useMemo(() => groupModels(models.groups), [models.groups]);
    const currentModel = rows.find(row => models.current !== null && row.provider === models.current.provider && row.modelId === models.current.model);
    const currentEffort = models.current?.reasoningEffort
        ?? currentModel?.defaultEffort
        ?? '';
    const selectPermission = (value) => {
        if (permission?.currentValue === value)
            return;
        if (value === 'danger-full-access' && !window.confirm('Enable Full Access for this session?'))
            return;
        void session.command(`/permission ${value}`).then(() => { setError(null); }, () => { setError('Permission switch failed'); });
    };
    const selectModel = async (value) => {
        if (directory === undefined)
            return;
        const separator = value.indexOf('\u0000');
        if (separator === -1)
            return;
        const provider = value.slice(0, separator);
        const modelId = value.slice(separator + 1);
        const row = rows.find(candidate => candidate.provider === provider && candidate.modelId === modelId);
        if (row === undefined)
            return;
        const sameRoute = models.current?.provider === provider && models.current.model === modelId;
        const reasoningEffort = sameRoute
            ? models.current?.reasoningEffort ?? row.defaultEffort
            : row.defaultEffort;
        const selection = {
            provider,
            model: modelId,
            ...reasoningEffort === undefined ? {} : { reasoningEffort },
        };
        try {
            setError(null);
            await directory.select(selection);
        }
        catch {
            setError('Model switch failed');
        }
    };
    const selectEffort = async (value) => {
        if (directory === undefined || models.current === null)
            return;
        try {
            setError(null);
            await directory.select({ ...models.current, reasoningEffort: value });
        }
        catch {
            setError('Thinking mode switch failed');
        }
    };
    return (_jsxs("div", { "data-mcp-controls": true, style: {
            display: 'flex',
            flexWrap: 'wrap',
            gap: 5,
            alignItems: 'center',
            padding: '5px 8px',
            borderBottom: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
            background: 'var(--dsw-alias-bg-layer-2, #f6f8fa)',
            fontSize: 11,
            flexShrink: 0,
        }, children: [permission !== undefined && (_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }, children: [_jsx("span", { style: { color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', whiteSpace: 'nowrap' }, children: "Perm" }), _jsx("select", { "data-mcp-permission": true, "aria-label": "Permission preset", value: permission.currentValue, onChange: event => selectPermission(event.target.value), style: selectStyle, children: permission.options
                            .filter(option => option.value !== 'custom')
                            .map(option => (_jsx("option", { value: option.value, children: permissionLabel(option.value, option.name) }, option.value))) })] })), _jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1.4 }, children: [_jsx("span", { style: { color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', whiteSpace: 'nowrap' }, children: "Model" }), _jsxs("select", { "data-mcp-model": true, "aria-label": "Model", value: models.current === null ? '' : modelKey(models.current.provider, models.current.model), onChange: event => { void selectModel(event.target.value); }, disabled: directory === undefined || models.status === 'loading' || models.status === 'selecting', style: selectStyle, children: [models.current === null && _jsx("option", { value: "", children: "Loading\u2026" }), models.groups.map(group => (_jsx("optgroup", { label: group.name, children: group.models.map(model => (_jsx("option", { value: modelKey(group.id, model.id), children: model.name }, modelKey(group.id, model.id)))) }, group.id)))] })] }), currentModel !== undefined && currentModel.reasoningEfforts.length > 1 && (_jsxs("label", { style: { display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }, children: [_jsx("span", { style: { color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', whiteSpace: 'nowrap' }, children: "Think" }), _jsx("select", { "data-mcp-thinking": true, "aria-label": "Thinking mode", value: currentEffort, onChange: event => { void selectEffort(event.target.value); }, disabled: directory === undefined || models.status === 'loading' || models.status === 'selecting', style: selectStyle, children: currentModel.reasoningEfforts.map(effort => _jsx("option", { value: effort, children: effort }, effort)) })] })), error !== null && (_jsx("span", { style: { color: 'var(--dsw-alias-state-error-primary, #d1242f)', flexBasis: '100%' }, children: error }))] }));
}
const selectStyle = {
    flex: 1,
    minWidth: 0,
    maxWidth: 132,
    padding: '1px 3px',
    fontSize: 11,
    border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
    borderRadius: 5,
    background: 'var(--dsw-alias-bg-layer-1, #fff)',
    color: 'var(--dsw-alias-label-primary, #1f2328)',
};
//# sourceMappingURL=PaneToolbar.js.map