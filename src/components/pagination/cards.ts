import { component, html, type Attributes } from '@esportsplus/template';
import icon from '~/components/icon';
import next from '@esportsplus/ui/svg/chevron-right.svg';
import previous from '@esportsplus/ui/svg/chevron-left.svg';
import type { Link } from './arrows';
import '~/components/card/scss/index.scss';


const PAGINATION_CARD = Symbol.for('@esportsplus/ui/pagination.cards.card');

const PAGINATION_CARD_SUBTITLE = Symbol.for('@esportsplus/ui/pagination.cards.subtitle');

const PAGINATION_CARD_TITLE = Symbol.for('@esportsplus/ui/pagination.cards.title');


type A = Attributes & {
    [PAGINATION_CARD]?: Attributes;
    [PAGINATION_CARD_SUBTITLE]?: Attributes;
    [PAGINATION_CARD_TITLE]?: Attributes;
    'aria-label'?: string;
    next?: Link;
    previous?: Link;
    // A soft halo around the card on hover and focus.
    ring?: boolean;
    // Lifts the card 1px on hover and focus and sinks it 1px below rest while pressed.
    tactile?: boolean;
};


function card(attributes: A, direction: 'next' | 'previous', link: Link) {
    let arrow = icon({ 'aria-hidden': 'true', class: 'pagination-card-arrow' }, direction === 'next' ? next : previous);

    return html`
        <a
            class='card pagination-card pagination-card--${direction} ${attributes.ring && 'card--ring'} ${attributes.tactile && 'pagination-card--tactile'}'
            href='${link.href}'
            rel='${direction === 'next' ? 'next' : 'prev'}'
            ${attributes[PAGINATION_CARD]}
        >
            ${direction === 'previous' && arrow}
            <span class='pagination-card-title' ${attributes[PAGINATION_CARD_TITLE]}>${link.title}</span>
            <span class='pagination-card-subtitle' ${attributes[PAGINATION_CARD_SUBTITLE]}>${link.label ?? (direction === 'next' ? 'Next' : 'Previous')}</span>
            ${direction === 'next' && arrow}
        </a>
    `;
}


export default component(
    ({ 'aria-label': label = 'Pagination', next, previous, ring, tactile, ...attributes }: A) => (next || previous) && html`
        <nav aria-label='${label}' class='pagination pagination--cards' ${attributes}>
            ${previous && card({ ...attributes, ring, tactile }, 'previous', previous)}
            ${next && card({ ...attributes, ring, tactile }, 'next', next)}
        </nav>
    `,
    { card: PAGINATION_CARD, subtitle: PAGINATION_CARD_SUBTITLE, title: PAGINATION_CARD_TITLE }
);
