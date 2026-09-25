import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { emailTypoFix } from '@esportsplus/ui';
import './email-typo-fix.scss';


type State = { active: boolean, error: string, sent: string, value: string };


const NAME = 'maya.chen@';

// Four slips of different shapes: a swap, a swap mid-word, a dropped letter and a wrong key in the ending.
const TYPOS = ['gmial.com', 'hotmial.com', 'yaho.com', 'gmail.con'];

const VALID = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;


function card(state: State, submit = 'Create account') {
    return html`
        <form
            class='email-typo-fix-demo-card'
            novalidate
            ${{
                onsubmit: (e: SubmitEvent) => {
                    e.preventDefault();

                    if (VALID.test(state.value.trim())) {
                        state.sent = state.value.trim();
                    }
                }
            }}
        >
            <h2 class='email-typo-fix-demo-title'>Start your free trial</h2>
            <p class='email-typo-fix-demo-subtitle'>14 days of everything. No card needed.</p>
            ${emailTypoFix({ state })}
            <button
                class='email-typo-fix-demo-submit'
                disabled=${() => !VALID.test(state.value.trim())}
                type='submit'
            >
                ${submit}
            </button>
        </form>
    `;
}


export default {
    name: 'email-typo-fix',
    variants: [
        {
            render: () => {
                // Opens on a typo so the suggestion is the first thing you see.
                let state = reactive({ active: false, error: '', sent: '', value: `${NAME}${TYPOS[0]}` });

                return html`
                    <div class='email-typo-fix-demo'>
                        ${card(state)}
                        <div class='email-typo-fix-demo-typos'>
                            <span>Try another typo</span>
                            <div>
                                ${TYPOS.map((typo) => html`
                                    <button
                                        aria-pressed=${() => String(state.value === `${NAME}${typo}`)}
                                        class='email-typo-fix-demo-typo'
                                        type='button'
                                        ${{
                                            onclick: () => {
                                                state.sent = '';
                                                state.value = `${NAME}${typo}`;
                                            }
                                        }}
                                    >
                                        ${typo}
                                    </button>
                                `)}
                            </div>
                        </div>
                    </div>
                `;
            },
            title: 'sign up'
        },
        {
            render: () => html`
                <div class='email-typo-fix-demo'>
                    ${emailTypoFix({
                        class: 'email-typo-fix-demo-plain',
                        hint: 'Receipts go here. Type slowly: nothing is flagged until you pause.',
                        label: 'Billing email',
                        placeholder: 'billing@company.com'
                    })}
                </div>
            `,
            title: 'empty (debounced check)'
        }
    ]
};
