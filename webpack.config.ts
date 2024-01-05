import { config, entry } from '@esportsplus/webpack';


export default config.css({
    contenthash: false,
    entry: {
        fonts: {
            montserrat: entry.css('./storage/fonts/montserrat/index.css')
        },
        normalize: entry.css('modern-normalize/modern-normalize.css')
    },
    mode: 'production'
});