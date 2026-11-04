import { html, type Attributes } from '@esportsplus/template';
import icon from '~/components/icon';
import next from '@esportsplus/ui/svg/arrow-right.svg';
import previous from '@esportsplus/ui/svg/arrow-left.svg';


type A = Attributes & {
    'aria-label'?: string;
    next?: Link;
    previous?: Link;
};

type Link = {
    // A line under the title; cards only.
    description?: string;
    href: string;
    // The small line above the title, 'Previous' or 'Next' when omitted; cards only.
    label?: string;
    title: string;
};


function arrow(direction: 'next' | 'previous', link?: Link) {
    let graphic = icon({ 'aria-hidden': 'true', class: 'pagination-arrow-icon' }, direction === 'next' ? next : previous),
        name = direction === 'next' ? 'Next' : 'Previous';

    if (!link) {
        return html`
            <button aria-label='${name}' class='pagination-arrow pagination-arrow--${direction} --disabled' disabled type='button'>
                ${graphic}
            </button>
        `;
    }

    return html`
        <a
            aria-label='${name}: ${link.title}'
            class='pagination-arrow pagination-arrow--${direction}'
            href='${link.href}'
            rel='${direction === 'next' ? 'next' : 'prev'}'
            title='${name}: ${link.title}'
        >
            ${graphic}
        </a>
    `;
}


// Both stay in place with a missing side disabled, so the pair never shifts between pages.
export default ({ 'aria-label': label = 'Pagination', next, previous, ...attributes }: A) => html`
    <nav aria-label='${label}' class='pagination pagination--arrows' ${attributes}>
        ${arrow('previous', previous)}
        ${arrow('next', next)}
    </nav>
`;


export type { Link };
