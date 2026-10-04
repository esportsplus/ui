import { html } from '~/app';
import '~/components/doc-card/scss/index.scss';


type Card = {
    description: string;
    href: string;
    name: string;
};

const docCard = (card: Card) => html`
    <a
        class='doc-card card --border-default --border-border'
        href='${card.href}'
    >
        <div class='doc-card-name'>${card.name}</div>
        <p class='doc-card-description'>${card.description}</p>
    </a>
`;


export { docCard };
export type { Card };
