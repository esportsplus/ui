import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive, ReactiveArray, type Reactive } from '@esportsplus/reactivity';
import close from '@esportsplus/ui/svg/close.svg';
import icon from '~/components/icon';
import { measure, ms, slides, timing } from '~/shared/animation';
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


const TAG_SEPARATORS = /[,\n]/;


const SHAKING = Symbol();

const INPUT_TAG_FIELD = Symbol.for('@esportsplus/ui/input.tag.field');


let uid = 0;


function key(tag: string) {
    return tag.toLowerCase();
}

// How chips move, from the CSS: how far they blur, shrink and shake, how dim a shake goes, what the remove button grows
// from, and each motion's timing; the remove button's swap eases like the row's slide.
function motion(element: Element) {
    let computed = getComputedStyle(element),
        settle = computed.getPropertyValue('--slide-timing-function').trim() || 'ease',
        swap = timing(computed, 'swap');

    return {
        blur: parseFloat(computed.getPropertyValue('--blur')) || 0,
        dim: parseFloat(computed.getPropertyValue('--shake-opacity')) || 1,
        grow: parseFloat(computed.getPropertyValue('--remove-scale')) || 1,
        leave: timing(computed, 'leave'),
        pop: timing(computed, 'pop'),
        scale: parseFloat(computed.getPropertyValue('--scale')) || 1,
        shake: parseFloat(computed.getPropertyValue('--shake')) || 0,
        shaking: timing(computed, 'shake'),
        slide: timing(computed, 'slide'),
        swap: swap && { ...swap, delay: ms(computed.getPropertyValue('--swap-delay')), easing: settle, fill: 'backwards' as const }
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
            local = reactive({ announcement: '', armed: '', text: '' }),
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
                            ${icon({ 'aria-hidden': 'true', class: 'input-tag-chip-icon' }, close)}
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
                            let { blur, leave, scale } = motion(element),
                                done = () => {
                                    let at = ghosts.indexOf(ghost);

                                    if (at !== -1) {
                                        ghosts.splice(at, 1);
                                    }
                                };

                            if (!leave) {
                                done();
                                return;
                            }

                            element.animate(
                                { filter: ['blur(0)', `blur(${blur / 2}px)`], opacity: [1, 0], scale: [1, scale] },
                                { ...leave, fill: 'forwards' }
                            ).finished.then(done, () => {});
                        }
                    }}
                >
                    <span aria-hidden='true' class='input-tag-chip-body'></span>
                    <span class='input-tag-chip-text'>${ghost.tag}</span>
                    <span class='input-tag-chip-remove'>
                        <span class='input-tag-chip-button'>${icon({ 'aria-hidden': 'true', class: 'input-tag-chip-icon' }, close)}</span>
                    </span>
                </li>
            `);

        function add(raw: string[], typed: boolean) {
            let added: string[] = [],
                // Each key's spelling among the current tags; undefined for one added earlier in this batch.
                seen = new Map<string, string | undefined>();

            for (let i = 0, n = state.tags.length; i < n; i++) {
                let k = key(state.tags[i]);

                if (!seen.has(k)) {
                    seen.set(k, state.tags[i]);
                }
            }

            for (let i = 0, n = raw.length; i < n; i++) {
                let tag = raw[i].trim();

                if (!tag) {
                    continue;
                }

                let k = key(tag);

                if (seen.has(k)) {
                    nudge(k);
                    local.announcement = `${seen.get(k) ?? tag} is already added`;
                    continue;
                }

                seen.set(k, undefined);
                added.push(tag);
            }

            local.armed = '';
            local.text = '';

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
        // Queried, since the chip forms in the frame it renders in, ahead of its parts' connect callbacks.
        function form(chip: HTMLElement) {
            let body = chip.querySelector('.input-tag-chip-body'),
                remove = chip.querySelector('.input-tag-chip-remove'),
                { blur, grow, pop, scale, swap } = motion(chip);

            if (pop) {
                body?.animate({ opacity: [0, 1], scale: [scale, 1] }, pop);
            }

            if (swap) {
                remove?.animate({ filter: [`blur(${blur}px)`, 'blur(0)'], opacity: [0, 1], scale: [grow, 1] }, swap);
            }
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

            slides([...children as HTMLCollectionOf<HTMLElement>].filter((child) => !child.classList.contains('input-tag-ghost')), shift, enter);
        }

        function nudge(k: string) {
            let element = chips.get(k);

            if (!element) {
                return;
            }

            let { dim, shake, shaking } = motion(element);

            element[SHAKING]?.cancel();

            if (!shaking) {
                return;
            }

            element[SHAKING] = element.animate(
                { opacity: [1, dim, 1], translate: ['0', `${-shake}px`, `${shake}px`, `${shake * -0.75}px`, `${shake / 2}px`, '0'] },
                shaking
            );
        }

        function pop(chip: HTMLElement) {
            let { blur, pop, scale } = motion(chip);

            if (pop) {
                chip.animate({ filter: [`blur(${blur}px)`, 'blur(0)'], opacity: [0, 1], scale: [scale, 1] }, pop);
            }
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

                                    local.text = value;

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

                                    if (!TAG_SEPARATORS.test(text)) {
                                        return;
                                    }

                                    e.preventDefault();
                                    add(((e.currentTarget as HTMLInputElement).value + text).split(TAG_SEPARATORS), false);
                                },
                                placeholder,
                                state,
                                value: () => local.text
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
