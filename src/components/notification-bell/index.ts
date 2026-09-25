import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import icon from '~/components/icon';
import bell from './svg/bell.svg';
import './scss/index.scss';


const notificationBell = ({ 'aria-label': label = 'Notifications', count = 0, dot = false, max = 99, ring = false, state: api = reactive({ count }), ...attributes }: Attributes & {
    'aria-label'?: string;
    count?: number;
    dot?: boolean;
    max?: number;
    ring?: boolean;
    state?: { count: number };
}) => {
    let previous = api.count,
        render = reactive([] as { digit: boolean; value: string }[]),
        // Alternates between 1 and 2 so back-to-back increments swap keyframe
        // names, which restarts the swing without forcing a reflow.
        state = reactive({ ring: ring ? 1 : 0 }),
        stop = effect(() => {
            let count = api.count;

            untrack(() => {
                if (count > previous) {
                    state.ring = state.ring === 1 ? 2 : 1;
                }

                previous = count;

                // Keep the last digits while the badge scales out
                if (count <= 0 || dot) {
                    return;
                }

                let values = (count > max ? `${max}+` : `${count}`).split('');

                for (let i = 0, n = values.length; i < n; i++) {
                    let value = values[i],
                        digit = value !== '+';

                    // Preserve the track so CSS can roll between digit positions.
                    if (render[i]?.digit === digit) {
                        render[i].value = value;
                    }
                    else {
                        let character = reactive({ digit, value });

                        render[i] = character;
                    }
                }

                if (render.length > values.length) {
                    render.splice(values.length);
                }
            });
        });

    onCleanup(stop);

    return html`
        <button
            class='notification-bell'
            type='button'
            ${{
                'aria-label': () => api.count > 0 ? `${label}, ${api.count} unread` : label,
                'data-ring': () => state.ring || '',
                onanimationend: (e: AnimationEvent) => {
                    if (e.animationName.startsWith('notification-bell-ring')) {
                        state.ring = 0;
                    }
                }
            }}
            ${attributes}
        >
            ${icon({ 'aria-hidden': true, class: 'notification-bell-icon' }, bell)}

            <span
                aria-hidden='true'
                class='notification-bell-badge ${dot && 'notification-bell-badge--dot'}'
                ${{ class: () => api.count > 0 && '--active' }}
            >
                ${!dot && html.reactive(render, function (character) {
                    if (!character.digit) {
                        return html`<span class='notification-bell-character'>${() => character.value}</span>`;
                    }

                    return html`
                        <span class='notification-bell-character'>
                            <span class='notification-bell-character-track' style='${() => `--value: ${character.value}`}'>
                                ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => html`<span>${value}</span>`)}
                            </span>
                        </span>
                    `;
                })}
            </span>
        </button>
    `;
};


export default notificationBell;
