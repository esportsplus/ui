import { button } from '@esportsplus/ui';
import { html } from '@esportsplus/template';
import type { Entry } from '~/viewer/types';


let colors = ['primary', 'secondary', 'tertiary', 'form'],
    modifiers = ['flat', 'skeleton', 'underline'],
    row = 'display: flex; flex-wrap: wrap; gap: var(--size-400); align-items: center;';


const entry: Entry = {
    name: 'button',
    variants: [
        {
            render: () => html`
                <div style='${row}'>
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
        },
        {
            render: () => button.hold(
                { class: 'button--primary', style: '--width: auto;' },
                (state) => state.complete ? 'complete!' : state.holding ? 'holding…' : 'hold me'
            ),
            title: 'hold'
        }
    ]
};


export default entry;
