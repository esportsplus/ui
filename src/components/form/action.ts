import response from '@esportsplus/action';
import { Action } from './types';
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


export default function(action: Action, s?: { processing: boolean }) {
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
            event.preventDefault();

            if (s) {
                s.processing = true;
            }

            let { errors } = await action({
                    input: parse( new FormData( this ).entries() ),
                    response
                });

            for (let i = 0, n = errors.length; i < n; i++) {
                let { message, path } = errors[i],
                    reactive = input.get( this[path!] );

                if (!reactive) {
                    continue;
                }

                reactive.error = `${message[0].toUpperCase()}${message.substring(1)}`;
            }

            if (s) {
                s.processing = false;
            }
        }
    };
};