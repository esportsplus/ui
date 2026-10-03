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
    description: string;
    name: string;
    variants: Variant[];
};


type Variant = {
    id?: string;
    options?: PreviewOption[];
    render: () => Renderable<unknown>;
    source?: () => Promise<string>;
    title: string;
};


type PreviewOption = {
    id: string;
    label: string;
    render: () => Renderable<unknown>;
    source?: () => Promise<string>;
};


export type { Entry, Page, PreviewOption, TocItem, Utility, Variant };
