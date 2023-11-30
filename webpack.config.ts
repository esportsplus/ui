import { config, entry } from '@esportsplus/webpack';


export default (env: { production?: boolean | string }) => {
    let production = env.production !== 'false';

    return config.web({
        cache: false,
        contenthash: false,
        entry: {
            css: {
                components: {
                    styles: entry.css('src/components/**/index.scss'),
                    variables: entry.css('src/components/**/variables.scss')
                },
                fonts: {
                    montserrat: entry.css('storage/fonts/montserrat/index.css')
                },
                normalizer: entry.css('modern-normalize/modern-normalize.css'),
                utilities: {
                    styles: entry.css('src/css-utilities/**/index.scss'),
                    variables: entry.css('src/css-utilities/**/variables.scss')
                }
            }
        },
        mode: production ? 'production': 'development',
        // Temporary output until css root directory can be set through
        // package.json or similar ( like 'main' key )
        output: {
            path: '.'
        }
    });
};