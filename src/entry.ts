import { entry, resolve } from '@esportsplus/webpack';


type Entry = ReturnType<typeof entry.sass>;


const styles = (entry: Entry, { font, fonts, normalizer }: { font?: string, fonts?: string[], normalizer?: boolean } = {}) => {
    entry.import.unshift( ...resolve.glob(`components/**/index.scss`) );
    entry.import.push( ...resolve.glob(`css-utilities/**/index.scss`) );

    fonts = font ? [font] : fonts;

    if (fonts) {
        entry.import.unshift(
            ...resolve.glob(`../storage/fonts/{${fonts.join(',')}}/index.css`)
        );
    }

    if (normalizer) {
        entry.import.unshift('modern-normalize/modern-normalize.css');
    }

    return entry;
};

const variables = (entry: Entry) => {
    entry.import.unshift( ...resolve.glob(`components/**/variables.scss`) );
    entry.import.push( ...resolve.glob(`css-utilities/**/variables.scss`) );

    return entry;
};


export default { styles, variables };