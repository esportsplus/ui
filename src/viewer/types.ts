import type { Renderable } from '@esportsplus/template';


type Entry = {
    name: string;
    variants: Variant[];
};


type Variant = {
    render: () => Renderable<unknown>;
    title: string;
};


export type { Entry, Variant };
