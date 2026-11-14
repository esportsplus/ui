import { html, reactive, uri } from 'docs/app';
import { icon, select } from '@esportsplus/ui/components';
import preview from 'docs/components/preview';
import type { Page, TocItem, Variant } from 'docs/types';
import header from 'docs/components/page/header';
import code from '@esportsplus/ui/svg/code.svg';
import eye from '@esportsplus/ui/svg/eye.svg';
import 'docs/components/directory/scss/index.scss';


type Directory = {
    // The index page's subtitle.
    description: string;
    items: Item[];
    route: 'components' | 'modifiers';
    // Empty for the index; otherwise names an item, which the missing middleware has already confirmed exists.
    slug?: string;
    title: string;
};

type Item = {
    description: string;
    label: string;
    name: string;
    variants: () => Variant[];
};


function detail({ items, route, slug, title }: Directory): Page {
    let item = items.find((item) => item.name === slug)!,
        variants = item.variants(),
        toc: TocItem[] = variants.map((variant, index) => ({ id: variant.id ?? `v-${index}`, label: variant.title }));

    return {
        render: () => html`
            <div class='page'>
                ${header({
                    breadcrumb: [
                        { href: uri(route), label: title },
                        { href: uri(`${route}.detail`, { slug: item.name }), label: item.label }
                    ],
                    description: item.description,
                    title: item.label
                })}

                ${variants.length === 0
                    ? html`<p class='page-note'>No examples yet.</p>`
                    : variants.map((variant, index) => example(variant, index, toc[index].id))}
            </div>
        `,
        toc
    };
}

// An example and its variants: a select swaps the variant, a second its style when it offers some, the view buttons
// swap in its source, and a hash naming either reveals it.
function example(variant: Variant, index: number, id: string) {
    let options = variant.options ?? [],
        selection = reactive({ active: false, error: '', selected: options[0]?.id ?? '' }),
        state = preview.state(),
        styles = variant.styles ?? [],
        // Picked by position, so a style with no class still has a value to select.
        styling = reactive({ active: false, error: '', selected: '0' });

    function current() {
        return options.find((option) => option.id === selection.selected);
    }

    return [
        variant.source && preview.buttons({ 'aria-label': `${variant.title} view`, state }, [
            { content: [icon({ 'aria-hidden': 'true' }, eye), 'Preview'], view: 'preview' },
            { content: [icon({ 'aria-hidden': 'true' }, code), 'Code'], view: 'code' }
        ]),
        preview({ anchors: options.map((option) => option.id), id, selection, state }, [
            preview.header({ index: index + 1, title: variant.title }, [
                options.length > 1 && select({
                    class: 'preview-header-select',
                    label: `${variant.title} variant`,
                    options: options.map((option) => ({ label: option.label, value: option.id })),
                    state: selection
                }),
                styles.length > 1 && select({
                    class: 'preview-header-select',
                    label: `${variant.title} style`,
                    options: styles.map((style, position) => ({ label: style.label, value: String(position) })),
                    state: styling
                })
            ]),
            () => {
                let render = current()?.render ?? variant.render,
                    style = styles[Number(styling.selected)]?.class ?? '';

                return preview.stage({ state }, () => render(style));
            },
            () => {
                let source = variant.source && (current()?.source ?? variant.source);

                return source && preview.source({ label: `Copy ${variant.title} source`, state }, source);
            }
        ])
    ];
}

function grid({ description, items, route, title }: Directory): Page {
    return {
        render: () => html`
            <div class='page'>
                ${header({ description, title })}

                <div class='grid page-grid'>
                    ${items.map((item) => html`
                        <a class='card directory-card' href='${uri(`${route}.detail`, { slug: item.name })}'>
                            <div class='directory-card-name'>${item.label}</div>
                            <p class='directory-card-description'>${item.description}</p>
                        </a>
                    `)}
                </div>
            </div>
        `,
        toc: []
    };
}


export default (options: Directory): Page => options.slug ? detail(options) : grid(options);
export type { Directory, Item };
