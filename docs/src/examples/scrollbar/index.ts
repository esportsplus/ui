import { html } from '@esportsplus/template';
import scrollbar from '@esportsplus/ui/modifiers/scrollbar';
import 'docs/examples/scrollbar/scss/index.scss';


let box = 'height: 160px; border: 1px solid var(--surface-border-default); border-radius: var(--border-radius-400);';

function tiles(columns: number, rows: number) {
    return html`
        <div style='display: grid; gap: var(--size-300); grid-template-columns: repeat(${columns}, 96px); padding: var(--size-500); width: max-content;'>
            ${Array.from({ length: columns * rows }).map((_, i) => html`
                <div class='scrollbar-demo-tile preview-text' style='align-items: center; border-radius: var(--border-radius-300); height: 56px; justify-content: center;'>${i + 1}</div>
            `)}
        </div>
    `;
}

function rows(count: number) {
    return html`
        <div style='display: flex; flex-direction: column; gap: var(--size-400); padding: var(--size-500); width: 100%;'>
            ${Array.from({ length: count }).map((_, i) => html`
                <div class='preview-text'>Row ${i + 1}</div>
            `)}
        </div>
    `;
}


export default {
    name: 'scrollbar',
    variants: [
        {
            render: () => html`<div ${scrollbar()} style='${box}'>${rows(14)}</div>`,
            title: 'default bar'
        },
        {
            render: () => html`<div ${scrollbar({ hover: true })} style='${box}'>${rows(14)}</div>`,
            title: 'visible on hover or keyboard focus'
        },
        {
            render: () => html`
                <div class='--scrollbar-scope' style='display: grid; gap: var(--size-400); grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%;'>
                    <div style='${box} overflow-y: auto;'>${rows(14)}</div>
                    <div class='--scrollbar-blue' style='${box} overflow-y: auto; --scrollbar-size: 10px; --scrollbar-behavior: auto;'>${rows(14)}</div>
                </div>
            `,
            title: 'scope: inherited defaults and child overrides'
        },
        {
            render: () => html`<div ${scrollbar({ hidden: true })} style='${box}'>${rows(14)}</div>`,
            title: 'hidden bar'
        },
        {
            render: () => html`<div ${scrollbar({ color: 'blue' })} style='${box}'>${rows(14)}</div>`,
            title: 'color states'
        },
        {
            render: () => html`<div ${scrollbar()} style='${box} --scrollbar-rail-color: var(--surface-border-default);'>${rows(14)}</div>`,
            title: 'rail color'
        },
        {
            render: () => html`<div ${scrollbar()} style='${box} --scrollbar-align: 0; --scrollbar-offset: 0px; --scrollbar-track-inset: 0px; --scrollbar-rail-color: var(--surface-border-default); --scrollbar-size-hover: 12px;'>${rows(14)}</div>`,
            title: 'edge-hugging growth'
        },
        {
            render: () => html`<div ${scrollbar()} style='${box} --scrollbar-offset: 6px; --scrollbar-rail-color: var(--surface-border-default); --scrollbar-track-inset: 16px;'>${rows(14)}</div>`,
            title: 'track inset and edge offset'
        },
        {
            render: () => html`<div ${scrollbar({ auto: true, horizontal: true })} style='${box}'>${tiles(16, 1)}</div>`,
            title: 'auto (horizontal)'
        },
        {
            render: () => html`<div ${scrollbar()} style='${box} --scrollbar-size: 12px; --scrollbar-width: auto;'>${rows(14)}</div>`,
            title: 'width variable'
        },
        {
            render: () => html`<div ${scrollbar({ horizontal: true })} style='${box}'>${tiles(16, 1)}</div>`,
            title: 'horizontal bar'
        },
        {
            render: () => html`<div ${scrollbar({ drag: 'horizontal', horizontal: true })} style='${box}'>${tiles(16, 1)}</div>`,
            title: 'drag (horizontal)'
        },
        {
            render: () => html`<div ${scrollbar({ drag: true })} style='${box}'>${tiles(12, 8)}</div>`,
            title: 'drag (both)'
        },
        {
            render: () => html`<div ${scrollbar({ fade: true })} style='${box}'>${rows(14)}</div>`,
            title: 'fade'
        },
        {
            render: () => html`<div ${scrollbar({ blur: true })} style='${box}'>${rows(14)}</div>`,
            title: 'blur'
        },
        {
            render: () => html`<div ${scrollbar({ fade: true, horizontal: true })} style='${box}'>${tiles(16, 1)}</div>`,
            title: 'fade (horizontal)'
        },
        {
            render: () => html`<div ${scrollbar({ blur: true, horizontal: true })} style='${box}'>${tiles(16, 1)}</div>`,
            title: 'blur (horizontal)'
        },
        {
            render: () => html`<div ${scrollbar({ drag: 'horizontal', fade: true, horizontal: true })} style='${box}'>${tiles(16, 1)}</div>`,
            title: 'drag with fade (horizontal)'
        },
        {
            render: () => html`<div ${scrollbar({ blur: true, drag: true })} style='${box}'>${tiles(12, 8)}</div>`,
            title: 'drag with blur (both)'
        },
        {
            render: () => html`<div ${scrollbar({ fade: true })} style='${box}'>${rows(2)}</div>`,
            title: 'fade (content fits)'
        },
        {
            render: () => html`<div ${scrollbar()} style='${box} --scrollbar-border-radius: 0px;'>${rows(14)}</div>`,
            title: 'square thumb'
        }
    ]
};
