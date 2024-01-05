import { config, entry } from '@esportsplus/webpack';


export default config.css({
    contenthash: false,
    entry: {
        components: {
            styles: entry.css('./src/components/**/index.scss'),
            variables: entry.css('./src/components/**/variables.scss')
        },
        fonts: {
            montserrat: entry.css('./storage/fonts/montserrat/index.css')
        },
        normalize: entry.css('modern-normalize/modern-normalize.css'),
        utilities: {
            styles: entry.css('./src/css-utilities/**/index.scss'),
            variables: entry.css('./src/css-utilities/**/variables.scss')
        }
    },
    mode: 'production'
});