import { reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';


const MORE_TRIGGER = Symbol.for('@esportsplus/ui/accordion.more.trigger');


type A = Attributes & {
    [MORE_TRIGGER]?: Attributes,
    label?: string,
    less?: Renderable<unknown>,
    lines?: number,
    maxHeight?: number,
    more?: Renderable<unknown>,
    onconnect?: never,
    ondisconnect?: never,
    state?: { active: boolean }
};


export default component(
    ({
        label = 'Expanded content',
        less = 'Show less',
        lines = 3,
        maxHeight = 320,
        more = 'Show more',
        state = reactive({ active: false }),
        ...attributes
    }: A, content) => {
        let id = `accordion-more-${crypto.randomUUID()}`,
            measured = reactive({ clamped: false, height: 0 }),
            observer: ResizeObserver | undefined,
            scrollable = () => state.active && measured.height > maxHeight;

        return html`
            <div
                class='accordion-more ${() => state.active && '--active'} ${() => measured.clamped && '--clamped'} ${() => scrollable() && '--scrollable'}'
                ${attributes}
                ${{
                    onconnect: (element: HTMLElement) => {
                        let body = element.querySelector<HTMLElement>('.accordion-more-body')!;

                        observer = new ResizeObserver(() => {
                            let computed = getComputedStyle(body),
                                height = body.offsetHeight,
                                line = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.2;

                            measured.clamped = height > Math.ceil(line * lines);
                            measured.height = height;
                        });
                        observer.observe(body);
                    },
                    ondisconnect: () => {
                        observer?.disconnect();
                    },
                    style: () => `${measured.height ? `--height: ${measured.height}px; ` : ''}--lines: ${lines}; --max-height: ${maxHeight}px;`
                }}
            >
                <div
                    class='accordion-more-content'
                    id='${id}'
                    ${{
                        'aria-label': () => scrollable() && label,
                        role: () => scrollable() && 'region',
                        tabindex: () => scrollable() && '0'
                    }}
                >
                    <div class='accordion-more-body'>${content}</div>
                </div>

                <button
                    aria-controls='${id}'
                    class='accordion-more-trigger'
                    type='button'
                    ${attributes[MORE_TRIGGER]}
                    ${{
                        'aria-expanded': () => state.active ? 'true' : 'false',
                        disabled: () => !measured.clamped,
                        onclick: () => {
                            state.active = !state.active;
                        }
                    }}
                >
                    <span class='accordion-more-trigger-label'>
                        <span ${{ 'aria-hidden': () => state.active && 'true' }}>${more}</span>
                        <span ${{ 'aria-hidden': () => !state.active && 'true' }}>${less}</span>
                    </span>
                    <svg class='accordion-more-trigger-icon' aria-hidden='true' viewBox='0 0 12 12'>
                        <path d='M3 4.5 6 7.5 9 4.5' />
                    </svg>
                </button>
            </div>
        `;
    },
    { trigger: MORE_TRIGGER }
);
