import { config, entry } from '@esportsplus/webpack';


export default ({ production }: { production?: string }) => {
    return config.web({
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
        mode: production !== 'false' ? 'production': 'development',
        // Temporary output until css root directory can be set through
        // package.json or similar ( like 'main' key )
        output: {
            path: '.'
        }
    });
};