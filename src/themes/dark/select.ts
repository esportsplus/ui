import select from '~/components/select';


const themed: typeof select = select.bind({
    attributes: {
        class: '--background-black --border-black --color-white',
        [select.option]: {
            class: '--background-black --color-white',
            style: '--color-default: var(--color-grey-500); --padding-horizontal: var(--size-500); white-space: nowrap; width: 100%;'
        },
        style: '--border-color-default: var(--color-black-300); --border-width: var(--border-width-400); border: var(--border-width) solid var(--border-color);',

        [select.tooltipContent]: {
            direction: 'sw',
            style: `
                --background: var(--color-black-400);
                --border-color: var(--color-black-300);
                --border-radius: var(--border-radius-500);
                --border-width: var(--border-width-400);
                border: var(--border-width) solid var(--border-color);
            `
        }
    }
});


export default themed;