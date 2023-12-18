import { html } from '@esportsplus/template';


const header = ({ subtitle, suptitle, title }: { subtitle?: string, suptitle?: string, title?: string }) => html`
    ${suptitle ? html`
        <span class="page-suptitle --text-bold --text-crop --text-uppercase --text-200" style="--color-default: var(--color-primary-400);letter-spacing: 0.24px;">
            ${suptitle}
        </span>
    ` : ''}

    ${title ? html`
        <h1 class="page-title --line-height-200 --margin-300 ${!subtitle && '--text-crop-bottom'} ${suptitle ? '--margin-top' : '--text-crop-top'}">
            ${title}
        </h1>
    ` : ''}

    ${subtitle ? html`
        <span class="page-subtitle --margin-top --margin-300 --text-crop-bottom">
            ${subtitle}
        </span>
    ` : ''}
`;


export default { header };
export { header };