import { modal } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


function demo(variant: string, description: string) {
    let state = reactive({ active: false });

    return html`
        <div class='button button--primary' style='--width: auto;' onclick='${() => state.active = true}'>
            open modal
        </div>

        ${modal(
            {
                class: `card ${variant}`,
                state,
                style: `--max-width: 420px; --padding-horizontal: var(--size-600); --padding-vertical: var(--size-600); ${variant ? '' : '--translateY: var(--size-400);'} background: var(--color-card-500, var(--color-grey-300));`
            },
            html`
                <h3 style='margin: 0 0 var(--size-400);'>Modal title</h3>
                <div class='text'>${description}</div>
                <div
                    class='button button--tertiary'
                    style='--width: auto; margin-top: var(--size-500);'
                    onclick='${() => state.active = false}'
                >
                    close
                </div>
            `
        )}
    `;
}


export default {
    name: 'modal',
    variants: [
        {
            render: () => demo('', 'Click the backdrop, press Esc, or use the button below to close.'),
            title: 'slide'
        },
        {
            render: () => demo('modal--fade', 'Opacity only, no movement.'),
            title: 'fade'
        },
        {
            render: () => demo('modal--scale', 'Zooms in from slightly smaller.'),
            title: 'scale'
        },
        {
            render: () => demo('modal--spring', 'Overshoots and settles.'),
            title: 'spring'
        },
        {
            render: () => demo('modal--sheet', 'Slides up from the bottom edge as a sheet.'),
            title: 'sheet'
        },
        {
            render: () => demo('modal--scale modal--blur', 'Blurs the page behind the backdrop.'),
            title: 'blur backdrop'
        }
    ]
};
