import { reactive, untrack } from '@esportsplus/reactivity';
import { component, html, type Attributes } from '@esportsplus/template';
import copy from '~/components/copy';
import icon from '~/components/icon';
import { observeSize } from '~/shared/resize';
import { minimap, type Source } from '../code/minimap';
import { languageFor, type Language, type Token } from '../code/syntax';
import { hidden, outline, type Line } from './model';
import chevron from '@esportsplus/ui/svg/chevron-down.svg';
import '~/modifiers/scrollbar/scss/index.scss';
import './scss/index.scss';


type CodeViewerAttributes = Attributes & {
    // A copy button in the header, writing the exact source.
    copy?: boolean;
    // Shown in the header; picks the language when 'language' is left out.
    filename?: string;
    fold?: boolean;
    language?: Language;
    lineNumbers?: boolean;
    // An overview of the whole source beside it; click, drag or scroll it to move through the code.
    minimap?: boolean;
    // Exact source text; a getter keeps following it.
    value: string | (() => string);
    // Marks each space and tab.
    whitespace?: boolean;
    wrap?: boolean;
};


const NO_BREAKS: readonly number[] = [];

const TOKEN_COLORS: readonly Token['kind'][] = [
    'color',
    'comment',
    'function',
    'keyword',
    'number',
    'operator',
    'property',
    'regexp',
    'selector',
    'string',
    'tag',
    'type',
    'variable'
];


function pixels(value: string) {
    return parseFloat(value) || 0;
}

function range(index: number, end: number) {
    return end - index === 2 ? `line ${end}` : `lines ${index + 2}–${end}`;
}


