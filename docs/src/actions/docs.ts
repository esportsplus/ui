import installation from 'docs/components/installation';
import type { Router } from 'docs/app';
import type { Page } from 'docs/types';


const page = (): Page => ({
    render: installation,
    toc: [
        { id: 'setup-package', label: 'Install the package' },
        { id: 'setup-styles', label: 'Import the styles' },
        { id: 'setup-component', label: 'Use a component' },
        { id: 'setup-preview', label: 'Preview' }
    ]
});


export { page };
export default (r: Router) => r
    .get({ name: 'docs', path: '/docs', responder: () => page() })
    .get({ name: 'home', path: '/', responder: () => page() });
