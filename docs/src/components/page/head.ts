import { html } from '../../app';
import { pageNavigation } from '../page-navigation';
import './scss/index.scss';


const pageHead = (title: string, description: string) => html`
    <div class='docs-page-head'>
        <div class='docs-title-row'>
            <h1 class='page-title docs-page-title --text-crop'>
                ${title}
            </h1>
            ${pageNavigation()}
        </div>
        <p class='docs-page-lede'>${description}</p>
    </div>
`;


export { pageHead };
