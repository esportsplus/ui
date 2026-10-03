import { html } from '@esportsplus/template';
import scrollbar from '~/css-utilities/scrollbar';


let box = 'height: 160px; border: 1px solid var(--color-border-400); border-radius: var(--border-radius-400);';

function tiles(columns: number, rows: number) {
    return html`
        <div style='display: grid; gap: var(--size-300); grid-template-columns: repeat(${columns}, 96px); padding: var(--size-500); width: max-content;'>
            ${Array.from({ length: columns * rows }).map((_, i) => html`
                <div class='text' style='align-items: center; background: var(--color-grey-400); border-radius: var(--border-radius-300); height: 56px; justify-content: center;'>${i + 1}</div>
            `)}
        </div>
    `;
}

function rows(count: number) {
    return html`
        <div style='display: flex; flex-direction: column; gap: var(--size-400); padding: var(--size-500); width: 100%;'>
            ${Array.from({ length: count }).map((_, i) => html`
                <div class='text'>Row ${i + 1}</div>
            `)}
        </div>
    `;
}


export default {
    name: 'scrollbar',
    variants: [
        {
            render: () => html`<div class='--scrollbar' style='${box}'>${rows(14)}</div>`,
            title: 'default bar'
        },
        {
            render: () => html`<div class='--scrollbar --scrollbar-hover' style='${box}'>${rows(14)}</div>`,
            title: 'visible on hover or keyboard focus'
        },
        {
            render: () => html`
                <div class='--scrollbar-scope' style='display: grid; gap: var(--size-400); grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%;'>
                    <div style='${box} overflow-y: auto;'>${rows(14)}</div>
                    <div class='--scrollbar-no-arrows' style='${box} overflow-y: auto; --scrollbar-color: var(--color-blue-500); --scrollbar-size: 10px; --scrollbar-behavior: auto;'>${rows(14)}</div>
                </div>
            `,
            title: 'scope: inherited defaults and child overrides'
        },
        {
            render: () => html`<div class='--scrollbar --scrollbar-hidden' style='${box}'>${rows(14)}</div>`,
            title: 'hidden bar'
        },
        {
            render: () => html`<div class='--scrollbar --scrollbar-thin' style='${box}'>${rows(14)}</div>`,
            title: 'thin bar'
        },
        {
            render: () => html`<div class='--scrollbar --scrollbar-no-arrows' style='${box}'>${rows(14)}</div>`,
            title: 'no arrows'
        },
        {
            render: () => html`<div class='--scrollbar --scrollbar-auto --scrollbar-no-arrows --scrollbar-horizontal' style='${box}'>${tiles(16, 1)}</div>`,
            title: 'no arrows (auto, horizontal)'
        },
        {
            render: () => html`<div class='--scrollbar' style='${box} --scrollbar-width: thin;'>${rows(14)}</div>`,
            title: 'width variable'
        },
        {
            render: () => html`<div class='--scrollbar --scrollbar-horizontal' style='${box}'>${tiles(16, 1)}</div>`,
            title: 'horizontal bar'
        },
        {
            render: () => html`<div class='--scrollbar --scrollbar-horizontal' style='${box}' ${scrollbar.drag('horizontal')}>${tiles(16, 1)}</div>`,
            title: 'drag (horizontal)'
        },
        {
            render: () => html`<div class='--scrollbar' style='${box}' ${scrollbar.drag()}>${tiles(12, 8)}</div>`,
            title: 'drag (both)'
        },
        {
            render: () => html`<div class='--scrollbar' style='${box}' ${scrollbar.fade()}>${rows(14)}</div>`,
            title: 'fade'
        },
        {
            render: () => html`<div class='--scrollbar' style='${box}' ${scrollbar.blur()}>${rows(14)}</div>`,
            title: 'blur'
        },
        {
            render: () => html`<div class='--scrollbar' style='${box}' ${scrollbar.fade()}>${rows(2)}</div>`,
            title: 'fade (content fits)'
        }
    ]
};
