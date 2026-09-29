import input from '~/components/input';


const themed: typeof input = Object.assign(input.bind({
    attributes: {
        class: 'input--primary --border --border-black --color-white',
        style: `
            --border-color-active: var(--color-purple-300);
            --border-color-default: var(--color-black-300);
        `
    }
}), { scrub: input.scrub });


export default themed;
