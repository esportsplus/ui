import { component, html, on, type Attributes, type Element, type Renderable } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import form from '~/components/form';
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
        onkeydown?: never;
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


export default Object.assign(component<A>(
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
            height = 0,
            id = `datalist-${++uid}`,
            observer: ResizeObserver | undefined,
            previous: string | undefined,
            scroller: HTMLElement | undefined,
            timer: ReturnType<typeof setTimeout> | undefined;

        function clamp(index: number) {
            return Math.min(Math.max(index, 0), keys.length - 1);
        }

        function measure() {
            let option = scroller?.querySelector<HTMLElement>('.datalist-option');

            if (!scroller || !option) {
                return;
            }

            height = option.offsetHeight;
            scroller.style.setProperty('--half', `${scroller.clientHeight / 2 / height}`);
            paint();
        }

        // Selection is derived from scroll position; the drum transform reads `--offset` in CSS
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

        function paint() {
            scroller!.style.setProperty('--offset', `${scroller!.scrollTop / height}`);
        }

        function scrollTo(index: number) {
            scroller?.scrollTo({
                behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
                top: clamp(index) * height
            });
        }

        function settle() {
            clearTimeout(timer);
            state.settled = true;
        }

        let stop = effect(() => {
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

        onCleanup(() => {
            clearTimeout(timer);
            observer?.disconnect();
            stop();
        });

        return html`
            <div class='datalist' ${this?.attributes} ${attributes}>
                <div class='datalist-lens' aria-hidden='true' ${this?.attributes?.[DATALIST_LENS]} ${attributes[DATALIST_LENS]}></div>

                <div
                    class='datalist-scroller'
                    role='listbox'
                    tabindex='0'
                    ${this?.attributes?.[DATALIST_SCROLLER]}
                    ${attributes[DATALIST_SCROLLER]}
                    ${{
                        'aria-activedescendant': () => `${id}-${keys.indexOf(String(state.selected))}`,
                        onconnect: (element: Element) => {
                            scroller = element;
                            measure();
                            scroller.scrollTop = clamp(keys.indexOf(String(state.selected))) * height;
                            paint();

                            // `scrollend` does not bubble so it cannot be delegated
                            on(element, 'scrollend', settle);

                            observer = new ResizeObserver(measure);
                            observer.observe(scroller);
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
                        onscroll
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
                                    onclick: () => scrollTo(index)
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
                        onrender: form.input.onrender(state),
                        value: () => state.selected
                    }}
                />
            </div>
        `;
    }
), { lens: DATALIST_LENS, option: DATALIST_OPTION, scroller: DATALIST_SCROLLER } as const);
