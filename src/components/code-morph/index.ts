import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive, ReactiveArray } from '@esportsplus/reactivity';
import { write } from '~/components/clipboard';
import './scss/index.scss';


type A = Attributes & {
    [CODE_MORPH_TAB]?: Attributes;
    label?: string;
    state?: State;
    steps: Step[];
};

type Kind = 'comment' | 'fn' | 'keyword' | 'number' | 'plain' | 'punct' | 'string' | 'type';

type Phase = 'enter' | 'exit' | 'idle' | 'stay';

type Placed = {
    col: number;
    kind: Kind;
    phase: Phase;
    row: number;
    text: string;
};

type State = {
    step: number;
};

type Step = {
    code: string;
    label: string;
    title: string;
};

type Token = {
    col: number;
    kind: Kind;
    row: number;
    text: string;
};


const CODE_MORPH_TAB = Symbol.for('@esportsplus/ui/code-morph.tab');

const KEYWORDS = new Set('import from export default function return const let var if else new true false null undefined async await try catch finally throw typeof'.split(' '));

// Tokens sit on this grid, so it is also the distance a token travels when a line is inserted above it.
const LINE = 22;

const PAD = 16;

// Alternatives in priority order, so a number inside a string stays part of the string. Multi-character
// operators come first so `=>` moves as one piece rather than two.
const PATTERN = /(\/\/[^\n]*)|("[^"\n]*"|'[^'\n]*'|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)|(=>|===|!==|&&|\|\||\?\.|\.\.\.|[^\s\w])/g;

// Long enough to notice the check, short enough to copy again soon.
const RESET = 1600;


let uid = 0;


function instant(element: HTMLElement, update: VoidFunction) {
    element.classList.add('--instant');
    update();
    getComputedStyle(element).opacity;
    element.classList.remove('--instant');
}

// Longest common subsequence over token text and kind. Returns, for every token in `b`, the index of its
// partner in `a`, or -1 when it is new.
function match(a: { kind: Kind; text: string }[], b: Token[]) {
    let m = b.length,
        n = a.length,
        w = m + 1,
        dp = new Uint16Array((n + 1) * w),
        pairs = new Array<number>(m).fill(-1);

    function same(i: number, j: number) {
        return a[i].text === b[j].text && a[i].kind === b[j].kind;
    }

    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i * w + j] = same(i, j) ? dp[(i + 1) * w + j + 1] + 1 : Math.max(dp[(i + 1) * w + j], dp[i * w + j + 1]);
        }
    }

    let i = 0,
        j = 0;

    while (i < n && j < m) {
        if (same(i, j)) {
            pairs[j] = i;
            i++;
            j++;
        }
        else if (dp[(i + 1) * w + j] >= dp[i * w + j + 1]) {
            i++;
        }
        else {
            j++;
        }
    }

    return pairs;
}

// Whitespace never becomes a token: it only advances the cursor, so re-indenting a line moves its tokens
// rather than replacing them.
function tokenize(code: string) {
    let col = 0,
        last = 0,
        row = 0,
        tokens: Token[] = [];

    function advance(text: string) {
        for (let i = 0, n = text.length; i < n; i++) {
            if (text[i] === '\n') {
                col = 0;
                row++;
            }
            else {
                col++;
            }
        }
    }

    for (let m of code.matchAll(PATTERN)) {
        let index = m.index ?? 0,
            kind: Kind = 'plain',
            text = m[0];

        advance(code.slice(last, index));

        if (m[1]) {
            kind = 'comment';
        }
        else if (m[2]) {
            kind = 'string';
        }
        else if (m[3]) {
            kind = 'number';
        }
        else if (m[5]) {
            kind = 'punct';
        }
        else if (KEYWORDS.has(text)) {
            kind = 'keyword';
        }
        else if (code[index + text.length] === '(') {
            kind = 'fn';
        }
        else if (/^[A-Z]/.test(text)) {
            kind = 'type';
        }

        tokens.push({ col, kind, row, text });
        advance(text);
        last = index + text.length;
    }

    return tokens;
}


