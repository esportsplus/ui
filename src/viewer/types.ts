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


type Utility = {
    category: string;
    description: string;
    name: string;
    variants: Variant[];
};


type Variant = {
    render: () => Renderable<unknown>;
    title: string;
};


export type { Entry, Page, TocItem, Utility, Variant };
