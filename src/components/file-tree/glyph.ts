import { html } from '@esportsplus/template';
import icon from '~/components/icon';
import FOLDERS from './folders';
import { resolver, type Options, type Resolved } from './icons';

function render(element: { name: string }, open: boolean, glyph: Resolved) {
    let color = glyph.color ? `var(--file-tree-icon-${glyph.color})` : 'inherit',
        // Preserve the existing folder assets, including both states. Explicit folder overrides use the new glyph.
        folder = glyph.name.startsWith('folder') && !glyph.custom && FOLDERS.get(element.name.toLowerCase()),
        attributes = {
            'aria-hidden': 'true',
            class: 'file-tree-icon file-tree-icon--builtin',
            'data-file-tree-icon': glyph.name,
            style: `--file-tree-glyph-color: ${color}`
        };

    if (folder) {
        return icon(attributes, folder[open ? 1 : 0]);
    }

    // Keep every path under the literal svg root: standalone path/g templates are parsed as HTML nodes
    // by the template compiler and therefore do not paint when inserted into an SVG afterward.
    return html`
        <div class='icon' ${attributes}>
            <svg aria-hidden='true' focusable='false' viewBox='0 0 16 16'>
                <g fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.3'>
                    <path d='${glyph.path}' />
                    <path d='${glyph.letters?.[0] ?? ''}' transform='${`translate(${glyph.letters?.length === 1 ? 6 : 3} 3)`}' />
                    <path d='${glyph.letters?.[1] ?? ''}' transform='translate(9 3)' />
                    <g transform='translate(8 8) scale(.45)' stroke-width='2'>
                        <path d='${glyph.badge?.path ?? ''}' />
                        <path d='${glyph.badge?.letters?.[0] ?? ''}' transform='${`translate(${glyph.badge?.letters?.length === 1 ? 6 : 3} 3)`}' />
                        <path d='${glyph.badge?.letters?.[1] ?? ''}' transform='translate(9 3)' />
                    </g>
                </g>
            </svg>
        </div>
    `;
}

function renderer(options?: Options) {
    let resolve = resolver(options);

    return (element: Parameters<typeof resolve>[0], open = false) => render(element, open, resolve(element, open));
}

const glyph = renderer();

export { renderer };
export default glyph;
