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
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type {
  AssistantBlock, CommandNode, ConversationNode, ConversationSnapshot, PartialAssistant, SessionFace, ToolResultNode,
} from '@deepseek-ai/dsh-client-runtime/client'
import {
  getComposerHeight, MAX_COMPOSER_HEIGHT, MIN_COMPOSER_HEIGHT, setComposerHeight, subscribePanes,
} from './pane-store.ts'
import { PaneToolbar } from './PaneToolbar.tsx'

/** One host slash command surfaced in the pane input menu. */
export interface PaneCommand {
  readonly name: string
  readonly description: string
  readonly hint?: string
}

interface MiniChatPaneProps {
  readonly sessionId: string
  readonly session: SessionFace | undefined
  readonly directory: ModelDirectory | undefined
  readonly listCommands: (sessionId: string) => Promise<readonly PaneCommand[]>
  readonly openInMain: () => void
}

const COMPOSER_MAX_ROWS = 6
const COMPOSER_LINE_HEIGHT = 18

const IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_IMAGES_PER_MESSAGE = 4

interface PaneAttachment {
  readonly id: string
  readonly file: File
  readonly previewUrl: string
}

let attachmentSeq = 0

function imageMediaType(value: string): string {
  if ((IMAGE_MEDIA_TYPES as readonly string[]).includes(value)) return value
  throw new Error(`unsupported image media type: ${value || '(empty)'}`)
}

function bytesToBase64(data: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < data.length; offset += chunk) {
    binary += String.fromCharCode(...data.subarray(offset, offset + chunk))
  }
  return btoa(binary)
}

const PANE_CSS = `
[data-mcp-chat] pre {
  margin: 4px 0;
  padding: 8px;
  border: 1px solid var(--dsw-alias-border-l2, #d0d7de);
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2, #f6f8fa);
  overflow: auto;
  font-size: 12px;
}
[data-mcp-chat] code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
[data-mcp-chat] p { margin: 4px 0; }
[data-mcp-chat] p:first-child { margin-top: 0; }
[data-mcp-chat] p:last-child { margin-bottom: 0; }
`

function textBlocksText(content: readonly { readonly type: string; readonly text?: string }[]): string {
  return content.map(block => block.type === 'text' && block.text !== undefined ? block.text : '').join('')
}

