import { component, html, on, type Attributes, type Element, type Renderable } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import form from '~/components/form';
import scrollbar from '~/css-utilities/scrollbar';
import { observeSize } from '~/shared/resize';
import './scss/index.scss';


const DATALIST_LENS = Symbol.for('@esportsplus/ui/datalist.lens');

const DATALIST_OPTION = Symbol.for('@esportsplus/ui/datalist.option');

const DATALIST_SCROLLER = Symbol.for('@esportsplus/ui/datalist.scroller');

const SETTLE_DELAY = 140;

const STEPS: Record<string, number> = {
    ArrowDown: 1,
    ArrowUp: -1,
    PageDown: 5,
    PageUp: -5
};


type A = {
    [DATALIST_LENS]?: Attributes;
    [DATALIST_OPTION]?: Attributes & {
        'aria-selected'?: never;
        onclick?: never;
    };
    [DATALIST_SCROLLER]?: Attributes & {
        'aria-activedescendant'?: never;
        onconnect?: never;
        ondragstart?: never;
        onkeydown?: never;
        onpointercancel?: never;
        onpointerdown?: never;
        onpointermove?: never;
        onpointerup?: never;
        onscroll?: never;
    };
    options: Record<number | string, Renderable<unknown>>;
} & (
    {
        selected?: number | string;
        state?: never;
    } | {
        selected?: never;
        state: State;
    }
) & Attributes;

type D = Attributes & Pick<A, typeof DATALIST_LENS | typeof DATALIST_OPTION | typeof DATALIST_SCROLLER>;

type State = {
    error: string;
    selected?: number | string;
    settled: boolean;
};


let uid = 0;


export default component(
    function(
        this: { attributes?: D },
        {
            options,
            selected,
            state = reactive({
                error: '',
                selected: selected ?? Object.keys(options)[0],
                settled: true
            }),
            ...attributes
        }: A
    ) {
        let keys = Object.keys(options),
            active = reactive(
                Object.fromEntries( keys.map(key => [key, false]) ) as Record<string, boolean>
            ),
            drum = reactive({ half: 0, offset: 0 }),
            height = 0,
            id = `datalist-${++uid}`,
            option: HTMLElement | undefined,
            previous: string | undefined,
            scroller: HTMLElement | undefined,
            timeline = typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()'),
            timer: ReturnType<typeof setTimeout> | undefined;

        function clamp(index: number) {
            return Math.min(Math.max(index, 0), keys.length - 1);
        }

        function measure() {
            if (!scroller || !option) {
                return;
            }

            let next = option.offsetHeight;

            // Measured while hidden (0) or at another item size, the scroller no longer sits on the selection
            if (next !== height) {
                height = next;
                scroller.scrollTo({ behavior: 'instant', top: clamp(keys.indexOf(String(state.selected))) * height });
            }

            if (!height || timeline) {
                return;
            }

            drum.half = scroller.clientHeight / 2 / height;
            paint();
        }

        // Selection is derived from scroll position
        function onscroll() {
            if (!scroller || !height) {
                return;
            }

            paint();

            let key = keys[clamp(Math.round(scroller.scrollTop / height))];

            if (key !== String(state.selected)) {
                state.selected = key;
            }

            state.settled = false;
            clearTimeout(timer);
            timer = setTimeout(settle, SETTLE_DELAY);
        }

        // Fallback for engines without scroll-driven animations; the drum transform reads `--offset` in CSS
        function paint() {
            if (timeline) {
                return;
            }

            drum.offset = scroller!.scrollTop / height;
        }

        function scrollTo(index: number) {
            scroller?.scrollTo({ top: clamp(index) * height });
        }

        function settle() {
            clearTimeout(timer);
            state.settled = true;
        }

        effect(() => {
            let key = String(state.selected);

            untrack(() => {
                if (previous !== undefined) {
                    active[previous] = false;
                }

                active[key] = true;
                previous = key;

                let index = keys.indexOf(key);

                if (scroller && height && index !== -1 && index !== Math.round(scroller.scrollTop / height)) {
                    scrollTo(index);
                }
            });
        });

        onCleanup(() => clearTimeout(timer));

        return html`
            <div class='datalist' ${this?.attributes} ${attributes}>
                <div class='datalist-lens' aria-hidden='true' ${this?.attributes?.[DATALIST_LENS]} ${attributes[DATALIST_LENS]}></div>

                <div
                    class='datalist-scroller --scrollbar-hidden'
                    role='listbox'
                    tabindex='0'
                    ${this?.attributes?.[DATALIST_SCROLLER]}
                    ${attributes[DATALIST_SCROLLER]}
                    ${scrollbar.drag('vertical')}
                    ${observeSize(measure)}
                    ${{
                        'aria-activedescendant': () => {
                            let index = keys.indexOf(String(state.selected));

                            return index !== -1 && `${id}-${index}`;
                        },
                        onconnect: (element: Element) => {
                            scroller = element as HTMLElement;

                            // `scrollend` does not bubble so it cannot be delegated
                            on(element, 'scrollend', settle);
                        },
                        onkeydown: (e: KeyboardEvent) => {
                            let index = keys.indexOf(String(state.selected));

                            if (e.key in STEPS) {
                                index += STEPS[e.key];
                            }
                            else if (e.key === 'Home') {
                                index = 0;
                            }
                            else if (e.key === 'End') {
                                index = keys.length - 1;
                            }
                            else {
                                return;
                            }

                            e.preventDefault();
                            scrollTo(index);
                        },
                        onscroll,
                        style: () => drum.half && `--half: ${drum.half}; --offset: ${drum.offset};`
                    }}
                >
                    <div class='datalist-track'>
                        ${keys.map((key, index) => html`
                            <div
                                class='datalist-option ${() => active[key] && '--active'}'
                                id='${id}-${index}'
                                role='option'
                                style='--index: ${index}'
                                ${this?.attributes?.[DATALIST_OPTION]}
                                ${attributes[DATALIST_OPTION]}
                                ${{
                                    'aria-selected': () => active[key] ? 'true' : 'false',
                                    onclick: () => scrollTo(index),
                                    onconnect: (element: HTMLElement) => {
                                        option ??= element;
                                    }
                                }}
                            >
                                ${options[key]}
                            </div>
                        `)}
                    </div>
                </div>

                <input class='datalist-tag'
                    ${{
                        name: attributes.name,
                        onconnect: form.input.onconnect(state),
                        value: () => state.selected
                    }}
                />
            </div>
        `;
    },
    { lens: DATALIST_LENS, option: DATALIST_OPTION, scroller: DATALIST_SCROLLER }
);
