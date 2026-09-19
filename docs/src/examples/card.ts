import { html } from '@esportsplus/template';


let box = '--padding-horizontal: var(--size-500); --padding-vertical: var(--size-500); --border-radius: var(--border-radius-400); --width: 200px; background: var(--color-grey-300);';


export default {
    name: 'card',
    variants: [
        {
            render: () => html`
                <div class='card' style='${box} --box-shadow: var(--box-shadow-300);'>
                    <div class='text'>Card with shadow</div>
                </div>
            `,
            title: 'default'
        }
    ]
};
