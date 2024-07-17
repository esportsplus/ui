import response from '@esportsplus/action';
import { Action } from './types';
// import alert from '~/components/alert';
import input from './input';


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


export default function(action: Action) {
    return {
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
            // TODO: Figure out processing
             // - Could pass reactive value above and tie it to form layout handler
            event.preventDefault();
            event?.submitter?.classList.add('button--processing');

            let { errors } = await action({
                    alert: null,
                    input: parse( Object.fromEntries( new FormData( this )?.entries() ) ),
                    response
                });

            for (let i = 0, n = errors.length; i < n; i++) {
                let { message, path } = errors[i],
                    state = input.get( this[path!] );

                if (!state) {
                    continue;
                }

                state.error = `${message[0].toUpperCase()}${message.substring(1)}`;
            }

            // TODO: replace with signal
            event?.submitter?.classList.remove('button--processing');
        }
    };
};