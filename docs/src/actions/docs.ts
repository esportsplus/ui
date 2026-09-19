import { html } from '../app';
import { layout } from '../components/layout';
import readme from '/README.md?raw';
import type { Router } from '../app';
import type { Page } from '../types';
import { prose } from '../components/prose';


const page = (): Page => ({
    render: () => html`
        <div class='page docs-page'>
            ${prose(readme)}
        </div>
    `,
    toc: []
});


export { page };
export default (r: Router) => r
    .get({ name: 'docs', path: '/docs', responder: () => layout(page()) })
    .get({ name: 'home', path: '/', responder: () => layout(page()) });
