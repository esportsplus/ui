import { loader } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import type { Entry } from '../types';


const entry: Entry = {
    name: 'loader',
    variants: [
        {
            render: () => {
                let state = reactive({ plays: 0 });

                return html`
                    <div class='button button--primary' style='--width: auto;' onclick='${() => state.plays++}'>
                        play loader
                    </div>

                    ${() => state.plays > 0 && loader({})}
                `;
            },
            title: 'full-screen reveal'
        }
    ]
};


export default entry;
