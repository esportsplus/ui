const primary = {
    class: 'link --color-white --flex-row --flex-vertical --text-bold',
    style: '--color-default: var(--color-grey-500);'
};

const tooltip = {
    class: `${primary.class} --background-black --padding-horizontal-600 --padding-vertical-500`,
    style: `${primary.style} white-space: nowrap;`
};


export default { primary, tooltip };