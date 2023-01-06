import { html } from '@esportsplus/template';


export default (data: { subtitle?: string, suptitle?: string, title?: string }) => html`
    ${data?.suptitle ? html`
        <span class="page-suptitle --text-bold --text-crop --text-uppercase --text-200" style="--color-default: var(--color-primary-400);letter-spacing: 0.24px;">
            ${data?.suptitle}
        </span>
    ` : ''}

    ${data?.title ? html`
        <h1 class="page-title --line-height-200 --margin-300 ${!data?.subtitle && '--text-crop-bottom'} ${data?.suptitle ? '--margin-top' : '--text-crop-top'}">
            ${data?.title}
        </h1>
    ` : ''}

    ${data?.subtitle ? html`
        <span class="page-subtitle --margin-top --margin-300 --text-crop-bottom">
            ${data?.subtitle}
        </span>
    ` : ''}
`;