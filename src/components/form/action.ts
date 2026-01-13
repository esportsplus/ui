import response, { Response } from '@esportsplus/action';
import { html, Attributes, Element, Renderable } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import input from './input';


type Errors = { errors: Response<unknown>['errors'] };


const OMIT = ['action', 'state'];


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


export default <T extends Record<string, any>>(
    attributes: {
        action: (data: { input: T, response: typeof response }) => (Promise<Errors> | Errors),
        state?: { processing: boolean }
    } & Attributes,
    content: Renderable<any>
) => {
    let { action, state } = attributes;

    return html`
        <form
            class='form'
            ${omit(attributes, OMIT)}
            ${{
                onclick: function(event) {
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
                onsubmit: async function(event) {
                    event.preventDefault();

                    if (state) {
                        state.processing = true;
                    }

                    let { errors } = await action({
                        input: parse( new FormData( this as any as HTMLFormElement ).entries() ) as T,
                        response
                    });

                    for (let i = 0, n = errors.length; i < n; i++) {
                        let { message, path } = errors[i],
                            reactive = input.get( (this as any as HTMLFormElement)[path!] as Element | undefined );

                        if (!reactive) {
                            continue;
                        }

                        reactive.error = `${message[0].toUpperCase()}${message.substring(1)}`;
                    }

                    if (state) {
                        state.processing = false;
                    }
                }
            }}
        >
            ${content}
        </form>
    `;
};