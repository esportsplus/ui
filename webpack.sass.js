const { config, scss } = require('./webpack.sass.config.js');


let entry = {
        'components': scss(`./src/components/**/index.scss`),
        'components.variables': scss(`./src/components/**/variables.scss`),

        'css-utilities': scss(`./src/css-utilities/**/index.scss`),
        'css-utilities.variables': scss(`./src/css-utilities/**/variables.scss`)
    },
    output = './build/css';


module.exports = config(entry, output);