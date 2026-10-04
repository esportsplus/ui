import { EditorDocument, floorIndex, lineEnd } from './document';
import type { MarkdownBlock } from './markdown-model';
import type { FoldRange } from './folding';

/** Fold boundaries follow logical Markdown blocks, never viewport slices. */
export function markdownFolds(doc: EditorDocument, blocks: readonly MarkdownBlock[]): FoldRange[] {
    let ranges: FoldRange[] = [], headings: MarkdownBlock[] = [];
    function section(header: MarkdownBlock, to: number) {
        if (to > header.to) ranges.push({ from: header.to, to, open: header.from, line: doc.position(header.from).line, endLine: doc.position(to).line });
    }
    for (let [index, block] of blocks.entries()) {
        if (block.kind === 'heading') {
            while (headings.length && headings.at(-1)!.level! >= block.level!) section(headings.pop()!, block.from);
            headings.push(block);
        } else if (['fence', 'code', 'quote', 'list', 'html', 'frontmatter'].includes(block.kind)) {
            let first = floorIndex(doc.starts, block.from), from = doc.starts[first + 1], to = block.to;
            if (block.kind === 'list' || block.kind === 'quote') {
                for (let child = index + 1; child < blocks.length; child++) {
                    let next = blocks[child]!;
                    if (next.kind === 'blank') continue;
                    let deeper = block.kind === 'list' ? (next.indent ?? 0) > (block.indent ?? 0) && (next.quoteDepth ?? 0) >= (block.quoteDepth ?? 0) : (next.quoteDepth ?? 0) > (block.quoteDepth ?? 0);
                    if (!deeper) break; to = next.to;
                }
            }
            if (from !== undefined && from < to) ranges.push({ from, to, open: block.from, line: first + 1, endLine: doc.position(to).line });
        }
    }
    for (let header of headings) section(header, doc.value.length);
    return ranges.sort((a, b) => a.line - b.line || b.to - a.to);
}

export function foldedMarkdown(doc: EditorDocument, blocks: readonly MarkdownBlock[], folds: readonly FoldRange[]): MarkdownBlock[] {
    return blocks.flatMap(block => {
        if (folds.some(fold => block.from >= fold.from && block.from < fold.to)) return [];
        let fold = folds.find(fold => fold.open === block.from);
        if (!fold || fold.from >= block.to) return [block];
        let end = lineEnd(doc.value, doc.starts, floorIndex(doc.starts, block.from));
        return [{ ...block, kind: 'paragraph' as const, contentFrom: block.from, contentTo: end, lines: undefined, task: undefined, to: fold.from }];
    });
}
