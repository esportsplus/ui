import { reactive } from '@esportsplus/reactivity';
import { html, component, type Attributes } from '@esportsplus/template';
import './scss/index.scss';


export default component<Attributes & {
    onconnect?: never,
    ondisconnect?: never
} & ({
    lines: number,
    state?: { active: boolean | number, expandable: boolean }
} | {
    lines?: undefined,
    state?: { active: boolean | number, expandable?: boolean }
})>(
    function({ lines, state = reactive({ active: false, expandable: false }), ...attributes }, content) {
        let a: Attributes | undefined,
            c: Attributes | undefined;

        state.expandable = lines === undefined;

        if (lines !== undefined) {
            let measured = reactive({ height: 0 }),
                observer: ResizeObserver | undefined;

            a = {
                class: 'accordion--more --scrollbar',
                style: () => `${measured.height ? `--height: ${measured.height}px; ` : ''}--lines: ${lines};`
            };
            c = {
                onconnect: (element: HTMLElement) => {
                    observer = new ResizeObserver(() => {
                        let computed = getComputedStyle(element),
                            height = element.offsetHeight,
                            line = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2;

                        state.expandable = height > Math.ceil(line * lines);
                        measured.height = height;
                    });
                    observer.observe(element);
                },
                ondisconnect: () => {
                    observer?.disconnect();
                }
            };
        }

        return html`
            <div
                class='accordion'
                ${attributes}
                ${a}
                ${{
                    class: () => state.active && '--active',
                    inert: () => lines === undefined && !state.active
                }}
            >
                <div class='accordion-content' ${c}>${content}</div>
            </div>
        `;
    }
);
