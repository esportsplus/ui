import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    format?: (value: number) => string;
    label?: string;
    max?: number;
    min?: number;
    prefix?: string;
    state?: State;
    step?: number;
    // Number of evenly spaced scale labels under the track.
    ticks?: number;
    value?: [number, number];
};

type Key = 'high' | 'low';

type State = { high: number; low: number };


const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const KEYS: Key[] = ['low', 'high'];


function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function snap(value: number, min: number, step: number) {
    return Math.round((value - min) / step) * step + min;
}


export default ({
    format = (value: number) => value.toLocaleString('en-US'),
    label = 'Price Range',
    max = 1000,
    min = 0,
    prefix = '$',
    state,
    step = 10,
    ticks = 5,
    value,
    ...attributes
}: A) => {
    let span = max - min || 1,
        s = state ?? reactive({
            high: value?.[1] ?? clamp(snap(min + span * 0.65, min, step), min, max),
            low: value?.[0] ?? clamp(snap(min + span * 0.15, min, step), min, max)
        }),
        drag = -1,
        labels: number[] = [],
        root: HTMLElement | undefined,
        thumbs: HTMLElement[] = [],
        ui = reactive({ dragging: -1, preview: -1 });

    for (let i = 0; i < ticks; i++) {
        let tick = snap(min + (i * span) / Math.max(1, ticks - 1), min, step);

        if (!labels.includes(tick)) {
            labels.push(tick);
        }
    }

    function commit(index: number, raw: number) {
        let next = clamp(snap(raw, min, step), min, max);

        // Thumbs meet but never pass, so each keeps the bound it started as.
        s[KEYS[index]] = index === 0 ? Math.min(next, s.high) : Math.max(next, s.low);
    }

    // The value under the pointer; the track maps edge to edge, like the range fill.
    function at(x: number) {
        if (!root) {
            return min;
        }

        let rect = root.getBoundingClientRect();

        return clamp(snap(((x - rect.left) / rect.width) * span + min, min, step), min, max);
    }

    function keydown(index: number, event: KeyboardEvent) {
        let big = step * 10,
            delta: Record<string, number> = {
                ArrowDown: -(event.shiftKey ? big : step),
                ArrowLeft: -(event.shiftKey ? big : step),
                ArrowRight: event.shiftKey ? big : step,
                ArrowUp: event.shiftKey ? big : step,
                End: Infinity,
                Home: -Infinity,
                PageDown: -big,
                PageUp: big
            };

        if (!(event.key in delta)) {
            return;
        }

        event.preventDefault();
        commit(index, clamp(s[KEYS[index]] + delta[event.key], min, max));
    }

    function pct(value: number) {
        return ((value - min) / span) * 100;
    }

    function release() {
        drag = -1;
        ui.dragging = -1;
    }

    // Digits roll on their own columns, right-aligned so the ones place never moves; columns a smaller number
    // doesn't need fold away to nothing.
    function roll(key: Key) {
        let width = format(max).length;

        function char(i: number) {
            let text = format(s[key]),
                pad = width - text.length;

            return i < pad ? '' : text[i - pad];
        }

        return html`
            <span class='range-filter-number'>
                <span class='range-filter-sr'>${() => format(s[key])}</span>
                <span aria-hidden='true' class='range-filter-columns'>
                    ${Array.from({ length: width }, (_, i) => html`
                        <span
                            class='range-filter-column'
                            ${{
                                class: () => {
                                    let c = char(i);

                                    return c === '' ? '--empty' : DIGITS.includes(c) ? '--digit' : '--symbol';
                                }
                            }}
                        >
                            <span class='range-filter-strip' style='${() => `--digit: ${DIGITS.includes(char(i)) ? char(i) : 0}`}'>
                                ${DIGITS.map((digit) => html`<span>${digit}</span>`)}
                            </span>
                            <span class='range-filter-symbol'>${() => DIGITS.includes(char(i)) ? '' : char(i)}</span>
                        </span>
                    `)}
                </span>
            </span>
        `;
    }

    return html`
        <div class='range-filter' ${attributes}>
            <div class='range-filter-header'>
                <div>
                    <p class='range-filter-label'>${label}</p>
                    <div class='range-filter-values'>
                        <span class='range-filter-value'>${prefix}${roll('low')}</span>
                        <span class='range-filter-dash'>–</span>
                        <span class='range-filter-value'>${prefix}${roll('high')}</span>
                    </div>
                </div>

                <button
                    class='range-filter-clear'
                    onclick='${() => {
                        s.low = min;
                        s.high = max;
                    }}'
                    type='button'
                    ${{ disabled: () => s.low === min && s.high === max }}
                >
                    <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
                        <path d='M18 6 6 18M6 6l12 12' />
                    </svg>
                    Clear
                </button>
            </div>

            <div class='range-filter-body'>
                <div
                    aria-label='${label}'
                    class='range-filter-root'
                    role='group'
                    ${{
                        class: () => ui.dragging !== -1 && '--dragging',
                        onlostpointercapture: release,
                        onpointercancel: release,
                        onpointerdown: (event: PointerEvent) => {
                            if (event.button !== 0 || !root) {
                                return;
                            }

                            let grabbed = (event.target as HTMLElement).closest<HTMLElement>('[data-thumb]'),
                                v = at(event.clientX),
                                index: number;

                            if (grabbed) {
                                index = Number(grabbed.dataset.thumb);
                            }
                            else {
                                let toHigh = Math.abs(v - s.high),
                                    toLow = Math.abs(v - s.low);

                                // Stacked thumbs tie, so the side of the press decides.
                                index = toLow === toHigh ? (v < s.low ? 0 : 1) : (toLow < toHigh ? 0 : 1);
                            }

                            event.preventDefault();
                            thumbs[index]?.focus({ preventScroll: true });
                            root.setPointerCapture(event.pointerId);
                            drag = index;
                            ui.dragging = index;
                            ui.preview = -1;
                            commit(index, v);
                        },
                        onpointerleave: () => {
                            ui.preview = -1;
                        },
                        onpointermove: (event: PointerEvent) => {
                            if (drag !== -1) {
                                commit(drag, at(event.clientX));
                                return;
                            }

                            // Touch has no hover, so there is nothing to preview.
                            if (event.pointerType === 'mouse') {
                                ui.preview = at(event.clientX);
                            }
                        },
                        onpointerup: release,
                        onrender: (element: HTMLElement) => {
                            root = element;
                        }
                    }}
                >
                    <div class='range-filter-track'>
                        <div class='range-filter-range' style='${() => `left: ${pct(s.low)}%; right: ${100 - pct(s.high)}%;`}'></div>
                    </div>

                    <div
                        aria-hidden='true'
                        class='range-filter-ghost'
                        ${{
                            // Hovering outside the selection shows how far it would stretch to reach the pointer.
                            class: () => (ui.preview !== -1 && (ui.preview < s.low || ui.preview > s.high)) && '--active',
                            style: () => {
                                let p = ui.preview;

                                if (p === -1 || (p >= s.low && p <= s.high)) {
                                    return '';
                                }

                                return p < s.low
                                    ? `left: ${pct(p)}%; width: ${pct(s.low) - pct(p)}%;`
                                    : `left: ${pct(s.high)}%; width: ${pct(p) - pct(s.high)}%;`;
                            }
                        }}
                    ></div>

                    ${KEYS.map((key, index) => html`
                        <div
                            aria-label='${`${index === 0 ? 'Minimum' : 'Maximum'} ${label.toLowerCase()}`}'
                            aria-valuemax='${max}'
                            aria-valuemin='${min}'
                            class='range-filter-thumb'
                            data-thumb='${index}'
                            role='slider'
                            tabindex='0'
                            ${{
                                'aria-valuenow': () => s[key],
                                'aria-valuetext': () => `${prefix}${format(s[key])}`,
                                class: () => ui.dragging === index && '--active',
                                onkeydown: (event: KeyboardEvent) => keydown(index, event),
                                onrender: (element: HTMLElement) => {
                                    thumbs[index] = element;
                                },
                                style: () => `--position: ${pct(s[key]) / 100}; z-index: ${ui.dragging === index || (index === 0 && s.low === max) ? 3 : 2};`
                            }}
                        ></div>
                    `)}
                </div>

                <div aria-hidden='true' class='range-filter-ticks'>
                    ${labels.map((tick) => html`<span>${prefix}${format(tick)}</span>`)}
                </div>
            </div>
        </div>
    `;
};

export type { State as RangeFilterState };
