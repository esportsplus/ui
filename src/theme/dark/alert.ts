import alert from '~/components/alert';


export default alert({
    class: '--margin-600 --padding-500',
    style: `
        background: var(--color-black-400);
        border: 2px solid var(--color-black-300);
        box-shadow: var(--box-shadow-300);
    `,

    'alert-close': {
        class: '--background-black --border-radius-300 --color-white',
        style: '--color-default: var(--color-grey-500);margin: calc(var(--size-100) * -1) 0;'
    },
    'alert-messages': {
        class: '--padding-horizontal --padding-500',
        style: 'justify-content: center;'
    },
    'alert-message': {
        style: 'color: var(--color-white-400);'
    },
});