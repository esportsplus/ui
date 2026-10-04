import { clamp, floorIndex, preferredEol, type Edit, type Selection } from './document';

/** Textareas normalize all CR/CRLF to LF. Keep that projection separate from exact source. */
export class NativeText {
    readonly value: string;
    #hidden: { from: number; to: number; at: number }[] = [];
    #base: NativeText | undefined;
    #rawEnds: number[] = [];
    #nativeEnds: number[] = [];

    constructor(source: string, hidden: readonly { from: number; to: number }[] = []) {
        if (hidden.length) {
            let sorted = [...hidden].sort((a, b) => a.from - b.from),
                cursor = 0,
                visible = '';
            for (let range of sorted) {
                if (range.from < cursor || range.to <= range.from || range.to > source.length) continue;
                visible += source.slice(cursor, range.from);
                this.#hidden.push({ ...range, at: visible.length });
                visible += '…';
                cursor = range.to;
            }
            visible += source.slice(cursor);
            this.#base = new NativeText(visible);
            this.value = this.#base.value;
            return;
        }
        this.value = source.replace(/\r\n?/g, '\n');
        for (let i = 0; i < source.length; i++) {
            if (source[i] === '\r' && source[i + 1] === '\n') {
                this.#rawEnds.push(i + 2);
                this.#nativeEnds.push(i + 1 - (this.#rawEnds.length - 1));
                i++;
            }
        }
    }

    toSource(offset: number): number {
        offset = clamp(offset, this.value.length);
        if (this.#base) {
            let visible = this.#base.toSource(offset),
                shift = 0;
            for (let range of this.#hidden) {
                if (visible <= range.at) break;
                shift += range.to - range.from - 1;
            }
            return visible + shift;
        }
        return offset + floorIndex(this.#nativeEnds, offset) + 1;
    }

    toNative(offset: number): number {
        if (this.#base) {
            let shift = 0;
            for (let range of this.#hidden) {
                if (offset < range.from) break;
                if (offset < range.to) return this.#base.toNative(range.at);
                shift += range.to - range.from - 1;
            }
            return this.#base.toNative(offset - shift);
        }
        return Math.max(0, offset - floorIndex(this.#rawEnds, offset) - 1);
    }

    /** Placeholder edges map to the two source boundaries, never to its interior. */
    placeholders() {
        return this.#hidden.map((range) => ({ ...range, at: this.#base!.toNative(range.at) }));
    }

    /** A minimal anchored diff retains untouched line endings, even in mixed-EOL documents. */
    edit(source: string, value: string, before?: Pick<Selection, 'start' | 'end'>, inputType = ''): Edit {
        let old = this.value;
        if (old === value) return { from: 0, to: 0, insert: '' };
        // Without direction an edit among repeated characters can land at the wrong offset.
        if (before && before.start === before.end) {
            let removed = old.length - value.length;
            if (removed > 0 && inputType.endsWith('Backward'))
                before = { ...before, start: this.toSource(Math.max(0, this.toNative(before.start) - removed)) };
            if (removed > 0 && inputType.endsWith('Forward'))
                before = { ...before, end: this.toSource(this.toNative(before.end) + removed) };
        }
        let from = 0,
            oldEnd = old.length,
            newEnd = value.length,
            prefixLimit = before ? this.toNative(before.start) : old.length,
            suffixLimit = before ? this.toNative(before.end) : 0;
        while (from < Math.min(old.length, value.length, prefixLimit) && old[from] === value[from]) from++;
        while (oldEnd > Math.max(from, suffixLimit) && newEnd > from && old[oldEnd - 1] === value[newEnd - 1]) {
            oldEnd--;
            newEnd--;
        }
        // A native mutation crossing a placeholder must not remove invisible source.
        if (this.placeholders().some((range) => from <= range.at && oldEnd > range.at))
            return { from: 0, to: 0, insert: '' };
        return {
            from: this.toSource(from),
            to: this.toSource(oldEnd),
            insert: value.slice(from, newEnd).replace(/\n/g, preferredEol(source))
        };
    }
}
