import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive, ReactiveArray, type Reactive } from '@esportsplus/reactivity';
import close from '@esportsplus/ui/svg/close.svg';
import { measure, slide, timing } from '~/shared/animation';
import input from './field';


type A = Attributes & {
    [INPUT_TAG_FIELD]?: Field;
    hint?: Renderable<unknown>;
    label: string;
    name?: string;
    placeholder?: string;
    state?: State;
    tags?: string[];
};

// A chip's element, carrying the shake still running on it.
type Chip = HTMLElement & { [SHAKING]?: Animation };

type D = Attributes & Pick<A, typeof INPUT_TAG_FIELD>;

// A removed chip's stand-in, laid where the chip stood while it fades out.
type Ghost = {
    height: number;
    left: number;
    tag: string;
    top: number;
    width: number;
};

type Field = Parameters<typeof input>[0];

type State = {
    active: boolean;
    error: string;
    tags: Reactive<string[]>;
};


// Exits are quicker than the pop, so removing never holds the eye.
const LEAVE: KeyframeAnimationOptions = { duration: 150, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };

// A chip is a small physical thing, so it lands with the faintest settle.
const POP: KeyframeAnimationOptions = {
    duration: 380,
    easing: 'linear(0, 0.035, 0.107, 0.208, 0.31, 0.42, 0.524, 0.61, 0.692, 0.757, 0.815, 0.863, 0.898, 0.928, 0.95, 0.968, 0.981, 0.989, 0.996, 1, 1.003, 1.004, 1.005, 1.005, 1.005, 1.005, 1.004, 1.004, 1.003, 1.003, 1)'
};

