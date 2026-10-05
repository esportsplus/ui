import type { EditorDocument, Selection } from './document';


// One entry per selection, so pasting into as many carets puts each piece back where it came from.
const MIME = 'application/x-esportsplus-code-editor';


// The ranges a copy or cut takes: the selections, or every caret's whole line when nothing is selected.
const copied = (document: EditorDocument): readonly Selection[] => {
    let ranges = document.selections;

    for (let i = 0, n = ranges.length; i < n; i++) {
        if (ranges[i].start !== ranges[i].end) {
            return ranges;
        }
    }

    let lines: Selection[] = [];

    for (let i = 0, n = ranges.length; i < n; i++) {
        let line = document.lineAt(ranges[i].start);

        lines.push({
            direction: 'none',
            end: line + 1 < document.lineCount ? document.lineStart(line + 1) : document.value.length,
            start: document.lineStart(line)
        });
    }

    return lines;
};

// What a paste inserts: one piece per caret when the clipboard holds exactly that many, otherwise the plain text.
// Malformed metadata from elsewhere falls back to the plain text, never to a partial edit.
const read = (data: DataTransfer, count: number): string | string[] => {
    let text = data.getData('text/plain'),
        encoded = data.getData(MIME),
        chunks: unknown = null;

    if (count < 2) {
        return text;
    }

    if (encoded) {
        try {
            chunks = JSON.parse(encoded);
        }
        catch {
            chunks = null;
        }
    }

    if (
        Array.isArray(chunks) &&
        chunks.length === count &&
        chunks.every((chunk) => typeof chunk === 'string') &&
        (chunks.join('\n') === text || chunks.join('\r\n') === text || chunks.join('\r') === text)
    ) {
        return chunks as string[];
    }

    let lines = text.split(/\r\n|\r|\n/);

    return lines.length === count ? lines : text;
};

// Writes each range's text, joined by the document's line ending, plus the pieces for a multi-caret paste.
const write = (data: DataTransfer, document: EditorDocument, ranges: readonly Selection[]) => {
    let chunks: string[] = [],
        value = document.value;

    for (let i = 0, n = ranges.length; i < n; i++) {
        chunks.push(value.slice(ranges[i].start, ranges[i].end));
    }

    data.setData('text/plain', chunks.join(document.eol));
    data.setData(MIME, JSON.stringify(chunks));
};


export { copied, MIME, read, write };
