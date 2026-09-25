import { accordion } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


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
            render: () => accordion.more({ style: 'max-width: 480px;' }, html`
                <div class='text'>
                    Show more reveals clamped content progressively. Only the container height animates,
                    so the text keeps its layout and never reflows while expanding. Collapsed content fades
                    out at the cutoff, and the trigger chevron flips to signal the current state. Content
                    longer than the maximum height scrolls inside the region instead of pushing the page,
                    and the trigger hides itself entirely whenever the content already fits.
                </div>
            `),
            title: 'show more'
        },
        {
            render: () => accordion.more({ lines: 2, maxHeight: 160, style: 'max-width: 480px;' }, html`
                <div class='text'>
                    ${Array.from({ length: 6 }, (_, i) => html`
                        <p>
                            Paragraph ${i + 1}. Expanded height is capped by maxHeight, so once the content
                            grows past it the region becomes keyboard-focusable and scrolls internally.
                        </p>
                    `)}
                </div>
            `),
            title: 'max height'
        },
        {
            render: () => accordion.more({ style: 'max-width: 480px;' }, html`
                <div class='text'>Short content fits, so no trigger is shown.</div>
            `),
            title: 'fits'
        }
    ]
};
