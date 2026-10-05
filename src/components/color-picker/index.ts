import { component, html, type Attributes } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import { measure, slides, timing } from '~/shared/animation';
import { clamp } from '~/shared/clamp';
import { keystep } from '~/shared/keystep';
import input from '~/components/input';
import range from '~/components/range';
import './scss/index.scss';


type A = Attributes & {
    [COLOR_PICKER_SWATCH]?: Attributes;
    recent?: string[];
    state?: { error: string, value: string };
    value: string;
};

type Channel = { active: boolean, error: string, value: number };

type Hsva = { a: number, h: number, s: number, v: number };

type Parts = {
    hex?: HTMLInputElement;
    swatches?: HTMLElement;
};


const HEX_PREFIX = /^#/;

const HEX_COLOR = /^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;


const COLOR_PICKER_SWATCH = Symbol.for('@esportsplus/ui/color-picker.swatch');

// Wide enough for a useful history, narrow enough to stay one row at 320px.
const MAX_RECENT = 8;


let uid = 0;


function fromHex(hex: string, previous: Hsva): Hsva | null {
    let rgba = parse(hex);

    if (!rgba) {
        return null;
    }

    return { ...toHsv(rgba.r, rgba.g, rgba.b, previous), a: rgba.a };
}

function parse(value: string) {
    let hex = value.trim().replace(HEX_PREFIX, '');

    if (!HEX_COLOR.test(hex)) {
        return null;
    }

    let full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex;

    function byte(i: number) {
        return parseInt(full.slice(i, i + 2), 16);
    }

    return {
        a: full.length === 8 ? byte(6) / 255 : 1,
        b: byte(4),
        g: byte(2),
        r: byte(0)
    };
}

function rgb({ h, s, v }: Hsva) {
    function f(n: number) {
        let k = (n + h / 60) % 6;

        return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255);
    }

    return [f(5), f(3), f(1)] as const;
}

function toHex(color: Hsva) {
    let alpha = Math.round(color.a * 255);

    function pair(n: number) {
        return n.toString(16).padStart(2, '0');
    }

    return ('#' + rgb(color).map(pair).join('') + (alpha < 255 ? pair(alpha) : '')).toUpperCase();
}

// Grey has no hue and black no saturation, so both keep what the user had instead of snapping to 0; that is
// what stops the hue thumb jumping home when a hex like #808080 or #000 comes in.
function toHsv(r: number, g: number, b: number, previous: Hsva) {
    let R = r / 255,
        G = g / 255,
        B = b / 255,
        max = Math.max(R, G, B),
        d = max - Math.min(R, G, B),
        h = previous.h;

    if (d !== 0) {
        let sector = max === R
            ? ((G - B) / d) % 6
            : max === G
                ? (B - R) / d + 2
                : (R - G) / d + 4;

        h = (sector * 60 + 360) % 360;
    }

    return { h, s: max === 0 ? previous.s : d / max, v: max };
}

