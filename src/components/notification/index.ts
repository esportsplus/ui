import { html, type Attributes } from '@esportsplus/template';
import { effect, reactive, untrack } from '@esportsplus/reactivity';
import icon from '~/components/icon';
import svg from '@esportsplus/ui/svg/bell.svg';
import '~/components/button/scss/index.scss';
import './scss/index.scss';


const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];


export default ({ 'aria-label': label = 'Notifications', bell = false, count = 0, counter = true, max = 99, ring = false, state: api = reactive({ count }), ...attributes }: Attributes & {
    'aria-label'?: string;
    bell?: boolean;
    count?: number;
    counter?: boolean;
    max?: number;
    ring?: boolean;
    state?: { count: number };
}) => {
    let announce = () => api.count > 0 ? `${label}, ${api.count} unread` : label,
        previous = api.count,
        render = reactive([] as { digit: boolean; value: string }[]),
        // Alternates between 1 and 2 so back-to-back increments swap keyframe
        // names, which restarts the swing without forcing a reflow.
        state = reactive({ ring: ring ? 1 : 0 });

    effect(() => {
        let count = api.count;

        untrack(() => {
            if (bell && count > previous) {
                state.ring = state.ring === 1 ? 2 : 1;
            }

            previous = count;

            // Keep the last digits while the bubble scales out
            if (count <= 0 || !counter) {
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

    let bubble = html`
        <span
            class='notification ${!counter && 'notification--dot'}'
            ${{ class: () => api.count > 0 && '--active' }}
            ${bell ? { 'aria-hidden': 'true' } : { ...attributes, 'aria-label': announce, role: 'status' }}
        >
            ${counter && html.reactive(render, function (character) {
                if (!character.digit) {
                    return html`<span class='notification-character'>${() => character.value}</span>`;
                }

                return html`
                    <span class='notification-character'>
                        <span class='notification-character-track' style='${() => `--value: ${character.value}`}'>
                            ${DIGITS.map((value) => html`<span class='notification-character-digit'>${value}</span>`)}
                        </span>
                    </span>
                `;
            })}
        </span>
    `;

    if (!bell) {
        return bubble;
    }

    return html`
        <button
            class='button notification-bell'
            type='button'
            ${{
                'aria-label': announce,
                class: () => state.ring && `notification-bell--ring-${state.ring}`,
                onanimationend: (e: AnimationEvent) => {
                    if (e.animationName.startsWith('notification-bell-ring')) {
                        state.ring = 0;
                    }
                }
            }}
            ${attributes}
        >
            ${icon({ 'aria-hidden': true, class: 'notification-bell-icon' }, svg)}
            ${bubble}
        </button>
    `;
};
