import { effect, reactive } from '@esportsplus/reactivity'
import { html, type Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import './scss/index.scss';


const OMIT = ['currency', 'decimals', 'delay', 'max', 'state', 'suffix', 'value'];


let formatters: Record<string, Intl.NumberFormat> = {};


export default (attributes: Attributes & {
    currency?: 'IGNORE' | 'EUR' | 'GBP' | 'USD';
    decimals?: number;
    delay?: number;
    max?: number;
    state?: { value: number },
    suffix?: string;
    value: number;
}) => {
    let { currency, decimals, delay, max, suffix, value } = attributes,
        api = attributes.state || reactive({ value: -1 }),
        formatter = currency === 'IGNORE'
            ? undefined
            : formatters[currency || 'USD'] ??= new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency || 'USD'
            }),
        rendering = true,
        state = reactive({
            length: 0,
            test: () => 'sds',
            render: [] as string[]
        }),
        render = reactive([] as string[]);

    decimals ??= 2;

    effect(() => {
        if (api.value !== -1) {
            value = api.value;
        }

        let padding = (max || value).toFixed(decimals).length - value.toFixed(decimals).length,
            values = value.toString().padStart( value.toString().length + padding, '1') as any;

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

        state.length = values.length;

        for (let i = 0, n = values.length; i < n; i++) {
            let value = values[i];

            if (!isNaN(parseInt(value, 10)) && (rendering === true || padding > 0)) {
                padding--;
                value = '0';
            }

            render[i] = value;
        }

        if (rendering === true) {
            rendering = false;
            setTimeout(() => api.value = value, delay || 1000);
        }
    });

    return html`
        <div class='counter' ${omit(attributes, OMIT)}>
            ${() => {
                let n = state.length;

                if (n === 0) {
                    return '';
                }

                return html.reactive(render, function (value) {
                    if (isNaN(parseInt(value, 10))) {
                        return html`
                            <span class='counter-character counter-character--symbol'>
                                ${value}
                            </span>
                        `;
                    }

                    return html`
                        <div class=' counter-character'>
                            <div class='counter-character-track' style='${`--value: ${value}`}'>
                                <span>9</span>
                                ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => html`<span>${value}</span>`)}
                                <span>0</span>
                            </div>
                        </div>
                    `;
                });
            }}
        </div>
    `;
};