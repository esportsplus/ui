import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Entry } from '../types';


let instance = 0,
    options: { mode: 'instant' | 'slide' | 'scroll'; title: string }[] = [
        { mode: 'instant', title: 'Default · Instant' },
        { mode: 'slide', title: 'tabs--slide · Horizontal' },
        { mode: 'scroll', title: 'tabs--scroll · Vertical' }
    ];


function demo(option: typeof options[number]) {
    let id = `tabs-demo-${++instance}`,
        state = reactive({ active: 0 }),
        labels = ['Tab 1', 'Tab 2', 'Tab 3'];

    return html`
        <section aria-label='${option.title}' style='display: grid; gap: var(--size-400); width: 100%; min-width: 0;'>
            <div class='tabs-triggers' role='tablist' aria-label='${option.title}' style='display: flex; gap: var(--size-300);'>
                ${labels.map((label, index) => html`
                    <div
                        type='button'
                        class='tabs-trigger button button--secondary ${() => state.active === index ? '--active' : ''}'
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
            <div style='height: 160px; overflow: hidden;'>
                <div class='tabs ${option.mode !== 'instant' && `tabs--${option.mode}`}' style='${() => `--i: ${-state.active}; height: 100%;`}'>
                    ${labels.map((_, index) => html`
                        <div
                            class='tabs-content ${() => state.active === index ? '--active' : ''}'
                            id='${id}-panel-${index}'
                            role='tabpanel'
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
            </div>
        </section>
    `;
}

export default {
    name: 'tabs',
    variants: options.map(option => ({
        title: option.title,
        render: () => demo(option)
    }))
} satisfies Entry;
