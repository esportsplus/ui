import { frame } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Entry } from '../types';
import './frame.scss';


type Mode = 'slide' | 'instant' | 'fade' | 'lift' | 'vertical' | 'scroll';

const options: { mode: Mode; title: string; description: string; source: string; reference: string }[] = [
    { mode: 'slide', title: '01 · Horizontal slide', description: 'The existing frames track. Panels travel together, with a fixed viewport and preserved scroll positions.', source: 'https://base-ui.com/react/components/tabs', reference: 'Base UI · animated panels' },
    { mode: 'instant', title: '02 · Instant switch', description: 'Underline tabs with an immediate panel change. The panel height follows its content.', source: 'https://www.radix-ui.com/primitives/docs/components/tabs', reference: 'Radix · tabs anatomy' },
    { mode: 'fade', title: '03 · Crossfade', description: 'Segmented tabs with overlapping panels. A steady viewport avoids movement around the component.', source: 'https://base-ui.com/react/components/tabs', reference: 'Base UI · panel transitions' },
    { mode: 'lift', title: '04 · Fade and lift', description: 'Pill tabs with a short upward entrance. Compare the extra motion with a simple crossfade.', source: 'https://base-ui.com/react/components/tabs', reference: 'Base UI · panel transitions' },
    { mode: 'vertical', title: '05 · Vertical slide', description: 'Sidebar navigation with a vertical panel track. Use the up and down arrows to move between tabs.', source: 'https://mui.com/material-ui/react-tabs/#vertical-tabs', reference: 'Material UI · vertical tabs' },
    { mode: 'scroll', title: '06 · Scrollable, manual tabs', description: 'A compact tab strip for more sections. Arrow keys move focus; Enter or Space opens the focused tab.', source: 'https://www.radix-ui.com/primitives/docs/components/tabs', reference: 'Radix · manual activation' }
];

let instance = 0;

function demo(option: typeof options[number]) {
    let id = `frame-demo-${++instance}`,
        state = reactive({ active: 0, focused: 0 }),
        labels = option.mode === 'scroll'
            ? ['Overview', 'Activity', 'Notes', 'Members', 'Permissions', 'Integrations', 'History']
            : ['Overview', 'Activity', 'Notes'],
        vertical = option.mode === 'vertical',
        manual = option.mode === 'scroll';

    function select(index: number) {
        state.active = index;
        state.focused = index;
    }

    function navigate(event: KeyboardEvent, index: number) {
        let next = index;

        if (event.key === (vertical ? 'ArrowDown' : 'ArrowRight')) next = (index + 1) % labels.length;
        else if (event.key === (vertical ? 'ArrowUp' : 'ArrowLeft')) next = (index + labels.length - 1) % labels.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = labels.length - 1;
        else return;

        event.preventDefault();
        state.focused = next;
        if (!manual) state.active = next;

        let tab = document.getElementById(`${id}-tab-${next}`);
        tab?.focus({ preventScroll: true });
        if (manual) tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    return html`
        <section class='frame-demo frame-demo--${option.mode}' aria-label='${option.title}'>
            <p class='frame-demo-description'>${option.description}</p>
            <div class='frame-demo-layout'>
                <div class='frame-demo-tabs' role='tablist' aria-label='${option.title}' aria-orientation='${vertical ? 'vertical' : 'horizontal'}'>
                    ${labels.map((label, index) => html`
                        <button
                            type='button'
                            class='frame-demo-tab'
                            id='${id}-tab-${index}'
                            role='tab'
                            aria-controls='${id}-panel-${index}'
                            aria-selected='${() => String(state.active === index)}'
                            tabindex='${() => state.focused === index ? 0 : -1}'
                            onclick='${() => select(index)}'
                            onkeydown='${(event: KeyboardEvent) => navigate(event, index)}'
                        >${label}</button>
                    `)}
                </div>
                <div class='frame-demo-viewport'>
                    <div class='frames' style='${() => `--i: ${-state.active}`}'>
                        ${labels.map((label, index) => frame({
                            class: () => state.active === index ? '--active' : '',
                            id: `${id}-panel-${index}`,
                            role: 'tabpanel',
                            'aria-labelledby': `${id}-tab-${index}`,
                            'aria-hidden': () => String(state.active !== index),
                            inert: () => state.active !== index,
                            tabindex: () => state.active === index ? 0 : -1
                        }, html`
                            <div class='frame-demo-content'>
                                <div class='frame-demo-eyebrow'>Workspace / ${label}</div>
                                <h3>${label === 'Overview' ? 'A place for every project' : label === 'Activity' ? 'A little progress, every day' : label === 'Notes' ? 'Keep your ideas here' : `Workspace ${label.toLowerCase()}`}</h3>
                                <p>${label === 'Overview' ? 'Switch sections without leaving the workspace. Each panel keeps its own content and position.' : label === 'Activity' ? 'Scroll this panel, visit another tab, then return. Your place stays where you left it.' : 'Write a draft below, switch tabs, and come back. Your text stays in the mounted panel.'}</p>
                                ${index === 0 ? html`
                                    <div class='frame-demo-stats'>
                                        <div><strong>24</strong><span>Projects</span></div>
                                        <div><strong>8</strong><span>In progress</span></div>
                                        <div><strong>96%</strong><span>On track</span></div>
                                    </div>
                                ` : index === 1 ? html`
                                    <ol class='frame-demo-activity'>
                                        ${['Design review completed', 'New milestone created', 'Project brief updated', 'Team feedback collected', 'Prototype shared', 'Release notes drafted', 'Checklist approved', 'Workspace organized'].map((item, i) => html`
                                            <li><span>${item}</span><small>${i + 1}h ago</small></li>
                                        `)}
                                    </ol>
                                ` : html`
                                    <label class='frame-demo-field'>
                                        <span>${label} draft</span>
                                        <textarea rows='3' placeholder='Try typing here, then switch tabs…'></textarea>
                                    </label>
                                `}
                            </div>
                        `))}
                    </div>
                </div>
            </div>
            <div class='frame-demo-footer'>
                <span>${manual ? 'Arrows to focus · Enter / Space to open' : vertical ? '↑ ↓ to switch · Home / End to jump' : '← → to switch · Home / End to jump'}</span>
                <a href='${option.source}' target='_blank' rel='noreferrer'>${option.reference} ↗</a>
            </div>
        </section>
    `;
}

export default {
    name: 'frame',
    variants: options.map(option => ({ title: option.title, render: () => demo(option) }))
} satisfies Entry;
