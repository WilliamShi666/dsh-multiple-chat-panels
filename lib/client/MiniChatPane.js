import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives';
import { getComposerHeight, MAX_COMPOSER_HEIGHT, MIN_COMPOSER_HEIGHT, setComposerHeight, subscribePanes, } from "./pane-store.js";
import { PaneToolbar } from "./PaneToolbar.js";
const COMPOSER_MAX_ROWS = 6;
const COMPOSER_LINE_HEIGHT = 18;
const IMAGE_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGES_PER_MESSAGE = 4;
let attachmentSeq = 0;
function imageMediaType(value) {
    if (IMAGE_MEDIA_TYPES.includes(value))
        return value;
    throw new Error(`unsupported image media type: ${value || '(empty)'}`);
}
function bytesToBase64(data) {
    let binary = '';
    const chunk = 0x8000;
    for (let offset = 0; offset < data.length; offset += chunk) {
        binary += String.fromCharCode(...data.subarray(offset, offset + chunk));
    }
    return btoa(binary);
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
`;
function textBlocksText(content) {
    return content.map(block => block.type === 'text' && block.text !== undefined ? block.text : '').join('');
}
/** First non-empty line of a collapsed tool/call/result/command row. */
function firstLine(text, max) {
    const line = text.split('\n').find(candidate => candidate.trim() !== '') ?? '';
    return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
function visibleNodes(nodes) {
    return nodes.filter(node => node.kind === 'user'
        || node.kind === 'assistant'
        || node.kind === 'steering'
        || node.kind === 'context'
        || node.kind === 'tool-result'
        || node.kind === 'command'
        || node.kind === 'turn-error'
        || node.kind === 'turn-max-tokens');
}
/** In-progress or final assistant blocks, rendered with the Harness markdown pipeline. */
function AssistantBlocksView({ blocks, streaming = false }) {
    return (_jsx(_Fragment, { children: blocks.map((block, index) => {
            const key = `${block.kind}-${index}`;
            switch (block.kind) {
                case 'text':
                    return _jsx(MarkdownText, { text: block.text, streaming: streaming }, key);
                case 'reasoning':
                    return (_jsxs("details", { style: {
                            margin: '6px 0',
                            padding: '6px 8px',
                            borderLeft: '2px solid var(--dsw-alias-border-l3, #a8b0b8)',
                            background: 'var(--dsw-alias-bg-layer-2, #f6f8fa)',
                            borderRadius: 6,
                        }, children: [_jsx("summary", { style: { cursor: 'pointer', color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', fontSize: 12 }, children: "Reasoning" }), _jsx("div", { style: { marginTop: 6 }, children: _jsx(MarkdownText, { text: block.text }) })] }, key));
                case 'tool-call':
                    return (_jsxs("details", { "data-mcp-tool-call": true, style: {
                            margin: '4px 0',
                            padding: '6px 8px',
                            border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
                            borderRadius: 6,
                            background: 'var(--dsw-alias-bg-layer-2, #f6f8fa)',
                            fontSize: 12,
                        }, children: [_jsxs("summary", { style: { cursor: 'pointer', fontWeight: 600 }, children: ["\uD83D\uDD27 ", block.name, _jsx("span", { style: { fontWeight: 400, color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', marginLeft: 6 }, children: firstLine(block.argsRaw, 90) })] }), _jsx("pre", { style: { margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }, children: block.argsRaw })] }, key));
                case 'image':
                    return _jsx("div", { style: { fontSize: 12, color: 'var(--dsw-alias-label-primary-dimmed, #656d76)' }, children: "\uD83D\uDDBC Image attachment" }, key);
                default:
                    return null;
            }
        }) }));
}
function ToolResultCard({ node }) {
    const name = node.call?.name ?? node.callId;
    const text = node.content.map(block => block.type === 'text' && 'text' in block ? block.text : '').join('');
    return (_jsxs("details", { "data-mcp-tool-result": true, style: {
            margin: '4px 0',
            padding: '6px 8px',
            border: `1px solid ${node.isError ? 'var(--dsw-alias-state-error-primary, #d1242f)' : 'var(--dsw-alias-border-l2, #d0d7de)'}`,
            borderRadius: 6,
            background: 'var(--dsw-alias-bg-layer-2, #f6f8fa)',
            fontSize: 12,
        }, children: [_jsxs("summary", { style: { cursor: 'pointer', fontWeight: 600 }, children: ["\u2699 ", name, _jsx("span", { style: { fontWeight: 400, color: node.isError ? 'var(--dsw-alias-state-error-primary, #d1242f)' : 'var(--dsw-alias-label-primary-dimmed, #656d76)', marginLeft: 6 }, children: firstLine(text, 90) || (node.isError ? 'Error' : 'Completed') })] }), _jsx("pre", { style: { margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }, children: text }), node.isError && (_jsx("div", { style: { color: 'var(--dsw-alias-state-error-primary, #d1242f)', marginTop: 4 }, children: "Error" }))] }));
}
/** One paired slash-command lifecycle from the session log. */
function CommandCard({ node }) {
    const failed = node.outcome?.kind === 'error';
    const summary = node.outcome?.text ?? node.args ?? (node.outcome === null ? 'Running…' : 'Completed');
    return (_jsxs("details", { "data-mcp-command": true, style: {
            margin: '4px 0',
            padding: '6px 8px',
            border: `1px solid ${failed ? 'var(--dsw-alias-state-error-primary, #d1242f)' : 'var(--dsw-alias-border-l2, #d0d7de)'}`,
            borderRadius: 6,
            background: 'var(--dsw-alias-bg-layer-2, #f6f8fa)',
            fontSize: 12,
        }, children: [_jsxs("summary", { style: { cursor: 'pointer', fontWeight: 600 }, children: ["\u2318 /", node.name ?? node.commandId, _jsx("span", { style: { fontWeight: 400, color: failed ? 'var(--dsw-alias-state-error-primary, #d1242f)' : 'var(--dsw-alias-label-primary-dimmed, #656d76)', marginLeft: 6 }, children: firstLine(summary, 90) })] }), node.args !== null && node.args !== '' && (_jsx("pre", { style: { margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }, children: node.args })), node.outcome?.text !== undefined && node.outcome.text !== '' && (_jsx("div", { style: { marginTop: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }, children: node.outcome.text })), node.outcome === null && (_jsx("div", { style: { marginTop: 6, color: 'var(--dsw-alias-label-primary-dimmed, #656d76)' }, children: "Running\u2026" }))] }));
}
/** Render one session's conversation with an input box and live controls. */
export function MiniChatPane({ sessionId, session, directory, listCommands, openInMain }) {
    const [draft, setDraft] = useState('');
    const [commands, setCommands] = useState([]);
    const [slashIndex, setSlashIndex] = useState(0);
    const [slashDismissed, setSlashDismissed] = useState(false);
    const inputRef = useRef(null);
    const chatRef = useRef(null);
    const composerRef = useRef(null);
    const [atBottom, setAtBottom] = useState(true);
    const atBottomRef = useRef(true);
    const composerDragRef = useRef(null);
    const [composerLive, setComposerLive] = useState(null);
    const manualComposerHeight = useSyncExternalStore(subscribePanes, () => getComposerHeight(sessionId), () => MIN_COMPOSER_HEIGHT);
    const composerHeight = composerLive ?? manualComposerHeight;
    const [attachments, setAttachments] = useState([]);
    const [attachmentError, setAttachmentError] = useState(null);
    const fileInputRef = useRef(null);
    const snapshot = useSyncExternalStore(session?.subscribe ?? (() => () => { }), () => session?.getSnapshot() ?? null, () => session?.getSnapshot() ?? null);
    useEffect(() => {
        if (session === undefined)
            return;
        // Runtime-internal bridge: open the history window so live events flow.
        // TODO(upstream): replace with a public per-session staging API.
        const sessionWithOpen = session;
        void sessionWithOpen.open();
    }, [session]);
    useEffect(() => {
        let cancelled = false;
        void listCommands(sessionId).then((list) => {
            if (!cancelled)
                setCommands(list);
        });
        return () => { cancelled = true; };
    }, [listCommands, sessionId]);
    useEffect(() => {
        setSlashIndex(0);
        setSlashDismissed(false);
    }, [draft]);
    useLayoutEffect(() => {
        const input = inputRef.current;
        if (input === null)
            return;
        input.style.height = 'auto';
        const naturalHeight = Math.min(input.scrollHeight, COMPOSER_LINE_HEIGHT * COMPOSER_MAX_ROWS + 12);
        input.style.height = `${Math.max(naturalHeight, composerHeight)}px`;
    }, [composerHeight, draft]);
    const slashQuery = draft.startsWith('/') && !draft.includes(' ') ? draft.slice(1) : null;
    const slashOpen = slashQuery !== null && !slashDismissed;
    const slashCandidates = useMemo(() => {
        if (slashQuery === null)
            return [];
        const query = slashQuery.toLowerCase();
        return commands
            .filter(command => command.name.toLowerCase().includes(query))
            .slice(0, 8);
    }, [commands, slashQuery]);
    const slashPick = slashCandidates[slashIndex] ?? slashCandidates[0];
    const addFiles = (files) => {
        if (files.length === 0)
            return;
        const unsupported = files.find(file => !IMAGE_MEDIA_TYPES.includes(file.type));
        if (unsupported !== undefined) {
            setAttachmentError(`Unsupported file type: ${unsupported.type || 'unknown'}. Only PNG/JPEG/WebP/GIF images are supported.`);
            return;
        }
        if (attachments.length + files.length > MAX_IMAGES_PER_MESSAGE) {
            setAttachmentError(`Too many images. Limit is ${MAX_IMAGES_PER_MESSAGE} per message.`);
            return;
        }
        if (files.some(file => file.size > MAX_IMAGE_BYTES)) {
            setAttachmentError('One or more images exceed the 10 MB per-image limit.');
            return;
        }
        setAttachmentError(null);
        const next = files.map((file) => {
            attachmentSeq += 1;
            return {
                id: `pane-attachment-${attachmentSeq}`,
                file,
                previewUrl: URL.createObjectURL(file),
            };
        });
        setAttachments(prev => [...prev, ...next]);
    };
    const removeAttachment = (id) => {
        const target = attachments.find(attachment => attachment.id === id);
        if (target !== undefined)
            URL.revokeObjectURL(target.previewUrl);
        setAttachments(prev => prev.filter(attachment => attachment.id !== id));
    };
    const submit = (event) => {
        event.preventDefault();
        const text = draft.trim();
        if ((text === '' && attachments.length === 0) || session === undefined)
            return;
        if (text.startsWith('/')) {
            void session.command(text);
            setDraft('');
            return;
        }
        void (async () => {
            const imageParts = await Promise.all(attachments.map(async (attachment) => {
                const data = bytesToBase64(new Uint8Array(await attachment.file.arrayBuffer()));
                return {
                    type: 'image',
                    mediaType: imageMediaType(attachment.file.type),
                    data,
                    ...(attachment.file.name === '' ? {} : { name: attachment.file.name }),
                };
            }));
            const content = [
                ...imageParts,
                ...(text === '' ? [] : [{ type: 'text', text }]),
            ];
            await session.prompt(content, 'queue');
            for (const attachment of attachments)
                URL.revokeObjectURL(attachment.previewUrl);
            setAttachments([]);
            setDraft('');
        })().catch(() => {
            setAttachmentError('Failed to send attachment.');
        });
    };
    const onComposerKeyDown = (event) => {
        if (slashOpen && slashCandidates.length > 0) {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setSlashIndex((slashIndex + 1) % slashCandidates.length);
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setSlashIndex((slashIndex - 1 + slashCandidates.length) % slashCandidates.length);
                return;
            }
            if (event.key === 'Enter' && slashPick !== undefined) {
                event.preventDefault();
                setDraft(`/${slashPick.name} `);
                inputRef.current?.focus();
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                setSlashDismissed(true);
                return;
            }
        }
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
        }
    };
    const updateAtBottom = () => {
        const chat = chatRef.current;
        if (chat === null)
            return;
        const next = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 24;
        atBottomRef.current = next;
        setAtBottom(next);
    };
    const scrollToBottom = (smooth) => {
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    };
    useEffect(() => {
        const chat = chatRef.current;
        if (chat !== null) {
            scrollToBottom(false);
            updateAtBottom();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useEffect(() => {
        if (atBottomRef.current)
            scrollToBottom(false);
    }, [snapshot]);
    const startComposerResize = (event) => {
        const composer = composerRef.current;
        if (composer === null)
            return;
        event.preventDefault();
        event.stopPropagation();
        const rect = composer.getBoundingClientRect();
        composerDragRef.current = { pointerId: event.pointerId, startY: event.clientY, startHeight: rect.height };
        setComposerLive(rect.height);
        event.currentTarget.setPointerCapture(event.pointerId);
    };
    const moveComposerResize = (event) => {
        const start = composerDragRef.current;
        if (start === null || start.pointerId !== event.pointerId)
            return;
        if (!event.currentTarget.hasPointerCapture(event.pointerId))
            return;
        const height = Math.min(MAX_COMPOSER_HEIGHT, Math.max(MIN_COMPOSER_HEIGHT, start.startHeight - (event.clientY - start.startY)));
        setComposerLive(height);
    };
    const finishComposerResize = (event, commit) => {
        const start = composerDragRef.current;
        if (start === null || start.pointerId !== event.pointerId)
            return;
        const height = commit ? composerLive : null;
        composerDragRef.current = null;
        setComposerLive(null);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (commit && height !== null && height !== start.startHeight)
            setComposerHeight(sessionId, height);
    };
    const nodes = snapshot === null ? [] : visibleNodes(snapshot.nodes);
    const partial = snapshot?.partial ?? null;
    const running = snapshot?.running ?? false;
    const hasMore = snapshot?.hasMore ?? false;
    const queue = snapshot?.queue ?? [];
    const pendingCount = snapshot?.pending.length ?? 0;
    return (_jsxs("div", { "data-mcp-chat": true, onDragOver: (event) => {
            if (event.dataTransfer.types.includes('Files'))
                event.preventDefault();
        }, onDrop: (event) => {
            const files = [...(event.dataTransfer?.files ?? [])];
            if (files.length > 0) {
                event.preventDefault();
                event.stopPropagation();
                addFiles(files);
            }
        }, onPasteCapture: (event) => {
            // Ctrl/Cmd+V and right-click paste both deliver clipboard files here.
            // The default is left alone so pasted text still reaches the composer.
            const files = [...(event.clipboardData?.files ?? [])];
            if (files.length > 0)
                addFiles(files);
        }, style: {
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            minHeight: 0,
            fontFamily: 'var(--dsw-font-family, system-ui, sans-serif)',
            color: 'var(--dsw-alias-label-primary, #1f2328)',
        }, children: [_jsx("style", { children: PANE_CSS }), session !== undefined && _jsx(PaneToolbar, { session: session, directory: directory }), _jsxs("div", { ref: chatRef, "data-mcp-chat-scroll": true, onScroll: updateAtBottom, style: {
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    overflow: 'auto',
                    flex: 1,
                    minHeight: 0,
                    padding: 10,
                    marginRight: 8,
                }, children: [hasMore && (_jsx("button", { type: "button", "data-mcp-load-older": true, onClick: () => { void session?.loadOlder(); }, style: {
                            alignSelf: 'center',
                            padding: '4px 10px',
                            fontSize: 12,
                            borderRadius: 6,
                            border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
                            background: 'var(--dsw-alias-bg-layer-1, #fff)',
                            color: 'var(--dsw-alias-label-primary, #1f2328)',
                            cursor: 'pointer',
                        }, children: "Load older" })), snapshot === null ? (_jsxs("div", { style: { color: 'var(--dsw-alias-label-primary-dimmed, #656d76)' }, children: ["Loading session ", sessionId, "\u2026"] })) : nodes.length === 0 && partial === null && queue.length === 0 ? (_jsx("div", { style: { color: 'var(--dsw-alias-label-primary-dimmed, #656d76)' }, children: "No messages yet." })) : (nodes.map((node) => {
                        const isUser = node.kind === 'user' || node.kind === 'steering';
                        if (node.kind === 'assistant') {
                            return (_jsx("div", { style: {
                                    alignSelf: 'stretch',
                                    padding: '2px 0',
                                    fontSize: 13,
                                    lineHeight: 1.6,
                                }, children: _jsx(AssistantBlocksView, { blocks: node.blocks }) }, node.seq));
                        }
                        if (node.kind === 'tool-result') {
                            return _jsx(ToolResultCard, { node: node }, node.seq);
                        }
                        if (node.kind === 'command') {
                            return _jsx(CommandCard, { node: node }, node.seq);
                        }
                        if (node.kind === 'turn-error' || node.kind === 'turn-max-tokens') {
                            return (_jsx("div", { style: { alignSelf: 'center', color: 'var(--dsw-alias-state-error-primary, #d1242f)', fontSize: 12 }, children: node.kind === 'turn-error' ? node.message : 'Turn stopped by the output-token limit' }, node.seq));
                        }
                        if (node.kind !== 'user' && node.kind !== 'steering' && node.kind !== 'context') {
                            return null;
                        }
                        return (_jsx("div", { style: {
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
                            }, children: _jsx(MarkdownText, { text: textBlocksText(node.content) }) }, node.seq));
                    })), partial !== null && partial.blocks.length > 0 && (_jsx("div", { style: {
                            alignSelf: 'stretch',
                            padding: '2px 0',
                            fontSize: 13,
                            lineHeight: 1.6,
                        }, children: _jsx(AssistantBlocksView, { blocks: partial.blocks, streaming: true }) })), queue.length > 0 && (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: queue.map(item => (_jsxs("div", { style: {
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
                            }, children: [_jsxs("span", { children: ["\u23F3 ", item.preview] }), item.placement === 'queued' && (_jsx("button", { type: "button", "aria-label": `Remove queued message ${item.preview}`, onClick: () => { void session?.updateQueue(item.id, { kind: 'remove' }); }, style: { border: 0, background: 'transparent', cursor: 'pointer' }, children: "\u00D7" }))] }, item.id))) })), pendingCount > 0 && (_jsx("button", { type: "button", "data-mcp-open-main": true, onClick: openInMain, style: {
                            alignSelf: 'center',
                            padding: '6px 10px',
                            fontSize: 12,
                            borderRadius: 6,
                            border: '1px solid var(--dsw-alias-state-warn-primary, #bf8700)',
                            background: 'var(--dsw-alias-bg-layer-1, #fff)',
                            color: 'var(--dsw-alias-label-primary, #1f2328)',
                            cursor: 'pointer',
                        }, children: "Approval / plan review \u2014 open in main conversation" }))] }), _jsxs("div", { ref: composerRef, "data-mcp-composer": true, style: {
                    borderTop: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
                    padding: 8,
                    minHeight: composerHeight,
                    boxSizing: 'border-box',
                    background: 'var(--dsw-alias-bg-layer-1, #fff)',
                    flexShrink: 0,
                    position: 'relative',
                }, children: [_jsx("div", { "data-mcp-composer-resize": true, "aria-label": "Resize composer", title: "Drag up or down to resize the composer", onPointerDown: startComposerResize, onPointerMove: moveComposerResize, onPointerUp: event => finishComposerResize(event, true), onPointerCancel: event => finishComposerResize(event, false), style: {
                            position: 'absolute',
                            top: -4,
                            left: 0,
                            right: 0,
                            height: 8,
                            cursor: 'ns-resize',
                            touchAction: 'none',
                            zIndex: 4,
                        } }), !atBottom && (_jsx("button", { type: "button", "data-mcp-scroll-bottom": true, "aria-label": "Scroll to latest message", title: "Scroll to latest message", onClick: () => scrollToBottom(true), style: {
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
                        }, children: "\u2193" })), slashOpen && slashCandidates.length > 0 && (_jsx("div", { "data-mcp-slash-menu": true, role: "listbox", "aria-label": "Slash commands", style: {
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
                        }, children: slashCandidates.map((command, index) => (_jsxs("button", { type: "button", role: "option", "aria-selected": index === slashIndex, onMouseDown: (event) => {
                                event.preventDefault();
                                setDraft(`/${command.name} `);
                                inputRef.current?.focus();
                            }, style: {
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
                            }, children: [_jsxs("span", { style: { fontWeight: 600, flexShrink: 0 }, children: ["/", command.name] }), _jsx("span", { style: { color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, children: command.hint ?? command.description })] }, command.name))) })), attachments.length > 0 && (_jsx("div", { "data-mcp-attachment-rail": true, style: {
                            display: 'flex',
                            gap: 6,
                            overflowX: 'auto',
                            marginBottom: 6,
                            paddingBottom: 2,
                        }, children: attachments.map((attachment) => (_jsxs("div", { style: { position: 'relative', flexShrink: 0 }, children: [_jsx("img", { src: attachment.previewUrl, alt: attachment.file.name, style: { width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2, #d0d7de)' } }), _jsx("button", { type: "button", "aria-label": `Remove attachment ${attachment.file.name}`, onClick: () => removeAttachment(attachment.id), style: {
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
                                    }, children: "\u00D7" })] }, attachment.id))) })), attachmentError !== null && (_jsx("div", { style: { marginBottom: 6, color: 'var(--dsw-alias-state-error-primary, #d1242f)', fontSize: 11 }, children: attachmentError })), running && (_jsx("div", { "data-mcp-running": true, style: { marginBottom: 6, color: 'var(--dsw-alias-label-primary-dimmed, #656d76)', fontSize: 11 }, children: "\u25CF Running \u2014 live output below" })), _jsxs("form", { onSubmit: submit, style: { display: 'flex', gap: 6, alignItems: 'flex-end' }, children: [_jsx("button", { type: "button", "data-mcp-attach": true, "aria-label": "Attach image", title: "Attach image", onClick: () => fileInputRef.current?.click(), style: {
                                    flexShrink: 0,
                                    padding: '6px 8px',
                                    borderRadius: 8,
                                    border: '1px solid var(--dsw-alias-border-l2, #d0d7de)',
                                    background: 'var(--dsw-alias-bg-layer-1, #fff)',
                                    color: 'var(--dsw-alias-label-primary, #1f2328)',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    lineHeight: 1,
                                }, children: "\uD83D\uDCCE" }), _jsx("input", { ref: fileInputRef, type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", multiple: true, style: { display: 'none' }, onChange: (event) => {
                                    addFiles([...(event.target.files ?? [])]);
                                    event.target.value = '';
                                } }), _jsx("textarea", { ref: inputRef, "aria-label": `Message ${sessionId}`, value: draft, onChange: event => setDraft(event.target.value), onKeyDown: onComposerKeyDown, rows: 2, placeholder: "Message or /command\u2026", style: {
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
                                } }), running ? (_jsx("button", { type: "button", "data-mcp-cancel": true, "aria-label": "Cancel running turn", onClick: () => { void session?.cancel(); }, style: {
                                    padding: '6px 10px',
                                    borderRadius: 8,
                                    border: '1px solid var(--dsw-alias-state-error-primary, #d1242f)',
                                    background: 'var(--dsw-alias-bg-layer-1, #fff)',
                                    color: 'var(--dsw-alias-state-error-primary, #d1242f)',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    flexShrink: 0,
                                }, children: "Stop" })) : (_jsx("button", { type: "submit", "data-mcp-send": true, style: {
                                    padding: '6px 12px',
                                    borderRadius: 8,
                                    border: '1px solid var(--dsw-alias-button-primary-fill, #1f2328)',
                                    background: 'var(--dsw-alias-button-primary-fill, #1f2328)',
                                    color: 'var(--dsw-alias-button-primary-foreground, #fff)',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: 13,
                                    flexShrink: 0,
                                }, children: "Send" }))] })] })] }));
}
//# sourceMappingURL=MiniChatPane.js.map