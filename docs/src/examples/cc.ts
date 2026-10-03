import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { cc } from '@esportsplus/ui';
import '~/examples/cc.scss';


export default {
    name: 'cc',
    variants: [
        {
            render: () => cc({}),
            title: 'default'
        },
        {
            render: () => {
                let result = reactive({ text: 'Fill in the card and check it.' }),
                    state = reactive({ cvc: '', expiry: '12/30', name: 'Grace Hopper', number: '3782 822463 10005' });

                return html`
                    <div class='cc-demo'>
                        ${cc({
                            onvalid: (card) => {
                                result.text = `${card.brand} ending ${card.last4}, expires ${card.expiry}, ${card.name}`;
                            },
                            state,
                            submit: 'Validate card'
                        })}
                        <span class='cc-demo-status'>${() => result.text}</span>
                    </div>
                `;
            },
            title: 'prefilled amex + onvalid'
        }
    ]
};
