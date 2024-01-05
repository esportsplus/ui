import { config, entry } from '@esportsplus/webpack';


export default config.css({
    contenthash: false,
    entry: {
        components: {
            styles: entry.css('./src/**/index.scss'),
            variables: entry.css('./src/**/variables.scss')
        }
    },
    mode: 'production',
    output: {
        path: '../../build'
    }
});