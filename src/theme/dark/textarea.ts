import textarea from '~/components/textarea';


export default textarea.bind({
    attributes: {
        class: 'textarea--primary --border --border-black --color-white',
        style: `
            --border-color-active: var(--color-purple-300);
            --border-color-default: var(--color-black-300);
        `
    }
});