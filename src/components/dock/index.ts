import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import tooltip from '~/components/tooltip';
import '~/components/card/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    [DOCK_BUTTON]?: Attributes;
    group?: boolean;
    items: Item[];
    label?: string;
    onlaunch?: (label: string) => void;
};

type Item = {
    icon: Renderable<unknown>;
    label: string;
    running?: boolean;
    state?: { running: boolean };
};

type Slot = HTMLElement & { [LABEL]: string };


const DOCK_BUTTON = Symbol.for('@esportsplus/ui/dock.button');

const LABEL = Symbol();

// The first label waits so a cursor passing through doesn't flash one; neighbours then open at once.
const TOOLTIP_DELAY = 300;


const dock = ({ group, items, label = 'Dock', onlaunch, ...attributes }: A) => {
    let buttons = items.map((item) => {
        let local = reactive({ launching: false }),
            state = item.state ?? reactive({ running: item.running ?? false });

        return html`
            <button
                class='card dock-button'
                type='button'
                ${attributes[DOCK_BUTTON]}
                ${{
                    'aria-label': () => state.running ? `${item.label}, running` : item.label,
                    class: () => local.launching && 'dock-button--launching',
                    onanimationend: () => {
                        local.launching = false;
                    },
                    onclick: () => {
                        // Already running: a click just brings it forward, no fanfare.
                        if (state.running) {
                            return;
                        }

                        state.running = true;
                        local.launching = true;
                        onlaunch?.(item.label);
                    }
                }}
            >
                ${item.icon}
            </button>
            <span aria-hidden='true' class='dock-light ${() => state.running && '--active'}'></span>
        `;
    });

    // One label glides between the icons; hidden from assistive tech, since each button is already named by it.
    let tip = group ? tooltip.shared({ delay: { open: TOOLTIP_DELAY } }) : null;

    return html`
        <nav class='card dock' ${attributes} ${{ 'aria-label': label }}>
            ${tip
                ? html`
                    <div class='dock-group' ${tip.delegate({ content: (trigger) => (trigger as Slot)[LABEL], edge: true, selector: '.dock-item' })}>
                        ${items.map((item, i) => html`
                            <div class='dock-item' ${{ onconnect: (element: Slot) => { element[LABEL] = item.label; } }}>${buttons[i]}</div>
                        `)}
                    </div>
                    ${tip.render({ 'aria-hidden': 'true', class: 'dock-label' })}
                `
                : items.map((item, i) => tooltip.onhover(
                    { class: 'dock-item', delay: { open: TOOLTIP_DELAY } },
                    html`
                        ${buttons[i]}
                        <span aria-hidden='true' class='dock-label tooltip-message tooltip-message--n'>${item.label}</span>
                    `
                ))}
        </nav>
    `;
};


export default component(dock, { button: DOCK_BUTTON });
export type { Item };
