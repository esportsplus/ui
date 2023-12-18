const subtitle = {
    class: 'page-subtitle --margin-top --margin-200 --text-crop-bottom'
};

const suptitle = {
    class: 'page-suptitle --text-bold --text-crop --text-uppercase --text-200'
};

const title = {
    class: (subtitle?: boolean, suptitle?: boolean) => `page-title --line-height-200 --margin-200 ${!subtitle && '--text-crop-bottom'} ${suptitle ? '--margin-top' : '--text-crop-top'}`
};


export default { subtitle, suptitle, title };
export { subtitle, suptitle, title };