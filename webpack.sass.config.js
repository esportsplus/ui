const { config, entry } = require('@esportsplus/webpack/webpack.sass.config.js');


module.exports = ({ production }) => config({
    entry: {
        'components': entry('./src/components/**/index.scss'),
        'components.variables': entry('./src/components/**/variables.scss'),

        'css-utilities': entry('./src/css-utilities/**/index.scss'),
        'css-utilities.variables': entry('./src/css-utilities/**/variables.scss')
    },
    output: './build/css',
    production
});