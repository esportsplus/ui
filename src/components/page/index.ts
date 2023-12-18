const subtitle = {
    class: 'page-subtitle --margin-top --margin-200 --text-crop-bottom'
};

const suptitle = {
    class: 'page-suptitle --text-bold-600 --text-crop --text-uppercase --text-300'
};

const title = {
    class: (subtitle?: boolean, suptitle?: boolean) => `page-title --line-height-200 --margin-300 ${!subtitle && '--text-crop-bottom'} ${suptitle ? '--margin-top' : '--text-crop-top'}`
};


export default { subtitle, suptitle, title };
export { subtitle, suptitle, title };