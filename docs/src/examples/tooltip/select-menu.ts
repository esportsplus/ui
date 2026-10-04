import { html } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { tooltip } from '@esportsplus/ui/components';
import check from '@esportsplus/ui/svg/check.svg';
import chevrons from '@esportsplus/ui/svg/chevrons-up-down.svg';


const choices = ['Geist', 'Inter', 'Montserrat', 'System UI'];


export default {
    title: '--select-menu · font picker',
    render: () => {
        let selected = reactive({ value: 'Inter' });

        let menu = tooltip.menu({
            class: '--select-menu',
            [tooltip.menu.option]: { class: 'tooltip-select-menu-option', role: 'menuitemradio' },
            options: choices.map((value) => ({
                'aria-checked': () => selected.value === value ? 'true' : 'false',
                onclick: () => {
                    selected.value = value;
                },
                content: html`
                    <svg aria-hidden='true' class='tooltip-select-menu-check'><use href='#${check}' /></svg>
                    <span class='tooltip-select-menu-option-label'>${value}</span>
                `
            }))
        }, html`
            <button aria-label='Choose font' class='tooltip-select-menu-trigger' type='button'>
                <span class='tooltip-select-menu-value'>${() => selected.value}</span>
                <svg aria-hidden='true' class='tooltip-select-menu-chevron'><use href='#${chevrons}' /></svg>
            </button>
        `);

        return html`<div class='tooltip-select-menu-demo'>${menu}</div>`;
    }
};
