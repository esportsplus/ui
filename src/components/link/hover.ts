import { html } from '@esportsplus/template';


export default ({ attributes, content }: { attributes?: Record<string, any>, content: any }) => {
    return {
        attributes: {
            class: 'link--hover'
        },
        content: html`
            <span class='link-hover link-hover--one' ${attributes}>
                ${content}
            </span>

            <span class='link-hover link-hover--two' ${attributes}>
                ${content}
            </span>
        `
    };
};