/** First non-empty line of a collapsed tool/call/result/command row. */
function firstLine(text: string, max: number): string {
  const line = text.split('\n').find(candidate => candidate.trim() !== '') ?? ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

function visibleNodes(nodes: readonly ConversationNode[]): ConversationNode[] {
  return nodes.filter(node => node.kind === 'user'
    || node.kind === 'assistant'
    || node.kind === 'steering'
    || node.kind === 'context'
    || node.kind === 'tool-result'
    || node.kind === 'command'
    || node.kind === 'turn-error'
    || node.kind === 'turn-max-tokens')
}

/** In-progress or final assistant blocks, rendered with the Harness markdown pipeline. */
function AssistantBlocksView({ blocks, streaming = false }: {
  blocks: readonly AssistantBlock[]
  streaming?: boolean
}) {
  return (
    <>
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}`
        switch (block.kind) {
          case 'text':
            return <MarkdownText key={key} text={block.text} streaming={streaming} />
          case 'reasoning':
            return (
              <details
                key={key}
                style={{
                  margin: '6px 0',
                  padding: '6px 8px',
                  borderLeft: '2px solid var(--dsw-alias-border-l3, #a8b0b8)',
                  background: 'var(--dsw-alias-bg-layer-2, #f6f8fa)',
                  borderRadius: 6,
                }}
              >
                <summary style={{ cursor: 'pointer', color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', fontSize: 12 }}>
                  Reasoning
                </summary>
                <div style={{ marginTop: 6 }}><MarkdownText text={block.text} /></div>
              </details>
            )
          case 'tool-call':
            return (
              <details
                key={key}
                data-mcp-tool-call
                style={{
                  margin: '4px 0',
                  padding: '6px 8px',
                  border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
                  borderRadius: 6,
                  background: 'var(--dsw-alias-bg-layer-2, #f6f8fa)',
                  fontSize: 12,
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                  🔧 {block.name}
                  <span style={{ fontWeight: 400, color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', marginLeft: 6 }}>
                    {firstLine(block.argsRaw, 90)}
                  </span>
                </summary>
                <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{block.argsRaw}</pre>
              </details>
            )
          case 'image':
            return <div key={key} style={{ fontSize: 12, color: 'var(--dsw-alias-label-primary-dimmed, #656d76)' }}>🖼 Image attachment</div>
          default:
            return null
        }
      })}
    </>
  )
}

function ToolResultCard({ node }: { node: ToolResultNode }) {
  const name = node.call?.name ?? node.callId
  const text = node.content.map(block => block.type === 'text' && 'text' in block ? block.text : '').join('')
  return (
    <details
      data-mcp-tool-result
      style={{
        margin: '4px 0',
        padding: '6px 8px',
        border: `1px solid ${node.isError ? 'var(--dsw-alias-state-error-primary, #d1242f)' : 'var(--dsw-alias-border-l2, #d0d7de)'}`,
        borderRadius: 6,
        background: 'var(--dsw-alias-bg-layer-2, #f6f8fa)',
        fontSize: 12,
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        ⚙ {name}
        <span style={{ fontWeight: 400, color: node.isError ? 'var(--dsw-alias-state-error-primary, #d1242f)' : 'var(--dsw-alias-label-primary-dimmed, #656d76)', marginLeft: 6 }}>
          {firstLine(text, 90) || (node.isError ? 'Error' : 'Completed')}
        </span>
      </summary>
      <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{text}</pre>
      {node.isError && (
        <div style={{ color: 'var(--dsw-alias-state-error-primary, #d1242f)', marginTop: 4 }}>Error</div>
      )}
    </details>
  )
}

/** One paired slash-command lifecycle from the session log. */
function CommandCard({ node }: { node: CommandNode }) {
  const failed = node.outcome?.kind === 'error'
  const summary = node.outcome?.text ?? node.args ?? (node.outcome === null ? 'Running…' : 'Completed')
  return (
    <details
      data-mcp-command
      style={{
        margin: '4px 0',
        padding: '6px 8px',
        border: `1px solid ${failed ? 'var(--dsw-alias-state-error-primary, #d1242f)' : 'var(--dsw-alias-border-l2, #d0d7de)'}`,
        borderRadius: 6,
        background: 'var(--dsw-alias-bg-layer-2, #f6f8fa)',
        fontSize: 12,
      }}
    >
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        ⌘ /{node.name ?? node.commandId}
        <span style={{ fontWeight: 400, color: failed ? 'var(--dsw-alias-state-error-primary, #d1242f)' : 'var(--dsw-alias-label-primary-dimmed, #656d76)', marginLeft: 6 }}>
          {firstLine(summary, 90)}
        </span>
      </summary>
      {node.args !== null && node.args !== '' && (
        <pre style={{ margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{node.args}</pre>
      )}
      {node.outcome?.text !== undefined && node.outcome.text !== '' && (
        <div style={{ marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{node.outcome.text}</div>
      )}
      {node.outcome === null && (
        <div style={{ marginTop: 6, color: 'var(--dsw-alias-label-primary-dimmed, #656d76)' }}>Running…</div>
      )}
    </details>
  )
}

/** Render one session's conversation with an input box and live controls. */
export function MiniChatPane({ sessionId, session, directory, listCommands, openInMain }: MiniChatPaneProps) {
  const [draft, setDraft] = useState('')
  const [commands, setCommands] = useState<readonly PaneCommand[]>([])
  const [slashIndex, setSlashIndex] = useState(0)
  const [slashDismissed, setSlashDismissed] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const chatRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const atBottomRef = useRef(true)
  const composerDragRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null)
  const [composerLive, setComposerLive] = useState<number | null>(null)
  const manualComposerHeight = useSyncExternalStore(
    subscribePanes,
    () => getComposerHeight(sessionId),
    () => MIN_COMPOSER_HEIGHT,
  )
  const composerHeight = composerLive ?? manualComposerHeight
  const [attachments, setAttachments] = useState<readonly PaneAttachment[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const subscribeSession = useMemo(
    () => session === undefined
      ? () => () => {}
      : (listener: () => void) => session.subscribe(listener),
    [session],
  )
  const snapshot: ConversationSnapshot | null = useSyncExternalStore(
    subscribeSession,
    () => session?.getSnapshot() ?? null,
    () => session?.getSnapshot() ?? null,
  )

  useEffect(() => {
    if (session === undefined) return
    // Runtime-internal bridge: open the history window so live events flow.
    // TODO(upstream): replace with a public per-session staging API.
    const sessionWithOpen = session as unknown as { open(): Promise<void> }
    void sessionWithOpen.open()
  }, [session])

  useEffect(() => {
    let cancelled = false
    void listCommands(sessionId).then((list) => {
      if (!cancelled) setCommands(list)
    })
    return () => { cancelled = true }
  }, [listCommands, sessionId])

  useEffect(() => {
    setSlashIndex(0)
    setSlashDismissed(false)
  }, [draft])

  useLayoutEffect(() => {
    const input = inputRef.current
    if (input === null) return
    input.style.height = 'auto'
    const naturalHeight = Math.min(input.scrollHeight, COMPOSER_LINE_HEIGHT * COMPOSER_MAX_ROWS + 12)
    input.style.height = `${Math.max(naturalHeight, composerHeight)}px`
  }, [composerHeight, draft])

  const slashQuery = draft.startsWith('/') && !draft.includes(' ') ? draft.slice(1) : null
  const slashOpen = slashQuery !== null && !slashDismissed
  const slashCandidates = useMemo(() => {
    if (slashQuery === null) return []
    const query = slashQuery.toLowerCase()
    return commands
      .filter(command => command.name.toLowerCase().includes(query))
      .slice(0, 8)
  }, [commands, slashQuery])
  const slashPick = slashCandidates[slashIndex] ?? slashCandidates[0]

  const addFiles = (files: readonly File[]): void => {
    if (files.length === 0) return
    const unsupported = files.find(file => !(IMAGE_MEDIA_TYPES as readonly string[]).includes(file.type))
    if (unsupported !== undefined) {
      setAttachmentError(`Unsupported file type: ${unsupported.type || 'unknown'}. Only PNG/JPEG/WebP/GIF images are supported.`)
      return
    }
    if (attachments.length + files.length > MAX_IMAGES_PER_MESSAGE) {
      setAttachmentError(`Too many images. Limit is ${MAX_IMAGES_PER_MESSAGE} per message.`)
      return
    }
    if (files.some(file => file.size > MAX_IMAGE_BYTES)) {
      setAttachmentError('One or more images exceed the 10 MB per-image limit.')
      return
    }
    setAttachmentError(null)
    const next = files.map((file) => {
      attachmentSeq += 1
      return {
        id: `pane-attachment-${attachmentSeq}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }
    })
    setAttachments(prev => [...prev, ...next])
  }

  const removeAttachment = (id: string): void => {
    const target = attachments.find(attachment => attachment.id === id)
    if (target !== undefined) URL.revokeObjectURL(target.previewUrl)
    setAttachments(prev => prev.filter(attachment => attachment.id !== id))
  }

  const submit = (event: React.FormEvent): void => {
    event.preventDefault()
    const text = draft.trim()
    if ((text === '' && attachments.length === 0) || session === undefined) return
    if (text.startsWith('/')) {
      void session.command(text)
      setDraft('')
      return
    }
    void (async () => {
      const imageParts = await Promise.all(attachments.map(async (attachment) => {
        const data = bytesToBase64(new Uint8Array(await attachment.file.arrayBuffer()))
        return {
          type: 'image' as const,
          mediaType: imageMediaType(attachment.file.type),
          data,
          ...(attachment.file.name === '' ? {} : { name: attachment.file.name }),
        }
      }))
      const content = [
        ...imageParts,
        ...(text === '' ? [] : [{ type: 'text' as const, text }]),
      ]
      await session.prompt(content, 'queue')
      for (const attachment of attachments) URL.revokeObjectURL(attachment.previewUrl)
      setAttachments([])
      setDraft('')
    })().catch(() => {
      setAttachmentError('Failed to send attachment.')
    })
  }

  const onComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (slashOpen && slashCandidates.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSlashIndex((slashIndex + 1) % slashCandidates.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSlashIndex((slashIndex - 1 + slashCandidates.length) % slashCandidates.length)
        return
      }
      if (event.key === 'Enter' && slashPick !== undefined) {
        event.preventDefault()
        setDraft(`/${slashPick.name} `)
        inputRef.current?.focus()
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setSlashDismissed(true)
        return
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  const updateAtBottom = (): void => {
    const chat = chatRef.current
    if (chat === null) return
    const next = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 24
    atBottomRef.current = next
    setAtBottom(next)
  }

  const scrollToBottom = (smooth: boolean): void => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  useEffect(() => {
    const chat = chatRef.current
    if (chat !== null) {
      scrollToBottom(false)
      updateAtBottom()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (atBottomRef.current) scrollToBottom(false)
  }, [snapshot])

  const startComposerResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    const composer = composerRef.current
    if (composer === null) return
    event.preventDefault()
    event.stopPropagation()
    const rect = composer.getBoundingClientRect()
    composerDragRef.current = { pointerId: event.pointerId, startY: event.clientY, startHeight: rect.height }
    setComposerLive(rect.height)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveComposerResize = (event: React.PointerEvent<HTMLDivElement>): void => {
    const start = composerDragRef.current
    if (start === null || start.pointerId !== event.pointerId) return
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const height = Math.min(
      MAX_COMPOSER_HEIGHT,
      Math.max(MIN_COMPOSER_HEIGHT, start.startHeight - (event.clientY - start.startY)),
    )
    setComposerLive(height)
  }

  const finishComposerResize = (event: React.PointerEvent<HTMLDivElement>, commit: boolean): void => {
    const start = composerDragRef.current
    if (start === null || start.pointerId !== event.pointerId) return
    const height = commit ? composerLive : null
    composerDragRef.current = null
    setComposerLive(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (commit && height !== null && height !== start.startHeight) setComposerHeight(sessionId, height)
  }

  const nodes = snapshot === null ? [] : visibleNodes(snapshot.nodes)
  const partial: PartialAssistant | null = snapshot?.partial ?? null
  const running = snapshot?.running ?? false
  const hasMore = snapshot?.hasMore ?? false
  const queue = snapshot?.queue ?? []
  const pendingCount = snapshot?.pending.length ?? 0

  return (
    <div
      data-mcp-chat
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault()
      }}
      onDrop={(event) => {
        const files = [...(event.dataTransfer?.files ?? [])]
        if (files.length > 0) {
          event.preventDefault()
          event.stopPropagation()
          addFiles(files)
        }
      }}
      onPasteCapture={(event) => {
        // Ctrl/Cmd+V and right-click paste both deliver clipboard files here.
        // The default is left alone so pasted text still reaches the composer.
        const files = [...(event.clipboardData?.files ?? [])]
        if (files.length > 0) addFiles(files)
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        fontFamily: 'var(--dsw-font-family, system-ui, sans-serif)',
        color: 'var(--dsw-alias-label-primary, #1f2328)',
      }}
    >
      <style>{PANE_CSS}</style>
      {session !== undefined && <PaneToolbar session={session} directory={directory} />}
      <div
        ref={chatRef}
        data-mcp-chat-scroll
        onScroll={updateAtBottom}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          overflow: 'auto',
          flex: 1,
          minHeight: 0,
          padding: 10,
          marginRight: 8,
        }}
      >
        {hasMore && (
          <button
            type="button"
            data-mcp-load-older
            onClick={() => { void session?.loadOlder() }}
            style={{
              alignSelf: 'center',
              padding: '4px 10px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
              background: 'var(--dsw-alias-bg-layer-1, #fff)',
              color: 'var(--dsw-alias-label-primary, #1f2328)',
              cursor: 'pointer',
            }}
          >
            Load older
          </button>
        )}
        {snapshot === null ? (
          <div style={{ color: 'var(--dsw-alias-label-primary-dimmed, #656d76)' }}>
            Loading session {sessionId}…
          </div>
        ) : nodes.length === 0 && partial === null && queue.length === 0 ? (
          <div style={{ color: 'var(--dsw-alias-label-primary-dimmed, #656d76)' }}>
            No messages yet.
          </div>
        ) : (
          nodes.map((node) => {
            const isUser = node.kind === 'user' || node.kind === 'steering'
            if (node.kind === 'assistant') {
              return (
                <div
                  key={node.seq}
                  style={{
                    alignSelf: 'stretch',
                    padding: '2px 0',
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  <AssistantBlocksView blocks={node.blocks} />
                </div>
              )
            }
            if (node.kind === 'tool-result') {
              return <ToolResultCard key={node.seq} node={node} />
            }
            if (node.kind === 'command') {
              return <CommandCard key={node.seq} node={node} />
            }
            if (node.kind === 'turn-error' || node.kind === 'turn-max-tokens') {
              return (
                <div key={node.seq} style={{ alignSelf: 'center', color: 'var(--dsw-alias-state-error-primary, #d1242f)', fontSize: 12 }}>
                  {node.kind === 'turn-error' ? node.message : 'Turn stopped by the output-token limit'}
                </div>
              )
            }
            if (node.kind !== 'user' && node.kind !== 'steering' && node.kind !== 'context') {
              return null
            }
            return (
              <div
                key={node.seq}
                style={{
                  alignSelf: isUser ? 'flex-end' : 'flex-start',
                  maxWidth: isUser ? '85%' : '96%',
                  padding: isUser ? '6px 10px' : '2px 0',
                  borderRadius: isUser ? 8 : 0,
                  background: isUser ? 'var(--dsw-alias-button-primary-dimmed, #e8f0fe)' : 'transparent',
                  border: isUser ? '1px solid var(--dsw-alias-border-l2, #d0d7de)' : 'none',
                  color: 'var(--dsw-alias-label-primary, #1f2328)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontSize: 13,
                  lineHeight: 1.6,
                }}
              >
                <MarkdownText text={textBlocksText(node.content)} />
              </div>
            )
          })
        )}
        {partial !== null && partial.blocks.length > 0 && (
          <div
            style={{
              alignSelf: 'stretch',
              padding: '2px 0',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <AssistantBlocksView blocks={partial.blocks} streaming />
          </div>
        )}
        {queue.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {queue.map(item => (
              <div
                key={item.id}
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '85%',
                  padding: '4px 8px',
                  borderRadius: 8,
                  background: 'var(--dsw-alias-bg-mask-drop, rgba(0,0,0,0.04))',
                  border: '1px dashed var(--dsw-alias-border-l3, #d0d7de)',
                  fontSize: 12,
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <span>⏳ {item.preview}</span>
                {item.placement === 'queued' && (
                  <button
                    type="button"
                    aria-label={`Remove queued message ${item.preview}`}
                    onClick={() => { void session?.updateQueue(item.id, { kind: 'remove' } as never) }}
                    style={{ border: 0, background: 'transparent', cursor: 'pointer' }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {pendingCount > 0 && (
          <button
            type="button"
            data-mcp-open-main
            onClick={openInMain}
            style={{
              alignSelf: 'center',
              padding: '6px 10px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid var(--dsw-alias-state-warn-primary, #bf8700)',
              background: 'var(--dsw-alias-bg-layer-1, #fff)',
              color: 'var(--dsw-alias-label-primary, #1f2328)',
              cursor: 'pointer',
            }}
          >
            Approval / plan review — open in main conversation
          </button>
        )}
      </div>
      <div
        ref={composerRef}
        data-mcp-composer
        style={{
          borderTop: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
          padding: 8,
          minHeight: composerHeight,
          boxSizing: 'border-box',
          background: 'var(--dsw-alias-bg-layer-1, #fff)',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <div
          data-mcp-composer-resize
          aria-label="Resize composer"
          title="Drag up or down to resize the composer"
          onPointerDown={startComposerResize}
          onPointerMove={moveComposerResize}
          onPointerUp={event => finishComposerResize(event, true)}
          onPointerCancel={event => finishComposerResize(event, false)}
          style={{
            position: 'absolute',
            top: -4,
            left: 0,
            right: 0,
            height: 8,
            cursor: 'ns-resize',
            touchAction: 'none',
            zIndex: 4,
          }}
        />
        {!atBottom && (
          <button
            type="button"
            data-mcp-scroll-bottom
            aria-label="Scroll to latest message"
            title="Scroll to latest message"
            onClick={() => scrollToBottom(true)}
            style={{
              position: 'absolute',
              right: 12,
              top: -34,
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
              background: 'var(--dsw-alias-bg-layer-1, #fff)',
              color: 'var(--dsw-alias-label-primary, #1f2328)',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
              zIndex: 4,
            }}
          >
            ↓
          </button>
        )}
        {slashOpen && slashCandidates.length > 0 && (
          <div
            data-mcp-slash-menu
            role="listbox"
            aria-label="Slash commands"
            style={{
              position: 'absolute',
              left: 8,
              right: 8,
              bottom: '100%',
              marginBottom: 4,
              border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
              borderRadius: 8,
              background: 'var(--dsw-alias-bg-layer-1, #fff)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
              overflow: 'hidden',
              zIndex: 5,
            }}
          >
            {slashCandidates.map((command, index) => (
              <button
                key={command.name}
                type="button"
                role="option"
                aria-selected={index === slashIndex}
                onMouseDown={(event) => {
                  event.preventDefault()
                  setDraft(`/${command.name} `)
                  inputRef.current?.focus()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 8,
                  width: '100%',
                  padding: '6px 10px',
                  border: 0,
                  borderBottom: '1px solid var(--dsw-alias-border-l1, rgba(0,0,0,0.04))',
                  background: index === slashIndex ? 'var(--dsw-alias-bg-layer-2, #f6f8fa)' : 'transparent',
                  color: 'var(--dsw-alias-label-primary, #1f2328)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 12,
                }}
              >
                <span style={{ fontWeight: 600, flexShrink: 0 }}>/{command.name}</span>
                <span style={{ color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {command.hint ?? command.description}
                </span>
              </button>
            ))}
          </div>
        )}
        {attachments.length > 0 && (
          <div
            data-mcp-attachment-rail
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              marginBottom: 6,
              paddingBottom: 2,
            }}
          >
            {attachments.map((attachment) => (
              <div key={attachment.id} style={{ position: 'relative', flexShrink: 0 }}>
                <img
                  src={attachment.previewUrl}
                  alt={attachment.file.name}
                  style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2, #d0d7de)' }}
                />
                <button
                  type="button"
                  aria-label={`Remove attachment ${attachment.file.name}`}
                  onClick={() => removeAttachment(attachment.id)}
                  style={{
                    position: 'absolute',
                    top: -4,
                    right: -4,
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
                    background: 'var(--dsw-alias-bg-layer-1, #fff)',
                    color: 'var(--dsw-alias-label-primary, #1f2328)',
                    cursor: 'pointer',
                    fontSize: 12,
                    lineHeight: 1,
                    padding: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {attachmentError !== null && (
          <div style={{ marginBottom: 6, color: 'var(--dsw-alias-state-error-primary, #d1242f)', fontSize: 11 }}>
            {attachmentError}
          </div>
        )}
        {running && (
          <div data-mcp-running style={{ marginBottom: 6, color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', fontSize: 11 }}>
            ● Running — live output below
          </div>
        )}
        <form onSubmit={submit} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
          <button
            type="button"
            data-mcp-attach
            aria-label="Attach image"
            title="Attach image"
            onClick={() => fileInputRef.current?.click()}
            style={{
              flexShrink: 0,
              padding: '6px 8px',
              borderRadius: 8,
              border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
              background: 'var(--dsw-alias-bg-layer-1, #fff)',
              color: 'var(--dsw-alias-label-primary, #1f2328)',
              cursor: 'pointer',
              fontSize: 14,
              lineHeight: 1,
            }}
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            multiple
            style={{ display: 'none' }}
            onChange={(event) => {
              addFiles([...(event.target.files ?? [])])
              event.target.value = ''
            }}
          />
          <textarea
            ref={inputRef}
            aria-label={`Message ${sessionId}`}
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={onComposerKeyDown}
            rows={2}
            placeholder="Message or /command…"
            style={{
              flex: 1,
              resize: 'none',
              fontSize: 13,
              lineHeight: `${COMPOSER_LINE_HEIGHT}px`,
              padding: '6px 8px',
              borderRadius: 8,
              border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
              background: 'var(--dsw-alias-bg-layer-1, #fff)',
              color: 'var(--dsw-alias-label-primary, #1f2328)',
              minWidth: 0,
              overflowY: 'auto',
            }}
          />
          {running ? (
            <button
              type="button"
              data-mcp-cancel
              aria-label="Cancel running turn"
              onClick={() => { void session?.cancel() }}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid var(--dsw-alias-state-error-primary, #d1242f)',
                background: 'var(--dsw-alias-bg-layer-1, #fff)',
                color: 'var(--dsw-alias-state-error-primary, #d1242f)',
                cursor: 'pointer',
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              data-mcp-send
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--dsw-alias-button-primary-fill, #1f2328)',
                background: 'var(--dsw-alias-button-primary-fill, #1f2328)',
                color: 'var(--dsw-alias-button-primary-foreground, #fff)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                flexShrink: 0,
              }}
            >
              Send
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
