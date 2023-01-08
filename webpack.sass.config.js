const { config, entry: e } = require('@esportsplus/webpack/webpack.sass.config.js');


let entry = {
        'components': e('./src/components/**/index.scss'),
        'components.variables': e('./src/components/**/variables.scss'),

        'css-utilities': e('./src/css-utilities/**/index.scss'),
        'css-utilities.variables': e('./src/css-utilities/**/variables.scss')
    },
    output = './build/css';


module.exports = ({ production }) => config(entry, output, production);