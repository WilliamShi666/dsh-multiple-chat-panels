/** Current document language tag, defaulting to English outside a browser. */
export declare function getDocumentLanguage(): string;
/** Observe `<html lang>` changes. @returns disposer. */
export declare function subscribeDocumentLanguage(listener: () => void): () => void;
/** Whether a language tag selects a Chinese variant. */
export declare function isChineseLanguage(language: string): boolean;
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
        readonly copyLabel: string;
        readonly copiedLabel: string;
    };
    readonly footnotes: string;
}
/** Labels for one language tag (stable reference per language). */
export declare function markdownLabelsFor(language: string): MarkdownLabels;
/** Reactive labels following the active document language. */
export declare function useMarkdownLabels(): MarkdownLabels;
