import { html, reactive, Attributes } from '@esportsplus/template';
import { omit } from '@esportsplus/utilities';
import template from '~/components/template';
import './scss/index.scss';


type A = Attributes & { state?: { active: boolean | number } };

type Accordion = HTMLElement & { [key: symbol]: { active: boolean | number } };


const OMIT = ['state'];


let key = Symbol();


export default template.factory(
    function(attributes: A, content) {
        let ref: Accordion,
            state = attributes.state || reactive({
                active: 0
            });

        return html`
            <div
                ${omit(attributes, OMIT)}
                ${{
                    class: () => {
                        return state.active && '--active';
                    },
                    onrender: (element) => {
                        ( ref = element as Accordion )[key] = state;
                    },
                    style: () => {
                        let parent = ref.closest<Accordion>('accordion');

                        if (parent && key in parent) {
                            parent[key].active = (+parent[key].active) + 1;
                        }

                        return state.active && `--max-height: ${ref.scrollHeight}`;
                    }
                }}
            >
                ${content}
            </div>
        `;
    }
);