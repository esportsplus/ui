import { component, html } from '@esportsplus/template';
import { CHOICES, radio, type A } from './shared';


// Round swatches, System split down the middle.
export default component(({ mode, ...attributes }: A) => html`
    <div aria-label='Theme' class='theme-swatches' role='radiogroup' ${attributes}>
        ${CHOICES.map((choice) => html`
            <button class='theme-swatches-option' ${radio(mode, choice, '.theme-swatches-circle')}>
                <span class='theme-swatches-circle theme-swatches-circle--${choice.value}'></span>
                <span class='theme-swatches-label'>${choice.label}</span>
            </button>
        `)}
    </div>
`);
