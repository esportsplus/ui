import { html, reactive, type Attributes, type Renderable } from '@esportsplus/frontend';
import { omit } from '@esportsplus/utilities';
import template from '~/components/template';
import write from './write';


type A = { timeout?: number, value: string } & Attributes;


const OMIT = ['timeout', 'value'];


export default template.factory<A, (state: { copied: boolean }) => Renderable<unknown>>(
    function(attributes, content) {
        let state = reactive({
                copied: false
            }),
            timeout = attributes.timeout || 1000 * 2;

        return html`
            <div
                ${omit(attributes, OMIT)}
                onclick=${(e: MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();

                    write(attributes.value).then(() => {
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