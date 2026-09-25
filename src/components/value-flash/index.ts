import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import './scss/index.scss';


type Direction = 'down' | 'up';

type Entry = { direction: Direction | ''; leaving: boolean; text: string };


export default ({ announceAfter = 700, format = String, hold = 900, label, state: api, ...attributes }: Attributes & {
    announceAfter?: number;
    format?: (value: number) => string;
    hold?: number;
    label?: string;
    state: { value: number };
}) => {
    let announcer: ReturnType<typeof setTimeout> | undefined,
        holder: ReturnType<typeof setTimeout> | undefined,
        previous = api.value,
        render = reactive([] as Entry[]),
        state = reactive({ changes: 0, direction: '' as Direction | '', flashing: false, settled: format(previous) }),
        stop = effect(() => {
            let value = api.value;

            untrack(() => {
                let prior = previous,
                    text = format(value);

                previous = value;

                clearTimeout(announcer);
                announcer = setTimeout(() => state.settled = text, announceAfter);

                // First run seeds the display without rolling it in.
                if (render.length === 0) {
                    render.push(reactive({ direction: '', leaving: false, text }));
                    return;
                }

                let delta = value - prior;

                if (!delta) {
                    if (render[render.length - 1].text !== text) {
                        render[render.length - 1].text = text;
                    }

                    return;
                }

                let direction: Direction = delta > 0 ? 'up' : 'down';

                // Outgoing text leaves the way the incoming text travels.
                for (let i = 0, n = render.length; i < n; i++) {
                    render[i].direction = direction;
                    render[i].leaving = true;
                }

                render.push(reactive({ direction, leaving: false, text }));

                state.changes++;
                state.direction = direction;
                state.flashing = true;

                clearTimeout(holder);
                holder = setTimeout(() => state.flashing = false, hold);
            });
        });

    function remove(entry: Entry) {
        let index = render.indexOf(entry);

        if (index !== -1) {
            render.splice(index, 1);
        }
    }

    onCleanup(() => {
        clearTimeout(announcer);
        clearTimeout(holder);
        stop();
    });

    return html`
        <span
            class='value-flash'
            ${attributes}
            ${{
                'data-direction': () => state.direction,
                // Alternating parity swaps between identical keyframes, restarting the arrow pop per change.
                'data-flash': () => state.flashing ? (state.changes % 2 ? 'odd' : 'even') : state.changes ? 'off' : ''
            }}
        >
            <span aria-hidden='true' class='value-flash-tint'></span>
            <span aria-hidden='true' class='value-flash-value'>
                ${html.reactive(render, function (entry) {
                    return html`
                        <span
                            class='${() => `value-flash-text${entry.direction ? ` value-flash-text--${entry.direction}` : ''}${entry.leaving ? ' value-flash-text--leaving' : ''}`}'
                            onanimationend='${() => {
                                if (entry.leaving) {
                                    remove(entry);
                                }
                            }}'
                        >
                            ${() => entry.text}
                        </span>
                    `;
                })}
            </span>
            <span aria-hidden='true' class='value-flash-arrow'>
                <svg fill='currentColor' viewBox='0 0 256 256'>
                    <path d='M128 68 L210 180 H46 Z' />
                </svg>
            </span>
            <span aria-live='polite' class='value-flash-announcement'>
                ${() => label ? `${label}: ${state.settled}` : state.settled}
            </span>
        </span>
    `;
};
