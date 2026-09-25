import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { slider } from '@esportsplus/ui';
import './slider.scss';


const TICKS = Array.from({ length: 13 }, (_, i) => i);


export default {
    name: 'slider',
    variants: [
        {
            render: () => html`<div class='slider-demo'>${slider({ 'aria-label': 'Volume', value: 50 })}</div>`,
            title: 'default'
        },
        {
            render: () => html`<div class='slider-demo'>${slider({ label: 'Opacity', output: true, value: 50 })}</div>`,
            title: 'with label and value'
        },
        {
            render: () => html`<div class='slider-demo'>${slider({ label: 'Price', output: true, value: [25, 75] })}</div>`,
            title: 'range'
        },
        {
            render: () => html`<div class='slider-demo'>${slider({ 'aria-label': 'Volume', disabled: true, value: 50 })}</div>`,
            title: 'disabled'
        },
        {
            render: () => html`
                <div class='slider-demo slider-demo--vertical'>
                    ${slider({ 'aria-label': 'Volume', orientation: 'vertical', value: 50 })}
                    ${slider({ 'aria-label': 'Range', orientation: 'vertical', value: [20, 70] })}
                </div>
            `,
            title: 'vertical'
        },
        {
            render: () => html`
                <div class='slider-demo'>
                    ${slider({ 'aria-label': 'Storage size in GB', max: 35, min: 5, value: 15 })}
                    <div aria-label='Storage size reference values' class='slider-demo-scale' role='group'>
                        <span>5 GB</span>
                        <span>20 GB</span>
                        <span>35 GB</span>
                    </div>
                </div>
            `,
            title: 'reference labels'
        },
        {
            render: () => html`
                <div class='slider-demo'>
                    ${slider({ 'aria-label': 'Value selector', max: 12, value: 5 })}
                    <div aria-label='Value scale from 0 to 12' class='slider-demo-ticks' role='group'>
                        ${TICKS.map((i) => html`
                            <span class='slider-demo-tick ${i % 2 !== 0 && '--minor'}'>
                                <i></i>
                                <span>${i}</span>
                            </span>
                        `)}
                    </div>
                </div>
            `,
            title: 'ticks'
        },
        {
            render: () => {
                let state = reactive({ value: 0.4 });

                return html`
                    <form class='slider-demo' onsubmit='${(event: Event) => event.preventDefault()}'>
                        ${slider({
                            format: (value: number) => `${Math.round(value * 100)}%`,
                            label: 'Zoom',
                            max: 1,
                            min: 0,
                            name: 'zoom',
                            output: true,
                            state,
                            step: 0.01
                        })}
                        <p class='slider-demo-caption'>Submits <code>zoom=${() => state.value}</code></p>
                    </form>
                `;
            },
            title: 'decimal steps, format, form field'
        }
    ]
};
