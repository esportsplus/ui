import { effect, reactive, untrack } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { clamp } from '~/shared/clamp';
import { keystep } from '~/shared/keystep';
import group from '~/components/group';
import icon from '~/components/icon';
import inlineEdit from '~/components/inline-edit';
import input from '~/components/input';
import undo from '@esportsplus/ui/svg/undo.svg';


type A = Attributes & {
    // Attributes for the reset button, in place of the default surface style.
    [RANGE_FILTER_RESET]?: Attributes;
    disabled?: boolean;
    // Editable fields under the scale for typing an exact bound.
    fields?: boolean;
    format?: (value: number) => string;
    label?: string;
    max?: number;
    min?: number;
    orientation?: 'horizontal' | 'vertical';
    prefix?: string;
    // A button beside the label that puts the thumbs back at their defaults.
    reset?: boolean;
    state?: State;
    step?: number;
    // Number of evenly spaced scale labels under the track, each fading while a thumb's value rides over it.
    ticks?: number;
    // A single number gives one thumb that fills from `min`; a pair gives a range.
    value?: number | [number, number];
};

type Key = 'high' | 'low';

type State = { high: number; low: number };


// How near a thumb's value, as a share of the track, hides a tick label: about one label's width on a default track,
// so the value riding beside the thumb takes the label's place rather than printing over it.
const COVERED = 0.15;

const KEYS: Key[] = ['low', 'high'];

const NON_NUMERIC_CHARACTERS = /[^\d.-]/g;

const RANGE_FILTER_RESET = Symbol.for('@esportsplus/ui/range-filter.reset');

// Shared by every filter that doesn't pass its own, so it isn't rebuilt on each render.
const RESET: Attributes = { class: 'button--surface' };


// Rounded to the step's own precision, so fractional steps never drift into float noise.
function snap(value: number, min: number, step: number, decimals: number) {
    return Number((Math.round((value - min) / step) * step + min).toFixed(decimals));
}


