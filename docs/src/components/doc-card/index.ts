import { html } from '../../app';
import './scss/index.scss';


type Card = {
    description: string;
    href: string;
    name: string;
};

const docCard = (card: Card) => html`
    <a class='doc-card card --border --border-default --border-border --border-radius-500 --padding-400' href='${card.href}'>
        <div class='doc-card-name'>${card.name}</div>
        <p class='doc-card-description'>${card.description}</p>
    </a>
`;


export { docCard };
export type { Card };
