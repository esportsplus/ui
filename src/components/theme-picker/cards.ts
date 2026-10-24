import { component, html } from '@esportsplus/template';
import { CHOICES, radio, type A } from './shared';


// Miniature pages, System split diagonally between the two.
export default component(({ mode, ...attributes }: A) => html`
    <div aria-label='Theme' class='theme-picker-cards' role='radiogroup' ${attributes}>
        ${CHOICES.map((choice) => html`
            <button class='theme-picker-cards-option' ${radio(mode, choice)}>
                <span class='theme-picker-cards-preview theme-picker-cards-preview--${choice.value}'>
                    <span class='theme-picker-cards-preview-bar'></span>
                    <span class='theme-picker-cards-preview-line'></span>
                    <span class='theme-picker-cards-preview-line theme-picker-cards-preview-line--short'></span>
                </span>
                <span class='theme-picker-cards-label'>${choice.label}</span>
            </button>
        `)}
    </div>
`);