function filter({
    [RANGE_FILTER_RESET]: buttons = RESET,
    disabled = false,
    fields = false,
    format = (value: number) => value.toLocaleString('en-US'),
    label = 'Price Range',
    max = 1000,
    min = 0,
    orientation = 'horizontal',
    prefix = '$',
    reset = true,
    state,
    step = 10,
    ticks = 5,
    value,
    ...attributes
}: A) {
    let decimals = (String(step).split('.')[1] || '').length,
        vertical = orientation === 'vertical',
        single = typeof value === 'number',
        span = max - min || 1,
        s = state ?? reactive({
            high: typeof value === 'number' ? value : value?.[1] ?? clamp(snap(min + span * 0.65, min, step, decimals), min, max),
            low: typeof value === 'number' ? min : value?.[0] ?? clamp(snap(min + span * 0.15, min, step, decimals), min, max)
        }),
        indices = single ? [1] : [0, 1],
        labels: number[] = [],
        // The last value hovered, kept while the ghost fades out so it fades where it was.
        hovered = min,
        // The pointer dragging; another finger's moves are ignored.
        pointer = -1,
        root: HTMLElement | undefined,
        thumbs: HTMLElement[] = [],
        ui = reactive({ dragging: -1, preview: -1 });

    for (let i = 0; i < ticks; i++) {
        let tick = snap(min + (i * span) / Math.max(1, ticks - 1), min, step, decimals);

        if (!labels.includes(tick)) {
            labels.push(tick);
        }
    }

    // Vertical thumb centres stop half a thumb inside each end of the control.
    function at(event: PointerEvent) {
        if (!root) {
            return min;
        }

        let rect = root.getBoundingClientRect(),
            thumb = vertical ? thumbs[indices[0]]?.offsetHeight ?? 0 : 0,
            share = vertical
                ? (rect.bottom - event.clientY - thumb / 2) / Math.max(1, rect.height - thumb)
                : (event.clientX - rect.left) / rect.width;

        return clamp(snap(share * span + min, min, step, decimals), min, max);
    }

    function commit(index: number, raw: number) {
        let next = clamp(snap(raw, min, step, decimals), min, max);

        // Thumbs meet but never pass, so each keeps the bound it started as.
        s[KEYS[index]] = index === 0 ? Math.min(next, s.high) : Math.max(next, s.low);
    }

    // The scrub keeps its own value; the filter snaps it to the step and keeps the bounds from crossing, then hands back
    // what it took, so dragging past the other bound holds at it.
    function field(index: number) {
        let key = KEYS[index],
            scrub = reactive({ active: false, error: '', value: s[key] });

        function sync() {
            if (scrub.value !== s[key]) {
                scrub.value = s[key];
            }
        }

        // Synced even when the bound holds, since a value the filter rounds back to the same bound changes nothing.
        effect(() => {
            let value = scrub.value;

            untrack(() => {
                commit(index, value);
                sync();
            });
        });

        effect(() => {
            s[key];
            untrack(sync);
        });

        return input.scrub({
            [input.scrub.field]: { disabled },
            class: 'range-filter-field',
            label: name(index),
            max,
            min,
            precision: decimals,
            state: scrub,
            step
        }, single ? 'Value' : index === 0 ? 'Min' : 'Max');
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

    function fraction(value: number) {
        return (value - min) / span;
    }

    function name(index: number) {
        return single ? label : `${index === 0 ? 'Minimum' : 'Maximum'} ${label.toLowerCase()}`;
    }

    function release(event: PointerEvent) {
        if (event.pointerId !== pointer) {
            return;
        }

        pointer = -1;
        ui.dragging = -1;
    }

    // The thumb's value under it, editable in place: the field takes the bare number, and a save snaps it to the step
    // and keeps it from crossing the other bound, as a drag would, then shows what it took.
    function tip(index: number) {
        let key = KEYS[index],
            edit = reactive({ editing: false, saved: false, value: String(s[key]) });

        effect(() => {
            let value = String(s[key]);

            untrack(() => {
                edit.value = value;
            });
        });

        return inlineEdit({
            [inlineEdit.display]: { disabled },
            class: 'range-edit range-filter-tip',
            label: name(index),
            onsave: (text: string) => {
                let parsed = Number(text.replace(NON_NUMERIC_CHARACTERS, ''));

                if (text.trim() !== '' && Number.isFinite(parsed)) {
                    commit(index, parsed);
                }

                edit.value = String(s[key]);
            },
            state: edit,
            style: `--position: var(--${key});`
        }, () => `${prefix}${format(s[key])}`);
    }

    return group({
        ...attributes,
        class: ['range-filter', vertical && 'range-filter--vertical', disabled && '--disabled', attributes.class ?? []].flat()
    }, html`
        <span class='group-label range-filter-label'>${label}</span>

        ${reset && html`
            <button
                class='button button--border button--reveal button--reveal-hover range-filter-reset'
                onclick='${() => {
                    s.low = min;
                    s.high = single ? min : max;
                }}'
                type='button'
                ${buttons}
                ${{ disabled: () => disabled || (s.low === min && s.high === (single ? min : max)) }}
            >
                ${icon({ 'aria-hidden': 'true', class: 'range-filter-reset-icon' }, undo)}
                <span class='button-reveal'><span class='button-reveal-text'>Reset</span></span>
            </button>
        `}

        <div class='range-filter-body'>
            <div
                aria-label='${label}'
                class='range-filter-root'
                role='group'
                ${{
                    onconnect: (element: HTMLElement) => {
                        root = element;
                    },
                    onlostpointercapture: release,
                    onpointercancel: release,
                    onpointerdown: (event: PointerEvent) => {
                        if (disabled || event.button !== 0 || !root || pointer !== -1) {
                            return;
                        }

                        // A press on a value edits it rather than moving a thumb.
                        if ((event.target as Element).closest('.range-filter-tip')) {
                            return;
                        }

                        let grabbed = thumbs.indexOf((event.target as HTMLElement).closest<HTMLElement>('.range-filter-thumb')!),
                            v = at(event),
                            index: number;

                        if (grabbed !== -1) {
                            index = grabbed;
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
                        // A grab is a pointer focus even after typing in a field, so it never rings.
                        thumbs[index]?.focus({ focusVisible: false, preventScroll: true });
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
                    onpointerup: release,
                    style: () => `--high: ${fraction(s.high)}; --low: ${fraction(s.low)};`
                }}
            >
                <div class='range-filter-track'>
                    <div class='range-fill'></div>
                </div>

                <div
                    aria-hidden='true'
                    class='range-ghost'
                    ${{
                        // Hovering outside the selection shows how far it would stretch to reach the pointer.
                        class: () => (ui.preview !== -1 && (ui.preview < s.low || ui.preview > s.high)) && '--active',
                        style: () => {
                            if (ui.preview !== -1) {
                                hovered = ui.preview;
                            }

                            return `--preview: ${fraction(hovered)};`;
                        }
                    }}
                ></div>

                ${indices.map((index) => {
                    let key = KEYS[index];

                    return html`
                        <div
                            aria-disabled='${disabled}'
                            aria-orientation='${orientation}'
                            aria-label='${name(index)}'
                            aria-valuemax='${max}'
                            aria-valuemin='${min}'
                            class='range-filter-thumb'
                            role='slider'
                            style='--position: var(--${key});'
                            tabindex='${disabled ? -1 : 0}'
                            ${{
                                'aria-valuenow': () => s[key],
                                'aria-valuetext': () => `${prefix}${format(s[key])}`,
                                class: [
                                    () => ui.dragging === index && '--active',
                                    index === 0 && (() => s.low === max && 'range-filter-thumb--stacked')
                                ],
                                onconnect: (element: HTMLElement) => {
                                    thumbs[index] = element;
                                },
                                onkeydown: (event: KeyboardEvent) => keydown(index, event)
                            }}
                        ></div>
                    `;
                })}

                ${indices.map(tip)}
            </div>

            <div aria-hidden='true' class='range-filter-ticks'>
                ${labels.map((tick) => html`
                    <span
                        class='range-filter-tick'
                        ${{ class: () => indices.some((index) => Math.abs(fraction(s[KEYS[index]]) - fraction(tick)) < COVERED) && 'range-filter-tick--covered' }}
                    >${prefix}${format(tick)}</span>
                `)}
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
    `);
}


export default Object.assign(filter, { reset: RANGE_FILTER_RESET } as const);
export type { State as RangeFilterState };
