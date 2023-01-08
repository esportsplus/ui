import config, { scss } from './webpack.sass.config.js';


let entry = {
        'components': scss(`./src/components/**/index.scss`),
        'components.variables': scss(`./src/components/**/variables.scss`),

        'css-utilities': scss(`./src/css-utilities/**/index.scss`),
        'css-utilities.variables': scss(`./src/css-utilities/**/variables.scss`),

        'fonts/montserrat': scss(`./storage/fonts/Montserrat/index.css`)
    },
    output = './build/css';


export default config(entry, output);