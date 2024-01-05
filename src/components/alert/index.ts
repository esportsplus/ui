import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


type Type = 'error' | 'info' | 'success';


let modifiers: Record<Type, string> = {
        error: 'red',
        info: 'black',
        success: 'green'
    },
    state = reactive({
        active: false,
        messages: new Set as Set<string>,
        seconds: 0,
        state: 'activating',
        type: '' as Type
    }),
    timeout = 250;


function activate(key: Type, messages: string | string[], seconds: number = 0) {
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

    state.state = 'activating';
    state.type = key;

    // Slide in animation needs time
    if (state.active) {
        state.active = true;

        if (seconds) {
            if (!state.seconds) {
                state.seconds = seconds;
            }

            setTimeout(() => {
                if (messages && messages.length < (state?.messages?.size || 0)) {
                    for (let message of messages) {
                        state.messages.delete(message);
                    }

                    state.messages = state.messages;
                }
                else {
                    deactivate();
                }
            }, 400 * seconds);
        }
        else {
            state.seconds = 0;
        }
        return;
    }

    setTimeout(() => {
        state.active = true;

        if (seconds) {
            if (!state.seconds) {
                state.seconds = seconds;
            }

            setTimeout(() => {
                if (messages && messages.length < (state?.messages?.size || 0)) {
                    for (let message of messages) {
                        state.messages.delete(message);
                    }

                    state.messages = state.messages;
                }
                else {
                    deactivate();
                }
            }, 400 * seconds);
        }
        else {
            state.seconds = 0;
        }
    }, timeout);
}

function deactivate() {
    state.state = 'deactivating';

    setTimeout(() => {
        state.active = false;
        state.messages.clear();
    }, timeout);
}


const error = (messages: string | string[], seconds: number = 0) => activate('error', messages, seconds);

const info = (messages: string | string[], seconds: number = 0) => activate('info', messages, seconds);

const success = (messages: string | string[], seconds: number = 0) => activate('success', messages, seconds);


const h = () => {
    // TODO: Fix importing close svg
    return () => state.active ? html`
        <div class='alert anchor anchor--ne ${() => state.active && '--active'} ${() => `alert--${state.state}`}'>
            <div class="alert-close --flex-start --margin-right --margin-100" onclick='${deactivate}'>
                <div class='button --background-state ${() => `--background-${modifiers[state.type] || 'black'}`} --color-state --color-white --flex-center --padding-300'>
                    <div class="icon --size-300">
                        ${html.inline`
                            <svg width="16" height="16" viewBox="0 0 16 16">
                                <path d="M3.527 14.948a.176.176 0 01-.248 0L1.051 12.72a.176.176 0 010-.248l11.42-11.419a.176.176 0 01.248 0l2.229 2.228a.174.174 0 010 .248L3.527 14.948z"/>
                                <path d="M12.472 14.948c.068.068.18.068.248 0l2.229-2.229a.176.176 0 000-.248L3.528 1.052a.176.176 0 00-.248 0L1.052 3.28a.176.176 0 000 .248l11.42 11.42z"/>
                            </svg>
                        `}
                    </div>
                </div>
            </div>

            <div class="card --overflow-hidden" style='--background: var(--color-white-400)'>
                <div class="alert-message --active --flex-row --padding --padding-horizontal-500 --padding-vertical-400">
                    <div class='--flex-row --flex-fill --flex-vertical'>
                        <div class="--flex-fill --flex-column --padding-right --padding-400">
                            <h5 class="page-title">
                                ${() => state.type.charAt(0).toUpperCase() + state.type.slice(1)}
                            </h5>
                            ${() => state.type && [...state.messages].map((message) => html`
                                <p class='--margin-top --margin-border-width-500'>${message}</p>
                            `)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    ` : '';
};

const types = ['error', 'info', 'success'] as const;


export default { deactivate, error, html: h, info, success, types };