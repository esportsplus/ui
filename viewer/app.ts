import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { sidebar } from '~/components';
import { entries } from './demos';

import category from './category';


let state = reactive({ category: 'all' });


export default html`
    ${sidebar(
        { class: 'sidebar--floating sidebar--w --active' },
        ['all', ...entries.map((entry) => entry.name)].map((name) => html`
            <div
                class='link ${() => state.category === name && '--active'}'
                onclick='${() => state.category = name}'
            >
                ${name}
            </div>
        `)
    )}
    <main class='viewer-main'>
        ${() => category(state.category === 'all' ? entries : entries.filter((entry) => entry.name === state.category))}
    </main>
`;
