import { accordion } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html, type Renderable } from '@esportsplus/template';
import scrollbar from '@esportsplus/ui/css-utilities/scrollbar';
import chevron from '@esportsplus/ui/svg/chevron-right.svg';
import 'docs/examples/accordion/scss/index.scss';


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
                    class='link --color-text'
                    style='--font-size: var(--font-size-300); margin-top: var(--size-300);'
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
                let rows = [
                    { label: 'Export options', content: 'PNG at 2×, with the canvas background. SVG keeps text as text. PDF bundles every region as a page.', active: true },
                    { label: 'Sharing', content: 'Invite people to view or edit this project, or share a link with your team.' },
                    { label: 'History', content: 'Review previous versions and restore an earlier version of this project.' },
                    { label: 'Billing (owners only)', content: 'Manage your plan and payment details.', disabled: true }
                ];

                return html`
                    <div class='accordion-demo'>
                        ${rows.map(({ active = false, content, disabled = false, label }) => {
                            let id = `accordion-toggle-${crypto.randomUUID()}`,
                                state = reactive({ active });

                            return html`
                                <div class='accordion-demo-row'>
                                    <button
                                        aria-controls='${id}'
                                        class='accordion-demo-toggle'
                                        disabled='${disabled}'
                                        id='${id}-toggle'
                                        type='button'
                                        ${{
                                            'aria-expanded': () => state.active ? 'true' : 'false',
                                            onclick: () => state.active = !state.active
                                        }}
                                    >
                                        <span>${label}</span>
                                        <svg aria-hidden='true' class='accordion-demo-chevron'><use href='#${chevron}' /></svg>
                                    </button>
                                    ${accordion({
                                        'aria-labelledby': `${id}-toggle`,
                                        id,
                                        role: 'region',
                                        state
                                    }, html`<p class='accordion-demo-description'>${content}</p>`)}
                                </div>
                            `;
                        })}
                    </div>
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
