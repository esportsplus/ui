import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import './scss/index.scss';


let formatters: Record<string, Intl.NumberFormat> = {};


export default ({ currency, decimals = 2, delay, max, state: api = reactive({ value: -1 }), suffix, value, ...attributes }: Attributes & {
    currency?: 'IGNORE' | 'EUR' | 'GBP' | 'USD';
    decimals?: number;
    delay?: number;
    max?: number;
    state?: { value: number },
    suffix?: string;
    value: number;
}) => {
    let formatter = currency === 'IGNORE'
            ? undefined
            : formatters[currency || 'USD'] ??= new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency || 'USD'
            }),
        animation = reactive({ started: false }),
        render = reactive([] as { digit: boolean; value: string }[]),
        stop = effect(() => {
            let target = api.value === -1 ? value : api.value,
                started = animation.started;

            let padding = (max || target).toFixed(decimals).length - target.toFixed(decimals).length,
                values = target.toString().padStart(target.toString().length + padding, '1') as any;

            if (formatter) {
                values = formatter.format(values);
            }
            else {
                values = Number(values).toLocaleString([], {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: decimals
                });
            }

            values = values.split('');

            if (suffix) {
                values.push(' ', ...suffix.split(''));
            }

            untrack(() => {
                for (let i = 0, n = values.length; i < n; i++) {
                    let value = values[i],
                        digit = !isNaN(parseInt(value, 10));

                    if (digit && (!started || padding > 0)) {
                        padding--;
                        value = '0';
                    }

                    // Preserve the track so CSS can transition between digit positions.
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
        }),
        timer = setTimeout(() => animation.started = true, delay ?? 1000);

    onCleanup(() => {
        clearTimeout(timer);
        stop();
    });

    return html`
        <div class='counter' ${attributes}>
            ${html.reactive(render, function (character) {
                    if (!character.digit) {
                        return html`
                            <span class='counter-character counter-character--symbol'>
                                ${() => character.value}
                            </span>
                        `;
                    }

                    return html`
                        <div class='counter-character'>
                            <div class='counter-character-track' style='${() => `--value: ${character.value}`}'>
                                <span>9</span>
                                ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => html`<span>${value}</span>`)}
                                <span>0</span>
                            </div>
                        </div>
                    `;
                })}
        </div>
    `;
};
