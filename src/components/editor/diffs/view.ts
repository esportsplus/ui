import { reactive, untrack } from '@esportsplus/reactivity';
import { component, html, type Attributes, type VirtualSlot } from '@esportsplus/template';
import icon from '~/components/icon';
import { languageFor, type Language, type Token } from '../code/syntax';
import { diffTexts, hunks, type Diff, type DiffChange } from './hunks';
import { highlighter, markup } from './render';
import { words } from './words';
import down from '@esportsplus/ui/svg/arrow-down.svg';
import up from '@esportsplus/ui/svg/arrow-up.svg';
import expand from '@esportsplus/ui/svg/chevrons-up-down.svg';


// A line on one side, and the line it replaces or is replaced by on the other, for word marks.
type Cell = { line: number; partner: number | null };

type DiffsAttributes = Attributes & {
    // Unchanged lines kept around each change; the rest fold into "N hidden lines" rows.
    context?: number;
    // Receives the controller once the view is connected.
    controller?: (controller: DiffsController) => void;
    filename?: string;
    ignoreWhitespace?: boolean;
    // Defaults to the language 'filename' implies.
    language?: Language;
    mode?: Mode;
    modified: string;
    onaccept?: (change: DiffChange) => void;
    onrevert?: (change: DiffChange) => void;
    original: string;
    wordDiff?: boolean;
};

type DiffsController = {
    // Reactive; read-only.
    readonly state: DiffsState;
    next(): boolean;
    previous(): boolean;
    setMode(mode: Mode): void;
    setTexts(original: string, modified: string): void;
};

type DiffsState = {
    additions: number;
    changes: number;
    // The change last moved to, -1 before any.
    current: number;
    deletions: number;
    mode: Mode;
};

type Gap = { from: number; kind: 'gap'; to: number };

type Item = Gap | Line;

// One visual row. A split row pairs both sides; a unified row has one side unless the line is unchanged. 'change' is
// -1 for unchanged lines, and 'lead' marks the first row of a change.
type Line = { change: number; kind: 'line'; lead: boolean; left: Cell | null; right: Cell | null };

type Mode = 'split' | 'unified';

type Side = 'modified' | 'original';


// Rows inserted into the list per splice; a spread argument list has a hard size limit.
const CHUNK = 4096;

const KIND: Record<Side, string> = {
    modified: 'diffs-word diffs-word--insert',
    original: 'diffs-word diffs-word--delete'
};


function plural(count: number, word: string) {
    return `${count} ${word}${count === 1 ? '' : 's'}`;
}


