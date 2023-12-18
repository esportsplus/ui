const subtitle = () => {
    return {
        class: 'page-subtitle --margin-top --margin-200 --text-crop-bottom'
    };
};

const suptitle = () => {
    return {
        class: 'page-suptitle --text-bold --text-crop --text-uppercase --text-200',
        style: '--color-default: var(--color-primary-400);letter-spacing: 0.24px;'
    }
};

const title = (subtitle: unknown, suptitle: unknown) => {
    return {
        class: `page-title --line-height-200 --margin-200 ${!subtitle && '--text-crop-bottom'} ${suptitle ? '--margin-top' : '--text-crop-top'}`
    };
};


export default { subtitle, suptitle, title };
export { subtitle, suptitle, title };