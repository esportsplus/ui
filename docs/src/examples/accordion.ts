import { accordion } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import './accordion.scss';


// The consumer owns the control, label, and shared expansion state.
const more = (attributes: { lines?: number, style?: string }, content: Renderable<unknown>) => {
    let id = `accordion-example-${crypto.randomUUID()}`,
        cleanup: (() => void) | undefined,
        state = reactive({ active: false, expandable: false });

    return html`
        <div
            style='max-width: 480px;'
            ${{
                onconnect: (element: HTMLElement) => {
                    if (CSS.supports('animation-timeline: scroll()')) {
                        return;
                    }

                    let viewport = element.querySelector<HTMLElement>('.accordion')!,
                        body = viewport.querySelector<HTMLElement>('.accordion-content')!;

                    // Match the utility's fade ramp over the first/last 5% of scrolling.
                    let measure = () => {
                        let range = viewport.scrollHeight - viewport.clientHeight,
                            progress = range > 0 ? Math.max(0, Math.min(1, viewport.scrollTop / range)) : 0;

                        viewport.style.setProperty('--fade-top-progress', String(range > 0 ? Math.min(1, progress / 0.05) : 0));
                        viewport.style.setProperty('--fade-bottom-progress', String(range > 0 ? Math.min(1, (1 - progress) / 0.05) : 0));
                    };

                    let observer = new ResizeObserver(measure);

                    observer.observe(viewport);
                    observer.observe(body);
                    viewport.addEventListener('scroll', measure, { passive: true });
                    measure();

                    cleanup = () => {
                        observer.disconnect();
                        viewport.removeEventListener('scroll', measure);
                    };
                },
                ondisconnect: () => cleanup?.()
            }}
        >
            ${accordion({
                lines: 3,
                ...attributes,
                'aria-label': 'Expanded content',
                class: ['accordion-example --scrollbar-fade', () => state.expandable && '--clamped'],
                id,
                role: 'region',
                state,
                tabindex: '0'
            }, content)}
            ${() => state.expandable && html`
                <button
                    aria-controls='${id}'
                    class='button button--tertiary'
                    style='--width: auto; margin-top: var(--size-300);'
                    type='button'
                    ${{
                        'aria-expanded': () => state.active ? 'true' : 'false',
                        onclick: () => state.active = !state.active
                    }}
                >
                    ${() => state.active ? 'Show less' : 'Show more'}
                </button>
            `}
        </div>
    `;
};


export default {
    name: 'accordion',
    variants: [
        {
            render: () => {
                let state = reactive({ active: false });

                return html`
                    <div
                        class='button button--tertiary'
                        style='--width: auto;'
                        onclick='${() => state.active = !state.active}'
                    >
                        toggle
                    </div>

                    ${accordion({ state }, html`
                        <div
                            class='card'
                            style='
                                --padding-horizontal: var(--size-500);
                                --padding-vertical: var(--size-500);
                                background: var(--color-grey-300);
                                margin-top: var(--size-400);
                            '>
                            <div class='text'>
                                Hidden content revealed when active.
                                Toggling flips state.active and the component reveals its body.
                            </div>
                        </div>
                    `)}
                `;
            },
            title: 'toggle'
        },
        {
            render: () => more({}, html`
                <div class='text'>
                    Show more reveals clamped content progressively. Only the container height animates,
                    so the text keeps its layout and never reflows while expanding. The consumer controls
                    any fade styling and supplies the button and its label. Content
                    longer than the maximum height scrolls inside the region instead of pushing the page,
                    and the external button toggles the shared expansion state.
                </div>
            `),
            title: 'show more'
        },
        {
            render: () => more({ lines: 2, style: '--max-height: 160px;' }, html`
                <div class='text'>
                    ${Array.from({ length: 6 }, (_, i) => html`
                        <p>
                            Paragraph ${i + 1}. Expanded height is capped by the --max-height CSS variable. The region
                            is keyboard-focusable and scrolls internally when the content exceeds that limit.
                        </p>
                    `)}
                </div>
            `),
            title: 'max height'
        },
        {
            render: () => more({}, html`
                <div class='text'>Short content fits without clamping, so the external button is disabled.</div>
            `),
            title: 'fits'
        }
    ]
};