export default component(
    function(this: { attributes?: Partial<DiffsAttributes> } | void, input: DiffsAttributes) {
        let {
                context = 3,
                controller: receive,
                filename,
                ignoreWhitespace = false,
                language,
                mode: initial = 'split',
                modified,
                onaccept,
                onrevert,
                original,
                wordDiff = true,
                ...attributes
            } = untrack(() => ({ ...this?.attributes, ...input })) as DiffsAttributes,
            diff: Diff,
            // Gaps the reader opened, by their first row; reset when the texts change.
            expanded = new Set<number>(),
            items = reactive([] as Item[]),
            lexers: Record<Side, (index: number) => readonly Token[]>,
            mode = initial,
            starts: number[] = [],
            ui = reactive({ additions: 0, changes: 0, current: -1, deletions: 0, digits: 1, mode: initial as Mode }),
            controller: DiffsController = {
                next: () => move(1),
                previous: () => move(-1),
                setMode: (next: Mode) => {
                    if (next === mode) {
                        return;
                    }

                    mode = next;
                    ui.mode = next;
                    build();
                },
                setTexts: (a: string, b: string) => {
                    original = a;
                    modified = b;
                    compute();
                },
                state: ui
            },
            slot: VirtualSlot<Item>;

        language ??= languageFor(filename);

        function actions(change: number) {
            if (!onaccept && !onrevert) {
                return '';
            }

            return html`
                <span class='diffs-actions'>
                    ${onrevert && html`
                        <button aria-label='Revert change ${change + 1}' class='diffs-action' type='button' ${{ onclick: () => onrevert(diff.changes[change]) }}>Revert</button>
                    `}
                    ${onaccept && html`
                        <button aria-label='Accept change ${change + 1}' class='diffs-action' type='button' ${{ onclick: () => onaccept(diff.changes[change]) }}>Accept</button>
                    `}
                </span>
            `;
        }

        function build() {
            let { gaps } = hunks(diff, context),
                next: Item[] = [],
                at = 0;

            for (let i = 0, n = gaps.length; i < n; i++) {
                let { from, to } = gaps[i];

                rows(at, from, next);

                if (expanded.has(from)) {
                    rows(from, to, next);
                }
                else {
                    next.push({ from, kind: 'gap', to });
                }

                at = to;
            }

            rows(at, diff.rows.length, next);
            replace(0, items.length, next);
        }

        function cell(item: Line, side: Side) {
            let value = side === 'original' ? item.left : item.right;

            if (!value) {
                return html`<div class='diffs-cell diffs-cell--empty'><span class='diffs-number'></span><code class='diffs-code'></code></div>`;
            }

            return html`
                <div class='diffs-cell ${item.change < 0 ? 'diffs-cell--equal' : side === 'original' ? 'diffs-cell--delete' : 'diffs-cell--insert'}'>
                    <span class='diffs-number'>${value.line + 1}</span>
                    <code class='diffs-code' ${{ innerHTML: code(value, side, item.change >= 0) }}></code>
                </div>
            `;
        }

        function code(value: Cell, side: Side, changed: boolean) {
            let text = diff[side][value.line],
                marks = null;

            if (changed && wordDiff && value.partner !== null) {
                marks = side === 'original'
                    ? words(text, diff.modified[value.partner], ignoreWhitespace)
                    : words(diff.original[value.partner], text, ignoreWhitespace);
            }

            return markup(text, lexers[side](value.line), marks ? marks[side] : [], KIND[side]);
        }

        function compute() {
            diff = diffTexts(original, modified, { ignoreWhitespace });
            expanded.clear();
            lexers = {
                modified: highlighter(diff.modified, language!),
                original: highlighter(diff.original, language!)
            };
            ui.additions = diff.additions;
            ui.changes = diff.changes.length;
            ui.current = -1;
            ui.deletions = diff.deletions;
            ui.digits = String(Math.max(diff.original.length, diff.modified.length)).length;
            build();
        }

        function gap(item: Gap) {
            let count = item.to - item.from;

            return html`
                <div class='diffs-row diffs-row--gap'>
                    <button
                        class='diffs-gap'
                        type='button'
                        ${{
                            onclick: () => {
                                let at = items.indexOf(item),
                                    next: Item[] = [];

                                if (at < 0) {
                                    return;
                                }

                                expanded.add(item.from);
                                rows(item.from, item.to, next);
                                replace(at, 1, next);
                            }
                        }}
                    >
                        ${icon({ 'aria-hidden': 'true', class: 'diffs-gap-icon' }, expand)}
                        ${plural(count, 'hidden line')}
                    </button>
                </div>
            `;
        }

        function line(item: Line) {
            let type = item.change < 0 ? 'equal' : item.left ? 'delete' : 'insert';

            if (mode === 'split') {
                return html`
                    <div
                        class='diffs-row diffs-row--split ${item.change >= 0 && 'diffs-row--change'} ${item.lead && 'diffs-row--lead'}'
                        ${{ class: () => item.change >= 0 && ui.current === item.change && '--active' }}
                    >
                        ${cell(item, 'original')}
                        ${cell(item, 'modified')}
                        ${item.lead && actions(item.change)}
                    </div>
                `;
            }

            let side: Side = item.right ? 'modified' : 'original',
                value = (item.right ?? item.left)!;

            return html`
                <div
                    class='diffs-row diffs-row--unified diffs-row--${type} ${item.lead && 'diffs-row--lead'}'
                    ${{ class: () => item.change >= 0 && ui.current === item.change && '--active' }}
                >
                    <span class='diffs-number'>${item.left ? item.left.line + 1 : ''}</span>
                    <span class='diffs-number'>${item.right ? item.right.line + 1 : ''}</span>
                    <span aria-hidden='true' class='diffs-sign'>${type === 'delete' ? '-' : type === 'insert' ? '+' : ''}</span>
                    <code class='diffs-code' ${{ innerHTML: code(value, side, item.change >= 0) }}></code>
                    ${item.lead && actions(item.change)}
                </div>
            `;
        }

        function move(direction: 1 | -1) {
            let count = diff.changes.length;

            if (!count) {
                return false;
            }

            let current = ui.current < 0
                ? (direction > 0 ? 0 : count - 1)
                : (ui.current + direction + count) % count;

            ui.current = current;
            slot.scrollTo(starts[current], 'center');

            return true;
        }

        function replace(at: number, count: number, next: Item[]) {
            items.splice(at, count, ...next.slice(0, CHUNK));

            for (let i = CHUNK, n = next.length; i < n; i += CHUNK) {
                items.splice(at + i, 0, ...next.slice(i, i + CHUNK));
            }

            starts = new Array(diff.changes.length).fill(0);

            for (let i = 0, n = items.length; i < n; i++) {
                let item = items[i];

                if (item.kind === 'line' && item.lead) {
                    starts[item.change] = i;
                }
            }
        }

        // Items for rows [from, to). Gaps hold unchanged rows only, so a change never straddles the range.
        function rows(from: number, to: number, out: Item[]) {
            let list = diff.rows;

            for (let i = from; i < to;) {
                let row = list[i];

                if (row.type === 'equal') {
                    out.push({
                        change: -1,
                        kind: 'line',
                        lead: false,
                        left: { line: row.original!, partner: null },
                        right: { line: row.modified!, partner: null }
                    });
                    i++;
                    continue;
                }

                let change = changeAt(i),
                    deletes: number[] = [],
                    inserts: number[] = [];

                for (let r = change.rows.from; r < change.rows.to; r++) {
                    if (list[r].type === 'delete') {
                        deletes.push(list[r].original!);
                    }
                    else {
                        inserts.push(list[r].modified!);
                    }
                }

                if (mode === 'split') {
                    for (let p = 0, n = Math.max(deletes.length, inserts.length); p < n; p++) {
                        out.push({
                            change: change.index,
                            kind: 'line',
                            lead: p === 0,
                            left: p < deletes.length ? { line: deletes[p], partner: inserts[p] ?? null } : null,
                            right: p < inserts.length ? { line: inserts[p], partner: deletes[p] ?? null } : null
                        });
                    }
                }
                else {
                    for (let p = 0, n = deletes.length; p < n; p++) {
                        out.push({ change: change.index, kind: 'line', lead: p === 0, left: { line: deletes[p], partner: inserts[p] ?? null }, right: null });
                    }

                    for (let p = 0, n = inserts.length; p < n; p++) {
                        out.push({ change: change.index, kind: 'line', lead: p === 0 && !deletes.length, left: null, right: { line: inserts[p], partner: deletes[p] ?? null } });
                    }
                }

                i = change.rows.to;
            }
        }

        // The change whose rows include 'row'; changes are in row order.
        function changeAt(row: number) {
            let list = diff.changes,
                hi = list.length - 1,
                lo = 0;

            while (lo < hi) {
                let mid = (lo + hi) >>> 1;

                if (list[mid].rows.to <= row) {
                    lo = mid + 1;
                }
                else {
                    hi = mid;
                }
            }

            return list[lo];
        }

        // Filled before the slot exists, so the first rows don't read as arriving above the reader and scroll it.
        compute();
        slot = html.virtual(items, (item) => item.kind === 'gap' ? gap(item) : line(item));

        return html`
            <div
                class='diffs'
                ${attributes}
                ${{
                    class: () => `diffs--${ui.mode}`,
                    onconnect: () => receive?.(controller),
                    onkeydown: (e: KeyboardEvent) => {
                        if (e.key !== 'F5' || !e.altKey || e.ctrlKey || e.metaKey) {
                            return;
                        }

                        e.preventDefault();
                        move(e.shiftKey ? -1 : 1);
                    },
                    style: () => `--digits: ${ui.digits};`
                }}
            >
                <div class='diffs-header'>
                    ${filename && html`<span class='diffs-filename' title='${filename}'>${filename}</span>`}
                    <span class='diffs-stats'>
                        <span class='diffs-stat diffs-stat--additions'>${() => `+${ui.additions}`}</span>
                        <span class='diffs-stat diffs-stat--deletions'>${() => `−${ui.deletions}`}</span>
                    </span>
                    <span aria-live='polite' class='diffs-position'>
                        ${() => {
                            if (!ui.changes) {
                                return 'No changes';
                            }

                            return ui.current < 0 ? plural(ui.changes, 'change') : `${ui.current + 1} of ${ui.changes}`;
                        }}
                    </span>
                    <div class='diffs-controls'>
                        <div aria-label='View' class='diffs-modes' role='group'>
                            ${(['split', 'unified'] as const).map((value) => html`
                                <button
                                    class='diffs-button diffs-button--text'
                                    type='button'
                                    ${{
                                        'aria-pressed': () => ui.mode === value ? 'true' : 'false',
                                        class: () => ui.mode === value && '--active',
                                        onclick: () => controller.setMode(value)
                                    }}
                                >
                                    ${value === 'split' ? 'Split' : 'Unified'}
                                </button>
                            `)}
                        </div>
                        <button
                            aria-label='Previous change (Shift+Alt+F5)'
                            class='diffs-button'
                            title='Previous change (Shift+Alt+F5)'
                            type='button'
                            ${{ disabled: () => !ui.changes, onclick: () => move(-1) }}
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'diffs-button-icon' }, up)}
                        </button>
                        <button
                            aria-label='Next change (Alt+F5)'
                            class='diffs-button'
                            title='Next change (Alt+F5)'
                            type='button'
                            ${{ disabled: () => !ui.changes, onclick: () => move(1) }}
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'diffs-button-icon' }, down)}
                        </button>
                    </div>
                </div>
                <div class='diffs-scroller --scrollbar' tabindex='0'>
                    ${slot.fragment}
                </div>
            </div>
        `;
    }
);
export type { DiffsAttributes, DiffsController, DiffsState, Mode };
