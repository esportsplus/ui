import { html } from '@esportsplus/template';


let colors = ['primary', 'secondary', 'tertiary'],
    modifiers = ['flat', 'skeleton', 'underline'],
    row = 'display: flex; flex-wrap: wrap; gap: var(--size-400); align-items: center;';


export default {
    name: 'button',
    variants: [
        {
            render: () => html`
                <div style='${row}'>
                    <div class="button --background-white --border --border-border --color-text --text-bold">
                        white
                    </div>

                    ${colors.map((color) => html`
                        <div class='button button--${color}' style='--width: auto;'>${color}</div>
                    `)}
                </div>
            `,
            title: 'colors'
        },
        {
            render: () => html`
                <div style='${row}'>
                    ${modifiers.map((modifier) => html`
                        <div class='button button--tertiary button--${modifier}'>${modifier}</div>
                    `)}
                </div>
            `,
            title: 'modifiers'
        }
    ]
};
