import { html } from '@esportsplus/template';
import { filter } from '@esportsplus/ui/components';
import type { Entry } from '~/types';
import '~/examples/filter/scss/index.scss';


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


function demo(layout: 'capped' | 'grid' | 'rows') {
    let controller = filter({ filters, height: true, items: assets, label: 'Asset type' });

    return html`
        <div class='filter-demo filter-demo--${layout}'>
            <div class='filter-demo-triggers' ${controller.triggers}>
                ${filters.map((f, index) => html`
                    <button class='filter-demo-trigger' ${controller.trigger(f, index)}>
                        ${f.label}
                        <span class='filter-demo-count'>${controller.counts[f.id]}</span>
                    </button>
                `)}
            </div>

            <ul class='filter-demo-items' ${controller.list}>
                ${assets.map((asset, index) => html`
                    <li class='filter-demo-item' ${controller.item(index)}>
                        <span class='filter-demo-name'>${asset.name}</span>
                        <span class='filter-demo-meta'>${asset.kind} · ${asset.size}</span>
                    </li>
                `)}
            </ul>

            <p class='filter-demo-empty ${() => controller.status.visible === 0 && '--active'}'>Nothing matches this filter</p>

            <p ${controller.announcer}></p>
        </div>
    `;
}


export default {
    name: 'filter',
    variants: [
        {
            render: () => demo('grid'),
            title: 'Grid · 3 columns'
        },
        {
            render: () => demo('rows'),
            title: 'Rows · Single column list'
        },
        {
            render: () => demo('capped'),
            title: 'Max rows · Scrolls past 2 rows'
        }
    ]
} satisfies Entry;
