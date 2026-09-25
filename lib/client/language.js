/**
 * Shared UI-language reading for the client half.
 *
 * The shell publishes the active language on `<html lang>`; plugins observe it
 * rather than owning a locale preference. Both the page and the pane need it:
 * the page for its own copy, the pane because the shell's `MarkdownText`
 * requires a labels object for its code-block controls.
 */
import { useSyncExternalStore } from 'react';
/** Current document language tag, defaulting to English outside a browser. */
export function getDocumentLanguage() {
    return typeof document === 'undefined' ? 'en' : document.documentElement.lang || 'en';
}
/** Observe `<html lang>` changes. @returns disposer. */
export function subscribeDocumentLanguage(listener) {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined')
        return () => { };
    const observer = new MutationObserver(listener);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => { observer.disconnect(); };
}
/** Whether a language tag selects a Chinese variant. */
export function isChineseLanguage(language) {
    return language.toLowerCase().split('-')[0] === 'zh';
}
const MARKDOWN_LABELS_EN = {
    code: { copyLabel: 'Copy', copiedLabel: 'Copied' },
    footnotes: 'Footnotes',
};
const MARKDOWN_LABELS_ZH = {
    code: { copyLabel: '复制', copiedLabel: '已复制' },
    footnotes: '脚注',
};
/** Labels for one language tag (stable reference per language). */
export function markdownLabelsFor(language) {
    return isChineseLanguage(language) ? MARKDOWN_LABELS_ZH : MARKDOWN_LABELS_EN;
}
/** Reactive labels following the active document language. */
export function useMarkdownLabels() {
    const language = useSyncExternalStore(subscribeDocumentLanguage, getDocumentLanguage, () => 'en');
    return markdownLabelsFor(language);
}
//# sourceMappingURL=language.js.map