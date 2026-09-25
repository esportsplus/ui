import { reactive } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


type A = Attributes & {
    disabled?: boolean;
    format?: (value: number) => string;
    label?: string;
    // Step for PageUp/PageDown and Shift+Arrow.
    largeStep?: number;
    max?: number;
    min?: number;
    // Submits each value as a hidden field; ranges submit two fields under the same name.
    name?: string;
    orientation?: 'horizontal' | 'vertical';
    // Shows the current value (or range) beside the label.
    output?: boolean;
    state?: State;
    step?: number;
    value?: number | [number, number];
};

type Key = 'high' | 'low' | 'value';

type State = { value: number } | { high: number; low: number };


function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}


export default ({
    disabled = false,
    format = String,
    label,
    largeStep = 10,
    max = 100,
    min = 0,
    name,
    orientation = 'horizontal',
    output = false,
    state,
    step = 1,
    value,
    ...attributes
}: A) => {
    let range = Array.isArray(value) || (!!state && 'low' in state),
        keys: Key[] = range ? ['low', 'high'] : ['value'],
        // Holds every key so one literal serves both shapes; only the keys in use are read.
        s = (state ?? reactive({
            high: Array.isArray(value) ? value[1] : max,
            low: Array.isArray(value) ? value[0] : min,
            value: Array.isArray(value) ? min : (value ?? min)
        })) as Record<Key, number>,
        control: HTMLElement | undefined,
        decimals = (String(step).split('.')[1] || '').length,
        drag = -1,
        span = max - min || 1,
        thumbs: HTMLElement[] = [],
        ui = reactive({ dragging: -1 }),
        vertical = orientation === 'vertical';

    function commit(index: number, raw: number) {
        let next = Number((Math.round((clamp(raw, min, max) - min) / step) * step + min).toFixed(decimals));

        // Thumbs meet but never pass each other, so each keeps the bound it started as.
        if (range) {
            next = index === 0 ? Math.min(next, s.high) : Math.max(next, s.low);
        }

        s[keys[index]] = next;
    }

    function fraction(event: PointerEvent) {
        if (!control) {
            return 0;
        }

        let rect = control.getBoundingClientRect(),
            size = parseFloat(getComputedStyle(control).getPropertyValue('--thumb-size')) || 0,
            // Edge alignment: the thumb centre travels between half a thumb in from each end, never past the track.
            f = vertical
                ? (rect.bottom - size / 2 - event.clientY) / (rect.height - size)
                : (event.clientX - rect.left - size / 2) / (rect.width - size);

        if (!vertical && getComputedStyle(control).direction === 'rtl') {
            f = 1 - f;
        }

        return clamp(f, 0, 1);
    }

    function keydown(index: number, event: KeyboardEvent) {
        let big = largeStep,
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
        commit(index, clamp(s[keys[index]] + delta[event.key], min, max));
    }

    function percent(key: Key) {
        return (s[key] - min) / span;
    }

    function readout() {
        return keys.map((key) => format(s[key])).join(' – ');
    }

    function release() {
        drag = -1;
        ui.dragging = -1;
    }

    return html`
        <div
            aria-disabled='${disabled && 'true'}'
            class='slider slider--${orientation} ${disabled && '--disabled'}'
            ${attributes}
            ${{
                class: () => ui.dragging !== -1 && '--dragging'
            }}
        >
            ${(label || output) && html`
                <div class='slider-header'>
                    ${label && html`<span class='slider-label'>${label}</span>`}
                    ${output && html`<output class='slider-output'>${readout}</output>`}
                </div>
            `}

            <div
                class='slider-control'
                ${{
                    onlostpointercapture: release,
                    onpointercancel: release,
                    onpointerdown: (event: PointerEvent) => {
                        if (disabled || event.button !== 0 || !control) {
                            return;
                        }

                        let f = fraction(event),
                            grabbed = (event.target as HTMLElement).closest<HTMLElement>('[data-thumb]'),
                            index = 0;

                        if (grabbed) {
                            index = Number(grabbed.dataset.thumb);
                        }
                        else if (range) {
                            let high = percent('high'),
                                low = percent('low');

                            // Stacked thumbs tie, so the side of the press decides which one moves.
                            index = Math.abs(f - low) === Math.abs(f - high) ? (f < low ? 0 : 1) : (Math.abs(f - low) < Math.abs(f - high) ? 0 : 1);
                        }

                        event.preventDefault();
                        thumbs[index]?.focus({ preventScroll: true });
                        control.setPointerCapture(event.pointerId);
                        drag = index;
                        ui.dragging = index;
                        commit(index, min + f * span);
                    },
                    onpointermove: (event: PointerEvent) => {
                        if (drag === -1) {
                            return;
                        }

                        commit(drag, min + fraction(event) * span);
                    },
                    onpointerup: release,
                    onrender: (element: HTMLElement) => {
                        control = element;
                    }
                }}
            >
                <div class='slider-track'>
                    <div
                        class='slider-indicator ${!range && 'slider-indicator--single'}'
                        style='${() => range
                            ? `--end: ${percent('high')}; --start: ${percent('low')};`
                            : `--end: ${percent('value')};`}'
                    ></div>

                    ${keys.map((key, index) => html`
                        <div
                            aria-label='${range ? `${index === 0 ? 'Minimum' : 'Maximum'}${label ? ` ${label.toLowerCase()}` : ''}` : (label ?? 'Value')}'
                            aria-orientation='${orientation}'
                            aria-valuemax='${max}'
                            aria-valuemin='${min}'
                            class='slider-thumb'
                            data-thumb='${index}'
                            role='slider'
                            tabindex='${disabled ? -1 : 0}'
                            ${{
                                'aria-valuenow': () => s[key],
                                'aria-valuetext': () => format(s[key]),
                                class: () => ui.dragging === index && '--active',
                                onkeydown: (event: KeyboardEvent) => {
                                    if (!disabled) {
                                        keydown(index, event);
                                    }
                                },
                                onrender: (element: HTMLElement) => {
                                    thumbs[index] = element;
                                },
                                style: () => `--position: ${percent(key)}`
                            }}
                        ></div>
                    `)}
                </div>
            </div>

            ${name && keys.map((key) => html`<input name='${name}' type='hidden' ${{ value: () => String(s[key]) }} />`)}
        </div>
    `;
};

export type { State as SliderState };
