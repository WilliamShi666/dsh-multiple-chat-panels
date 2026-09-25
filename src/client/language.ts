/**
 * Shared UI-language reading for the client half.
 *
 * The shell publishes the active language on `<html lang>`; plugins observe it
 * rather than owning a locale preference. Both the page and the pane need it:
 * the page for its own copy, the pane because the shell's `MarkdownText`
 * requires a labels object for its code-block controls.
 */
import { useSyncExternalStore } from 'react'

/** Current document language tag, defaulting to English outside a browser. */
export function getDocumentLanguage(): string {
  return typeof document === 'undefined' ? 'en' : document.documentElement.lang || 'en'
}

/** Observe `<html lang>` changes. @returns disposer. */
export function subscribeDocumentLanguage(listener: () => void): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}
  const observer = new MutationObserver(listener)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  return () => { observer.disconnect() }
}

/** Whether a language tag selects a Chinese variant. */
export function isChineseLanguage(language: string): boolean {
  return language.toLowerCase().split('-')[0] === 'zh'
}

/**
 * Copy the shell's `MarkdownText` requires.
 *
 * DSH 0.1.5 dereferences `labels.code.copyLabel` unconditionally while
 * rendering a fenced code block, so a caller that omits `labels` crashes the
 * whole outlet on the first code block. Supplying the strings keeps panes
 * independent of the shell's internal locale seat.
 */
export interface MarkdownLabels {
  readonly code: {
    readonly copyLabel: string
    readonly copiedLabel: string
  }
  readonly footnotes: string
}

const MARKDOWN_LABELS_EN: MarkdownLabels = {
  code: { copyLabel: 'Copy', copiedLabel: 'Copied' },
  footnotes: 'Footnotes',
}

const MARKDOWN_LABELS_ZH: MarkdownLabels = {
  code: { copyLabel: '复制', copiedLabel: '已复制' },
  footnotes: '脚注',
}

/** Labels for one language tag (stable reference per language). */
export function markdownLabelsFor(language: string): MarkdownLabels {
  return isChineseLanguage(language) ? MARKDOWN_LABELS_ZH : MARKDOWN_LABELS_EN
}

/** Reactive labels following the active document language. */
export function useMarkdownLabels(): MarkdownLabels {
  const language = useSyncExternalStore(subscribeDocumentLanguage, getDocumentLanguage, () => 'en')
  return markdownLabelsFor(language)
}
