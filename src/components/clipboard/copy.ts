import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import { omit } from '@esportsplus/utilities';
import write from './write';


type A = Attributes & {
    onerror?: () => void;
    timeout?: number;
    value: string;
};


const OMIT = ['onerror', 'timeout', 'value'];


export default component<A, (state: { copied: boolean }) => Renderable<unknown>>(
    (attributes, content) => {
        let state = reactive({ copied: false }),
            timer: ReturnType<typeof setTimeout> | undefined,
            connected = true;

        return html`
            <button
                type='button'
                ${omit(attributes, OMIT)}
                ${{
                    onconnect: () => { connected = true; },
                    ondisconnect: () => {
                        connected = false;
                        clearTimeout(timer);
                        state.copied = false;
                    },
                    onclick: async (event: MouseEvent) => {
                        event.preventDefault();
                        event.stopPropagation();

                        let copied = await write(attributes.value);

                        if (!connected) {
                            return;
                        }

                        clearTimeout(timer);
                        state.copied = copied;

                        if (!copied) {
                            attributes.onerror?.();
                            return;
                        }

                        timer = setTimeout(() => { state.copied = false; }, attributes.timeout ?? 3000);
                    }
                }}
            >
                ${() => content(state)}
            </button>
        `;
    }
);
