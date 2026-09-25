import { html } from '@esportsplus/template';


const alert = () => html`
    <svg class='button-icon' fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.5' viewBox='0 0 12 12'>
        <circle cx='6' cy='6' r='4.75' />
        <path d='M6 3.75V6.25M6 8.25V8.26' />
    </svg>
`;

const check = () => html`
    <svg class='button-icon button-icon--draw' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' viewBox='0 0 12 12'>
        <path d='M2.5 6.25L4.75 8.5L9.5 3.5' pathLength='1' />
    </svg>
`;

const copy = () => html`
    <svg class='button-icon' fill='none' stroke='currentColor' stroke-linejoin='round' stroke-width='1.25' viewBox='0 0 12 12'>
        <rect height='6.75' rx='1.25' width='6.75' x='4' y='4' />
        <path d='M8 2.5V2.25C8 1.56 7.44 1 6.75 1H2.25C1.56 1 1 1.56 1 2.25V6.75C1 7.44 1.56 8 2.25 8H2.5' />
    </svg>
`;

const cross = () => html`
    <svg class='button-icon button-icon--draw' fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.5' viewBox='0 0 12 12'>
        <path d='M3.5 3.5L8.5 8.5M8.5 3.5L3.5 8.5' pathLength='1' />
    </svg>
`;

const spinner = () => html`
    <svg class='button-icon button-icon--spin' fill='none' stroke='currentColor' stroke-linecap='round' stroke-width='1.5' viewBox='0 0 12 12'>
        <circle cx='6' cy='6' opacity='0.2' r='4.75' />
        <path d='M10.75 6A4.75 4.75 0 0 0 6 1.25' />
    </svg>
`;


export { alert, check, copy, cross, spinner };
