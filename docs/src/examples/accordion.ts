import { accordion } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import scrollbar from '~/css-utilities/scrollbar';


// The consumer owns the control, label, and shared expansion state.
const more = (attributes: { lines?: number, style?: string }, content: Renderable<unknown>) => {
    let fade = scrollbar.fade(),
        id = `accordion-example-${crypto.randomUUID()}`,
        state = reactive({ active: false, expandable: false });

    return html`
        <div style='max-width: 480px;'>
            ${accordion({
                ...fade,
                lines: 3,
                ...attributes,
                'aria-label': 'Expanded content',
                id,
                role: 'region',
                state,
                style: [attributes.style, fade.style],
                tabindex: () => state.active && '0'
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
                    so the text keeps its layout and never reflows while expanding. The consumer supplies
                    the button, its label, and any fade styling, here the --scrollbar-fade utility. Content
                    longer than the maximum height scrolls inside the region instead of pushing the page,
                    and the button only renders while there is more to show.
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
                <div class='text'>Short content fits without clamping, so there is nothing to expand and no button is shown.</div>
            `),
            title: 'fits'
        }
    ]
};
