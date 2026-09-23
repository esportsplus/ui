import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import write from './write';


type A = Attributes & {
    timeout?: number;
    value: string;
};


export default component<A, (state: { copied: boolean, failed: boolean }) => Renderable<unknown>>(
    ({ timeout = 3000, value, ...attributes }, content) => {
        let state = reactive({ copied: false, failed: false }),
            timer: ReturnType<typeof setTimeout> | undefined,
            connected = true;

        return html`
            <button
                type='button'
                ${attributes}
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

                        let copied = await write(value);

                        if (!connected) {
                            return;
                        }

                        clearTimeout(timer);
                        state.copied = copied;

                        if (!copied) {
                            state.failed = true;
                            return;
                        }

                        timer = setTimeout(() => { state.copied = false; }, timeout);
                    }
                }}
            >
                ${() => content(state)}
            </button>
        `;
    }
);
