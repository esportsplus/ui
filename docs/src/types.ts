import type { Renderable } from '@esportsplus/template';


type Entry = {
    name: string;
    variants: Variant[];
};


type Page = {
    render: () => Renderable<unknown>;
    toc: TocItem[];
};


type TocItem = {
    id: string;
    label: string;
};


type Modifier = {
    description: string;
    name: string;
    variants: Variant[];
};


// The class a preview's style select hands its example to put on its fields, such as 'input--border'.
type Style = {
    class: string;
    label: string;
};


type Variant = {
    id?: string;
    options?: PreviewOption[];
    render: (style: string) => Renderable<unknown>;
    source?: () => Promise<string>;
    // Offered in a second select beside the variant's, the first chosen by default; its class reaches 'render'.
    styles?: Style[];
    title: string;
};


type PreviewOption = {
    id: string;
    label: string;
    render: (style: string) => Renderable<unknown>;
    source?: () => Promise<string>;
};


export type { Entry, Modifier, Page, Style, TocItem, Variant };
