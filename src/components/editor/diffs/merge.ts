import { reactive, untrack } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import icon from '~/components/icon';
import codeEditor, { type Controller } from '../code';
import { EditorDocument } from '../code/document';
import { languageFor, type Language } from '../code/syntax';
import { conflictMarkers, diff3, resolveMarker, type ConflictMarker, type MergeChoice, type MergeRegion } from './diff3';
import { highlighter, markup } from './render';
import down from '@esportsplus/ui/svg/arrow-down.svg';
import up from '@esportsplus/ui/svg/arrow-up.svg';
import check from '@esportsplus/ui/svg/check.svg';


type Lens = { conflict: number; kind: 'lens' };

// One line of a read-only side; 'conflict' indexes the merge's conflicts, -1 outside them. A conflict with no lines on
// this side still gets one empty row (line -1), so it shows where it sits.
type PaneLine = { conflict: number; kind: 'line'; line: number; tone: '' | 'change' | 'conflict' };

type PaneItem = Lens | PaneLine;

type MergeAttributes = Attributes & {
    // The common ancestor; null compares the sides directly, so every difference is a conflict.
    base: string | null;
    current: string;
    filename?: string;
    incoming: string;
    // Defaults to the language 'filename' implies.
    language?: Language;
    // Complete merge hands over the result, once no conflict markers remain.
    onresolve: (result: string) => void;
};

type Side = 'current' | 'incoming';


const EOL = /\r\n|\r|\n/;

const TRAILING_EOL = /(?:\r\n|\r|\n)$/;


function lines(section: string) {
    return section === '' ? [] : section.replace(TRAILING_EOL, '').split(EOL);
}

function same(a: readonly string[], b: readonly string[]) {
    return a.length === b.length && a.every((line, i) => line === b[i]);
}


