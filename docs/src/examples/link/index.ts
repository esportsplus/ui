import { highlight } from '@esportsplus/ui/components';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import 'docs/examples/link/scss/index.scss';


let color = '--color: light-dark(var(--color-purple-300), oklch(from var(--color-purple-300) 0.75 0.15 h));',
    managers = ['pnpm', 'npm', 'yarn', 'bun'];


function group(vertical: boolean, fill: boolean, line: boolean) {
    let state = reactive({ active: 0 });

    return html`
        <div
            aria-orientation='${vertical ? 'vertical' : 'horizontal'}'
            class='link-demo-group ${vertical && 'link-demo-group--vertical'}'
            role='tablist'
        >
            ${highlight({ class: 'link-demo-group-highlight', fill, line: line ? (vertical ? 'left' : 'bottom') : undefined })}
            ${managers.map((manager, index) => html`
                <div
                    class='link link-demo-group-link ${() => state.active === index && '--active'}'
                    onclick='${() => state.active = index}'
                    role='tab'
                    tabindex='0'
                    ${{ 'aria-selected': () => String(state.active === index) }}
                >
                    ${manager}
                </div>
            `)}
        </div>
    `;
}


export default {
    name: 'link',
    variants: [
        {
            render: () => html`<div class='link' style='${color}'>Basic link</div>`,
            title: 'default'
        },
        {
            render: () => group(false, true, false),
            title: 'horizontal group'
        },
        {
            render: () => group(false, false, true),
            title: 'horizontal group · line'
        },
        {
            render: () => group(false, true, true),
            title: 'horizontal group · background + line'
        },
        {
            render: () => group(true, true, false),
            title: 'vertical group'
        },
        {
            render: () => group(true, false, true),
            title: 'vertical group · line'
        },
        {
            render: () => group(true, true, true),
            title: 'vertical group · background + line'
        }
    ]
};
