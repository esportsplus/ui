import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import write from './write';


type A = { timeout?: number, value: string } & Attributes;


export default component<A, (state: { copied: boolean }) => Renderable<unknown>>(
    function({ timeout = 1000 * 2, value, ...attributes }, content) {
        let state = reactive({
                copied: false
            });

        return html`
            <div
                ${attributes}
                onclick=${(e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();

                    void write(value).then(() => {
                        state.copied = true;

                        setTimeout(() => {
                            state.copied = false;
                        }, timeout);
                    });
                }}
            >
                ${() => content(state)}
            </div>
        `;
    }
);