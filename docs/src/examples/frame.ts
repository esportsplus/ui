import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Entry } from '../types';


let instance = 0,
    options: { mode: 'instant' | 'scroll' | 'slide' | 'swap'; title: string }[] = [
        { mode: 'instant', title: 'Default · Instant' },
        { mode: 'slide', title: 'frame--slide · Horizontal' },
        { mode: 'scroll', title: 'frame--scroll · Vertical' },
        { mode: 'swap', title: 'frame--swap · Crossfade in place' }
    ];


function demo(option: typeof options[number]) {
    let id = `frame-demo-${++instance}`,
        state = reactive({ active: 0 }),
        labels = ['Tab 1', 'Tab 2', 'Tab 3'];

    return html`
        <section aria-label='${option.title}' style='display: grid; gap: var(--size-400); grid-template-columns: minmax(0, 1fr); width: 100%;'>
            <div class='frame-triggers' role='tablist' aria-label='${option.title}' style='display: flex; gap: var(--size-300);'>
                ${labels.map((label, index) => html`
                    <div
                        type='button'
                        class='frame-trigger button button--secondary ${() => state.active === index ? '--active' : ''}'
                        id='${id}-tab-${index}'
                        role='tab'
                        aria-controls='${id}-panel-${index}'
                        aria-selected='${() => String(state.active === index)}'
                        onclick='${() => state.active = index}'
                    >
                        ${label}
                    </div>
                `)}
            </div>
            <div style='${() => `--i: ${state.active}; overflow: hidden;`}'>
                ${labels.map((_, index) => html`
                    <div
                        class='frame ${option.mode !== 'instant' && `frame--${option.mode}`} ${() => state.active === index ? '--active' : ''}'
                        id='${id}-panel-${index}'
                        role='tabpanel'
                        style='--n: ${index}'
                        aria-labelledby='${id}-tab-${index}'
                        aria-hidden='${() => String(state.active !== index)}'
                        inert='${() => state.active !== index}'
                        tabindex='${() => state.active === index ? 0 : -1}'
                    >
                        <div style='display: grid; place-items: center; width: 100%; height: 160px; background: var(--color-grey-500);'>
                            content ${index + 1}
                        </div>
                    </div>
                `)}
            </div>
        </section>
    `;
}

export default {
    name: 'frame',
    variants: options.map(option => ({
        title: option.title,
        render: () => demo(option)
    }))
} satisfies Entry;
