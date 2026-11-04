import { component, html } from '@esportsplus/template';
import { CHOICES, radio, type A } from './shared';


// Miniature pages, System split diagonally between the two.
export default component(({ mode, ...attributes }: A) => html`
    <div aria-label='Theme' class='theme-cards' role='radiogroup' ${attributes}>
        ${CHOICES.map((choice) => html`
            <button class='theme-cards-option' ${radio(mode, choice, '.theme-cards-preview')}>
                <span class='theme-cards-preview theme-cards-preview--${choice.value}'>
                    <span class='theme-cards-preview-bar'></span>
                    <span class='theme-cards-preview-line'></span>
                    <span class='theme-cards-preview-line theme-cards-preview-line--short'></span>
                </span>
                <span class='theme-cards-label'>${choice.label}</span>
            </button>
        `)}
    </div>
`);