function template(
    this: { attributes?: Pick<A, typeof COLOR_PICKER_SWATCH> } | void,
    {
        recent: initial = [],
        state = reactive({ error: '', value: '' }),
        value,
        ...attributes
    }: A
) {
    let start = fromHex(state.value || value, { a: 1, h: 0, s: 0, v: 0 });

    if (!start) {
        throw new Error(`Color picker: '${state.value || value}' is not a valid hex color`);
    }

    let alpha: Channel = reactive({ active: false, error: '', value: Math.round(start.a * 100) }),
        color = reactive({ a: start.a, h: start.h, s: start.s, v: start.v }),
        dirty = { alpha: false, hue: false, pad: false },
        hue: Channel = reactive({ active: false, error: '', value: Math.round(start.h) }),
        id = `color-picker-${++uid}`,
        // Stand-ins for swatches pushed out of the recent list, fading out where they stood.
        leaving = reactive([] as { hex: string, left: number, top: number }[]),
        parts: Parts = {},
        picker = reactive({ active: '', invalid: false }),
        pointer = { alpha: false, hue: false, pad: -1 },
        recent = reactive(initial.map((hex) => hex.toUpperCase()));

    let fading = html.reactive(leaving, (ghost) => html`
        <span
            aria-hidden='true'
            class='color-picker-swatch color-picker-swatch--leaving'
            style='--swatch: ${ghost.hex}; left: ${ghost.left}px; top: ${ghost.top}px;'
            ${{
                onanimationend: () => {
                    let at = leaving.indexOf(ghost);

                    if (at !== -1) {
                        leaving.splice(at, 1);
                    }
                }
            }}
        ></span>
    `);

    state.value = toHex(color);

    function apply(leaving: boolean) {
        let field = parts.hex;

        if (!field) {
            return;
        }

        let next = fromHex(field.value, read());

        if (!next) {
            // Enter keeps the text so it can be fixed; leaving the field puts the real value back rather than
            // stranding a broken one.
            if (leaving) {
                field.value = toHex(read());
            }

            picker.invalid = !leaving;
            return;
        }

        let changed = toHex(next) !== toHex(read());

        picker.invalid = false;
        update(next);
        field.value = toHex(next);

        if (changed) {
            commit();
        }
    }

    // Recents update when a change settles, so a drag adds one swatch rather than one per frame.
    function commit() {
        let hex = toHex(read());

        picker.active = hex;

        if (recent[0] === hex) {
            return;
        }

        let container = parts.swatches,
            dropped: { hex: string, rect: DOMRect }[] = [],
            index = recent.indexOf(hex),
            kept = recent.filter((c) => c !== hex).slice(0, MAX_RECENT - 1);

        // Swatches lead the container in 'recent' order, ghosts after them.
        if (container) {
            measure(container.children);

            for (let i = 0, n = recent.length; i < n; i++) {
                if (recent[i] !== hex && !kept.includes(recent[i])) {
                    dropped.push({ hex: recent[i], rect: container.children[i].getBoundingClientRect() });
                }
            }
        }

        if (index !== -1) {
            recent.splice(index, 1);
        }

        recent.unshift(hex);

        if (recent.length > MAX_RECENT) {
            recent.splice(MAX_RECENT);
        }

        if (container) {
            requestAnimationFrame(() => flip(container, dropped));
        }
    }

    function css() {
        let [r, g, b] = rgb(read());

        return `--alpha: ${color.a}; --hue: ${color.h}; --rgb: ${r} ${g} ${b};`;
    }

    // Runs after the swatch list has re-rendered: survivors slide from where they were, newcomers grow in and
    // the dropped ones fade out from a stand-in, since their own nodes are already gone.
    function flip(container: HTMLElement, dropped: { hex: string, rect: DOMRect }[]) {
        let box = container.getBoundingClientRect(),
            computed = getComputedStyle(container),
            enter = timing(computed, 'swatch'),
            from = {
                filter: `blur(${computed.getPropertyValue('--swatch-blur').trim()})`,
                opacity: 0,
                scale: computed.getPropertyValue('--swatch-scale').trim()
            },
            move = timing(computed, 'swatch-shift');

        slides([...container.children].slice(0, recent.length), move, (element) => {
            if (enter) {
                element.animate([from, { filter: 'blur(0px)', opacity: 1, scale: '1' }], enter);
            }
        });

        for (let { hex, rect } of dropped) {
            leaving.push({ hex, left: rect.left - box.left, top: rect.top - box.top });
        }
    }

    // Pointer capture keeps the drag alive outside the pad, so the point is clamped back onto it.
    function pick(pad: HTMLElement, e: PointerEvent) {
        let rect = pad.getBoundingClientRect();

        update({
            s: clamp((e.clientX - rect.left) / rect.width, 0, 1),
            v: 1 - clamp((e.clientY - rect.top) / rect.height, 0, 1)
        });
    }

    function read(): Hsva {
        return { a: color.a, h: color.h, s: color.s, v: color.v };
    }

    function slide(channel: 'alpha' | 'hue', e: KeyboardEvent) {
        let delta = keystep(e, 1),
            target = channel === 'hue' ? hue : alpha;

        pointer[channel] = false;

        if (delta === null) {
            return;
        }

        dirty[channel] = true;

        // Native ranges already step by one; only the Shift jump needs handling here.
        if (!e.shiftKey || !e.key.startsWith('Arrow')) {
            return;
        }

        e.preventDefault();
        target.value = clamp(target.value + delta, 0, Number((e.currentTarget as HTMLInputElement).max));
    }

    function sync(hex: string) {
        let field = parts.hex;

        alpha.value = Math.round(color.a * 100);
        hue.value = Math.round(color.h);

        // The field follows the color except while it is being typed in.
        if (field && document.activeElement !== field) {
            field.value = hex;
        }
    }

    function update(patch: Partial<Hsva>) {
        if (patch.a !== undefined) {
            color.a = patch.a;
        }

        if (patch.h !== undefined) {
            color.h = patch.h;
        }

        if (patch.s !== undefined) {
            color.s = patch.s;
        }

        if (patch.v !== undefined) {
            color.v = patch.v;
        }

        let hex = toHex(read());

        if (picker.active !== hex) {
            picker.active = '';
        }

        state.value = hex;
        sync(hex);
    }

    effect(() => alpha.value, (next) => {
        if (Math.round(color.a * 100) !== next) {
            update({ a: next / 100 });
        }
    });

    effect(() => hue.value, (next) => {
        if (Math.round(color.h) !== next) {
            update({ h: next });
        }
    });

    effect(() => state.value, (next) => {
        let parsed = next && toHex(read()) !== next.toUpperCase() ? fromHex(next, read()) : null;

        if (parsed) {
            update(parsed);
        }
    });

    return html`
        <div class='color-picker' ${this?.attributes} ${attributes} ${{ style: css }}>
            <div
                aria-label='Saturation and brightness'
                aria-roledescription='2D slider'
                aria-valuemax='100'
                aria-valuemin='0'
                class='color-picker-pad'
                role='slider'
                tabindex='0'
                ${{
                    'aria-valuenow': () => Math.round(color.s * 100),
                    'aria-valuetext': () => `Saturation ${Math.round(color.s * 100)}%, brightness ${Math.round(color.v * 100)}%`,
                    onblur: () => {
                        if (dirty.pad) {
                            commit();
                        }

                        dirty.pad = false;
                    },
                    onkeydown: (e: KeyboardEvent) => {
                        let delta = keystep(e, 0.01);

                        if (delta === null) {
                            return;
                        }

                        e.preventDefault();
                        dirty.pad = true;

                        // Left and right move saturation, the rest brightness, matching the axes on screen.
                        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                            update({ s: clamp(color.s + delta, 0, 1) });
                        }
                        else {
                            update({ v: clamp(color.v + delta, 0, 1) });
                        }
                    },
                    onpointercancel: (e: PointerEvent) => {
                        if (e.pointerId === pointer.pad) {
                            pointer.pad = -1;
                            commit();
                        }
                    },
                    // Only the first pointer counts, so a second finger can't make the handle jump.
                    onpointerdown: function(this: HTMLElement, e: PointerEvent) {
                        if (pointer.pad !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) {
                            return;
                        }

                        pointer.pad = e.pointerId;
                        this.setPointerCapture(e.pointerId);
                        pick(this, e);
                    },
                    onpointermove: function(this: HTMLElement, e: PointerEvent) {
                        if (e.pointerId === pointer.pad) {
                            pick(this, e);
                        }
                    },
                    onpointerup: (e: PointerEvent) => {
                        if (e.pointerId === pointer.pad) {
                            pointer.pad = -1;
                            commit();
                        }
                    }
                }}
            >
                <span
                    class='color-picker-thumb'
                    style='${() => `left: ${color.s * 100}%; top: ${(1 - color.v) * 100}%;`}'
                ></span>
            </div>

            <div class='color-picker-channels'>
                <div class='color-picker-sliders'>
                    ${range({
                        'aria-label': 'Hue',
                        'aria-valuetext': () => `${hue.value} degrees`,
                        class: 'color-picker-channel color-picker-channel--hue',
                        max: 360,
                        min: 0,
                        onblur: () => {
                            if (dirty.hue && !pointer.hue) {
                                commit();
                            }

                            dirty.hue = false;
                        },
                        onchange: () => {
                            if (pointer.hue) {
                                commit();
                            }
                        },
                        onkeydown: (e: KeyboardEvent) => slide('hue', e),
                        onpointerdown: () => {
                            pointer.hue = true;
                        },
                        state: hue,
                        step: 1
                    })}
                    ${range({
                        'aria-label': 'Opacity',
                        'aria-valuetext': () => `${alpha.value}%`,
                        class: 'color-picker-channel color-picker-channel--alpha',
                        max: 100,
                        min: 0,
                        onblur: () => {
                            if (dirty.alpha && !pointer.alpha) {
                                commit();
                            }

                            dirty.alpha = false;
                        },
                        onchange: () => {
                            if (pointer.alpha) {
                                commit();
                            }
                        },
                        onkeydown: (e: KeyboardEvent) => slide('alpha', e),
                        onpointerdown: () => {
                            pointer.alpha = true;
                        },
                        state: alpha,
                        step: 1
                    })}
                </div>
                <span aria-hidden='true' class='color-picker-preview'></span>
            </div>

            <div class='color-picker-fields'>
                ${input({
                    'aria-invalid': () => picker.invalid ? 'true' : 'false',
                    'aria-label': 'Hex color',
                    autocapitalize: 'characters',
                    autocomplete: 'off',
                    class: 'color-picker-hex',
                    maxlength: 9,
                    onblur: () => apply(true),
                    onconnect: (element: HTMLInputElement) => {
                        parts.hex = element;
                        element.value = toHex(read());
                    },
                    onfocus: function(this: HTMLInputElement) {
                        this.select();
                    },
                    oninput: () => {
                        picker.invalid = false;
                    },
                    onkeydown: function(this: HTMLInputElement, e: KeyboardEvent) {
                        if (e.key === 'Enter') {
                            apply(false);
                        }
                        else if (e.key === 'Escape') {
                            this.value = toHex(read());
                            picker.invalid = false;
                        }
                    },
                    spellcheck: false
                })}
                <span aria-hidden='true' class='color-picker-alpha'>${() => `${Math.round(color.a * 100)}%`}</span>
                <span aria-live='polite' class='color-picker-status'>${() => picker.invalid && 'Not a valid hex color'}</span>
            </div>

            <div class='color-picker-recent' ${{ hidden: () => recent.length === 0 }}>
                <p class='color-picker-recent-label' id='${id}-recent'>Recent</p>
                <div
                    aria-labelledby='${id}-recent'
                    class='color-picker-swatches'
                    role='group'
                    ${{
                        onconnect: (element: HTMLElement) => {
                            parts.swatches = element;
                        }
                    }}
                >
                    ${html.reactive(recent, (hex) => html`
                        <button
                            aria-label='Use ${hex}'
                            class='color-picker-swatch'
                            style='--swatch: ${hex};'
                            type='button'
                            ${this?.attributes?.[COLOR_PICKER_SWATCH]}
                            ${attributes[COLOR_PICKER_SWATCH]}
                            ${{
                                'aria-pressed': () => picker.active === hex ? 'true' : 'false',
                                class: () => picker.active === hex && '--active',
                                onclick: () => {
                                    let next = fromHex(hex, read());

                                    if (!next) {
                                        return;
                                    }

                                    // Applies without reordering, so the swatch under the cursor stays put.
                                    update(next);
                                    picker.active = hex;
                                    picker.invalid = false;
                                }
                            }}
                        ></button>
                    `)}
                    ${fading}
                </div>
            </div>
        </div>
    `;
}


export default component(template, { swatch: COLOR_PICKER_SWATCH });
