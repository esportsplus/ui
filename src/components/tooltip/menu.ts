import { component, html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive } from '@esportsplus/reactivity';
import onclick from './onclick';
import render, { type Option } from './options';
import place from './select-menu';


const MENU_OPTION = Symbol.for('@esportsplus/ui/tooltip.menu.option');

const MENU_TOOLTIP_CONTENT = Symbol.for('@esportsplus/ui/tooltip.menu.tooltip-content');


type A = Attributes & {
    [MENU_OPTION]?: Attributes,
    [MENU_TOOLTIP_CONTENT]?: Attributes & { direction?: string },
    onanimationcancel?: never,
    onanimationend?: never,
    onanimationstart?: never,
    onclick?: never,
    ondocumentclick?: never,
    onfocusout?: never,
    onkeydown?: never,
    onpointerdown?: never,
    ontransitioncancel?: never,
    ontransitionend?: never,
    ontransitionrun?: never,
    options: Option[],
    state?: { active: boolean },
    toggle?: boolean
};


export default component(
    ({ options, state = reactive({ active: false }), ...attributes }: A, content) => {
        let { direction = 'nw', ...tooltipContent } = attributes[MENU_TOOLTIP_CONTENT] ?? {},
            elements: HTMLElement[] = [],
            keyboard = false,
            layout = reactive({ placement: '' }),
            menu: HTMLElement | undefined,
            observer: MutationObserver | undefined,
            trigger: HTMLElement | undefined;

        function selection() {
            return Math.max(0, items().findIndex((element) => element.matches('[aria-checked="true"], [aria-selected="true"]')));
        }

        function selectMenu() {
            return menu?.parentElement?.classList.contains('--select-menu');
        }

        function position() {
            if (!menu || !selectMenu()) {
                return;
            }

            trigger ??= menu.parentElement?.querySelector<HTMLElement>('.tooltip-select-menu-trigger') ?? undefined;

            let visible = items(),
                option = visible[0],
                label = option?.querySelector<HTMLElement>('.tooltip-select-menu-option-label'),
                value = trigger?.querySelector<HTMLElement>('.tooltip-select-menu-value');

            if (!trigger || !option || !label || !value) {
                return;
            }

            let placed = place({ label, option, panel: menu, scroller: menu, trigger, value }, visible.length, selection());

            layout.placement = placed.style;
            menu.scrollTo({ top: placed.scroll, behavior: 'instant' });
        }

        onCleanup(() => observer?.disconnect());

        function close(refocus: boolean) {
            state.active = false;

            if (refocus) {
                trigger?.focus({ preventScroll: true });
            }
        }

        function focus(index: number) {
            let visible = items(),
                n = visible.length,
                element = visible[((index % n) + n) % n];

            element?.focus({ preventScroll: true });

            if (element && menu && selectMenu()) {
                let pad = parseFloat(getComputedStyle(menu).paddingTop) || 0,
                    top = element.offsetTop;

                if (top < menu.scrollTop + pad) {
                    menu.scrollTo({ top: top - pad, behavior: 'instant' });
                }
                else if (top + element.offsetHeight > menu.scrollTop + menu.clientHeight - pad) {
                    menu.scrollTo({ top: top + element.offsetHeight - menu.clientHeight + pad, behavior: 'instant' });
                }
            }
        }

        function items() {
            return elements.filter((element) => !element.hidden);
        }

        function move(step: number) {
            let at = items().indexOf(document.activeElement as HTMLElement);

            focus(at === -1 ? (step > 0 ? 0 : -1) : at + step);
        }

        // The trigger is the consumer's content, so it's found from the event rather than rendered here.
        function source(e: Event) {
            let root = e.currentTarget as HTMLElement,
                target = (e.target as HTMLElement).closest<HTMLElement>('a[href], button, [tabindex]');

            if (target && root.contains(target) && !menu?.contains(target)) {
                trigger = target;
            }
        }

        effect(() => state.active, (active) => {
            if (!menu) {
                return;
            }

            menu.inert = !active;

            if (!active) {
                return;
            }

            position();

            // Select menus start on their selection; other menus use the first item or the panel.
            if (selectMenu()) {
                focus(selection());
            }
            else if (keyboard) {
                focus(0);
            }
            else {
                menu.focus({ preventScroll: true });
            }
        });

        return onclick(
            {
                ...attributes,
                onfocusout: (e: FocusEvent) => {
                    if (state.active && !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null)) {
                        close(false);
                    }
                },
                onkeydown: (e: KeyboardEvent) => {
                    if (!menu?.contains(e.target as Node)) {
                        keyboard = true;
                        source(e);

                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                            e.preventDefault();

                            if (state.active) {
                                focus(e.key === 'ArrowDown' ? 0 : -1);
                            }
                            else {
                                state.active = true;
                            }
                        }

                        return;
                    }

                    switch (e.key) {
                        case 'Enter':
                        case ' ':
                            e.preventDefault();
                            items().find((element) => element === document.activeElement)?.click();
                            return;
                        case 'ArrowDown':
                            e.preventDefault();
                            move(1);
                            return;
                        case 'ArrowUp':
                            e.preventDefault();
                            move(-1);
                            return;
                        case 'End':
                            e.preventDefault();
                            focus(-1);
                            return;
                        case 'Escape':
                            e.preventDefault();
                            close(true);
                            return;
                        case 'Home':
                            e.preventDefault();
                            focus(0);
                            return;
                        case 'Tab':
                            // Focus moves on as usual; the menu just gets out of the way.
                            close(false);
                    }
                },
                onpointerdown: (e: PointerEvent) => {
                    keyboard = false;
                    source(e);
                },
                onwindowresize: () => {
                    if (state.active) {
                        position();
                    }
                },
                state
            },
            html`
                ${content}

                <div
                    class='tooltip-content ${`tooltip-content--${direction}`}'
                    role='menu'
                    tabindex='-1'
                    ${tooltipContent}
                    ${{
                        style: [tooltipContent.style, () => layout.placement].flat(),
                        onconnect: (element: HTMLElement) => {
                            element.inert = !state.active;
                            menu = element;

                            if (selectMenu()) {
                                observer = new MutationObserver(() => {
                                    if (state.active) {
                                        position();

                                        if (menu?.contains(document.activeElement)) {
                                            focus(selection());
                                        }
                                    }
                                });
                                observer.observe(element, {
                                    attributeFilter: ['aria-checked', 'aria-selected', 'hidden'],
                                    attributes: true,
                                    subtree: true
                                });
                                position();
                            }
                        }
                    }}
                >
                    ${render(
                        options.map(({ onclick, onconnect, ...option }, index) => ({
                            ...option,
                            // Also keeps the click from reaching the tooltip's own toggle, which would reopen it.
                            onclick: function(this: HTMLElement, e: PointerEvent) {
                                onclick?.call(this, e);
                                close(true);
                            },
                            onconnect: (element: HTMLElement) => {
                                elements[index] = element;
                                onconnect?.(element);
                            },
                            onpointermove: (e: PointerEvent) => {
                                let element = e.currentTarget as HTMLElement;

                                if (e.pointerType !== 'touch' && document.activeElement !== element) {
                                    element.focus({ preventScroll: true });
                                }
                            },
                            role: 'menuitem',
                            tabindex: '-1'
                        })),
                        attributes[MENU_OPTION]
                    )}
                </div>
            `
        );
    },
    { option: MENU_OPTION, tooltipContent: MENU_TOOLTIP_CONTENT }
);


export type { A };
