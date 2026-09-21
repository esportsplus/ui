import { html } from '../app';
import { layout } from '../components/layout';
import installation from '../components/installation';
import type { Router } from '../app';
import type { Page } from '../types';


const page = (): Page => ({
    render: () => html`
        <div class='page docs-page'>${installation()}</div>
    `,
    toc: [
        { id: 'setup-package', label: 'Install the package' },
        { id: 'setup-styles', label: 'Import the styles' },
        { id: 'setup-component', label: 'Use a component' },
        { id: 'setup-preview', label: 'Preview' }
    ]
});


export { page };
export default (r: Router) => r
    .get({ name: 'docs', path: '/docs', responder: () => layout(page()) })
    .get({ name: 'home', path: '/', responder: () => layout(page()) });
