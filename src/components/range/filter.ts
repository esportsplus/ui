import { computed, reactive, read } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { clamp } from '~/shared/clamp';
import { keystep } from '~/shared/keystep';
import input from '~/components/input';
import close from '@esportsplus/ui/svg/close.svg';


type A = Attributes & {
    disabled?: boolean;
    // Editable fields under the scale for typing an exact bound.
    fields?: boolean;
    format?: (value: number) => string;
    label?: string;
    max?: number;
    min?: number;
    orientation?: 'horizontal' | 'vertical';
    prefix?: string;
    state?: State;
    step?: number;
    // Number of evenly spaced scale labels under the track.
    ticks?: number;
    // A single number gives one thumb that fills from `min`; a pair gives a range.
    value?: number | [number, number];
};

type Key = 'high' | 'low';

type State = { high: number; low: number };

type Thumb = HTMLElement & { [INDEX]: number };


const NON_NUMERIC_CHARACTERS = /[^\d.-]/g;


const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

const INDEX = Symbol();

const KEYS: Key[] = ['low', 'high'];


// Rounded to the step's own precision, so fractional steps never drift into float noise.
function snap(value: number, min: number, step: number) {
    return Number((Math.round((value - min) / step) * step + min).toFixed((String(step).split('.')[1] || '').length));
}


