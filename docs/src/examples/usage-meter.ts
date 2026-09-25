import { usageMeter } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


function live(variant?: string) {
    let usage = reactive({ completion: 0, context: 128000, cost: 0.0021, prompt: 320 });

    return html`
        ${usageMeter({ class: variant, usage })}

        <div
            class='button button--tertiary'
            style='--width: auto; margin-top: var(--size-400);'
            onclick='${() => {
                if (usage.prompt + usage.completion >= usage.context) {
                    usage.completion = 0;
                    usage.cost = 0.0021;
                    usage.prompt = 320;
                    return;
                }

                usage.completion += 9600;
                usage.cost += 0.0384;
                usage.prompt += 14200;
            }}'
        >
            send message
        </div>
    `;
}


export default {
    name: 'usage-meter',
    variants: [
        {
            render: () => live(),
            title: 'bar'
        },
        {
            render: () => live('usage-meter--inline'),
            title: 'inline'
        },
        {
            render: () => usageMeter({ usage: { completion: 21400, context: 128000, cost: 0.4127, prompt: 81200 } }),
            title: 'warning (over 75%)'
        },
        {
            render: () => usageMeter({ usage: { completion: 24800, context: 128000, cost: 0.4981, prompt: 94100 } }),
            title: 'critical (over 90%)'
        },
        {
            render: () => usageMeter({ class: 'usage-meter--inline', usage: { completion: 1200, context: 200000, prompt: 18400 } }),
            title: 'inline without cost'
        }
    ]
};
