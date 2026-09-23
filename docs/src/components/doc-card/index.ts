import { html } from '../../app';
import './scss/index.scss';


type Card = {
    description: string;
    href: string;
    name: string;
};

const docCard = (card: Card) => html`
    <a
        class='doc-card card --border-default --border-border'
        href='${card.href}'
        style='border: 1px solid var(--border-color);border-radius: var(--border-radius-500);--padding-horizontal: var(--size-400);--padding-vertical: var(--size-400);'
    >
        <div class='doc-card-name'>${card.name}</div>
        <p class='doc-card-description'>${card.description}</p>
    </a>
`;


export { docCard };
export type { Card };
