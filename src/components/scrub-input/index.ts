import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import input from '~/components/input';
import './scss/index.scss';


type A = Attributes & {
    [SCRUB_INPUT_FIELD]?: Field;
    [SCRUB_INPUT_LABEL]?: Attributes;
    label: string;
    // Browsers announce pointer lock with a banner, which is too loud for a quick nudge but worth it for long scrubs.
    lockPointer?: boolean;
    max?: number;
    min?: number;
    pixelsPerStep?: number;
    precision?: number;
    state?: State;
    step?: number;
    suffix?: string;
    value?: number;
};

type D = Attributes & Pick<A, typeof SCRUB_INPUT_FIELD | typeof SCRUB_INPUT_LABEL>;

type Field = Parameters<typeof input>[0];

type Scrub = {
    id: number;
    lastX: number;
    moved: boolean;
    // Unrounded running value, so slow fine drags accumulate instead of rounding every sub-step away.
    raw: number;
    sent: number;
    start: number;
    startX: number;
};

type State = {
    active: boolean;
    error: string;
    value: number;
};


// Below this the press is a click on the label (which focuses the field), not the start of a scrub.
const DRAG_THRESHOLD = 3;

const SCRUB_INPUT_FIELD = Symbol.for('@esportsplus/ui/scrub-input.field');

const SCRUB_INPUT_LABEL = Symbol.for('@esportsplus/ui/scrub-input.label');

// Spacing of the tape's minor ticks; majors land every fifth.
const TICK = 6;


function decimals(n: number) {
    let s = String(n),
        dot = s.indexOf('.');

    return dot < 0 ? 0 : s.length - dot - 1;
}

// Shift is a coarse gear, Alt/Option a fine one, like Figma.
function gear(e: { altKey: boolean, shiftKey: boolean }) {
    return e.shiftKey ? 10 : e.altKey ? 0.1 : 1;
}


