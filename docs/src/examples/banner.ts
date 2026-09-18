import { html } from '@esportsplus/template';


let label = 'position: relative; --color: var(--color-white-400); font-weight: var(--font-weight-600);',
    stage = 'position: relative; overflow: hidden; height: 130px; border-radius: var(--border-radius-400); padding: var(--size-500); display: flex; align-items: flex-end;';


export default {
    name: 'banner',
    variants: [
        {
            render: () => html`
                <div style='${stage}'>
                    <div class='banner banner--gradient' style='--from: var(--color-purple-400); --to: var(--color-black-500);'></div>
                    <div class='text' style='${label}'>--gradient</div>
                </div>
            `,
            title: 'gradient'
        },
        {
            render: () => html`
                <div style='${stage}'>
                    <div class='banner banner--blur' style='background: linear-gradient(120deg, var(--color-purple-300), var(--color-red-400)); --blur: 14px;'></div>
                    <div class='text' style='${label}'>--blur</div>
                </div>
            `,
            title: 'blur'
        },
        {
            render: () => html`
                <div style='${stage}'>
                    <div class='banner banner--backdrop' style='background: linear-gradient(to top, var(--color-black-500), transparent);'></div>
                    <div class='text' style='${label}'>--backdrop</div>
                </div>
            `,
            title: 'backdrop'
        }
    ]
};
