import { component, html, type Attributes } from '@esportsplus/template';
import { effect, reactive, untrack } from '@esportsplus/reactivity';
import icon from '~/components/icon';
import svg from '@esportsplus/ui/svg/bell.svg';
import '~/components/button/scss/index.scss';
import './scss/index.scss';


type A = Attributes & {
    'aria-label'?: string;
    bell?: boolean;
    count?: number;
    counter?: boolean;
    max?: number;
    ring?: boolean;
    state?: { count: number };
};


export default component(
    ({ 'aria-label': label = 'Notifications', bell = false, count = 0, counter = true, max = 99, ring = false, state: api = reactive({ count }), ...attributes }: A) => {
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
                        // SVG text sits its baseline exactly where it's told, so the glyph centers the same in every
                        // browser; an HTML line box rounds the font's ascent, descent and leading, a different way in
                        // each engine. The hidden HTML copy only gives the character its width.
                        if (!character.digit) {
                            return html`
                                <span aria-hidden='true' class='notification-character'>
                                    <span class='notification-character-width'>+</span>
                                    <svg class='notification-character-glyphs'>
                                        <g class='notification-character-track'>
                                            <text class='notification-character-digit' x='50%' y='50%'>+</text>
                                        </g>
                                    </svg>
                                </span>
                            `;
                        }

                        return html`
                            <span aria-hidden='true' class='notification-character'>
                                <span class='notification-character-width'>0</span>
                                <svg class='notification-character-glyphs'>
                                    <g class='notification-character-track' style='${() => `--translateY: ${character.value}`}'>
                                        <text class='notification-character-digit' x='50%' y='50%'>0</text>
                                        <text class='notification-character-digit' x='50%' y='150%'>1</text>
                                        <text class='notification-character-digit' x='50%' y='250%'>2</text>
                                        <text class='notification-character-digit' x='50%' y='350%'>3</text>
                                        <text class='notification-character-digit' x='50%' y='450%'>4</text>
                                        <text class='notification-character-digit' x='50%' y='550%'>5</text>
                                        <text class='notification-character-digit' x='50%' y='650%'>6</text>
                                        <text class='notification-character-digit' x='50%' y='750%'>7</text>
                                        <text class='notification-character-digit' x='50%' y='850%'>8</text>
                                        <text class='notification-character-digit' x='50%' y='950%'>9</text>
                                    </g>
                                </svg>
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
                        if (e.animationName.startsWith('notification-bell--ring')) {
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
    }
);
