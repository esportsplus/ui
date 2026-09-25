import { input, password } from '@esportsplus/ui';
import { html } from '@esportsplus/template';
import { boardInputVariations, boardOtpVariations } from './board-fields';
import { fieldVariations } from './form-prototypes';
import { moreFieldVariations } from './form-options';
import { inputPatternVariations } from './form-patterns';


let instance = 0,
    style = `
        --border-color-active: color-mix(in oklch, var(--color-text-500) 40%, transparent);
        --border-color-default: var(--color-border-400);
        --border-radius: var(--border-radius-500);
        --border-width: var(--border-width-400);
        --box-shadow-active: 0 0 0 3px color-mix(in oklch, var(--color-text-500) 10%, transparent);
        --box-shadow-default: 0 1px 2px oklch(0 0 0 / 0.04);
    `;


export default {
    name: 'input',
    variants: [
        ...fieldVariations('input'),
        ...moreFieldVariations('input'),
        ...boardInputVariations(),
        ...boardOtpVariations(),
        ...inputPatternVariations(),
        {
            render: () => input({ placeholder: 'Type here…' }),
            title: 'default'
        },
        {
            render: () => input({ placeholder: 'Password', type: 'password' }),
            title: 'password'
        },
        {
            render: () => {
                let id = `password-${++instance}`;

                return html`
                    <div class='form-prototype'>
                        <label for='${id}'>Password</label>
                        ${password({ style, [password.input]: { id, name: 'password' } })}
                    </div>
                `;
            },
            title: 'password · caps lock warning'
        }
    ]
};