export default ({
    disabled = false,
    fields = false,
    format = (value: number) => value.toLocaleString('en-US'),
    label = 'Price Range',
    max = 1000,
    min = 0,
    orientation = 'horizontal',
    prefix = '$',
    state,
    step = 10,
    ticks = 5,
    value,
    ...attributes
}: A) => {
    let vertical = orientation === 'vertical',
        single = typeof value === 'number',
        span = max - min || 1,
        s = state ?? reactive({
            high: typeof value === 'number' ? value : value?.[1] ?? clamp(snap(min + span * 0.65, min, step), min, max),
            low: typeof value === 'number' ? min : value?.[0] ?? clamp(snap(min + span * 0.15, min, step), min, max)
        }),
        indices = single ? [1] : [0, 1],
        labels: number[] = [],
        // The pointer dragging; another finger's moves are ignored.
        pointer = -1,
        root: HTMLElement | undefined,
        thumbs: HTMLElement[] = [],
        ui = reactive({ dragging: -1, preview: -1 }),
        // Negative and fractional values can outgrow `max`, so the digit columns size to the widest extreme.
        width = Math.max(...[min, max, min + step, max - step].map((v) => format(snap(v, min, step)).length));

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

    // Vertical thumb centres stop half a thumb inside each end of the control.
    function at(event: PointerEvent) {
        if (!root) {
            return min;
        }

        let rect = root.getBoundingClientRect(),
            thumb = vertical ? thumbs[indices[0]]?.offsetHeight ?? 0 : 0,
            fraction = vertical
                ? (rect.bottom - event.clientY - thumb / 2) / Math.max(1, rect.height - thumb)
                : (event.clientX - rect.left) / rect.width;

        return clamp(snap(fraction * span + min, min, step), min, max);
    }

    function field(index: number) {
        let draft = reactive({ value: null as string | null }),
            key = KEYS[index];

        function save() {
            if (draft.value === null) {
                return;
            }

            let parsed = Number(draft.value.replace(NON_NUMERIC_CHARACTERS, ''));

            if (draft.value.trim() !== '' && Number.isFinite(parsed)) {
                commit(index, parsed);
            }

            draft.value = null;
        }

        return html`
            <label class='range-filter-field'>
                <span class='range-filter-field-label'>${single ? 'Value' : index === 0 ? 'Min' : 'Max'}</span>
                ${prefix && html`<span aria-hidden='true' class='range-filter-field-prefix'>${prefix}</span>`}
                ${input({
                    'aria-label': single ? label : `${index === 0 ? 'Minimum' : 'Maximum'} ${label.toLowerCase()}`,
                    autocomplete: 'off',
                    class: 'range-filter-input',
                    disabled,
                    inputmode: 'decimal',
                    onblur: save,
                    oninput: (event: Event) => {
                        draft.value = (event.target as HTMLInputElement).value;
                    },
                    onkeydown: (event: KeyboardEvent) => {
                        if (event.key === 'Enter') {
                            save();
                        }
                        else if (event.key === 'Escape') {
                            draft.value = null;
                        }
                    },
                    value: () => draft.value ?? String(s[key])
                })}
            </label>
        `;
    }

    function keydown(index: number, event: KeyboardEvent) {
        if (disabled) {
            return;
        }

        let delta = keystep(event, step);

        if (delta === null) {
            return;
        }

        event.preventDefault();
        commit(index, clamp(s[KEYS[index]] + delta, min, max));
    }

    function pct(value: number) {
        return ((value - min) / span) * 100;
    }

    function release(event: PointerEvent) {
        if (event.pointerId !== pointer) {
            return;
        }

        pointer = -1;
        ui.dragging = -1;
    }

    // Digits roll on their own columns, right-aligned so the ones place never moves; columns a smaller number
    // doesn't need fold away to nothing. A drag commits on every pointer move, so the number is formatted once per
    // change and only the columns whose character changed re-render.
    function roll(key: Key) {
        let text = computed(() => format(s[key]));

        return html`
            <span class='range-filter-number'>
                <span class='range-filter-sr'>${() => read(text)}</span>
                <span aria-hidden='true' class='range-filter-columns'>
                    ${Array.from({ length: width }, (_, i) => {
                        let char = computed(() => {
                                let value = read(text),
                                    pad = width - value.length;

                                return i < pad ? '' : value[i - pad];
                            });

                        return html`
                            <span
                                class='range-filter-column'
                                ${{
                                    class: () => {
                                        let c = read(char);

                                        return c === '' ? 'range-filter-column--empty' : DIGITS.includes(c) ? 'range-filter-column--digit' : 'range-filter-column--symbol';
                                    }
                                }}
                            >
                                <span class='range-filter-strip' style='${() => `--digit: ${DIGITS.includes(read(char)) ? read(char) : 0}`}'>
                                    ${DIGITS.map((digit) => html`<span>${digit}</span>`)}
                                </span>
                                <span class='range-filter-symbol'>${() => !DIGITS.includes(read(char)) && read(char)}</span>
                            </span>
                        `;
                    })}
                </span>
            </span>
        `;
    }

    return html`
        <div class='range-filter ${vertical && 'range--vertical'} ${disabled && '--disabled'}' ${attributes}>
            <div class='range-filter-header'>
                <div>
                    <p class='range-filter-label'>${label}</p>
                    <div class='range-filter-values'>
                        ${!single && html`
                            <span class='range-filter-value'>${prefix}${roll('low')}</span>
                            <span class='range-filter-dash'>–</span>
                        `}
                        <span class='range-filter-value'>${prefix}${roll('high')}</span>
                    </div>
                </div>

                <button
                    class='range-filter-clear'
                    onclick='${() => {
                        s.low = min;
                        s.high = single ? min : max;
                    }}'
                    type='button'
                    ${{ disabled: () => disabled || (s.low === min && s.high === (single ? min : max)) }}
                >
                    <svg aria-hidden='true'><use href='#${close}' /></svg>
                    Clear
                </button>
            </div>

            <div class='range-filter-body'>
                <div
                    aria-label='${label}'
                    class='range-filter-root'
                    role='group'
                    ${{
                        class: () => ui.dragging !== -1 && 'range-filter-root--dragging',
                        onconnect: (element: HTMLElement) => {
                            root = element;
                        },
                        onlostpointercapture: release,
                        onpointercancel: release,
                        onpointerdown: (event: PointerEvent) => {
                            if (disabled || event.button !== 0 || !root || pointer !== -1) {
                                return;
                            }

                            let grabbed = (event.target as HTMLElement).closest<Thumb>('.range-filter-thumb'),
                                v = at(event),
                                index: number;

                            if (grabbed) {
                                index = grabbed[INDEX];
                            }
                            else if (single) {
                                index = 1;
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
                            pointer = event.pointerId;
                            ui.dragging = index;
                            ui.preview = -1;
                            commit(index, v);
                        },
                        onpointerleave: () => {
                            ui.preview = -1;
                        },
                        onpointermove: (event: PointerEvent) => {
                            if (ui.dragging !== -1) {
                                if (event.pointerId === pointer) {
                                    commit(ui.dragging, at(event));
                                }

                                return;
                            }

                            // Touch has no hover, so there is nothing to preview.
                            if (!disabled && event.pointerType === 'mouse') {
                                ui.preview = at(event);
                            }
                        },
                        onpointerup: release
                    }}
                >
                    <div class='range-filter-track'>
                        <div class='range-filter-range' style='${() => vertical
                            ? `bottom: ${pct(s.low)}%; top: ${100 - pct(s.high)}%;`
                            : `left: ${pct(s.low)}%; right: ${100 - pct(s.high)}%;`}'></div>
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

                                let start = vertical ? 'bottom' : 'left',
                                    size = vertical ? 'height' : 'width';

                                return p < s.low
                                    ? `${start}: ${pct(p)}%; ${size}: ${pct(s.low) - pct(p)}%;`
                                    : `${start}: ${pct(s.high)}%; ${size}: ${pct(p) - pct(s.high)}%;`;
                            }
                        }}
                    ></div>

                    ${indices.map((index) => {
                        let key = KEYS[index];

                        return html`
                            <div
                                aria-disabled='${disabled}'
                                aria-orientation='${orientation}'
                                aria-label='${single ? label : `${index === 0 ? 'Minimum' : 'Maximum'} ${label.toLowerCase()}`}'
                                aria-valuemax='${max}'
                                aria-valuemin='${min}'
                                class='range-filter-thumb'
                                role='slider'
                                tabindex='${disabled ? -1 : 0}'
                                ${{
                                    'aria-valuenow': () => s[key],
                                    'aria-valuetext': () => `${prefix}${format(s[key])}`,
                                    class: [
                                        () => ui.dragging === index && '--active',
                                        () => index === 0 && s.low === max && 'range-filter-thumb--stacked'
                                    ],
                                    onconnect: (element: Thumb) => {
                                        element[INDEX] = index;
                                        thumbs[index] = element;
                                    },
                                    onkeydown: (event: KeyboardEvent) => keydown(index, event),
                                    style: () => `--position: ${pct(s[key]) / 100};`
                                }}
                            ></div>
                        `;
                    })}
                </div>

                <div aria-hidden='true' class='range-filter-ticks'>
                    ${labels.map((tick) => html`<span>${prefix}${format(tick)}</span>`)}
                </div>
            </div>

            ${fields && html`
                <div class='range-filter-fields'>
                    ${single ? field(1) : html`
                        ${field(0)}
                        <span aria-hidden='true' class='range-filter-separator'></span>
                        ${field(1)}
                    `}
                </div>
            `}
        </div>
    `;
};

export type { State as RangeFilterState };
