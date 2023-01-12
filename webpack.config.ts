import { config, entry } from '@esportsplus/webpack';


export default ({ production }: { production?: string }) => {
    let webpack = {
            entry: {
                'css/components': entry.css('src/components/**/index.scss'),
                'css/variables/components': entry.css('src/components/**/variables.scss'),

                'css/css-utilities': entry.css('src/css-utilities/**/index.scss'),
                'css/variables/css-utilities': entry.css('src/css-utilities/**/variables.scss'),

                'css/fonts/montserrat': entry.css('storage/fonts/montserrat/index.css'),
                'css/normalizer': 'modern-normalize/modern-normalize.css'
            },
            output: {
                path: '.'
            }
        };

    return config(webpack, { production });
}