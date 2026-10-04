import type { FileTreeElement as Element } from '.';
import type { Entry } from './model';


type Match = ((path: string) => boolean) | null;


function walk(elements: Element[], dotfiles: boolean, exclude: Match, prefix: string, inside: boolean, out: Set<string>) {
    for (let i = 0, n = elements.length; i < n; i++) {
        let element = elements[i],
            path = prefix + element.name,
            hide = inside || (!dotfiles && element.name[0] === '.') || !!exclude?.(path);

        if (hide) {
            out.add(element.id);
        }

        if (element.children) {
            walk(element.children, dotfiles, exclude, `${path}/`, hide, out);
        }
    }

    return out;
}


// Checks 'element' and everything inside it again, as once it's added, moved or renamed, leaving the rest of 'out' as
// it is: a live change costs what it touched rather than the whole tree. 'out' must hold none of them beforehand.
const recheck = (element: Element, index: Map<string, Entry>, dotfiles: boolean, exclude: Match, roots: boolean, out: Set<string>) => {
    if (dotfiles && !exclude) {
        return;
    }

    let names: string[] = [],
        parent = index.get(element.id)?.parent ?? null;

    if (roots && parent === null) {
        walk(element.children ?? [], dotfiles, exclude, '', false, out);
        return;
    }

    for (let node = parent; node !== null; node = index.get(node)!.parent) {
        let entry = index.get(node)!;

        if (roots && entry.parent === null) {
            break;
        }

        names.unshift(entry.element.name);
    }

    walk([element], dotfiles, exclude, names.length ? `${names.join('/')}/` : '', parent !== null && out.has(parent), out);
};


// Ids never shown, with everything inside them, so a hidden folder's contents mark none of its ancestors. Patterns
// match the path of names, 'src/index.ts', so they read the same whether ids are paths or not. Under 'roots' each
// top-level element is a root: never hidden itself, with paths starting below it.
export default (elements: Element[], dotfiles: boolean, exclude: Match, roots: boolean) => {
    let out = new Set<string>();

    if (dotfiles && !exclude) {
        return out;
    }

    if (!roots) {
        return walk(elements, dotfiles, exclude, '', false, out);
    }

    for (let i = 0, n = elements.length; i < n; i++) {
        let children = elements[i].children;

        if (children) {
            walk(children, dotfiles, exclude, '', false, out);
        }
    }

    return out;
};

export { recheck };
