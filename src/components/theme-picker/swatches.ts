import { component, html } from '@esportsplus/template';
import { CHOICES, radio, type A } from './shared';


// Round swatches, System split down the middle.
export default component(({ mode, ...attributes }: A) => html`
    <div aria-label='Theme' class='theme-picker-swatches' role='radiogroup' ${attributes}>
        ${CHOICES.map((choice) => html`
            <button class='theme-picker-swatches-option' ${radio(mode, choice)}>
                <span class='theme-picker-swatches-circle theme-picker-swatches-circle--${choice.value}'></span>
                <span class='theme-picker-swatches-label'>${choice.label}</span>
            </button>
        `)}
    </div>
`);
