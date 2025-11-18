import './scss/index.scss';


const primary = {
    class: `button button--primary --color-white --text-bold --text-uppercase`,
};

const secondary = {
    class: `button button--secondary --background-black --color-white --text-bold`
};

const tertiary = {
    class: `button button--tertiary --background-black --color-white --text-bold`
};


const form = {
    class: `${primary.class} --padding-500 --width-full`
};


export default { form, primary, secondary, tertiary };