export default component(
    function(this: { attributes?: Partial<MergeAttributes> } | void, input: MergeAttributes) {
        let {
                base,
                current,
                filename,
                incoming,
                language,
                onresolve,
                ...attributes
            } = untrack(() => ({ ...this?.attributes, ...input })) as MergeAttributes,
            result = diff3(base, current, incoming),
            conflicts = result.regions.filter((region) => region.kind === 'conflict'),
            document = new EditorDocument(result.text),
            editor: Controller | undefined,
            // Each conflict's block in the result, null once resolved or edited beyond recognition; and the reverse.
            linked: (ConflictMarker | null)[] = [],
            list: ConflictMarker[] = [],
            owners: number[] = [],
            queued = false,
            panes: Record<Side, ReturnType<typeof pane>>,
            ui = reactive({ conflicts: 0, current: -1, version: 0 }),
            unsubscribe: VoidFunction | undefined;

        language ??= languageFor(filename);

        function accept(conflict: number, choice: MergeChoice) {
            let marker = linked[conflict];

            if (!marker) {
                return false;
            }

            return apply(marker, choice);
        }

        function apply(marker: ConflictMarker, choice: MergeChoice) {
            let text = document.value;

            document.replace(marker.from, marker.to, resolveMarker(text, marker, choice), { selection: { start: marker.from } });
            scan();
            editor?.goToLine(document.lineAt(marker.from) + 1);

            return true;
        }

        // Moves to the next or previous remaining block, in the result and in both sides.
        function go(direction: 1 | -1) {
            let count = list.length;

            if (!count) {
                return false;
            }

            let at = document.selection.start,
                index = direction > 0 ? 0 : count - 1;

            for (let i = 0; i < count; i++) {
                let j = direction > 0 ? i : count - 1 - i;

                if (direction > 0 ? list[j].from > at : list[j].to <= at) {
                    index = j;
                    break;
                }
            }

            reveal(index);

            return true;
        }

        function lens(side: Side, item: Lens) {
            let resolved = () => (ui.version, !linked[item.conflict]);

            return html`
                <div class='diffs-merge-lens' ${{ class: () => resolved() && 'diffs-merge-lens--resolved' }}>
                    ${() => resolved()
                        ? html`<span class='diffs-merge-lens-note'>Resolved</span>`
                        : html`
                            <button
                                aria-label='${side === 'current' ? 'Accept current' : 'Accept incoming'} for conflict ${item.conflict + 1}'
                                class='diffs-action'
                                type='button'
                                ${{ onclick: () => accept(item.conflict, side) }}
                            >
                                ${side === 'current' ? 'Accept current' : 'Accept incoming'}
                            </button>
                            <button
                                aria-label='Accept both for conflict ${item.conflict + 1}'
                                class='diffs-action'
                                type='button'
                                ${{ onclick: () => accept(item.conflict, 'both') }}
                            >
                                Accept both
                            </button>
                        `}
                </div>
            `;
        }

        function line(text: readonly string[], tokens: ReturnType<typeof highlighter>, item: PaneLine) {
            return html`
                <div
                    class='diffs-merge-line ${item.tone && `diffs-merge-line--${item.tone}`}'
                    ${item.conflict >= 0 && { class: () => ui.current >= 0 && owners[ui.current] === item.conflict && '--active' }}
                >
                    <span class='diffs-number'>${item.line < 0 ? '' : item.line + 1}</span>
                    <code class='diffs-code' ${{ innerHTML: item.line < 0 ? '' : markup(text[item.line], tokens(item.line), [], '') }}></code>
                </div>
            `;
        }

        // Pairs each conflict with its block in the result by content, in order, so edits elsewhere don't confuse them.
        function link() {
            let at = 0;

            linked = conflicts.map(() => null);
            owners = list.map(() => -1);

            for (let i = 0, n = conflicts.length; i < n && at < list.length; i++) {
                for (let j = at; j < list.length; j++) {
                    if (same(lines(list[j].current), conflicts[i].current) && same(lines(list[j].incoming), conflicts[i].incoming)) {
                        linked[i] = list[j];
                        owners[j] = i;
                        at = j + 1;
                        break;
                    }
                }
            }
        }

        function pane(side: Side) {
            let items: PaneItem[] = [],
                text: string[] = [],
                c = 0;

            for (let i = 0, n = result.regions.length; i < n; i++) {
                let region: MergeRegion = result.regions[i],
                    own = region[side],
                    conflict = region.kind === 'conflict' ? c++ : -1,
                    tone: PaneLine['tone'] = conflict >= 0 ? 'conflict' : region.kind === side || region.kind === 'same' ? 'change' : '';

                if (conflict >= 0) {
                    items.push({ conflict, kind: 'lens' });

                    if (!own.length) {
                        items.push({ conflict, kind: 'line', line: -1, tone });
                    }
                }

                for (let j = 0, m = own.length; j < m; j++) {
                    items.push({ conflict, kind: 'line', line: text.length, tone });
                    text.push(own[j]);
                }
            }

            let tokens = highlighter(text, language!),
                rows = reactive(items);

            return {
                items,
                lines: text.length,
                slot: html.virtual(rows, (item) => item.kind === 'lens' ? lens(side, item) : line(text, tokens, item))
            };
        }

        function reveal(index: number) {
            let marker = list[index],
                conflict = owners[index];

            ui.current = index;
            editor?.goToLine(marker.line + 1);

            if (conflict < 0) {
                return;
            }

            for (let side of ['current', 'incoming'] as const) {
                let at = panes[side].items.findIndex((item) => item.kind === 'lens' && item.conflict === conflict);

                if (at >= 0) {
                    panes[side].slot.scrollTo(at, 'start');
                }
            }
        }

        function scan() {
            list = conflictMarkers(document.value);
            link();
            ui.conflicts = list.length;

            if (ui.current >= list.length) {
                ui.current = list.length - 1;
            }

            ui.version++;
        }

        function schedule() {
            if (queued) {
                return;
            }

            queued = true;
            queueMicrotask(() => {
                queued = false;
                scan();
            });
        }

        function section(side: Side) {
            return html`
                <div class='diffs-merge-pane diffs-merge-pane--${side}'>
                    <div class='diffs-merge-title'>${side === 'current' ? 'Current' : 'Incoming'}</div>
                    <div class='diffs-merge-scroller --scrollbar' tabindex='0'>
                        ${panes[side].slot.fragment}
                    </div>
                </div>
            `;
        }

        panes = {
            current: pane('current'),
            incoming: pane('incoming')
        };
        scan();
        ui.current = list.length ? 0 : -1;

        return html`
            <div
                class='diffs-merge'
                ${attributes}
                ${{
                    onconnect: () => {
                        unsubscribe ??= document.subscribe((_, change) => {
                            if (change.textChanged) {
                                schedule();
                            }
                        });
                    },
                    ondisconnect: () => {
                        unsubscribe?.();
                        unsubscribe = undefined;
                    },
                    onkeydown: (e: KeyboardEvent) => {
                        if (e.defaultPrevented || e.key !== 'F8' || !e.altKey || e.ctrlKey || e.metaKey) {
                            return;
                        }

                        e.preventDefault();
                        go(e.shiftKey ? -1 : 1);
                    },
                    style: `--digits: ${String(Math.max(panes.current.lines, panes.incoming.lines)).length};`
                }}
            >
                <div class='diffs-merge-header'>
                    ${filename && html`<span class='diffs-filename' title='${filename}'>${filename}</span>`}
                    <span aria-live='polite' class='diffs-position'>
                        ${() => ui.conflicts === 1 ? '1 conflict remaining' : ui.conflicts ? `${ui.conflicts} conflicts remaining` : 'No conflicts remaining'}
                    </span>
                    <div class='diffs-controls'>
                        ${(['current', 'incoming', 'both'] as const).map((choice) => html`
                            <button
                                class='diffs-button diffs-button--text'
                                type='button'
                                ${{
                                    disabled: () => ui.current < 0 || ui.current >= ui.conflicts,
                                    onclick: () => {
                                        let marker = list[ui.current];

                                        if (marker) {
                                            apply(marker, choice);
                                        }
                                    }
                                }}
                            >
                                ${choice === 'current' ? 'Accept current' : choice === 'incoming' ? 'Accept incoming' : 'Accept both'}
                            </button>
                        `)}
                        <button
                            aria-label='Previous conflict (Shift+Alt+F8)'
                            class='diffs-button'
                            title='Previous conflict (Shift+Alt+F8)'
                            type='button'
                            ${{ disabled: () => !ui.conflicts, onclick: () => go(-1) }}
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'diffs-button-icon' }, up)}
                        </button>
                        <button
                            aria-label='Next conflict (Alt+F8)'
                            class='diffs-button'
                            title='Next conflict (Alt+F8)'
                            type='button'
                            ${{ disabled: () => !ui.conflicts, onclick: () => go(1) }}
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'diffs-button-icon' }, down)}
                        </button>
                        <button
                            class='diffs-button diffs-button--primary diffs-button--text'
                            type='button'
                            ${{ disabled: () => ui.conflicts > 0, onclick: () => onresolve(document.value) }}
                        >
                            ${icon({ 'aria-hidden': 'true', class: 'diffs-button-icon' }, check)}
                            Complete merge
                        </button>
                    </div>
                </div>
                <div class='diffs-merge-sides'>
                    ${section('incoming')}
                    ${section('current')}
                </div>
                <div class='diffs-merge-result'>
                    <div class='diffs-merge-title'>Result</div>
                    ${codeEditor({
                        class: 'diffs-merge-editor',
                        controller: (controller: Controller) => {
                            editor = controller;
                        },
                        document,
                        options: { fileName: filename, label: 'Merge result', language }
                    })}
                </div>
            </div>
        `;
    }
);
export type { MergeAttributes };