export default Object.assign(
    component(function(
        this: { attributes?: D } | void,
        {
            label,
            lockPointer = false,
            max = Infinity,
            min = -Infinity,
            pixelsPerStep = 1,
            step = 1,
            precision = decimals(step) + 1,
            suffix = '',
            value = 0,
            state = reactive({ active: false, error: '', value }),
            ...attributes
        }: A,
        content: Renderable<unknown>
    ) {
        let local = reactive({ draft: null as string | null, scrubbing: false }),
            period = TICK * 5,
            scrub: Scrub | null = null,
            skip = false,
            suppress = false;

        function clamp(n: number) {
            return Math.min(Math.max(n, min), max);
        }

        function commit() {
            if (local.draft === null) {
                return state.value;
            }

            let next = parse(local.draft);

            if (next !== null && next !== state.value) {
                state.value = next;
            }

            return next ?? state.value;
        }

        function end() {
            if (document.pointerLockElement) {
                document.exitPointerLock();
            }

            document.documentElement.style.removeProperty('cursor');
            suppress = scrub?.moved ?? false;
            scrub = null;
            local.scrubbing = false;
        }

        function format(n: number) {
            return `${round(n)}${suffix}`;
        }

        function parse(text: string) {
            let trimmed = (suffix ? text.replace(suffix, '') : text).trim(),
                n = Number(trimmed);

            return trimmed === '' || Number.isNaN(n) ? null : clamp(round(n));
        }

        function round(n: number) {
            return Number(n.toFixed(precision));
        }

        // Written straight to the field so the selection lands on the new text rather than waiting a frame.
        function show(field: HTMLInputElement, text: string) {
            local.draft = text;
            field.value = text;
            field.select();
        }

        return html`
            <div
                class='scrub-input'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: () => local.scrubbing && '--active',
                    ondisconnect: () => {
                        if (scrub) {
                            end();
                        }
                    },
                    ondocumentkeydown: (e: KeyboardEvent) => {
                        if (e.key !== 'Escape' || !scrub) {
                            return;
                        }

                        state.value = scrub.start;
                        end();
                    }
                }}
            >
                <span aria-hidden='true' class='scrub-input-tape'>
                    <span
                        class='scrub-input-ticks'
                        style=${() => {
                            // The pattern repeats every major tick, so only the remainder matters, which also keeps huge values precise.
                            let offset = ((((state.value / step) * pixelsPerStep) % period) + period) % period;

                            return `--offset: ${offset}px`;
                        }}
                    ></span>
                    <span class='scrub-input-needle'></span>
                </span>
                <span
                    class='scrub-input-label'
                    ${this?.attributes?.[SCRUB_INPUT_LABEL]}
                    ${attributes[SCRUB_INPUT_LABEL]}
                    ${{
                        onclick: (e: MouseEvent) => {
                            let s = suppress;

                            suppress = false;

                            // The click that ends a scrub shouldn't also drop you into typing.
                            if (s) {
                                return;
                            }

                            (e.currentTarget as HTMLElement).parentElement?.querySelector<HTMLInputElement>('.scrub-input-field')?.focus();
                        },
                        onlostpointercapture: (e: PointerEvent) => {
                            if (scrub?.id === e.pointerId) {
                                end();
                            }
                        },
                        onpointercancel: (e: PointerEvent) => {
                            if (scrub?.id === e.pointerId) {
                                end();
                            }
                        },
                        onpointerdown: (e: PointerEvent) => {
                            // Ignores a second finger rather than letting it hijack the drag.
                            if (e.button !== 0 || scrub) {
                                return;
                            }

                            e.preventDefault();

                            let element = e.currentTarget as HTMLElement,
                                field = element.parentElement?.querySelector<HTMLInputElement>('.scrub-input-field'),
                                start = state.value;

                            if (field && document.activeElement === field) {
                                start = commit();
                                skip = true;
                                field.blur();
                            }

                            element.setPointerCapture(e.pointerId);
                            scrub = {
                                id: e.pointerId,
                                lastX: e.clientX,
                                moved: false,
                                raw: start,
                                sent: start,
                                start,
                                startX: e.clientX
                            };
                        },
                        onpointermove: (e: PointerEvent) => {
                            let s = scrub;

                            if (!s || e.pointerId !== s.id) {
                                return;
                            }

                            let element = e.currentTarget as HTMLElement;

                            if (!s.moved) {
                                if (Math.abs(e.clientX - s.startX) < DRAG_THRESHOLD) {
                                    return;
                                }

                                s.moved = true;
                                local.scrubbing = true;
                                // Keeps the resize cursor once the pointer leaves the label.
                                document.documentElement.style.cursor = 'ew-resize';

                                if (lockPointer && e.pointerType === 'mouse') {
                                    // Refused locks reject (or return nothing); the captured pointer keeps scrubbing either way.
                                    Promise.resolve(element.requestPointerLock?.()).catch(() => {});
                                }
                            }

                            // A locked pointer stays put, so only movementX reports travel.
                            let dx = document.pointerLockElement === element ? e.movementX : e.clientX - s.lastX;

                            s.lastX = e.clientX;
                            s.raw = clamp(s.raw + (dx / pixelsPerStep) * step * gear(e));

                            let next = round(s.raw);

                            if (next === s.sent) {
                                return;
                            }

                            s.sent = next;
                            state.value = next;
                        },
                        onpointerup: (e: PointerEvent) => {
                            if (scrub?.id === e.pointerId) {
                                end();
                            }
                        }
                    }}
                >
                    ${content}
                </span>
                ${input.call({ attributes: { ...this?.attributes?.[SCRUB_INPUT_FIELD], ...attributes[SCRUB_INPUT_FIELD] } }, {
                    'aria-label': label,
                    'aria-valuemax': Number.isFinite(max) ? max : undefined,
                    'aria-valuemin': Number.isFinite(min) ? min : undefined,
                    'aria-valuenow': () => state.value,
                    'aria-valuetext': () => format(state.value),
                    autocomplete: 'off',
                    class: 'scrub-input-field',
                    inputmode: 'decimal',
                    onblur: () => {
                        if (!skip) {
                            commit();
                        }

                        skip = false;
                        local.draft = null;
                    },
                    onfocus: (e: FocusEvent) => {
                        show(e.currentTarget as HTMLInputElement, format(state.value));
                    },
                    oninput: (e: Event) => {
                        local.draft = (e.currentTarget as HTMLInputElement).value;
                    },
                    onkeydown: (e: KeyboardEvent) => {
                        let field = e.currentTarget as HTMLInputElement;

                        if (e.key === 'Enter') {
                            e.preventDefault();
                            // Stays in the field with the result selected, so the next edit is one keystroke away.
                            show(field, format(commit()));
                        }
                        else if (e.key === 'Escape') {
                            skip = true;
                            field.blur();
                        }
                        else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                            e.preventDefault();

                            let base = local.draft === null ? state.value : (parse(local.draft) ?? state.value),
                                next = clamp(round(base + (e.key === 'ArrowUp' ? step : -step) * gear(e)));

                            if (next !== state.value) {
                                state.value = next;
                            }

                            show(field, format(next));
                        }
                    },
                    role: 'spinbutton',
                    spellcheck: false,
                    state,
                    value: () => local.draft ?? format(state.value)
                })}
            </div>
        `;
    }
), { field: SCRUB_INPUT_FIELD, label: SCRUB_INPUT_LABEL } as const);
