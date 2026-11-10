import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import tag from '~/components/field/tag';
import { swallow } from '~/shared/press';
import input from './field';
import '~/components/field/scss/index.scss';


type A = Attributes & {
    [INPUT_SCRUB_FIELD]?: Field;
    [INPUT_SCRUB_LABEL]?: Attributes;
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
    // The input's surface modifier.
    variant?: 'surface' | 'surface-primary';
};

type D = Attributes & Pick<A, typeof INPUT_SCRUB_FIELD | typeof INPUT_SCRUB_LABEL>;

type Field = Parameters<typeof input>[0];

type Scrub = {
    id: number;
    lastX: number;
    // Pointer lock was asked for; taking it releases the pointer capture, which then no longer ends the scrub.
    locked: boolean;
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

const INPUT_SCRUB_FIELD = Symbol.for('@esportsplus/ui/input.scrub.field');

const INPUT_SCRUB_LABEL = Symbol.for('@esportsplus/ui/input.scrub.label');

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


export default component(
    function(
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
            variant,
            ...attributes
        }: A,
        content: Renderable<unknown>
    ) {
        let field: HTMLInputElement | undefined,
            local = reactive({ draft: null as string | null, scrubbing: false }),
            period = TICK * 5,
            scrub: Scrub | null = null,
            skip = false;

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

            // The click that ends a scrub shouldn't also drop you into typing.
            if (scrub?.moved) {
                swallow();
            }

            scrub = null;
            local.scrubbing = false;
            state.active = false;
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

        // The label and the track both start a scrub; a press that never drags focuses the field instead.
        let drag = {
            onclick: () => {
                field?.focus();
            },
            onlostpointercapture: (e: PointerEvent) => {
                if (scrub?.id === e.pointerId && !scrub.locked) {
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
                    locked: false,
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

                    // The field reads as in use while it's dragged, as it does while typed in.
                    s.moved = true;
                    local.scrubbing = true;
                    state.active = true;

                    if (lockPointer && e.pointerType === 'mouse') {
                        s.locked = true;

                        // A refused lock rejects (or returns nothing) and leaves the capture in place, which scrubs on.
                        Promise.resolve(element.requestPointerLock?.()).catch(() => {
                            s.locked = false;
                        });
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
        };

        // An input with the letter or icon floating at its start and the tape along its foot, so the box, its states
        // and its variants are the input's own.
        return tag.call({ attributes: this?.attributes }, {
            ...attributes,
            class: ['input-scrub', () => local.scrubbing && '--active', attributes.class ?? []].flat(),
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
            },
            // The browser takes Escape to release a lock before the page sees it, so a released lock ends the scrub.
            ondocumentpointerlockchange: () => {
                if (scrub?.locked && !document.pointerLockElement) {
                    end();
                }
            }
        }, html`
            <span
                class='field-tag-item input-scrub-label'
                ${this?.attributes?.[INPUT_SCRUB_LABEL]}
                ${attributes[INPUT_SCRUB_LABEL]}
                ${drag}
            >
                ${content}
            </span>
            ${input.call({ attributes: { ...this?.attributes?.[INPUT_SCRUB_FIELD], ...attributes[INPUT_SCRUB_FIELD] } }, {
                'aria-label': label,
                'aria-valuemax': Number.isFinite(max) && max,
                'aria-valuemin': Number.isFinite(min) && min,
                'aria-valuenow': () => state.value,
                'aria-valuetext': () => format(state.value),
                autocomplete: 'off',
                class: ['input-scrub-field', variant && `input--${variant}`],
                inputmode: 'decimal',
                onblur: () => {
                    if (!skip) {
                        commit();
                    }

                    skip = false;
                    local.draft = null;
                },
                onconnect: (element: HTMLInputElement) => {
                    field = element;
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
            <span aria-hidden='true' class='input-scrub-tape' ${drag}>
                <span
                    class='input-scrub-ticks'
                    style=${() => {
                        // The pattern repeats every major tick, so only the remainder matters, which also keeps huge values precise.
                        let offset = ((((state.value / step) * pixelsPerStep) % period) + period) % period;

                        return `--offset: ${offset}px`;
                    }}
                ></span>
                <span class='input-scrub-needle'></span>
            </span>
        `);
    },
    { field: INPUT_SCRUB_FIELD, label: INPUT_SCRUB_LABEL }
);
