import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import write from './write';


type A = Attributes & {
    ondisconnect?: never;
    onclick?: never;
    timeout?: number;
    value: string;
};


export default component<A, (state: { copied: boolean, failed: boolean }) => Renderable<unknown>>(
    ({ timeout = 3000, value, ...attributes }, content) => {
        let state = reactive({ copied: false, failed: false }),
            reset = () => {
                clearTimeout(timer);
                state.copied = false;
                state.failed = false;
            },
            timer: ReturnType<typeof setTimeout> | undefined;

        return html`
            <div
                ${attributes}
                ${{
                    ondisconnect: reset,
                    onclick: async (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        reset();

                        state.copied = await write(value);

                        if (!state.copied) {
                            state.failed = true;
                        }

                        timer = setTimeout(reset, timeout);
                    }
                }}
            >
                ${() => content(state)}
            </div>
        `;
    }
);
