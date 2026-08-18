/**
 * Compact per-pane controls: permission preset, model route, and reasoning
 * effort. All three write through the same public surfaces as the main
 * conversation (session.command('/permission ...') and the shared
 * ModelDirectory), so the pane and the main view stay on one source of truth.
 */
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type {
  ModelProviderGroup, ModelSelection,
} from '@deepseek-ai/dsh-api-remotes/client'
import type { SessionFace } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ModelDirectory, ModelDirectoryState,
} from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { PermissionSelect } from '@deepseek-ai/dsh-permission-presets/client'

interface PaneToolbarProps {
  readonly session: SessionFace
  readonly directory: ModelDirectory | undefined
}

const EMPTY_MODELS: ModelDirectoryState = {
  current: null,
  routable: null,
  groups: [],
  failures: [],
  status: 'idle',
  error: null,
}

/** Bind a bare observable to React without pulling in web-react. */
function useObservable<T>(source: { getSnapshot(): T; subscribe(fn: () => void): () => void } | undefined, fallback: T): T {
  const subscribe = useMemo(
    () => (source === undefined ? () => () => {} : (fn: () => void) => source.subscribe(fn)),
    [source],
  )
  const getSnapshot = useMemo(
    () => (source === undefined ? () => fallback : () => source.getSnapshot()),
    [source, fallback],
  )
  return useSyncExternalStore(subscribe, getSnapshot, () => fallback)
}

/** Stable key for one provider/model row. */
function modelKey(providerId: string, modelId: string): string {
  return `${providerId}\u0000${modelId}`
}

function groupModels(groups: readonly ModelProviderGroup[]): ReadonlyArray<{ provider: string; modelId: string; name: string; reasoningEfforts: readonly string[]; defaultEffort: string | undefined }> {
  const rows: Array<{ provider: string; modelId: string; name: string; reasoningEfforts: readonly string[]; defaultEffort: string | undefined }> = []
  for (const group of groups) {
    for (const model of group.models) {
      rows.push({
        provider: group.id,
        modelId: model.id,
        name: model.name,
        reasoningEfforts: model.reasoning?.efforts.map(effort => effort.id) ?? [],
        defaultEffort: model.reasoning?.defaultEffort,
      })
    }
  }
  return rows
}

/** Display label for one permission preset option. */
function permissionLabel(value: string, name: string): string {
  if (value === 'read-only') return 'Read-only'
  if (value === 'workspace-write') return 'Workspace write'
  if (value === 'danger-full-access') return 'Full access'
  return name
}

/** Compact toolbar for the per-pane permission/model/thinking choices. */
export function PaneToolbar({ session, directory }: PaneToolbarProps) {
  const permissionFace = session.projections.faceOf('permissions')
  const permission = useObservable(permissionFace, undefined as PermissionSelect | undefined)
  const models = useObservable(directory?.store, EMPTY_MODELS)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (directory === undefined) return
    let cancelled = false
    void directory.load().catch(() => {
      if (!cancelled) setError('Model catalog failed to load')
    })
    return () => { cancelled = true }
  }, [directory])

  const rows = useMemo(() => groupModels(models.groups), [models.groups])
  const currentModel = rows.find(
    row => models.current !== null && row.provider === models.current.provider && row.modelId === models.current.model,
  )
  const currentEffort = models.current?.reasoningEffort
    ?? currentModel?.defaultEffort
    ?? ''

  const selectPermission = (value: string): void => {
    if (permission?.currentValue === value) return
    if (value === 'danger-full-access' && !window.confirm('Enable Full Access for this session?')) return
    void session.command(`/permission ${value}`).then(
      () => { setError(null) },
      () => { setError('Permission switch failed') },
    )
  }

  const selectModel = async (value: string): Promise<void> => {
    if (directory === undefined) return
    const separator = value.indexOf('\u0000')
    if (separator === -1) return
    const provider = value.slice(0, separator)
    const modelId = value.slice(separator + 1)
    const row = rows.find(candidate => candidate.provider === provider && candidate.modelId === modelId)
    if (row === undefined) return
    const sameRoute = models.current?.provider === provider && models.current.model === modelId
    const reasoningEffort = sameRoute
      ? models.current?.reasoningEffort ?? row.defaultEffort
      : row.defaultEffort
    const selection: ModelSelection = {
      provider,
      model: modelId,
      ...reasoningEffort === undefined ? {} : { reasoningEffort },
    }
    try {
      setError(null)
      await directory.select(selection)
    } catch {
      setError('Model switch failed')
    }
  }

  const selectEffort = async (value: string): Promise<void> => {
    if (directory === undefined || models.current === null) return
    try {
      setError(null)
      await directory.select({ ...models.current, reasoningEffort: value })
    } catch {
      setError('Thinking mode switch failed')
    }
  }

  return (
    <div
      data-mcp-controls
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 5,
        alignItems: 'center',
        padding: '5px 8px',
        borderBottom: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
        background: 'var(--dsw-alias-bg-layer-2, #f6f8fa)',
        fontSize: 11,
        flexShrink: 0,
      }}
    >
      {permission !== undefined && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}>
          <span style={{ color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', whiteSpace: 'nowrap' }}>Perm</span>
          <select
            data-mcp-permission
            aria-label="Permission preset"
            value={permission.currentValue}
            onChange={event => selectPermission(event.target.value)}
            style={selectStyle}
          >
            {permission.options
              .filter(option => option.value !== 'custom')
              .map(option => (
                <option key={option.value} value={option.value}>{permissionLabel(option.value, option.name)}</option>
              ))}
          </select>
        </label>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1.4 }}>
        <span style={{ color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', whiteSpace: 'nowrap' }}>Model</span>
        <select
          data-mcp-model
          aria-label="Model"
          value={models.current === null ? '' : modelKey(models.current.provider, models.current.model)}
          onChange={event => { void selectModel(event.target.value) }}
          disabled={directory === undefined || models.status === 'loading' || models.status === 'selecting'}
          style={selectStyle}
        >
          {models.current === null && <option value="">Loading…</option>}
          {models.groups.map(group => (
            <optgroup key={group.id} label={group.name}>
              {group.models.map(model => (
                <option key={modelKey(group.id, model.id)} value={modelKey(group.id, model.id)}>{model.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {currentModel !== undefined && currentModel.reasoningEfforts.length > 1 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}>
          <span style={{ color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', whiteSpace: 'nowrap' }}>Think</span>
          <select
            data-mcp-thinking
            aria-label="Thinking mode"
            value={currentEffort}
            onChange={event => { void selectEffort(event.target.value) }}
            disabled={directory === undefined || models.status === 'loading' || models.status === 'selecting'}
            style={selectStyle}
          >
            {currentModel.reasoningEfforts.map(effort => <option key={effort} value={effort}>{effort}</option>)}
          </select>
        </label>
      )}
      {error !== null && (
        <span style={{ color: 'var(--dsw-alias-state-error-primary, #d1242f)', flexBasis: '100%' }}>{error}</span>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  maxWidth: 132,
  padding: '1px 3px',
  fontSize: 11,
  border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
  borderRadius: 5,
  background: 'var(--dsw-alias-bg-layer-1, #fff)',
  color: 'var(--dsw-alias-label-primary, #1f2328)',
}
