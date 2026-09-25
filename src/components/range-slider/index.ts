import { html, type Attributes } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import input from '~/components/input';
import './scss/index.scss';


type A = Attributes & {
    [RANGE_SLIDER_INPUT]?: Parameters<typeof input>[0];
    [RANGE_SLIDER_THUMB]?: Attributes;
    format?: (value: number) => string;
    label: string;
    max?: number;
    min?: number;
    prefix?: string;
    state?: State;
    step?: number;
    value?: [number, number];
};

type Drag = { gliding: boolean, offset: number, thumb: Thumb };

type State = { high: number, low: number };

type Thumb = 0 | 1;


const KEYS = ['low', 'high'] as const;

const RANGE_SLIDER_INPUT = Symbol.for('@esportsplus/ui/range-slider.input');

const RANGE_SLIDER_THUMB = Symbol.for('@esportsplus/ui/range-slider.thumb');


function clamp(value: number, lo: number, hi: number) {
    return Math.min(Math.max(value, lo), hi);
}

function template(
    this: { attributes?: Partial<A> } | void,
    { format = String, label, max = 100, min = 0, prefix = '', state, step = 1, value, ...attributes }: A
) {
    let decimals = (String(step).split('.')[1] || '').length,
        defaults = this?.attributes,
        drag: Drag | null = null,
        name = label.toLowerCase(),
        s = state || reactive({ high: value?.[1] ?? max, low: value?.[0] ?? min }),
        span = max - min,
        thumbs: HTMLElement[] = [],
        track: HTMLElement | undefined,
        ui = reactive({ dragging: -1, gliding: false });

    // Thumbs stop at each other rather than push; in a filter, pushing would quietly change the bound the user isn't touching.
    function commit(thumb: Thumb, raw: number) {
        let next = Number((Math.round((raw - min) / step) * step + min).toFixed(decimals)),
            bounded = thumb === 0 ? clamp(next, min, s.high - step) : clamp(next, s.low + step, max);

        if (bounded === s[KEYS[thumb]]) {
            return;
        }

        s[KEYS[thumb]] = bounded;
    }

    function end() {
        drag = null;
        ui.dragging = -1;
        ui.gliding = false;
    }

    function field(thumb: Thumb) {
        let draft = reactive({ value: null as string | null }),
            key = KEYS[thumb];

        function save() {
            if (draft.value === null) {
                return;
            }

            let parsed = Number(draft.value.replace(/[^\d.]/g, ''));

            if (draft.value.trim() !== '' && Number.isFinite(parsed)) {
                commit(thumb, parsed);
            }

            draft.value = null;
        }

        return html`
            <label class='range-slider-field'>
                <span class='range-slider-field-label'>${thumb === 0 ? 'Min' : 'Max'}</span>
                ${prefix && html`<span class='range-slider-field-prefix' aria-hidden='true'>${prefix}</span>`}
                ${input({
                    'aria-label': `${thumb === 0 ? 'Minimum' : 'Maximum'} ${name}`,
                    autocomplete: 'off',
                    class: 'range-slider-input',
                    inputmode: 'numeric',
                    onblur: save,
                    oninput: (e: Event) => {
                        draft.value = (e.target as HTMLInputElement).value;
                    },
                    onkeydown: (e: KeyboardEvent) => {
                        if (e.key === 'Enter') {
                            save();
                        }
                        else if (e.key === 'Escape') {
                            draft.value = null;
                        }
                    },
                    value: () => draft.value ?? String(s[key]),
                    ...defaults?.[RANGE_SLIDER_INPUT],
                    ...attributes[RANGE_SLIDER_INPUT]
                })}
            </label>
        `;
    }

    function fraction(x: number) {
        if (!track) {
            return 0;
        }

        let box = track.getBoundingClientRect();

        return clamp((x - box.left) / box.width, 0, 1);
    }

    function handle(thumb: Thumb) {
        let key = KEYS[thumb];

        return html`
            <div
                class='range-slider-handle range-slider-handle--${key}'
                ${{
                    // The active thumb sits on top; at rest the one nearer an end yields, so stacked thumbs can always be pulled apart.
                    class: () => (ui.dragging === -1 ? (thumb === 0) === (s.low > (min + max) / 2) : ui.dragging === thumb) && '--raised'
                }}
            >
                <div
                    aria-label='${`${thumb === 0 ? 'Minimum' : 'Maximum'} ${name}`}'
                    aria-valuemax='${max}'
                    aria-valuemin='${min}'
                    class='range-slider-thumb'
                    data-thumb='${thumb}'
                    role='slider'
                    tabindex='0'
                    ${defaults?.[RANGE_SLIDER_THUMB]}
                    ${attributes[RANGE_SLIDER_THUMB]}
                    ${{
                        'aria-valuenow': () => s[key],
                        'aria-valuetext': () => format(s[key]),
                        class: () => ui.dragging === thumb && '--active',
                        onkeydown: (e: KeyboardEvent) => keydown(thumb, e),
                        onrender: (element: HTMLElement) => {
                            thumbs[thumb] = element;
                        }
                    }}
                >
                    <span class='range-slider-tooltip' aria-hidden='true'>${() => format(s[key])}</span>
                </div>
            </div>
        `;
    }

    function keydown(thumb: Thumb, e: KeyboardEvent) {
        let big = step * 10,
            delta: Record<string, number> = {
                ArrowDown: e.shiftKey ? -big : -step,
                ArrowLeft: e.shiftKey ? -big : -step,
                ArrowRight: e.shiftKey ? big : step,
                ArrowUp: e.shiftKey ? big : step,
                End: Infinity,
                Home: -Infinity,
                PageDown: -big,
                PageUp: big
            };

        if (!(e.key in delta)) {
            return;
        }

        e.preventDefault();
        commit(thumb, clamp(s[KEYS[thumb]] + delta[e.key], min, max));
    }

    return html`
        <div
            class='range-slider'
            ${defaults}
            ${attributes}
            ${{
                class: () => ui.dragging !== -1 && !ui.gliding && '--dragging',
                style: () => `--high: ${(s.high - min) / span}; --low: ${(s.low - min) / span};`
            }}
        >
            <div class='range-slider-header'>
                <span class='range-slider-label'>${label}</span>
                <span class='range-slider-summary'>${() => `${format(s.low)} to ${format(s.high)}`}</span>
            </div>

            <div
                aria-label='${label}'
                class='range-slider-track'
                role='group'
                ${{
                    onlostpointercapture: end,
                    onpointercancel: end,
                    onpointerdown: (e: PointerEvent) => {
                        if (e.button !== 0 || !track) {
                            return;
                        }

                        let f = fraction(e.clientX),
                            grabbed = (e.target as HTMLElement).closest<HTMLElement>('[data-thumb]'),
                            thumb: Thumb;

                        if (grabbed) {
                            thumb = Number(grabbed.dataset.thumb) as Thumb;
                        }
                        else {
                            let high = (s.high - min) / span,
                                low = (s.low - min) / span,
                                toHigh = Math.abs(f - high),
                                toLow = Math.abs(f - low);

                            // Stacked thumbs tie, so the side of the click decides.
                            thumb = toLow === toHigh ? (f < low ? 0 : 1) : (toLow < toHigh ? 0 : 1);
                        }

                        e.preventDefault();
                        thumbs[thumb]?.focus({ preventScroll: true });
                        track.setPointerCapture(e.pointerId);

                        // Grabbing a thumb off-center keeps that offset, so it never jumps.
                        drag = {
                            gliding: !grabbed,
                            offset: grabbed ? f - (s[KEYS[thumb]] - min) / span : 0,
                            thumb
                        };
                        ui.dragging = thumb;
                        ui.gliding = !grabbed;

                        if (!grabbed) {
                            commit(thumb, min + f * span);
                        }
                    },
                    onpointermove: (e: PointerEvent) => {
                        if (!drag) {
                            return;
                        }

                        commit(drag.thumb, min + (fraction(e.clientX) - drag.offset) * span);
                    },
                    onpointerup: end,
                    onrender: (element: HTMLElement) => {
                        track = element;
                    }
                }}
            >
                <div class='range-slider-rail'>
                    <div class='range-slider-fill'></div>
                </div>
                ${handle(0)}
                ${handle(1)}
            </div>

            <div class='range-slider-fields'>
                ${field(0)}
                <span class='range-slider-dash' aria-hidden='true'></span>
                ${field(1)}
            </div>
        </div>
    `;
}


export default Object.assign(template, { input: RANGE_SLIDER_INPUT, thumb: RANGE_SLIDER_THUMB } as const);
export type { State };
