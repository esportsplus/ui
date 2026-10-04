import { html } from 'docs/app';
import { pageNavigation } from 'docs/components/page-navigation';
import 'docs/components/page/scss/index.scss';


const pageHead = (title: string, description: string) => html`
    <div class='page-head title-row'>
        <h1 class='page-title --text-crop'>
            ${title}
        </h1>
        ${pageNavigation()}
        <p class='page-lede'>${description}</p>
    </div>
`;


export { pageHead };
