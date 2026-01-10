import '@esportsplus/vite/global.d.ts';
import { Response } from '@esportsplus/action';
import { html, reactive, svg, Attributes, Renderable } from '@esportsplus/frontend';
import { omit } from '@esportsplus/utilities';
import { icon } from '@esportsplus/ui';
import check from './svg/check.svg';
import close from './svg/close.svg';
import e from './svg/error.svg';
import './scss/index.scss';


type Type = 'error' | 'info' | 'success';


const OMIT = ['alert-close', 'alert-messages', 'alert-message'];


let modifiers: Record<Type, string> = {
        error: 'red',
        info: 'black',
        success: 'green'
    },
    timeout = 250;


function activate(key: Type, messages: Renderable<any>, seconds: number, state: { active: boolean, messages: Set<Renderable<any>>, rerender: number, type: Type }) {
    if (!Array.isArray(messages)) {
        messages = [messages];
    }

    if (!messages.length) {
        return;
    }

    if (state.type !== key) {
        state.active = false;
        state.messages.clear();
    }

    state.type = key;

    for (let message of messages) {
        state.messages.add(message);
    }

    if (state.active) {
        state.rerender++;

        if (!seconds) {
            return;
        }

        setTimeout(deactivate, timeout + (500 * seconds));
    }
    else {
        setTimeout(() => {
            state.active = true;
            state.rerender++;
            state.type = key;

            if (seconds) {
                setTimeout(deactivate, 500 * seconds);
            }
        }, timeout);
    }
}

function deactivate(state: { active: boolean, messages: Set<Renderable<any>>, type: Type }) {
    state.active = false;

    setTimeout(() => {
        state.messages.clear();
    }, timeout);
}


export default (attributes: Attributes & { 'alert-close'?: Attributes, 'alert-messages'?: Attributes, 'alert-message'?: Attributes }) => {
    let state = reactive({
            active: false,
            messages: new Set() as Set<Renderable<any>>,
            rerender: 0,
            type: '' as Type
        });


    const error = (messages: Renderable<any>, seconds: number = 0) => activate('error', messages, seconds, state);

    error.response = (response: Response<any>) => {
        if (response.ok) {
            return;
        }

        error(
            response.errors.map(({ message, path }) => {
                if (!path) {
                    return message;
                }

                return `${String(path).split('.').join(' ')} ${message}`;
            }),
            5
        );
    };


    return {
        content: html`
            <div
                class='alert anchor anchor--n ${() => state.active && '--active'} --flex-row'
                ${omit(attributes, OMIT)}
            >
                ${() => {
                    let type = state.type;

                    return html`
                        <div class='--flex-vertical' style='${`--color: var(--color-${modifiers[type]}-400);`}'>
                            ${icon({ class: '--size-500' }, type === 'error' ? e : check)}
                        </div>
                    `;
                }}

                <div
                    class='alert-messages --flex-column --flex-fill'
                    ${attributes['alert-messages']}
                >
                    ${() => {
                        let message = attributes['alert-message'];

                        return state.rerender && [...state.messages].map((content) => {
                            if (typeof content === 'string') {
                                return html`
                                    <p ${message}>
                                        ${content}
                                    </p>
                                `;
                            }

                            return html`
                                <div class='--flex-start'>
                                    ${content}
                                </div>
                            `;
                        });
                    }}
                </div>

                <div class="--flex-vertical">
                    <div
                        class='alert-close button --padding-300'
                        onclick='${() => deactivate(state)}'
                        ${attributes['alert-close']}
                    >
                        <div class="icon" style='--size: 14px;'>
                            ${svg.sprite(close)}
                        </div>
                    </div>
                </div>
            </div>
        `,
        deactivate: () => deactivate(state),
        error,
        info: (messages: Renderable<any>, seconds: number = 0) => activate('info', messages, seconds, state),
        success: (messages: Renderable<any>, seconds: number = 0) => activate('success', messages, seconds, state)

    };
};