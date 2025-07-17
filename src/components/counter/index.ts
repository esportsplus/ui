import { effect, reactive } from '@esportsplus/reactivity'
import { html } from '@esportsplus/template';
import './scss/index.scss';


let formatters: Record<string, Intl.NumberFormat> = {};


// TODO: Prevent rounding
export default ({ currency, delay, max, suffix, value }: { currency?: 'IGNORE' | 'EUR' | 'GBP' | 'USD', delay?: number, max?: number, suffix?: string, value: number }) => {
    let api = reactive({ value: -1 }),
        formatter = currency === 'IGNORE' ? undefined : formatters[currency || 'USD'] ??= new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'USD'
        }),
        rendering = true,
        state = reactive({
            length: 0,
            render: [] as string[]
        });

    effect(() => {
        if (api.value !== -1) {
            value = api.value;
        }

        let padding = (max || value).toFixed(2).length - value.toFixed(2).length,
            values = value.toString().padStart( value.toString().length + padding, '1') as any;

        if (formatter) {
            values = formatter.format(values);
        }
        else {
            values = Number(values).toLocaleString();
        }

        values = values.split('');

        if (suffix) {
            values.push(' ', ...suffix.split(''));
        }

        state.length = values.length;

        for (let i = 0, n = values.length; i < n; i++) {
            let value = values[i];

            if (!isNaN(parseInt(value, 10)) && (rendering === true || padding > 0)) {
                padding--;
                value = '0';
            }

            state.render[i] = value;
        }

        if (rendering === true) {
            rendering = false;
            setTimeout(() => api.value = value, delay || 1000);
        }
    });

    return {
        html: html`
            <div class='counter'>
                ${() => {
                    let n = state.length;

                    if (n === 0) {
                        return '';
                    }

                    return html.reactive(state.render, function (value, i) {
                        if (isNaN(parseInt(value as string, 10))) {
                            return html`
                                <span class='counter-character counter-character--symbol'>
                                    ${value}
                                </span>
                            `;
                        }

                        return html`
                            <div
                                class='
                                    ${i > n - 3 && 'counter-character--fraction'}
                                    counter-character
                                '
                            >
                                <div class='counter-character-track' style='${() => `--value: ${this[i]}`}'>
                                    <span>9</span>
                                    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => html`<span>${value}</span>`)}
                                    <span>0</span>
                                </div>
                            </div>
                        `;
                    })
                }}
            </div>
        `,
        state: api
    };
};