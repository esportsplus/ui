import '@esportsplus/vite/global.d.ts';
import { Response } from '@esportsplus/action';
import { reactive } from '@esportsplus/reactivity';
import { html, svg, Attributes, Renderable } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import { icon } from '@esportsplus/ui';
import check from './svg/check.svg';
import close from './svg/close.svg';
import e from './svg/error.svg';
import './scss/index.scss';


type Type = 'error' | 'info' | 'success';


const OMIT = ['close', 'message'];


let modifiers: Record<Type, string> = {
        error: 'red',
        info: 'black',
        success: 'green'
    },
    state = reactive({
        active: false,
        messages: new Set as Set<Renderable<any>>,
        type: '' as Type
    }),
    timeout = 250;


function activate(key: Type, messages: Renderable<any>, seconds: number = 0) {
    if (!Array.isArray(messages)) {
        messages = [messages];
    }

    if (!messages.length) {
        return;
    }

    if (state.type !== key) {
        state.messages.clear();
    }
    else {
        // @ts-ignore
        state.type = '';
    }

    for (let message of messages) {
        state.messages.add(message);
    }

    if (state.active) {
        state.active = false;

        // Slide in animation needs time
        setTimeout(() => {
            state.active = true;
            state.type = key;

            if (seconds) {
                setTimeout(deactivate, 500 * seconds);
            }
        }, timeout);
    }
    else {
        setTimeout(() => {
            state.active = true;
            state.type = key;

            if (seconds) {
                setTimeout(deactivate, 500 * seconds);
            }
        }, timeout);
    }
}

function deactivate() {
    state.active = false;

    setTimeout(() => {
        state.messages.clear();
    }, timeout);
}


const error = (messages: Renderable<any>, seconds: number = 0) => activate('error', messages, seconds);

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

const info = (messages: Renderable<any>, seconds: number = 0) => activate('info', messages, seconds);

const success = (messages: Renderable<any>, seconds: number = 0) => activate('success', messages, seconds);


const content = (attributes: Attributes & { close?: Attributes, message?: Attributes }) => {
    return html`
        <div
            class='alert anchor anchor--n ${() => state.active && '--active'}'
            ${omit(attributes, OMIT)}
        >
            <div class='--flex-row'>
                ${() => {
                    let type = state.type;

                    return html`
                        <div class='--flex-vertical' style='${`--color: var(--color-${modifiers[type]}-400);`}'>
                            ${icon({ class: '--margin-right --margin-600 --size-500' }, type === 'error' ? e : check)}
                        </div>
                    `;
                }}

                <div class='--flex-fill --flex-column --gap-100 --padding-right --padding-800'>
                    ${() => {
                        let message = attributes.message;

                        return state.type && [...state.messages].map((content) => {
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
            </div>

            <div
                class='alert-close button --padding-300'
                onclick='${deactivate}'
                ${attributes.close}
            >
                <div class="icon" style='--size: 14px;'>
                    ${svg.sprite(close)}
                </div>
            </div>
        </div>
    `;
};


export default { content, deactivate, error, info, success };