import { filterGrid } from '@esportsplus/ui';
import { html } from '@esportsplus/template';
import type { Entry } from '../types';


type Asset = {
    kind: 'clip' | 'doc' | 'image';
    name: string;
    size: string;
};


let assets: Asset[] = [
        { kind: 'image', name: 'hero-wide', size: '2.4 MB' },
        { kind: 'doc', name: 'onboarding', size: '184 KB' },
        { kind: 'doc', name: 'brand-deck', size: '9.1 MB' },
        { kind: 'image', name: 'swatches', size: '640 KB' },
        { kind: 'doc', name: 'changelog', size: '12 KB' },
        { kind: 'clip', name: 'teaser-cut', size: '48 MB' },
        { kind: 'image', name: 'grid-study', size: '1.2 MB' },
        { kind: 'doc', name: 'contract-v3', size: '96 KB' },
        { kind: 'clip', name: 'still-frame', size: '22 MB' }
    ],
    filters = [
        { id: 'all', label: 'All', match: () => true },
        { id: 'image', label: 'Images', match: (asset: Asset) => asset.kind === 'image' },
        { id: 'clip', label: 'Clips', match: (asset: Asset) => asset.kind === 'clip' },
        { id: 'doc', label: 'Docs', match: (asset: Asset) => asset.kind === 'doc' },
        { id: 'audio', label: 'Audio', match: () => false }
    ];


function card(asset: Asset) {
    return html`
        <div style='display: flex; flex-direction: column; height: 100%; justify-content: space-between;'>
            <p class='--text-truncate' style='font-size: var(--font-size-300); font-weight: var(--font-weight-500); margin: 0;'>
                ${asset.name}
            </p>
            <p style='color: var(--color-text-300); font-size: var(--font-size-200); font-variant: tabular-nums; margin: 0;'>
                ${asset.size}
            </p>
        </div>
    `;
}


export default {
    name: 'filter-grid',
    variants: [
        {
            render: () => filterGrid({ filters, items: assets, label: 'Asset type', render: card }),
            title: 'Default · 3 columns'
        },
        {
            render: () => filterGrid({
                columns: 2,
                filters,
                items: assets,
                label: 'Asset type',
                maxRows: 3,
                render: card,
                rowHeight: 64
            }),
            title: 'Capped rows · Scrolls past 3 rows'
        }
    ]
} satisfies Entry;
