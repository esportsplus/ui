import { resolve } from '@esportsplus/webpack';


const styles = (files: string[], { font, fonts, normalizer }: { font?: string, fonts?: string[], normalizer?: boolean } = {}) => {
    files.unshift( ...resolve.glob(`./components/**/index.scss`) );
    files.push( ...resolve.glob(`./css-utilities/**/index.scss`) );

    fonts = font ? [font] : fonts;

    if (fonts) {
        files.unshift(
            ...resolve.glob(`../storage/fonts/{${fonts.join(',')}}/index.css`)
        );
    }

    if (normalizer) {
        files.unshift('modern-normalize/modern-normalize.css');
    }

    return files;
};

const variables = (files: string[]) => {
    files.unshift( ...resolve.glob('./components/**/variables.scss') );
    files.push( ...resolve.glob('./css-utilities/**/variables.scss') );

    return files;
};


export default { styles, variables };