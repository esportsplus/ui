import { component, html, type Attributes } from '@esportsplus/template';
import { effect, reactive } from '@esportsplus/reactivity';
import onclick from './onclick';
import render, { type Option } from './options';


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
            keyboard = false,
            menu: HTMLElement | undefined,
            trigger: HTMLElement | undefined;

        function close(refocus: boolean) {
            state.active = false;

            if (refocus) {
                trigger?.focus({ preventScroll: true });
            }
        }

        function focus(index: number) {
            let visible = items(),
                n = visible.length;

            visible[((index % n) + n) % n]?.focus({ preventScroll: true });
        }

        function items() {
            return menu ? [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([hidden])')] : [];
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

            // Keyboard and assistive tech opens want the first item; pointer opens focus the menu itself.
            if (keyboard) {
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
                        onrender: (element: HTMLElement) => {
                            element.inert = !state.active;
                            menu = element;
                        }
                    }}
                >
                    ${render(
                        options.map(({ onclick, ...option }) => ({
                            ...option,
                            // Also keeps the click from reaching the tooltip's own toggle, which would reopen it.
                            onclick: function(this: HTMLElement, e: PointerEvent) {
                                onclick?.call(this, e);
                                close(true);
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
