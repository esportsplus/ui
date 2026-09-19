import { html } from '../../app';
import { toc } from '../toc';
import type { Page } from '../../types';
import './scss/index.scss';


const layout = (page: Page) => html`
    <main class='docs-main'>${page.render()}</main>
    ${toc(page.toc)}
`;


export { layout };
