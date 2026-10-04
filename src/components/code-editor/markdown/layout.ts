import type { MarkdownBlock } from './model';

export const MARKDOWN_WINDOW_LIMIT = 120;
export const MARKDOWN_SLICE_LINES = 32;
export const MARKDOWN_SLICE_CHARACTERS = 8192;
/** Bound DOM inside a huge paragraph/quote/code block as well as the block window. */
export function viewportBlocks(blocks: readonly MarkdownBlock[], source: string): MarkdownBlock[] {
    let output: MarkdownBlock[] = [];
    for (let block of blocks) {
        if (
            block.kind === 'frontmatter' ||
            block.kind === 'html' ||
            (block.contentTo - block.contentFrom <= MARKDOWN_SLICE_CHARACTERS &&
                (block.lines?.length ?? 0) <= MARKDOWN_SLICE_LINES)
        ) {
            output.push(block);
            continue;
        }
        let rows = block.lines;
        if (!rows) {
            rows = [];
            let cursor = block.contentFrom;
            for (let match of source.slice(block.contentFrom, block.contentTo).matchAll(/[^\r\n]*(?:\r\n|\r|\n|$)/g)) {
                if (!match[0]) continue;
                let content = match[0].replace(/(?:\r\n|\r|\n)$/, '');
                rows.push({
                    from: cursor,
                    to: cursor + match[0].length,
                    contentFrom: cursor,
                    contentTo: cursor + content.length
                });
                cursor += match[0].length;
            }
        }
        let pieces: NonNullable<MarkdownBlock['lines']> = [];
        for (let row of rows) {
            // A single long code line is one inert text node and remains horizontally scrollable.
            if (block.kind === 'code' || block.kind === 'fence') {
                pieces.push(row);
                continue;
            }
            for (
                let from = row.contentFrom;
                from < row.contentTo || from === row.contentFrom;
                from += MARKDOWN_SLICE_CHARACTERS
            ) {
                let to = Math.min(row.contentTo, from + MARKDOWN_SLICE_CHARACTERS);
                pieces.push({
                    from: from === row.contentFrom ? row.from : from,
                    to: to === row.contentTo ? row.to : to,
                    contentFrom: from,
                    contentTo: to
                });
                if (to === row.contentTo) break;
            }
        }
        let start = 0;
        while (start < pieces.length) {
            let end = start,
                characters = 0;
            while (
                end < pieces.length &&
                end - start < MARKDOWN_SLICE_LINES &&
                characters + pieces[end]!.contentTo - pieces[end]!.contentFrom <= MARKDOWN_SLICE_CHARACTERS
            ) {
                characters += pieces[end]!.contentTo - pieces[end]!.contentFrom;
                end++;
            }
            if (end === start) end++;
            let first = pieces[start]!,
                last = pieces[end - 1]!;
            output.push({
                ...block,
                from: start === 0 ? block.from : first.from,
                to: end === pieces.length ? block.to : pieces[end]!.from,
                contentFrom: first.contentFrom,
                contentTo: last.contentTo,
                lines: pieces.slice(start, end),
                continuation: start > 0,
                continues: end < pieces.length,
                task: start === 0 ? block.task : undefined,
                marker: start === 0 ? block.marker : undefined
            });
            start = end;
        }
    }
    return output;
}
export function headingScale(level = 0) {
    return [1, 1.7, 1.45, 1.25, 1.1, 1, 0.95][level] ?? 1;
}
/** Variable-height block index. Measured rows update a Fenwick tree in O(log n). */
export class MarkdownLayout {
    readonly blocks: readonly MarkdownBlock[];
    readonly heights: number[];
    #tree: number[];
    constructor(blocks: readonly MarkdownBlock[], source: string, width = 600, fontSize = 13, lineHeight = 20) {
        this.blocks = blocks;
        this.heights = blocks.map((block) => {
            if (block.kind === 'frontmatter') return 20;
            let scale = headingScale(block.level),
                line = block.level && block.level <= 2 ? fontSize * scale * 1.3 : lineHeight,
                available = Math.max(40, width - (block.indent ?? 0) * fontSize * 0.6 - (block.quoteDepth ?? 0) * 10),
                columns = Math.max(8, Math.floor(available / (fontSize * 0.6 * scale))),
                text = source.slice(block.contentFrom, block.contentTo),
                lines =
                    block.lines?.map((row) => source.slice(row.contentFrom, row.contentTo)) ?? text.split(/\r\n|\r|\n/),
                count = lines.reduce(
                    (sum, value) =>
                        sum +
                        Math.max(
                            1,
                            block.kind === 'code' || block.kind === 'fence' ? 1 : Math.ceil(value.length / columns)
                        ),
                    0
                );
            return Math.max(
                line,
                count * line +
                    (block.kind === 'fence' || block.kind === 'code'
                        ? (block.continuation ? 0 : 1) + (block.continues ? 0 : 1)
                        : 0)
            );
        });
        this.#tree = Array(blocks.length + 1).fill(0);
        for (let i = 0; i < this.heights.length; i++) this.#add(i, this.heights[i]!);
    }
    #add(index: number, delta: number) {
        for (let i = index + 1; i < this.#tree.length; i += i & -i) this.#tree[i]! += delta;
    }
    prefix(end: number) {
        let sum = 0;
        for (let i = Math.min(Math.max(0, end), this.heights.length); i > 0; i -= i & -i) sum += this.#tree[i]!;
        return sum;
    }
    get total() {
        return this.prefix(this.heights.length);
    }
    measure(index: number, height: number) {
        if (
            !(height > 0) ||
            !Number.isFinite(height) ||
            index < 0 ||
            index >= this.heights.length ||
            Math.abs(this.heights[index]! - height) < 0.5
        )
            return false;
        let delta = height - this.heights[index]!;
        this.heights[index] = height;
        this.#add(index, delta);
        return true;
    }
    at(y: number) {
        let index = 0,
            sum = 0,
            bit = 1;
        while (bit * 2 < this.#tree.length) bit *= 2;
        for (; bit; bit >>= 1) {
            let next = index + bit;
            if (next < this.#tree.length && sum + this.#tree[next]! <= y) {
                index = next;
                sum += this.#tree[next]!;
            }
        }
        return Math.min(index, Math.max(0, this.heights.length - 1));
    }
    index(offset: number) {
        let lo = 0,
            hi = this.blocks.length;
        while (lo < hi) {
            let mid = (lo + hi) >>> 1;
            if (this.blocks[mid]!.from <= offset) lo = mid + 1;
            else hi = mid;
        }
        return Math.max(0, lo - 1);
    }
    window(y: number, height: number, overscan = 240) {
        let start = this.at(Math.max(0, y - overscan)),
            end = Math.min(this.blocks.length, this.at(y + Math.max(1, height) + overscan) + 1);
        if (end - start > MARKDOWN_WINDOW_LIMIT) {
            start = Math.max(start, this.at(y) - 12);
            end = Math.min(this.blocks.length, start + MARKDOWN_WINDOW_LIMIT);
        }
        return { start, end };
    }
}
