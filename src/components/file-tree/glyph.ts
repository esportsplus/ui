import icon from '~/components/icon';
import { resolver, type Options } from './icons';
import { FILES, FOLDERS } from './sprites';


type Element = Parameters<ReturnType<typeof resolver>>[0];


// One sprite per row, as every other icon in the library is drawn; the color is the modifier's, so a monochrome tree
// leaves it to the row.
function renderer(options: Options = {}) {
    let colored = options.colored !== false,
        remap = options.remap ?? {},
        resolve = resolver(options);

    return (element: Element, open = false) => {
        let { custom, name } = resolve(element),
            color = name.startsWith('folder') ? 'folder' : name,
            sprite = name;

        if (!custom) {
            if (name === 'file') {
                sprite = remap.file ?? FILES.file;
            }
            else if (name === 'folder') {
                sprite = (open ? remap['folder-open'] : remap.folder) ?? FOLDERS.folder[open ? 1 : 0];
            }
            else if (Object.hasOwn(FOLDERS, name)) {
                sprite = FOLDERS[name as keyof typeof FOLDERS][open ? 1 : 0];
            }
            else {
                sprite = FILES[name as keyof typeof FILES];
            }
        }

        return icon({
            'aria-hidden': 'true',
            class: colored && !custom ? `file-tree-icon file-tree-icon--${color}` : 'file-tree-icon',
            'data-file-tree-icon': name
        }, sprite);
    };
}


const glyph = renderer();


export default glyph;
export { renderer };
