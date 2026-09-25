import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import input from '~/components/input';
import range from '~/components/range';
import './scss/index.scss';


type A = Attributes & {
    [COLOR_PICKER_SWATCH]?: Attributes;
    recent?: string[];
    state?: { error: string, value: string };
    value?: string;
};

type Channel = { active: boolean, error: string, value: number };

type Hsva = { a: number, h: number, s: number, v: number };

type Parts = {
    alpha?: HTMLInputElement;
    hex?: HTMLInputElement;
    hue?: HTMLInputElement;
    swatches?: HTMLElement;
};


const COLOR_PICKER_SWATCH = Symbol.for('@esportsplus/ui/color-picker.swatch');

const DEFAULT_RECENT = ['#E5484D', '#F5A524', '#30A46C', '#0090FF', '#8E4EC6'];

const DEFAULT_VALUE = '#5B8DEF';

// Wide enough for a useful history, narrow enough to stay one row at 320px.
const MAX_RECENT = 8;

const SWATCH: KeyframeAnimationOptions = {
    duration: 300,
    easing: 'linear(0, 0.058, 0.18, 0.321, 0.455, 0.573, 0.671, 0.75, 0.812, 0.86, 0.897, 0.924, 0.944, 0.96, 0.971, 0.979, 0.985, 0.989, 0.992, 0.994, 0.996, 0.997, 0.998, 0.999, 1)'
};

const SWATCH_EXIT: KeyframeAnimationOptions = {
    duration: 150,
    easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
    fill: 'forwards'
};


let uid = 0;


function clamp(n: number) {
    return Math.min(Math.max(n, 0), 1);
}

function fromHex(hex: string, previous: Hsva): Hsva | null {
    let rgba = parse(hex);

    if (!rgba) {
        return null;
    }

    return { ...toHsv(rgba.r, rgba.g, rgba.b, previous), a: rgba.a };
}

// Arrows move one step, Shift or the Page keys ten, Home and End jump to the ends.
function keystep(e: KeyboardEvent, step: number) {
    let big = step * 10,
        unit = e.shiftKey ? big : step;

    switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
            return unit;
        case 'ArrowDown':
        case 'ArrowLeft':
            return -unit;
        case 'End':
            return Infinity;
        case 'Home':
            return -Infinity;
        case 'PageDown':
            return -big;
        case 'PageUp':
            return big;
    }

    return null;
}

