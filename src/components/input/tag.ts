import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive, ReactiveArray, type Reactive } from '@esportsplus/reactivity';
import close from '@esportsplus/ui/svg/close.svg';
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

type Chip = {
    body?: HTMLElement;
    element?: HTMLElement;
    remove?: HTMLElement;
};

type D = Attributes & Pick<A, typeof INPUT_TAG_FIELD>;

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

// No bounce on the slide: the row closing up should read as settled.
const SLIDE: KeyframeAnimationOptions = {
    duration: 410,
    easing: 'linear(0, 0.038, 0.116, 0.219, 0.326, 0.43, 0.518, 0.602, 0.674, 0.731, 0.782, 0.825, 0.858, 0.886, 0.91, 0.928, 0.942, 0.955, 0.964, 0.971, 0.977, 0.982, 0.986, 0.989, 0.991, 0.993, 0.995, 0.996, 0.997, 0.997, 1)'
};

const SWAP: KeyframeAnimationOptions = { ...SLIDE, delay: 60, duration: 300, fill: 'backwards' };

const INPUT_TAG_FIELD = Symbol.for('@esportsplus/ui/input.tag.field');


let uid = 0;


function key(tag: string) {
    return tag.toLowerCase();
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
            flips = new Map<Element, Animation>(),
            id = `input-tag-${++uid}`,
            list: HTMLElement | undefined,
            local = reactive({ announcement: '', armed: '' }),
            reduced = matchMedia('(prefers-reduced-motion: reduce)'),
            shakes = new Map<Element, Animation>(),
            slot = html.reactive(state.tags, (tag) => html`
                <li
                    class='input-tag-chip ${() => local.armed === key(tag) && '--active'}'
                    data-key='${key(tag)}'
                    ${{
                        ondisconnect: (element: HTMLElement) => {
                            if (chips.get(key(tag))?.element === element) {
                                chips.delete(key(tag));
                            }
                        },
                        onrender: (element: HTMLElement) => {
                            chip(key(tag)).element = element;
                        }
                    }}
                >
                    <span
                        aria-hidden='true'
                        class='input-tag-chip-body'
                        ${{
                            onrender: (element: HTMLElement) => {
                                chip(key(tag)).body = element;
                            }
                        }}
                    ></span>
                    <span class='input-tag-chip-text'>${tag}</span>
                    <span
                        class='input-tag-chip-remove'
                        ${{
                            onrender: (element: HTMLElement) => {
                                chip(key(tag)).remove = element;
                            }
                        }}
                    >
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
                    ${name ? html`<input name='${name}[]' type='hidden' value='${tag}' />` : ''}
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

            mutate(() => state.tags.push(...added), (element) => {
                if (element.dataset.key === formed) {
                    form(chips.get(formed));
                }
                else {
                    pop(element);
                }
            });
            local.announcement = `Added ${added.join(', ')}`;
        }

        function chip(k: string) {
            let parts = chips.get(k);

            if (!parts) {
                parts = {};
                chips.set(k, parts);
            }

            return parts;
        }

        // Its letters are already on screen where the field was, so only the chip's body and remove button form around them.
        function form(parts: Chip | undefined) {
            let body = parts?.body,
                remove = parts?.remove;

            if (reduced.matches) {
                body?.animate({ opacity: [0, 1] }, POP);
                remove?.animate({ opacity: [0, 1] }, SWAP);
                return;
            }

            body?.animate({ opacity: [0, 1], scale: [0.9, 1] }, POP);
            remove?.animate({ filter: ['blur(4px)', 'blur(0)'], opacity: [0, 1], scale: [0.25, 1] }, SWAP);
        }

        // Records every item's box, applies the change, then slides each survivor from its old box to its new one.
        function mutate(change: () => void, enter?: (chip: HTMLElement) => void) {
            if (!list) {
                change();
                return;
            }

            let before = new Map<Element, DOMRect>(),
                children = list.children;

            for (let i = 0, n = children.length; i < n; i++) {
                before.set(children[i], children[i].getBoundingClientRect());
            }

            change();
            slot.flush();

            for (let [element, animation] of flips) {
                animation.cancel();
                flips.delete(element);
            }

            for (let i = 0, n = children.length; i < n; i++) {
                let child = children[i] as HTMLElement;

                if (child.classList.contains('input-tag-ghost')) {
                    continue;
                }

                let first = before.get(child);

                if (!first) {
                    enter?.(child);
                    continue;
                }

                if (reduced.matches) {
                    continue;
                }

                let last = child.getBoundingClientRect(),
                    dx = first.left - last.left,
                    dy = first.top - last.top;

                if (!dx && !dy) {
                    continue;
                }

                let animation = child.animate({ transform: [`translate(${dx}px, ${dy}px)`, 'none'] }, SLIDE);

                animation.onfinish = () => flips.delete(child);
                flips.set(child, animation);
            }
        }

        function nudge(k: string) {
            let element = chips.get(k)?.element;

            if (!element) {
                return;
            }

            shakes.get(element)?.cancel();
            shakes.set(
                element,
                reduced.matches
                    ? element.animate({ opacity: [1, 0.4, 1] }, SHAKE)
                    : element.animate({ translate: ['0', '-4px', '4px', '-3px', '2px', '0'] }, SHAKE)
            );
        }

        function pop(chip: HTMLElement) {
            if (reduced.matches) {
                chip.animate({ opacity: [0, 1] }, POP);
                return;
            }

            chip.animate({ filter: ['blur(4px)', 'blur(0)'], opacity: [0, 1], scale: [0.9, 1] }, POP);
        }

        function remove(k: string) {
            let index = state.tags.findIndex((t) => key(t) === k);

            if (index === -1) {
                return;
            }

            let element = chips.get(k)?.element,
                tag = state.tags[index];

            // Leaves a ghost in its place to fade out, while the real chip leaves the flow at once and the rest close up.
            if (element && list) {
                let ghost = element.cloneNode(true) as HTMLElement,
                    origin = list.getBoundingClientRect(),
                    rect = element.getBoundingClientRect();

                ghost.classList.add('input-tag-ghost');
                ghost.classList.remove('--active');
                ghost.inert = true;
                ghost.removeAttribute('data-key');
                ghost.style.cssText = `height: ${rect.height}px; left: ${rect.left - origin.left}px; top: ${rect.top - origin.top}px; width: ${rect.width}px;`;
                list.append(ghost);
                ghost.animate(
                    reduced.matches
                        ? { opacity: [1, 0] }
                        : { filter: ['blur(0)', 'blur(2px)'], opacity: [1, 0], scale: [1, 0.9] },
                    { ...LEAVE, fill: 'forwards' }
                ).onfinish = () => ghost.remove();
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
                ${{
                    ondisconnect: () => {
                        for (let [, animation] of shakes) {
                            animation.cancel();
                        }

                        shakes.clear();
                    }
                }}
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
                            onrender: (element: HTMLElement) => {
                                list = element;
                            }
                        }}
                    >
                        ${slot}
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
                ${hint ? html`<p class='input-tag-hint'>${hint}</p>` : ''}
                <span aria-live='polite' class='input-tag-live'>${() => local.announcement}</span>
            </div>
        `;
    },
    { field: INPUT_TAG_FIELD }
);
