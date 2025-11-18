import select from '~/components/select';


export default select.bind({
    attributes: {
        class: '--background-black --border --border-black --color-white',
        option: {
            class: '--background-black --color-white --padding-horizontal-500 --width-full',
            style: '--color-default: var(--color-grey-500);white-space: nowrap;'
        },
        style: '--border-color-default: var(--color-black-300);',

        'tooltip-content': {
            class: '--border --border-radius-500',
            direction: 'sw',
            style: `
                --background: var(--color-black-400);
                --border-color: var(--color-black-300);
            `
        }
    }
});