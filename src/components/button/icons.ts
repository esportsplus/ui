import { html } from '@esportsplus/template';
import alertSvg from '@esportsplus/ui/svg/circle-alert.svg';
import checkSvg from '@esportsplus/ui/svg/check.svg';
import closeSvg from '@esportsplus/ui/svg/close.svg';
import copySvg from '@esportsplus/ui/svg/copy.svg';
import spinnerSvg from '@esportsplus/ui/svg/spinner.svg';


// SVG elements take no dynamic class, so every variant is its own static template.
const alert = () => html`<svg aria-hidden='true' class='button-icon'><use href='#${alertSvg}' /></svg>`;

const check = () => html`<svg aria-hidden='true' class='button-icon button-icon--draw'><use href='#${checkSvg}' /></svg>`;

const copy = () => html`<svg aria-hidden='true' class='button-icon'><use href='#${copySvg}' /></svg>`;

const cross = () => html`<svg aria-hidden='true' class='button-icon button-icon--draw'><use href='#${closeSvg}' /></svg>`;

const spinner = () => html`<svg aria-hidden='true' class='button-icon button-icon--spin'><use href='#${spinnerSvg}' /></svg>`;


export { alert, check, copy, cross, spinner };
