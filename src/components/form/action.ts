import { response } from '@esportsplus/action';
import { html } from '@esportsplus/template';
import alert from '~/components/alert';
import { Action, Reactive } from './types';


function parse(input: Record<string, any>) {
    let data: Record<string, any> = {};

    for (let path in input) {
        let bucket = data,
            keys = path.indexOf('.') !== -1 ? path.split('.') : [path];

        for (let i = 0; i < keys.length - 1; i++) {
            bucket = bucket[keys[i]] = bucket[keys[i]] || {};
        }

        bucket[ keys[keys.length - 1] ] = input[path];
    }

    return data;
};


export default function(action: Action, reactive: Reactive = {}) {
    return html({
        onclick: function(this: HTMLFormElement, event: Event) {
            let trigger = event.target as HTMLButtonElement;

            if (trigger?.type !== 'submit') {
                return;
            }

            // On initial page load both events will be dispatched without preventDefault
            event.preventDefault();

            this.dispatchEvent(
                new SubmitEvent('submit', { cancelable: true, bubbles:true, submitter: trigger })
            );
        },
        onsubmit: async function(this: HTMLFormElement, event: SubmitEvent) {
            event.preventDefault();

            let { errors } = await action({
                    alert,
                    input: parse( Object.fromEntries( new FormData( this )?.entries() ) ),
                    processing: {
                        end: (deactivate: boolean = true) => {
                            if (deactivate) {
                                alert.deactivate();
                            }

                            event?.submitter?.classList.remove('button--processing');
                        },
                        start: () => {
                            alert.processing();
                            event?.submitter?.classList.add('button--processing');
                        }
                    },
                    response
                });

            if (errors && 'errors' in reactive) {
                let messages: Record<string, string> = {};

                for (let i = 0, n = errors.length; i < n; i++) {
                    let { message, path } = errors[i];

                    messages[path] = `${message[0].toUpperCase()}${message.substring(1)}`;
                }

                reactive.errors = messages;
            }
        }
    });
};