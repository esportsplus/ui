import { component, html, type Attributes } from '@esportsplus/template';
import highlight from '~/components/highlight';
import './scss/index.scss';


type A = Attributes & {
    [GROUP_HIGHLIGHT]?: Parameters<typeof highlight>[0];
};


const GROUP_HIGHLIGHT = Symbol.for('@esportsplus/ui/group.highlight');


export default component(
    function({ [GROUP_HIGHLIGHT]: layer, ...attributes }: A, content) {
        return html`
            <div class='group' ${attributes}>
                ${layer !== undefined && highlight(layer)}
                ${content}
            </div>
        `;
    },
    { highlight: GROUP_HIGHLIGHT }
);
