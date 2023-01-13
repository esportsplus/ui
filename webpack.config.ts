import { config, entry } from '@esportsplus/webpack';


export default ({ production }: { production?: string }) => {
    let webpack = {
            entry: {
                css: {
                    components: {
                        styles: entry.css('src/components/**/index.scss'),
                        variables: entry.css('src/components/**/variables.scss')
                    },
                    fonts: {
                        montserrat: entry.css('storage/fonts/montserrat/index.css')
                    },
                    normalizer: entry.css('modern-normalize/modern-normalize.css', { local: false }),
                    utilities: {
                        styles: entry.css('src/css-utilities/**/index.scss'),
                        variables: entry.css('src/css-utilities/**/variables.scss')
                    }
                }
            },
            // Temprorary root output until we can route to build through package.json or similar
            output: {
                path: '.'
            }
        };

    return config(webpack, { production });
};