import { html, type Attributes } from '@esportsplus/template';
import { effect, onCleanup, reactive, untrack } from '@esportsplus/reactivity';
import './scss/index.scss';


type Currency = 'EUR' | 'GBP' | 'IGNORE' | 'USD';


let formatters: Record<string, Intl.NumberFormat> = {};


// Both paths use the visitor's locale; 'IGNORE' formats a plain number instead of a currency.
function formatter(currency: Currency, decimals: number) {
    if (currency === 'IGNORE') {
        return formatters[decimals] ??= new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals });
    }

    return formatters[currency] ??= new Intl.NumberFormat(undefined, { currency, style: 'currency' });
}


export default ({ currency = 'USD', decimals = 2, delay, max, prefix, startOnView, value, state: api = reactive({ value }), suffix, ...attributes }: Attributes & {
    currency?: Currency;
    decimals?: number;
    delay?: number;
    max?: number;
    prefix?: string;
    startOnView?: boolean;
    state?: { value: number },
    suffix?: string;
    value: number;
}) => {
    let animation = reactive({ started: false }),
        format = formatter(currency, decimals),
        observer: IntersectionObserver | undefined,
        render = reactive([] as { digit: boolean; index: number; roll: number; value: string }[]),
        stop = effect(() => {
            let started = animation.started,
                target = api.value;

            let padding = (max || target).toFixed(decimals).length - target.toFixed(decimals).length,
                values = format.format(Number(target.toString().padStart(target.toString().length + padding, '1'))).split('');

            if (prefix) {
                values.unshift(...prefix.split(''));
            }

            if (suffix) {
                values.push(' ', ...suffix.split(''));
            }

            untrack(() => {
                let remaining = values.filter((value: string) => !isNaN(parseInt(value, 10))).length;

                for (let i = 0, n = values.length; i < n; i++) {
                    let previous = render[i],
                        value = values[i],
                        digit = !isNaN(parseInt(value, 10)),
                        index = digit ? --remaining : 0;

                    if (digit && (!started || padding > 0)) {
                        padding--;
                        value = '0';
                    }

                    // Preserve the track so CSS can transition between digit positions.
                    if (previous?.digit === digit) {
                        previous.index = index;

                        if (previous.value !== value) {
                            previous.roll = previous.roll === 1 ? 2 : 1;
                            previous.value = value;
                        }
                    }
                    else {
                        let character = reactive({ digit, index, roll: 0, value });

                        render[i] = character;
                    }
                }

                if (render.length > values.length) {
                    render.splice(values.length);
                }
            });
        }),
        timer: ReturnType<typeof setTimeout> | undefined;

    function start() {
        timer = setTimeout(() => animation.started = true, delay ?? 1000);
    }

    onCleanup(() => {
        clearTimeout(timer);
        observer?.disconnect();
        stop();
    });

    return html`
        <div
            class='counter'
            ${attributes}
            ${{
                onconnect: (element: HTMLElement) => {
                    if (!startOnView) {
                        start();
                        return;
                    }

                    observer = new IntersectionObserver((entries) => {
                        if (!entries.some((entry) => entry.isIntersecting)) {
                            return;
                        }

                        observer?.disconnect();
                        start();
                    });
                    observer.observe(element);
                }
            }}
        >
            ${html.reactive(render, function (character) {
                    if (!character.digit) {
                        return html`
                            <span aria-hidden='true' class='counter-character counter-character--symbol'>
                                ${() => character.value}
                            </span>
                        `;
                    }

                    // Alternating the roll parity swaps between identical keyframes, restarting the per-roll animation.
                    return html`
                        <div aria-hidden='true' class='counter-character'>
                            <div
                                class='counter-character-track ${() => character.roll && `counter-character-track--roll-${character.roll}`}'
                                style='${() => `--index: ${character.index}; --value: ${character.value}`}'
                            >
                                <span>9</span>
                                ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => html`<span>${value}</span>`)}
                                <span>0</span>
                            </div>
                        </div>
                    `;
                })}
            <span class='counter-sr'>${prefix}${() => format.format(api.value)}${suffix && ` ${suffix}`}</span>
        </div>
    `;
};
