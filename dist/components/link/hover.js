import { html } from '@esportsplus/template';
export default ({ attributes, content }) => {
    return {
        attributes: {
            class: 'link--hover'
        },
        html: html `
            <span class='link-hover link-hover--one' ${attributes}>
                ${content}
            </span>

            <span class='link-hover link-hover--two' ${attributes}>
                ${content}
            </span>
        `
    };
};