function parse(value: string) {
    let hex = value.trim().replace(/^#/, '');

    if (!/^([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) {
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

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
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
        recent: initial = DEFAULT_RECENT,
        value = DEFAULT_VALUE,
        state = reactive({ error: '', value: '' }),
        ...attributes
    }: A = {}
) {
    let start = fromHex(state.value || value, { a: 1, h: 0, s: 0, v: 0 }) ?? { a: 1, h: 220, s: 0.6, v: 0.9 },
        alpha: Channel = reactive({ active: false, error: '', value: Math.round(start.a * 100) }),
        color = reactive({ a: start.a, h: start.h, s: start.s, v: start.v }),
        dirty = { alpha: false, hue: false, pad: false },
        hue: Channel = reactive({ active: false, error: '', value: Math.round(start.h) }),
        id = `color-picker-${++uid}`,
        parts: Parts = {},
        picker = reactive({ active: '', invalid: false }),
        pointer = { alpha: false, hue: false, pad: -1 },
        recent = reactive(initial.map((hex) => hex.toUpperCase()));

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
                field.value = toHex(read()).slice(1);
            }

            picker.invalid = !leaving;
            return;
        }

        let changed = toHex(next) !== toHex(read());

        picker.invalid = false;
        update(next);
        field.value = toHex(next).slice(1);

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
            dropped: { node: HTMLElement, rect: DOMRect }[] = [],
            first = new Map<string, DOMRect>(),
            index = recent.indexOf(hex),
            kept = recent.filter((c) => c !== hex).slice(0, MAX_RECENT - 1);

        if (container) {
            for (let element of container.querySelectorAll<HTMLElement>('.color-picker-swatch')) {
                let key = element.dataset.hex ?? '',
                    rect = element.getBoundingClientRect();

                first.set(key, rect);

                if (key !== hex && !kept.includes(key)) {
                    dropped.push({ node: element.cloneNode(true) as HTMLElement, rect });
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
            requestAnimationFrame(() => flip(container, first, dropped));
        }
    }

    function css() {
        let [r, g, b] = rgb(read());

        return `--alpha: ${color.a}; --hue: ${color.h}; --rgb: ${r} ${g} ${b};`;
    }

    // Runs after the swatch list has re-rendered: survivors slide from where they were, newcomers grow in and
    // the dropped ones fade out from a stand-in, since their own nodes are already gone.
    function flip(container: HTMLElement, first: Map<string, DOMRect>, dropped: { node: HTMLElement, rect: DOMRect }[]) {
        let box = container.getBoundingClientRect(),
            still = reduced();

        for (let element of container.querySelectorAll<HTMLElement>('.color-picker-swatch')) {
            let previous = first.get(element.dataset.hex ?? '');

            if (!previous) {
                element.animate(
                    still
                        ? [{ opacity: 0 }, { opacity: 1 }]
                        : [{ filter: 'blur(4px)', opacity: 0, scale: '0.6' }, { filter: 'blur(0px)', opacity: 1, scale: '1' }],
                    SWATCH
                );
                continue;
            }

            let x = previous.left - element.getBoundingClientRect().left;

            if (x !== 0 && !still) {
                element.animate([{ translate: `${x}px 0` }, { translate: '0 0' }], SWATCH);
            }
        }

        for (let { node, rect } of dropped) {
            node.classList.add('--leaving');
            node.removeAttribute('aria-pressed');
            node.setAttribute('aria-hidden', 'true');
            node.style.left = `${rect.left - box.left}px`;
            node.style.top = `${rect.top - box.top}px`;
            container.append(node);
            node.animate(
                still
                    ? [{ opacity: 1 }, { opacity: 0 }]
                    : [{ filter: 'blur(0px)', opacity: 1, scale: '1' }, { filter: 'blur(4px)', opacity: 0, scale: '0.6' }],
                SWATCH_EXIT
            ).onfinish = () => node.remove();
        }
    }

    function read(): Hsva {
        return { a: color.a, h: color.h, s: color.s, v: color.v };
    }

    function slide(channel: 'alpha' | 'hue', e: KeyboardEvent) {
        let element = e.currentTarget as HTMLInputElement,
            max = Number(element.max),
            delta = keystep(e, 1);

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

        let next = Math.min(Math.max(element.valueAsNumber + delta, 0), max);

        element.value = String(next);
        (channel === 'hue' ? hue : alpha).value = next;
    }

    function sync() {
        let { alpha: a, hex, hue: h } = parts;

        alpha.value = Math.round(color.a * 100);
        hue.value = Math.round(color.h);

        if (a && a.valueAsNumber !== alpha.value) {
            a.value = String(alpha.value);
        }

        if (h && h.valueAsNumber !== hue.value) {
            h.value = String(hue.value);
        }

        // The field follows the color except while it is being typed in.
        if (hex && document.activeElement !== hex) {
            hex.value = toHex(read()).slice(1);
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
        sync();
    }

    let disposers = [
        effect(() => {
            let next = alpha.value;

            untrack(() => {
                if (Math.round(color.a * 100) !== next) {
                    update({ a: next / 100 });
                }
            });
        }),
        effect(() => {
            let next = hue.value;

            untrack(() => {
                if (Math.round(color.h) !== next) {
                    update({ h: next });
                }
            });
        }),
        effect(() => {
            let next = state.value;

            untrack(() => {
                let parsed = next && toHex(read()) !== next.toUpperCase() ? fromHex(next, read()) : null;

                if (parsed) {
                    update(parsed);
                }
            });
        })
    ];

    onCleanup(() => {
        for (let i = 0, n = disposers.length; i < n; i++) {
            disposers[i]();
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
                            update({ s: clamp(color.s + delta) });
                        }
                        else {
                            update({ v: clamp(color.v + delta) });
                        }
                    },
                    onpointercancel: (e: PointerEvent) => {
                        if (e.pointerId === pointer.pad) {
                            pointer.pad = -1;
                            commit();
                        }
                    },
                    // Pointer capture keeps the drag alive outside the pad, and only the first pointer counts, so
                    // a second finger can't make the handle jump.
                    onpointerdown: function(this: HTMLElement, e: PointerEvent) {
                        if (pointer.pad !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) {
                            return;
                        }

                        pointer.pad = e.pointerId;
                        this.setPointerCapture(e.pointerId);

                        let rect = this.getBoundingClientRect();

                        update({
                            s: clamp((e.clientX - rect.left) / rect.width),
                            v: 1 - clamp((e.clientY - rect.top) / rect.height)
                        });
                    },
                    onpointermove: function(this: HTMLElement, e: PointerEvent) {
                        if (e.pointerId !== pointer.pad) {
                            return;
                        }

                        let rect = this.getBoundingClientRect();

                        update({
                            s: clamp((e.clientX - rect.left) / rect.width),
                            v: 1 - clamp((e.clientY - rect.top) / rect.height)
                        });
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
                        onconnect: (element: HTMLInputElement) => {
                            parts.hue = element;
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
                        onconnect: (element: HTMLInputElement) => {
                            parts.alpha = element;
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
                <label class='color-picker-hex ${() => picker.invalid && '--invalid'}'>
                    <span class='color-picker-hash'>#</span>
                    ${input({
                        'aria-invalid': () => picker.invalid ? 'true' : 'false',
                        'aria-label': 'Hex color',
                        autocapitalize: 'characters',
                        autocomplete: 'off',
                        class: 'color-picker-hex-input',
                        maxlength: 9,
                        onblur: () => apply(true),
                        onconnect: (element: HTMLInputElement) => {
                            parts.hex = element;
                            element.value = toHex(read()).slice(1);
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
                                this.value = toHex(read()).slice(1);
                                picker.invalid = false;
                            }
                        },
                        spellcheck: false
                    })}
                </label>
                <span aria-hidden='true' class='color-picker-alpha'>${() => `${Math.round(color.a * 100)}%`}</span>
                <span aria-live='polite' class='color-picker-status'>${() => picker.invalid ? 'Not a valid hex color' : ''}</span>
            </div>

            <div class='color-picker-recent'>
                <p class='color-picker-recent-label' id='${id}-recent'>Recent</p>
                <div
                    aria-labelledby='${id}-recent'
                    class='color-picker-swatches'
                    role='group'
                    ${{
                        onrender: (element: HTMLElement) => {
                            parts.swatches = element;
                        }
                    }}
                >
                    ${html.reactive(recent, (hex) => html`
                        <button
                            aria-label='Use ${hex}'
                            class='color-picker-swatch'
                            data-hex='${hex}'
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
                </div>
            </div>
        </div>
    `;
}


export default Object.assign(template, { swatch: COLOR_PICKER_SWATCH } as const);
