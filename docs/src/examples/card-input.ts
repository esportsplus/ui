import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { cardInput } from '@esportsplus/ui';
import './card-input.scss';


export default {
    name: 'card-input',
    variants: [
        {
            render: () => cardInput({}),
            title: 'default'
        },
        {
            render: () => {
                let result = reactive({ text: 'Fill in the card and check it.' }),
                    state = reactive({ cvc: '', expiry: '12/30', name: 'Grace Hopper', number: '3782 822463 10005' });

                return html`
                    <div class='card-input-demo'>
                        ${cardInput({
                            onvalid: (card) => {
                                result.text = `${card.brand} ending ${card.last4}, expires ${card.expiry}, ${card.name}`;
                            },
                            state,
                            submit: 'Validate card'
                        })}
                        <span class='card-input-demo-status'>${() => result.text}</span>
                    </div>
                `;
            },
            title: 'prefilled amex + onvalid'
        }
    ]
};
