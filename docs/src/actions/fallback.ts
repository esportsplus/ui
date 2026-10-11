import { html } from '@esportsplus/template';


// Never rendered: docs/middleware/redirect sends unnamed routes to /components.
export default {
    handler: () => html``,
    name: null,
    path: null,
    subdomain: null
};