// Decaying swings say "already here" without reading as an error.
const SHAKE: KeyframeAnimationOptions = { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' };

const SHAKING = Symbol();

// Eases like the row's slide.
const SWAP: KeyframeAnimationOptions = { delay: 60, duration: 300, fill: 'backwards' };

const INPUT_TAG_FIELD = Symbol.for('@esportsplus/ui/input.tag.field');


let uid = 0;


function key(tag: string) {
    return tag.toLowerCase();
}

// How chips move, from the CSS: how far they blur, shrink and shake, how dim a shake goes, what the remove button grows
// from, and the row's slide.
function motion(element: Element) {
    let computed = getComputedStyle(element);

    return {
        blur: parseFloat(computed.getPropertyValue('--chip-blur')) || 0,
        dim: parseFloat(computed.getPropertyValue('--chip-shake-opacity')) || 1,
        grow: parseFloat(computed.getPropertyValue('--chip-remove-scale')) || 1,
        scale: parseFloat(computed.getPropertyValue('--chip-scale')) || 1,
        settle: computed.getPropertyValue('--chip-slide-easing').trim() || 'ease',
        shake: parseFloat(computed.getPropertyValue('--chip-shake')) || 0,
        slide: timing(computed, 'chip-slide')
    };
}


export default component(
    function(
        this: { attributes?: D } | void,
        {
            hint,
            label,
            name,
            placeholder = 'Add a tag',
            tags = [],
            state = reactive({ active: false, error: '', tags: new ReactiveArray<string>(tags) }),
            ...attributes
        }: A
    ) {
        let chips = new Map<string, Chip>(),
            field: HTMLInputElement | undefined,
            ghosts = new ReactiveArray<Ghost>(),
            id = `input-tag-${++uid}`,
            list: HTMLElement | undefined,
            local = reactive({ announcement: '', armed: '' }),
            slot = html.reactive(state.tags, (tag) => html`
                <li
                    class='input-tag-chip ${() => local.armed === key(tag) && '--active'}'
                    ${{
                        onconnect: (element: HTMLElement) => {
                            chips.set(key(tag), element);
                        },
                        ondisconnect: (element: HTMLElement) => {
                            if (chips.get(key(tag)) === element) {
                                chips.delete(key(tag));
                            }
                        }
                    }}
                >
                    <span aria-hidden='true' class='input-tag-chip-body'></span>
                    <span class='input-tag-chip-text'>${tag}</span>
                    <span class='input-tag-chip-remove'>
                        <button
                            aria-label='Remove ${tag}'
                            class='input-tag-chip-button'
                            type='button'
                            ${{
                                onclick: () => {
                                    remove(key(tag));
                                    field?.focus();
                                },
                                // Keeps focus in the field, so typing carries straight on.
                                onpointerdown: (e: PointerEvent) => {
                                    e.preventDefault();
                                }
                            }}
                        >
                            <svg aria-hidden='true'><use href='#${close}' /></svg>
                        </button>
                    </span>
                    ${name && html`<input name='${name}[]' type='hidden' value='${tag}' />`}
                </li>
            `),
            stand = html.reactive(ghosts, (ghost) => html`
                <li
                    aria-hidden='true'
                    class='input-tag-chip input-tag-ghost'
                    inert
                    style='height: ${ghost.height}px; left: ${ghost.left}px; top: ${ghost.top}px; width: ${ghost.width}px;'
                    ${{
                        // Not before: until it is in the document its node belongs to the template's own, whose clock
                        // never runs.
                        onconnect: (element: HTMLElement) => {
                            let { blur, scale } = motion(element);

                            element.animate(
                                { filter: ['blur(0)', `blur(${blur / 2}px)`], opacity: [1, 0], scale: [1, scale] },
                                { ...LEAVE, fill: 'forwards' }
                            ).finished.then(() => {
                                let at = ghosts.indexOf(ghost);

                                if (at !== -1) {
                                    ghosts.splice(at, 1);
                                }
                            }, () => {});
                        }
                    }}
                >
                    <span aria-hidden='true' class='input-tag-chip-body'></span>
                    <span class='input-tag-chip-text'>${ghost.tag}</span>
                    <span class='input-tag-chip-remove'>
                        <span class='input-tag-chip-button'><svg aria-hidden='true'><use href='#${close}' /></svg></span>
                    </span>
                </li>
            `);

        function add(raw: string[], typed: boolean) {
            let added: string[] = [],
                seen = new Set<string>(state.tags.map(key));

            for (let i = 0, n = raw.length; i < n; i++) {
                let tag = raw[i].trim();

                if (!tag) {
                    continue;
                }

                if (seen.has(key(tag))) {
                    let existing = state.tags.find((t) => key(t) === key(tag)) ?? tag;

                    nudge(key(tag));
                    local.announcement = `${existing} is already added`;
                    continue;
                }

                seen.add(key(tag));
                added.push(tag);
            }

            if (field) {
                field.value = '';
            }

            local.armed = '';

            if (!added.length) {
                return;
            }

            // Only a single typed tag forms in place around its letters; pasted lists pop in, since most land away from the caret.
            let formed = typed && added.length === 1 ? key(added[0]) : '';

            // A formed tag is the only one added, so whatever enters is its chip.
            mutate(() => state.tags.push(...added), formed ? form : pop);
            local.announcement = `Added ${added.join(', ')}`;
        }

        // Its letters are already on screen where the field was, so only the chip's body and remove button form around them.
        function form(chip: HTMLElement) {
            let body = chip.querySelector('.input-tag-chip-body'),
                remove = chip.querySelector('.input-tag-chip-remove'),
                { blur, grow, scale, settle } = motion(chip);

            body?.animate({ opacity: [0, 1], scale: [scale, 1] }, POP);
            remove?.animate({ filter: [`blur(${blur}px)`, 'blur(0)'], opacity: [0, 1], scale: [grow, 1] }, { ...SWAP, easing: settle });
        }

        // Records every item's box, applies the change, then slides each survivor from its old box to its new one.
        function mutate(change: () => void, enter?: (chip: HTMLElement) => void) {
            if (!list) {
                change();
                return;
            }

            let children = list.children,
                shift = motion(list).slide;

            measure(children);
            change();
            slot.flush();

            for (let i = 0, n = children.length; i < n; i++) {
                let child = children[i] as HTMLElement;

                if (!child.classList.contains('input-tag-ghost') && !slide(child, shift)) {
                    enter?.(child);
                }
            }
        }

        function nudge(k: string) {
            let element = chips.get(k);

            if (!element) {
                return;
            }

            let { dim, shake } = motion(element);

            element[SHAKING]?.cancel();
            element[SHAKING] = element.animate(
                { opacity: [1, dim, 1], translate: ['0', `${-shake}px`, `${shake}px`, `${shake * -0.75}px`, `${shake / 2}px`, '0'] },
                SHAKE
            );
        }

        function pop(chip: HTMLElement) {
            let { blur, scale } = motion(chip);

            chip.animate({ filter: [`blur(${blur}px)`, 'blur(0)'], opacity: [0, 1], scale: [scale, 1] }, POP);
        }

        function remove(k: string) {
            let index = state.tags.findIndex((t) => key(t) === k);

            if (index === -1) {
                return;
            }

            let element = chips.get(k),
                tag = state.tags[index];

            // Leaves a ghost in its place to fade out, while the real chip leaves the flow at once and the rest close up.
            if (element && list) {
                let origin = list.getBoundingClientRect(),
                    rect = element.getBoundingClientRect();

                ghosts.push({ height: rect.height, left: rect.left - origin.left, tag, top: rect.top - origin.top, width: rect.width });
            }

            mutate(() => state.tags.splice(index, 1));
            local.announcement = `Removed ${tag}`;
            local.armed = '';
        }

        return html`
            <div
                class='input-tag'
                ${this?.attributes}
                ${attributes}
            >
                <label class='input-tag-label' for='${id}'>${label}</label>
                <div
                    class='input-tag-box'
                    ${{
                        // Pressing the field's empty space types into it, like a real input.
                        onpointerdown: (e: PointerEvent) => {
                            let target = e.target as HTMLElement;

                            if (target !== e.currentTarget && target !== list) {
                                return;
                            }

                            e.preventDefault();
                            field?.focus();
                        }
                    }}
                >
                    <ul
                        class='input-tag-list'
                        ${{
                            'aria-label': () => `${label}, ${slot.length} added`,
                            onconnect: (element: HTMLElement) => {
                                list = element;
                            }
                        }}
                    >
                        ${slot}
                        ${stand}
                        <li class='input-tag-entry' role='none'>
                            ${input.call({ attributes: { ...this?.attributes?.[INPUT_TAG_FIELD], ...attributes[INPUT_TAG_FIELD] } }, {
                                autocomplete: 'off',
                                class: 'input-tag-field',
                                enterkeyhint: 'enter',
                                id,
                                onblur: () => {
                                    local.armed = '';
                                },
                                onconnect: (element: HTMLInputElement) => {
                                    field = element;
                                },
                                oninput: (e: Event) => {
                                    let value = (e.currentTarget as HTMLInputElement).value;

                                    // Mobile keyboards often never fire a comma keydown.
                                    if (value.includes(',')) {
                                        add(value.split(','), true);
                                    }
                                    else {
                                        local.armed = '';
                                    }
                                },
                                onkeydown: (e: KeyboardEvent) => {
                                    let element = e.currentTarget as HTMLInputElement;

                                    if (e.key === 'Enter' || e.key === ',') {
                                        e.preventDefault();
                                        add([element.value], true);
                                    }
                                    else if (e.key === 'Backspace' && element.value === '' && state.tags.length) {
                                        e.preventDefault();

                                        // The first Backspace arms the last chip; the second removes it.
                                        let last = key(state.tags[state.tags.length - 1]);

                                        if (local.armed === last) {
                                            remove(last);
                                        }
                                        else {
                                            local.armed = last;
                                        }
                                    }
                                    else if (e.key === 'Escape') {
                                        local.armed = '';
                                    }
                                },
                                onpaste: (e: ClipboardEvent) => {
                                    let text = e.clipboardData?.getData('text') ?? '';

                                    if (!/[,\n]/.test(text)) {
                                        return;
                                    }

                                    e.preventDefault();
                                    add(((e.currentTarget as HTMLInputElement).value + text).split(/[,\n]/), false);
                                },
                                placeholder,
                                state
                            })}
                        </li>
                    </ul>
                </div>
                ${!!hint && html`<p class='input-tag-hint'>${hint}</p>`}
                <span aria-live='polite' class='input-tag-live'>${() => local.announcement}</span>
            </div>
        `;
    },
    { field: INPUT_TAG_FIELD }
);
