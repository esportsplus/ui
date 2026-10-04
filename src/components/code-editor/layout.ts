import { floorIndex, lineStarts, lineEnd, clamp } from './document';
import { NativeText } from './projection';
export type Rect = { left: number; top: number; width: number; height: number };
export type LayoutLine = { from: number; to: number; number: number; top: number; height: number; breaks: number[] };
/** Monospace fallback, with optional browser Range measurements for exact shaping/wrapping. */
export class EditorLayout {
    lines: LayoutLine[] = [];
    height = 0;
    #starts: number[] = [];
    #tops: number[] = [];
    readonly projection: NativeText;
    readonly source: string;
    readonly width: number;
    readonly lineHeight: number;
    readonly charWidth: number;
    readonly tabSize: number;
    readonly wrap: boolean;
    readonly mirror?: HTMLElement;
    constructor(
        projection: NativeText,
        source: string,
        width: number,
        lineHeight: number,
        charWidth: number,
        tabSize: number,
        wrap: boolean,
        mirror?: HTMLElement
    ) {
        this.projection = projection;
        this.source = source;
        this.width = width;
        this.lineHeight = lineHeight;
        this.charWidth = charWidth;
        this.tabSize = tabSize;
        this.wrap = wrap;
        this.mirror = mirror;
        let text = projection.value,
            starts = lineStarts(text),
            sourceStarts = lineStarts(source),
            top = 0;
        for (let index = 0; index < starts.length; index++) {
            let from = starts[index],
                to = lineEnd(text, starts, index),
                breaks = [from],
                x = 0,
                lastSpace = -1;
            for (let offset = from; wrap && offset < to;) {
                let character = String.fromCodePoint(text.codePointAt(offset)!),
                    advance =
                        character === '\t' ? (tabSize - (Math.floor(x / charWidth) % tabSize)) * charWidth : charWidth;
                if (wrap && x + advance > width && offset > breaks.at(-1)!) {
                    let next = lastSpace >= breaks.at(-1)! ? lastSpace + 1 : offset;
                    breaks.push(next);
                    x = 0;
                    lastSpace = -1;
                    if (next < offset) {
                        offset = next;
                        continue;
                    }
                    advance = character === '\t' ? tabSize * charWidth : charWidth;
                }
                x += advance;
                if (/\s/.test(character)) lastSpace = offset;
                offset += character.length;
            }
            let height = breaks.length * lineHeight;
            let rects = wrap && breaks.length > 1 ? this.range(from, to)?.getClientRects?.() : undefined;
            if (rects?.length) {
                let ys = [...rects].filter((rect) => rect.height > 0).map((rect) => rect.top),
                    unique = [...new Set(ys)];
                if (unique.length) {
                    height = unique.length * lineHeight;
                    // Use browser wrap boundaries, including variable-width glyphs, for minimap rows too.
                    let box = mirror!.getBoundingClientRect();
                    breaks = [from];
                    for (let row = 1; row < unique.length; row++) {
                        let lo = breaks.at(-1)!,
                            hi = to,
                            target = unique[row] - box.top;
                        while (lo < hi) {
                            let mid = (lo + hi) >>> 1,
                                caret = this.range(mid)?.getClientRects?.()[0];
                            if (caret && caret.top - box.top < target - 0.5) lo = mid + 1;
                            else hi = mid;
                        }
                        breaks.push(lo);
                    }
                }
            }
            this.lines.push({
                from,
                to,
                number: floorIndex(sourceStarts, projection.toSource(from)) + 1,
                top,
                height,
                breaks
            });
            top += height;
        }
        this.height = top;
        this.#starts = this.lines.map((line) => line.from);
        this.#tops = this.lines.map((line) => line.top);
    }
    range(from: number, to = from) {
        let node = this.mirror?.firstChild;
        if (!node || node.nodeType !== 3) return null;
        let range = node.ownerDocument!.createRange();
        range.setStart(node, clamp(from, node.textContent?.length ?? 0));
        range.setEnd(node, clamp(to, node.textContent?.length ?? 0));
        return range;
    }
    visible(top: number, bottom: number) {
        let first = Math.max(0, floorIndex(this.#tops, top)),
            last = Math.max(first + 1, floorIndex(this.#tops, bottom) + 1);
        return this.lines.slice(first, last);
    }
    lineAt(offset: number) {
        return this.lines[Math.max(0, floorIndex(this.#starts, offset))];
    }
    rect(offset: number): Rect {
        offset = clamp(offset, this.projection.value.length);
        let exact = this.range(offset, offset)?.getClientRects?.(),
            box = this.mirror?.getBoundingClientRect();
        if (exact?.length && box && exact[0].height)
            return { left: exact[0].left - box.left, top: exact[0].top - box.top, width: 1, height: this.lineHeight };
        let line = this.lineAt(offset),
            row = Math.max(0, floorIndex(line.breaks, offset)),
            left = 0;
        for (let character of this.projection.value.slice(line.breaks[row], Math.min(offset, line.to)))
            left +=
                character === '\t'
                    ? (this.tabSize - (Math.floor(left / this.charWidth) % this.tabSize)) * this.charWidth
                    : this.charWidth;
        return { left, top: line.top + row * this.lineHeight, width: 1, height: this.lineHeight };
    }
    offset(x: number, y: number) {
        let index = Math.max(0, floorIndex(this.#tops, Math.max(0, y))),
            line = this.lines[index],
            row = clamp(Math.floor((y - line.top) / this.lineHeight), line.breaks.length - 1),
            from = line.breaks[row],
            to = line.breaks[row + 1] ?? line.to;
        // Range caret rectangles supply the actual browser's wrap boundaries when available.
        if (this.range(line.from, line.to)?.getClientRects?.().length) {
            let lo = line.from,
                hi = line.to;
            while (lo < hi) {
                let mid = (lo + hi) >>> 1,
                    r = this.rect(mid);
                if (
                    r.top + this.lineHeight / 2 < y ||
                    (Math.abs(r.top + this.lineHeight / 2 - y) <= this.lineHeight / 2 && r.left < x)
                )
                    lo = mid + 1;
                else hi = mid;
            }
            let right = this.rect(lo),
                left = this.rect(Math.max(line.from, lo - 1));
            return Math.abs(right.left - x) < Math.abs(left.left - x) ? lo : Math.max(line.from, lo - 1);
        }
        let lo = from,
            hi = to;
        while (lo < hi) {
            let mid = (lo + hi) >>> 1;
            if (this.rect(mid).left < x) lo = mid + 1;
            else hi = mid;
        }
        let right = this.rect(lo),
            left = this.rect(Math.max(from, lo - 1));
        return Math.abs(right.left - x) < Math.abs(left.left - x) ? lo : Math.max(from, lo - 1);
    }
}
