import { html } from '../../app';
import './scss/index.scss';


const pageHead = (title: string, description: string) => html`
    <div class='docs-page-head'>
        <h1 class='page-title docs-page-title'>${title}</h1>
        <p class='docs-page-lede'>${description}</p>
    </div>
`;


export { pageHead };
