import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import icon from '~/components/icon';
import textarea from '~/components/textarea';
import arrow from './svg/arrow-up.svg';
import './scss/index.scss';


const COMPOSER_SEND = Symbol.for('@esportsplus/ui/composer.send');

const COMPOSER_TEXTAREA = Symbol.for('@esportsplus/ui/composer.textarea');


type A = Attributes & {
    [COMPOSER_SEND]?: Attributes & {
        disabled?: never;
        onclick?: never;
    };
    [COMPOSER_TEXTAREA]?: Parameters<typeof textarea>[0] & {
        oninput?: never;
        onkeydown?: never;
        value?: never;
    };
    actions?: Renderable<unknown>;
    footer?: Renderable<unknown>;
    state?: { processing: boolean, value: string };
    submit: (value: string) => Promise<void> | void;
};


type D = Attributes & Pick<A, typeof COMPOSER_SEND | typeof COMPOSER_TEXTAREA>;


export default component(
    function(
        this: { attributes?: D },
        {
            actions,
            footer,
            state = reactive({
                processing: false,
                value: ''
            }),
            submit,
            ...attributes
        }: A
    ) {
        let disabled = () => state.processing || !state.value.trim();

        let send = async () => {
            if (disabled()) {
                return;
            }

            state.processing = true;

            try {
                await submit(state.value);
                state.value = '';
            }
            finally {
                state.processing = false;
            }
        };

        return html`
            <div class='composer' ${this?.attributes} ${attributes}>
                <div class='composer-input'>
                    ${textarea({
                        autoresize: { height: { max: '320px', min: '72px' } },
                        ...this?.attributes?.[COMPOSER_TEXTAREA],
                        ...attributes[COMPOSER_TEXTAREA],
                        oninput: (e: Event) => {
                            state.value = (e.target as HTMLTextAreaElement).value;
                        },
                        onkeydown: (e: KeyboardEvent) => {
                            if (e.key !== 'Enter' || e.isComposing || e.shiftKey) {
                                return;
                            }

                            e.preventDefault();
                            void send();
                        },
                        value: () => state.value
                    })}

                    <div class='composer-toolbar'>
                        <div class='composer-actions'>
                            ${actions}
                        </div>

                        <button
                            aria-label='Send'
                            class='composer-send'
                            type='button'
                            ${this?.attributes?.[COMPOSER_SEND]}
                            ${attributes[COMPOSER_SEND]}
                            ${{
                                disabled,
                                onclick: send
                            }}
                        >
                            ${icon({ 'aria-hidden': true }, arrow)}
                        </button>
                    </div>
                </div>

                ${footer && html`
                    <div class='composer-footer'>
                        ${footer}
                    </div>
                `}
            </div>
        `;
    },
    { send: COMPOSER_SEND, textarea: COMPOSER_TEXTAREA }
);
