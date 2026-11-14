import { reactive } from '@esportsplus/reactivity';
import { pagination } from '@esportsplus/ui/components';
import type { Entry } from 'docs/types';


function demo(page: number, total: number, siblings?: number) {
    return pagination({ caption: true, siblings, state: reactive({ page }), total });
}


export default {
    name: 'pagination',
    variants: [
        {
            render: () => demo(6, 181),
            title: 'overflow'
        },
        {
            render: () => demo(1, 5),
            title: 'few pages'
        },
        {
            render: () => demo(50, 100, 2),
            title: 'two siblings'
        },
        {
            render: () => pagination.cards({
                next: { href: '#', title: 'Themes' },
                previous: { href: '#', title: 'Installation' }
            }),
            title: 'cards'
        },
        {
            render: () => pagination.cards({
                next: { description: 'Make the library fit your design.', href: '#', label: 'Customize your project', title: 'Themes' },
                previous: { description: 'Add the library and build your first component.', href: '#', label: 'Start here', title: 'Installation' }
            }),
            title: 'cards: label and description'
        },
        {
            render: () => pagination.cards({ next: { href: '#', title: 'Tokens' } }),
            title: 'cards: next only'
        },
        {
            render: () => pagination.cards({ previous: { href: '#', title: 'Scrollbar' } }),
            title: 'cards: previous only'
        },
        {
            render: () => pagination.cards({
                next: { href: '#', title: 'Themes' },
                previous: { href: '#', title: 'Installation' },
                tactile: true
            }),
            title: 'cards: tactile'
        },
        {
            render: () => pagination.cards({
                next: { href: '#', title: 'Themes' },
                previous: { href: '#', title: 'Installation' },
                ring: true,
                tactile: true
            }),
            title: 'cards: tactile + ring'
        },
        {
            render: () => pagination.cards({
                next: { href: '#', title: 'Themes' },
                previous: { href: '#', title: 'Installation' },
                ring: true
            }),
            title: 'cards: ring'
        },
        {
            render: () => pagination.arrows({
                next: { href: '/themes', title: 'Themes' },
                previous: { href: '/installation', title: 'Installation' }
            }),
            title: 'arrows'
        },
        {
            render: () => pagination.arrows({ next: { href: '/tokens', title: 'Tokens' } }),
            title: 'arrows: first page'
        },
        {
            render: () => pagination.arrows({ previous: { href: '/modifiers/scrollbar', title: 'Scrollbar' } }),
            title: 'arrows: last page'
        }
    ]
} satisfies Entry;