function template(this: { attributes?: Partial<A> } | void, { label = 'Tutorial steps', state = reactive({ step: 0 }), steps, ...attributes }: A) {
    let applied = -1,
        attempt = 0,
        cols = 0,
        copy = reactive({ status: 'idle' as 'copied' | 'failed' | 'idle' }),
        id = `code-morph-${++uid}`,
        items = new ReactiveArray<Placed>(),
        observer: ResizeObserver | undefined,
        // The live tokens in source order; `items` only renders them, in whatever order they arrived.
        ordered: Placed[] = [],
        pill: HTMLElement | undefined,
        rows: number[] = [],
        sources = steps.map((step) => step.code.trim()),
        tabs: HTMLElement[] = [],
        timer: ReturnType<typeof setTimeout> | undefined,
        tokens = sources.map(tokenize),
        view = reactive({ added: new Set<number>(), step: 0 });

    for (let i = 0, n = sources.length; i < n; i++) {
        let lines = sources[i].split('\n');

        rows.push(lines.length);

        for (let j = 0, o = lines.length; j < o; j++) {
            cols = Math.max(cols, lines[j].length);
        }
    }

    let height = Math.max(...rows);

    function apply(next: number) {
        if (next === applied || !tokens[next]) {
            return;
        }

        let initial = applied === -1;

        applied = next;
        view.step = next;
        place();

        if (initial) {
            ordered = tokens[next].map((token) => reactive({ col: token.col, kind: token.kind, phase: 'idle' as Phase, row: token.row, text: token.text }));
            items.push(...ordered);
            return;
        }

        // Tokens still fading out from the last change are dropped: they are already leaving and would
        // only muddy this diff.
        for (let i = items.length - 1; i >= 0; i--) {
            if (items[i].phase === 'exit') {
                items.splice(i, 1);
            }
        }

        let added = new Set<number>(),
            previous = ordered,
            target = tokens[next],
            pairs = match(previous, target),
            used = new Set<number>();

        ordered = [];

        for (let j = 0, n = target.length; j < n; j++) {
            let partner = pairs[j],
                token = target[j];

            if (partner >= 0) {
                let item = previous[partner];

                item.col = token.col;
                item.phase = 'stay';
                item.row = token.row;
                ordered.push(item);
                used.add(partner);
                continue;
            }

            let item = reactive({ col: token.col, kind: token.kind, phase: 'enter' as Phase, row: token.row, text: token.text });

            added.add(token.row);
            items.push(item);
            ordered.push(item);
        }

        for (let i = 0, n = previous.length; i < n; i++) {
            if (!used.has(i)) {
                previous[i].phase = 'exit';
            }
        }

        view.added = added;
    }

    async function clip() {
        let n = ++attempt;

        // Confirms on press: the write is near instant and waiting reads as lag.
        show('copied');

        if (!(await write(sources[view.step])) && n === attempt) {
            show('failed');
        }
    }

    function place() {
        let tab = tabs[applied];

        if (!pill || !tab) {
            return;
        }

        pill.style.translate = `${tab.offsetLeft}px 0`;
        pill.style.width = `${tab.offsetWidth}px`;
    }

    function show(status: 'copied' | 'failed') {
        clearTimeout(timer);
        copy.status = status;
        timer = setTimeout(() => {
            copy.status = 'idle';
        }, RESET);
    }

    let stop = effect(() => {
        apply(state.step);
    });

    onCleanup(() => {
        clearTimeout(timer);
        observer?.disconnect();
        stop();
    });

    return html`
        <div class='code-morph' ${this?.attributes} ${attributes}>
            <div class='code-morph-header'>
                <div
                    class='code-morph-tabs'
                    role='tablist'
                    ${{
                        'aria-label': label,
                        onconnect: (element: HTMLElement) => {
                            if (pill) {
                                instant(pill, place);
                            }

                            observer = new ResizeObserver(() => {
                                if (pill) {
                                    instant(pill, place);
                                }
                            });
                            observer.observe(element);
                        },
                        onkeydown: (e: KeyboardEvent) => {
                            let end = steps.length - 1,
                                next = ({
                                    ArrowLeft: applied === 0 ? end : applied - 1,
                                    ArrowRight: applied === end ? 0 : applied + 1,
                                    End: end,
                                    Home: 0
                                } as Record<string, number>)[e.key];

                            if (next === undefined) {
                                return;
                            }

                            e.preventDefault();
                            state.step = next;
                            tabs[next]?.focus();
                        }
                    }}
                >
                    <span
                        aria-hidden='true'
                        class='code-morph-pill'
                        ${{ onrender: (element: HTMLElement) => { pill = element; } }}
                    ></span>
                    ${steps.map((step, i) => html`
                        <button
                            class='code-morph-tab ${() => view.step === i && '--active'}'
                            id='${id}-tab-${i}'
                            role='tab'
                            type='button'
                            ${this?.attributes?.[CODE_MORPH_TAB]}
                            ${attributes[CODE_MORPH_TAB]}
                            ${{
                                'aria-controls': `${id}-panel`,
                                'aria-selected': () => String(view.step === i),
                                onclick: () => {
                                    state.step = i;
                                },
                                onrender: (element: HTMLElement) => {
                                    tabs[i] = element;
                                },
                                tabindex: () => view.step === i ? 0 : -1
                            }}
                        >
                            <span class='code-morph-tab-label'>${step.label}</span>
                        </button>
                    `)}
                </div>

                <button
                    aria-label='Copy this step'
                    class='code-morph-copy ${() => copy.status === 'copied' && '--copied'}'
                    type='button'
                    ${{ onclick: clip }}
                >
                    <svg
                        aria-hidden='true'
                        class='code-morph-icon code-morph-icon--copy'
                        fill='none'
                        stroke='currentColor'
                        stroke-linecap='round'
                        stroke-linejoin='round'
                        stroke-width='1.5'
                        viewBox='0 0 16 16'
                    >
                        <rect height='8' rx='1.75' width='8' x='5.25' y='5.25' />
                        <path d='M10.75 5.25V4a1.25 1.25 0 0 0-1.25-1.25H4A1.25 1.25 0 0 0 2.75 4v5.5A1.25 1.25 0 0 0 4 10.75h1.25' />
                    </svg>
                    <svg
                        aria-hidden='true'
                        class='code-morph-icon code-morph-icon--check'
                        fill='none'
                        stroke='currentColor'
                        stroke-linecap='round'
                        stroke-linejoin='round'
                        stroke-width='1.5'
                        viewBox='0 0 16 16'
                    >
                        <path d='M3.5 8.5 6.5 11.5 12.5 4.5' />
                    </svg>
                </button>
                <span class='code-morph-sr' role='status'>
                    ${() => copy.status === 'copied' ? 'Copied' : copy.status === 'failed' ? "Couldn't copy" : ''}
                </span>
            </div>

            <div
                class='code-morph-panel'
                id='${id}-panel'
                role='tabpanel'
                tabindex='0'
                ${{ 'aria-labelledby': () => `${id}-tab-${view.step}` }}
            >
                <pre class='code-morph-sr'>${() => sources[view.step]}</pre>
                <div
                    aria-hidden='true'
                    class='code-morph-code'
                    style='${() => `height: ${rows[view.step] * LINE + PAD * 2}px`}'
                >
                    ${Array.from({ length: height }, (_, row) => html`
                        <span
                            class='code-morph-added ${() => view.added.has(row) && '--active'}'
                            style='top: ${PAD + row * LINE}px'
                        ></span>
                    `)}
                    <div class='code-morph-gutter'>
                        ${Array.from({ length: height }, (_, row) => html`
                            <div class='code-morph-number ${() => row >= rows[view.step] && '--hidden'}'>${row + 1}</div>
                        `)}
                    </div>
                    <div class='code-morph-tokens' style='width: calc(${cols}ch + 20px)'>
                        ${html.reactive(items, (item) => html`
                            <span
                                class='code-morph-token code-morph-token--${item.kind} ${() => item.phase === 'enter' && '--enter'} ${() => item.phase === 'exit' && '--exit'}'
                                style='${() => `transform: translate(${item.col}ch, ${item.row * LINE}px)`}'
                            >${item.text}</span>
                        `)}
                    </div>
                </div>
            </div>

            <div class='code-morph-footer'>
                <span class='code-morph-count'>${() => `${view.step + 1}/${steps.length}`}</span>
                <div class='code-morph-titles'>
                    ${steps.map((step, i) => html`
                        <span aria-hidden='${() => String(view.step !== i)}' class='code-morph-title ${() => view.step === i && '--active'}'>
                            ${step.title}
                        </span>
                    `)}
                </div>
            </div>
        </div>
    `;
}


export default Object.assign(template, { tab: CODE_MORPH_TAB } as const);
export type { State as CodeMorphState, Step as CodeMorphStep };
