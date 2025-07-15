import { html, svg } from '@esportsplus/template';
import './scss/index.scss';
function copy({ attributes, brand }) {
    return html `
        <div class='footer-copyright group-item --flex-center'>
            <div
                class='text --padding-vertical --padding-300 --text-300'
                style='--color-default: var(--color-grey-500);'
                ${attributes}
            >
                &copy; ${`${new Date().getFullYear()} ${brand}, All rights reserved`}
            </div>
        </div>
    `;
}
export default ({ copyright, footer, nav, social }) => {
    return html `
        <footer class='footer' ${footer?.attributes}>
            <div class='container'>
                <div class='group group--offset-top --flex-center --margin-400'>

                    ${nav
        ? nav.links.map(({ text, url }) => html `
                            <div class='group-item'>
                                <a
                                    class='link --color-white --padding-vertical-300 --text-300'
                                    href='${url}'
                                    style='--color-default: var(--color-grey-500);'
                                    ${nav.attributes}
                                >
                                    ${text}
                                </a>
                            </div>
                        `)
        : copy(copyright)}

                    <div class='footer-break'></div>

                    ${social?.links && social.links.map(({ icon, url }) => html `
                        <div class='group-item'>
                            <a
                                class='link --color-white --padding-0px'
                                href='${url}'
                                style='--color-default: var(--color-grey-500);'
                                ${social.attributes}
                            >
                                <div class='icon --size-500'>
                                    ${svg.sprite(icon)}
                                </div>
                            </a>
                        </div>
                    `)}

                    ${nav && copy(copyright)}

                </div>
            </div>
        </footer>
    `;
};
