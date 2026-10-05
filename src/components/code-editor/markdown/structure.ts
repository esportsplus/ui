import type { EditorDocument } from '../document';
import type { FoldRange } from '../folding';
import type { MarkdownBlock } from './model';


// Blocks whose lines after the first can fold away.
const CONTAINERS = new Set<MarkdownBlock['kind']>(['code', 'fence', 'frontmatter', 'html', 'list', 'quote']);


// True when 'next' nests inside the list or quote 'block'.
function deeper(block: MarkdownBlock, next: MarkdownBlock) {
    if (block.kind === 'list') {
        return next.indent > block.indent && next.quoteDepth >= block.quoteDepth;
    }

    return next.quoteDepth > block.quoteDepth;
}

// The next block after 'index' that isn't blank.
function following(blocks: readonly MarkdownBlock[], index: number) {
    for (let i = index + 1, n = blocks.length; i < n; i++) {
        if (blocks[i].kind !== 'blank') {
            return blocks[i];
        }
    }

    return null;
}


// The fold block 'index' opens, following logical blocks: a heading folds its section up to the next heading of
// its level or higher, a list item or quote its nested children, and any container the lines after its first.
const foldAt = (document: EditorDocument, blocks: readonly MarkdownBlock[], index: number): FoldRange | null => {
    let block = blocks[index];

    if (block.kind === 'heading') {
        let to = document.value.length;

        for (let i = index + 1, n = blocks.length; i < n; i++) {
            if (blocks[i].kind === 'heading' && blocks[i].level! <= block.level!) {
                to = blocks[i].from;
                break;
            }
        }

        if (to <= block.to) {
            return null;
        }

        return { endLine: document.lineAt(to) + 1, from: block.to, line: document.lineAt(block.from) + 1, open: block.from, to };
    }

    if (!CONTAINERS.has(block.kind)) {
        return null;
    }

    let first = document.lineAt(block.from),
        to = block.to;

    if (first + 1 >= document.lineCount) {
        return null;
    }

    if (block.kind === 'list' || block.kind === 'quote') {
        for (let i = index + 1, n = blocks.length; i < n; i++) {
            if (blocks[i].kind === 'blank') {
                continue;
            }

            if (!deeper(block, blocks[i])) {
                break;
            }

            to = blocks[i].to;
        }
    }

    let from = document.lineStart(first + 1);

    if (from >= to) {
        return null;
    }

    return { endLine: document.lineAt(to) + 1, from, line: first + 1, open: block.from, to };
};

// Whether block 'index' opens a fold, without measuring it: only its neighbours are looked at.
const foldable = (blocks: readonly MarkdownBlock[], index: number, text: string) => {
    let block = blocks[index];

    if (block.kind === 'heading') {
        let next = blocks[index + 1];

        return !!next && !(next.kind === 'heading' && next.level! <= block.level!);
    }

    if (!CONTAINERS.has(block.kind)) {
        return false;
    }

    let line = block.from;

    while (line < block.to && text.charCodeAt(line) !== 10 && text.charCodeAt(line) !== 13) {
        line++;
    }

    if (line + (text.charCodeAt(line) === 13 && text.charCodeAt(line + 1) === 10 ? 2 : 1) < block.to) {
        return true;
    }

    if (block.kind !== 'list' && block.kind !== 'quote') {
        return false;
    }

    let next = following(blocks, index);

    return !!next && deeper(block, next);
};

// Every fold in the document, by line, outer ones first.
const markdownFolds = (document: EditorDocument, blocks: readonly MarkdownBlock[]) => {
    let ranges: FoldRange[] = [];

    for (let i = 0, n = blocks.length; i < n; i++) {
        let range = foldAt(document, blocks, i);

        if (range) {
            ranges.push(range);
        }
    }

    return ranges.sort((a, b) => a.line - b.line || b.to - a.to);
};


export { foldable, foldAt, markdownFolds };
