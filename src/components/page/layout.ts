import { html } from '@esportsplus/template';


type Data = {
    content?: any;
    subtitle?: string;
    suptitle?: string;
    title?: string;
    width?: string;
};


export default ({ content, subtitle, suptitle, title, width }: Data) => html`
    <div class="container --slide-in --margin-vertical --margin-900" style="${width && `--max-width: ${width};`}">
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

        ${content || ''}
    </div>
`;