export default component(
    function(this: { attributes?: Partial<CodeViewerAttributes> } | void, input: CodeViewerAttributes) {
        let {
                copy: copyable = false,
                filename,
                fold = true,
                language,
                lineNumbers = true,
                minimap: overview = false,
                value,
                whitespace = false,
                wrap = false,
                ...attributes
            } = untrack(() => ({ ...this?.attributes, ...input })) as CodeViewerAttributes,
            current = () => {
                let next = input.value ?? this?.attributes?.value;

                return (typeof next === 'function' ? next() : next) ?? '';
            },
            frame = 0,
            lexer = language ?? languageFor(filename),
            lines: Line[] = [],
            palette: Record<string, string> = {},
            rail: HTMLElement | undefined,
            scroller: HTMLElement | undefined,
            source: Source | null = null,
            stale = false;

        let map = overview && minimap({
            focus: () => scroller?.focus({ preventScroll: true }),
            name: 'code-viewer',
            scroll: (top, relative) => {
                if (scroller) {
                    scroller.scrollTop = relative ? scroller.scrollTop + top : top;
                }
            }
        });

        let size = observeSize((_, element) => {
            scroller = element;
            update(true);
        });

        // Line geometry and token colors, read from the rendered lines; folded lines take no height.
        function measure() {
            let content = scroller?.firstElementChild as HTMLElement | null,
                elements = content?.children;

            if (!map || !content || !elements?.length) {
                source = null;
                return;
            }

            let computed = getComputedStyle(content),
                fallback = computed.getPropertyValue('--color').trim() || 'currentColor',
                heights: number[] = [],
                lineHeight = pixels(getComputedStyle(elements[0]).lineHeight) || 20,
                tops: number[] = [];

            for (let i = 0, n = elements.length; i < n; i++) {
                let element = elements[i] as HTMLElement;

                if (element.hidden) {
                    heights.push(0);
                    tops.push(i ? tops[i - 1] + heights[i - 1] : 0);
                }
                else {
                    heights.push(element.offsetHeight);
                    tops.push(element.offsetTop);
                }
            }

            palette = {};

            for (let i = 0, n = TOKEN_COLORS.length; i < n; i++) {
                let kind = TOKEN_COLORS[i];

                palette[kind] = computed.getPropertyValue(`--${kind === 'color' ? 'literal' : kind}-color`).trim() || fallback;
            }

            source = {
                breaks: () => NO_BREAKS,
                count: tops.length,
                height: content.offsetHeight,
                indexAt: (y) => {
                    let hi = tops.length - 1,
                        lo = 0;

                    while (lo < hi) {
                        let mid = (lo + hi + 1) >>> 1;

                        if (tops[mid] <= y) {
                            lo = mid;
                        }
                        else {
                            hi = mid - 1;
                        }
                    }

                    return lo;
                },
                lineHeight,
                rows: (index) => Math.max(1, Math.round(heights[index] / lineHeight)),
                tabSize: pixels(computed.tabSize) || 4,
                text: (index) => heights[index] ? lines[index].text : '',
                tokens: (index) => lines[index].tokens,
                top: (index) => tops[index]
            };
            map.invalidate();
        }

        function render(text: string) {
            let folded = new Set<number>(),
                rows: { folded: boolean; hidden: boolean }[];

            lines = outline(text, lexer, { fold, whitespace });
            rows = lines.map(() => reactive({ folded: false, hidden: false }));

            let foldable = lines.some((line) => line.end !== -1);

            function toggle(index: number) {
                if (folded.has(index)) {
                    folded.delete(index);
                }
                else {
                    folded.add(index);
                }

                let next = hidden(lines, folded);

                for (let i = 0, n = rows.length; i < n; i++) {
                    rows[i].folded = folded.has(i);
                    rows[i].hidden = next[i];
                }

                update(true);
            }

            update(true);

            return html`
                <div class='code-viewer-lines' style='--digits: ${Math.max(3, String(lines.length).length)};'>
                    ${lines.map((line, index) => html`
                        <div class='code-viewer-line' hidden='${() => rows[index].hidden}'>
                            ${(lineNumbers || foldable) && html`
                                <span class='code-viewer-gutter'>
                                    ${lineNumbers && html`<span class='code-viewer-number'>${index + 1}</span>`}
                                    ${line.end > index
                                        ? html`
                                            <button
                                                class='code-viewer-fold'
                                                type='button'
                                                ${{
                                                    'aria-expanded': () => String(!rows[index].folded),
                                                    'aria-label': () => `${rows[index].folded ? 'Unfold' : 'Fold'} ${range(index, line.end)}`,
                                                    onclick: () => toggle(index)
                                                }}
                                            >
                                                ${icon({ 'aria-hidden': 'true', class: 'code-viewer-fold-icon' }, chevron)}
                                            </button>
                                        `
                                        : html`<span class='code-viewer-fold'></span>`}
                                </span>
                            `}
                            <code class='code-viewer-code' ${{ innerHTML: line.html }}></code>
                            ${line.end > index && html`
                                <button
                                    aria-label='Unfold ${range(index, line.end)}'
                                    class='code-viewer-placeholder'
                                    hidden='${() => !rows[index].folded}'
                                    type='button'
                                    ${{ onclick: () => toggle(index) }}
                                >…</button>
                            `}
                        </div>
                    `)}
                </div>
            `;
        }

        // Draws the minimap in the next frame; 'remeasure' rereads the lines first, after a render, fold or resize.
        function update(remeasure = false) {
            if (!map) {
                return;
            }

            stale ||= remeasure;

            if (frame) {
                return;
            }

            frame = requestAnimationFrame(() => {
                frame = 0;

                if (stale) {
                    stale = false;
                    measure();
                }

                if (map && rail && scroller && source) {
                    map.paint(
                        source,
                        { clientHeight: scroller.clientHeight, scrollHeight: scroller.scrollHeight, scrollTop: scroller.scrollTop },
                        palette,
                        rail.clientWidth
                    );
                }
            });
        }

        return html`
            <div
                class='code-viewer ${wrap ? 'code-viewer--wrap' : ''}'
                ${attributes}
                ${{
                    ondisconnect: () => {
                        cancelAnimationFrame(frame);
                        frame = 0;
                    }
                }}
            >
                ${(filename || copyable) && html`
                    <div class='code-viewer-header'>
                        ${filename && html`<span class='code-viewer-filename' title='${filename}'>${filename}</span>`}
                        ${copyable && copy({
                            class: 'code-viewer-copy',
                            error: 'Copy unavailable. Select and copy the code.',
                            label: 'Copy code',
                            success: 'Code copied',
                            value: current
                        })}
                    </div>
                `}
                <div class='code-viewer-body'>
                    <div
                        aria-label='${filename ?? 'Code'}'
                        class='code-viewer-scroller --scrollbar --scrollbar-hover'
                        role='region'
                        tabindex='0'
                        ${size}
                        ${{ onscroll: () => update() }}
                    >
                        ${() => {
                            let text = current();

                            return untrack(() => render(text));
                        }}
                    </div>
                    ${map && map.template({
                        onconnect: (element: HTMLElement) => {
                            rail = element;
                            update(true);
                        }
                    })}
                </div>
            </div>
        `;
    }
);
export type { CodeViewerAttributes };
