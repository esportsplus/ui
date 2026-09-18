import { html } from '@esportsplus/template';


let stage = 'position: relative; height: 110px; border: 1px dashed var(--color-border-400); border-radius: var(--border-radius-400);';


export default {
    name: 'bubble',
    variants: [
        {
            render: () => html`
                <div style='${stage}'>
                    ${['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((position) => html`
                        <div class='bubble bubble--${position}' style='--size: 18px; --background: var(--color-purple-300);'></div>
                    `)}
                </div>
            `,
            title: 'corners'
        },
        {
            render: () => html`
                <div style='display: flex; align-items: center; gap: var(--size-400);'>
                    <div class='bubble --background-red --flicker' style='--size: 12px;'></div>
                    <div class='text'>flicker notification dot</div>
                </div>
            `,
            title: 'flicker'
        }
    ]
};
