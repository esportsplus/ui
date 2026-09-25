import { longPress, toast } from '@esportsplus/ui';
import { html } from '@esportsplus/template';


let surface = '--background-white --border-border --color-text',
    style = '--border-width: var(--border-width-400); --width: auto; border: var(--border-width) solid var(--border-color);';


function tile() {
    let press = longPress.bind({ duration: 700, onlongpress: () => toast.success('Opened') });

    return html`
        <div
            class='button ${surface}'
            role='button'
            style='${style} gap: var(--size-300); -webkit-touch-callout: none; touch-action: manipulation; user-select: none;'
            tabindex='0'
            ${press.attributes}
        >
            ${() => press.state.holding ? 'Keep holding' : 'Press and hold'}
            <span class='--tabular'>${() => `${press.state.step} / ${press.steps}`}</span>
        </div>
    `;
}


export default {
    name: 'long-press',
    variants: [
        {
            render: () => longPress.button(
                { class: surface, onlongpress: () => toast.success('Archived'), style },
                'Hold to archive'
            ),
            title: 'button'
        },
        {
            render: () => longPress.button(
                { class: surface, duration: 1500, onlongpress: () => toast.error('Deleted'), steps: 24, style: `--fill-color: var(--color-red-400); ${style}` },
                'Hold to delete'
            ),
            title: 'slow'
        },
        {
            render: () => longPress.button(
                { class: surface, disabled: true, onlongpress: () => {}, style },
                'Hold to archive'
            ),
            title: 'disabled'
        },
        {
            render: tile,
            title: 'bind'
        }
    ]
};
