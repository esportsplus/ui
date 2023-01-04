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
        processing: false,
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

    state.messages.clear();

    for (let message of messages) {
        state.messages.add(message);
    }

    state.state = 'activating';
    state.type = key;

    // Slide in animation needs time
    if (state.active) {
        state.active = true;
        state.processing = false;

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
        state.processing = false;

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
        state.processing = false;
    }, timeout);
}


const error = (messages: string | string[], seconds: number = 0) => activate('error', messages, seconds);

const info = (messages: string | string[], seconds: number = 0) => activate('info', messages, seconds);

const processing = () => {
    state.state = 'activating';
    state.processing = true;

    // Slide in animation needs time
    setTimeout(() => {
        state.active = true;
    }, timeout);
};

const success = (messages: string | string[], seconds: number = 0) => activate('success', messages, seconds);


const h = () => {
    return () => state.active || state.processing ? html`
        <div class='alert anchor anchor--ne ${() => state.active && '--active'} ${() => `alert--${state.state}`}'>
            ${() => !state.processing ? html`
                <div class="alert-close --flex-start --margin-right --margin-100" onclick='${deactivate}'>
                    <div class='button --background-state ${() => `--background-${modifiers[state.type] || 'black'}`} --color-state --color-white --flex-center --padding-300'>
                        <div class="icon --size-300">
                            <svg width="16" height="16" viewBox="0 0 16 16">
                                <path d="M3.527 14.948a.176.176 0 01-.248 0L1.051 12.72a.176.176 0 010-.248l11.42-11.419a.176.176 0 01.248 0l2.229 2.228a.174.174 0 010 .248L3.527 14.948z"/>
                                <path d="M12.472 14.948c.068.068.18.068.248 0l2.229-2.229a.176.176 0 000-.248L3.528 1.052a.176.176 0 00-.248 0L1.052 3.28a.176.176 0 000 .248l11.42 11.42z"/>
                            </svg>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="card --overflow-hidden" style='--background: var(--color-white-400)'>
                <div class="alert-message ${() => !state.processing && '--active'} --flex-row --padding --padding-horizontal-500 --padding-vertical-400">
                    <div class='--flex-row --flex-fill --flex-vertical'>
                        <div class="--flex-fill --flex-column --padding-right --padding-400">
                            <h5 class="page-title">
                                ${() => state.type.charAt(0).toUpperCase() + state.type.slice(1)}
                            </h5>
                            ${() => state.type && [...state.messages].map((message) => html`
                                <p class='--margin-top --margin-border-width-500'>${message}</p>
                            `)}
                        </div>

                        ${() => !state.processing && state.seconds ? html`
                            <svg class='alert-timer' style='--animation-duration: ${state.seconds}s;'>
                                <circle class="alert-timer-bg" cx="50%" cy="50%" r="40%" style='--border-color: var(--color-grey-500);' />
                                <circle class="alert-timer-meter" cx="50%" cy="50%" r="40%" style='--border-color: var(--color-black-300);' />
                            </svg>
                        ` : ''}
                    </div>
                </div>

                <div class='alert-processing ${() => state.processing && '--active'} --flex-row --flex-vertical --padding --padding-500'>
                    <div class="processing">
                        <span class='processing-ring'></span>
                    </div>
                    <div class='text --flex-fill --margin-left --margin-300 --text-bold' style='--color: var(--color-text-500)'>
                        Processing

                        <div class='ellipsis'>
                            <span class='ellipsis-dot --margin-left --margin-border-width'>.</span>
                            <span class='ellipsis-dot --margin-left --margin-border-width'>.</span>
                            <span class='ellipsis-dot --margin-left --margin-border-width'>.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    ` : '';
};

const types = ['error', 'info', 'success'] as const;


export default { deactivate, error, html: h, info, processing, success, types };