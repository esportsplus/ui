import response from '@esportsplus/action';
import { Action } from './types';
// import alert from '~/components/alert';
import input from './input';


function parse(input: ReturnType<FormData['entries']>) {
    let data: Record<string, any> = {};

    for (let [path, value] of input) {
        let bucket = data,
            segments = path.indexOf('.') !== -1 ? path.split('.') : [path];

        for (let i = 0; i < segments.length - 1; i++) {
            bucket = bucket[ segments[i] ] = bucket[ segments[i] ] || {};
        }

        let key = segments.at(-1)!;

        if (path.endsWith('[]')) {
            if (typeof value === 'string' && value.trim() === '') {
                continue;
            }

            bucket = bucket[ key.substring(0, key.length - 2) ] ??= [];
            bucket.push(value);
        }
        else {
            bucket[key] = value;
        }
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
            // TODO: Figure out button--processing
             // - Could pass reactive value above and tie it to form layout handler
            event.preventDefault();
            event?.submitter?.classList.add('button--processing');

            let { errors } = await action({
                    // @ts-ignore
                    alert: null,
                    input: parse( new FormData( this ).entries() ),
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