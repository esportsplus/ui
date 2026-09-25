import { html, type Attributes, type Renderable } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import '~/components/tabs/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    [SLIDING_TABS_PANEL]?: Attributes;
    [SLIDING_TABS_TAB]?: Attributes;
    label: string;
    selected?: string;
    state?: State;
    tabs: Tab[];
};

type State = {
    selected: string;
};

type Tab = {
    content: Renderable<unknown>;
    id: string;
    label: string;
};


const EASE_OUT = 'cubic-bezier(0.23, 1, 0.32, 1)';

const SLIDING_TABS_PANEL = Symbol.for('@esportsplus/ui/sliding-tabs.panel');

const SLIDING_TABS_TAB = Symbol.for('@esportsplus/ui/sliding-tabs.tab');


let uid = 0;


function instant(element: HTMLElement, update: VoidFunction) {
    element.classList.add('--instant');
    update();
    getComputedStyle(element).opacity;
    element.classList.remove('--instant');
}

function reduced() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}


const slidingTabs = ({ label, selected, state, tabs, ...attributes }: A) => {
    let applied = '',
        hover: HTMLElement | undefined,
        id = `sliding-tabs-${++uid}`,
        initial = '',
        list: HTMLElement | undefined,
        observer: ResizeObserver | undefined,
        panels = new Map<string, HTMLElement>(),
        running = new Map<HTMLElement, Animation>(),
        s = state ?? reactive({ selected: selected ?? tabs[0]?.id ?? '' }),
        tabRefs = new Map<string, HTMLElement>(),
        underline: HTMLElement | undefined;

    initial = untrack(() => s.selected);

    function animate(panel: HTMLElement, keyframes: Keyframe[], duration: number) {
        running.get(panel)?.cancel();

        let animation = panel.animate(keyframes, { duration, easing: EASE_OUT });

        running.set(panel, animation);

        return animation;
    }

    function apply(next: string) {
        let previous = applied,
            target = measure(next);

        if (!list || !underline || !target || previous === next) {
            return;
        }

        applied = next;

        let from = index(previous),
            to = index(next),
            dir = to > from ? 1 : -1,
            reduce = reduced();

        underline.classList.toggle('--forward', target[1] > parseFloat(getComputedStyle(underline).getPropertyValue('--sliding-tabs-right')));
        place(target);

        let incoming = panels.get(next),
            outgoing = panels.get(previous);

        if (outgoing) {
            outgoing.classList.remove('--active');
            outgoing.classList.add('--leaving');
            outgoing.inert = true;

            // Softer and faster than the entrance, so the old panel is gone before the new one draws the eye.
            animate(outgoing, [
                { opacity: 1, translate: '0 0' },
                { opacity: 0, translate: `${reduce ? 0 : dir * -6}px 0` }
            ], 150).onfinish = () => {
                outgoing.classList.remove('--leaving');
                outgoing.inert = false;
            };
        }

        if (incoming) {
            incoming.classList.remove('--leaving');
            incoming.classList.add('--active');
            incoming.inert = false;

            animate(incoming, [
                { filter: reduce ? 'blur(0px)' : 'blur(4px)', opacity: 0, translate: `${reduce ? 0 : dir * 8}px 0` },
                { filter: 'blur(0px)', opacity: 1, translate: '0 0' }
            ], 250);
        }
    }

    function enter(tab: string, e: PointerEvent) {
        let element = tabRefs.get(tab);

        if (e.pointerType === 'touch' || !hover || !element) {
            return;
        }

        let pill = hover,
            update = () => {
                pill.style.translate = `${element.offsetLeft}px 0`;
                pill.style.width = `${element.offsetWidth}px`;
            };

        // Fresh entries fade in where the pointer is instead of sliding over from where it last left.
        if (pill.classList.contains('--active')) {
            update();
        }
        else {
            instant(pill, update);
            pill.classList.add('--active');
        }
    }

    function index(tab: string) {
        return tabs.findIndex((t) => t.id === tab);
    }

    function measure(tab: string) {
        let element = tabRefs.get(tab);

        return element ? [element.offsetLeft, element.offsetLeft + element.offsetWidth] as const : null;
    }

    function place(target: readonly [number, number]) {
        underline!.style.setProperty('--sliding-tabs-left', `${target[0]}px`);
        underline!.style.setProperty('--sliding-tabs-right', `${target[1]}px`);
    }

    function select(tab: string) {
        s.selected = tab;
    }

    let stop = effect(() => {
        apply(s.selected);
    });

    onCleanup(() => {
        observer?.disconnect();
        stop();

        for (let animation of running.values()) {
            animation.cancel();
        }
    });

    return html`
        <div class='sliding-tabs' ${attributes}>
            <div
                class='sliding-tabs-list'
                role='tablist'
                ${{
                    'aria-label': label,
                    onconnect: (element: HTMLElement) => {
                        let target = measure(s.selected);

                        list = element;
                        applied = s.selected;

                        if (target && underline) {
                            instant(underline, () => place(target));
                        }

                        element.classList.add('--ready');

                        // Tabs change width with the viewport, so the underline re-fits without animating.
                        observer = new ResizeObserver(() => {
                            let target = measure(applied);

                            if (target && underline) {
                                instant(underline, () => place(target));
                            }
                        });
                        observer.observe(element);
                    },
                    onkeydown: (e: KeyboardEvent) => {
                        let current = index(s.selected),
                            target = ({
                                ArrowLeft: current - 1,
                                ArrowRight: current + 1,
                                End: tabs.length - 1,
                                Home: 0
                            } as Record<string, number>)[e.key];

                        if (target === undefined) {
                            return;
                        }

                        e.preventDefault();

                        // Automatic activation: arrows select as well as focus.
                        let next = tabs[(target + tabs.length) % tabs.length].id;

                        select(next);
                        tabRefs.get(next)?.focus();
                    },
                    onpointerleave: () => {
                        hover?.classList.remove('--active');
                    }
                }}
            >
                <span
                    aria-hidden='true'
                    class='sliding-tabs-hover'
                    ${{ onrender: (element: HTMLElement) => { hover = element; } }}
                ></span>
                ${tabs.map((tab) => html`
                    <button
                        class='sliding-tabs-tab'
                        id='${id}-tab-${tab.id}'
                        role='tab'
                        type='button'
                        ${attributes[SLIDING_TABS_TAB]}
                        ${{
                            'aria-controls': `${id}-panel-${tab.id}`,
                            'aria-selected': () => String(s.selected === tab.id),
                            class: () => s.selected === tab.id && '--active',
                            onclick: () => select(tab.id),
                            onpointerenter: (e: PointerEvent) => enter(tab.id, e),
                            onrender: (element: HTMLElement) => {
                                tabRefs.set(tab.id, element);
                            },
                            tabindex: () => s.selected === tab.id ? 0 : -1
                        }}
                    >
                        <span class='sliding-tabs-label'>${tab.label}</span>
                    </button>
                `)}
                <span
                    aria-hidden='true'
                    class='sliding-tabs-underline'
                    ${{ onrender: (element: HTMLElement) => { underline = element; } }}
                ></span>
            </div>

            <div class='sliding-tabs-panels tabs'>
                ${tabs.map((tab) => html`
                    <div
                        class='sliding-tabs-panel tabs-content ${tab.id === initial && '--active'}'
                        id='${id}-panel-${tab.id}'
                        role='tabpanel'
                        tabindex='0'
                        ${attributes[SLIDING_TABS_PANEL]}
                        ${{
                            'aria-labelledby': `${id}-tab-${tab.id}`,
                            onrender: (element: HTMLElement) => {
                                panels.set(tab.id, element);
                            }
                        }}
                    >
                        ${tab.content}
                    </div>
                `)}
            </div>
        </div>
    `;
};


export default Object.assign(slidingTabs, { panel: SLIDING_TABS_PANEL, tab: SLIDING_TABS_TAB } as const);
export type { State, Tab };
