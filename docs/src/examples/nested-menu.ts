import { nestedMenu } from '@esportsplus/ui';


let items = [
    { hint: '⌘N', label: 'New file' },
    {
        items: [
            { label: 'Rename' },
            { label: 'Duplicate' },
            {
                items: [
                    { label: 'Markdown' },
                    { label: 'PDF' },
                    {
                        items: [
                            { label: 'Letter' },
                            { label: 'A4' },
                            { disabled: true, label: 'Tabloid' }
                        ],
                        label: 'Paper size'
                    }
                ],
                label: 'Export as'
            }
        ],
        label: 'File actions'
    },
    {
        items: [
            { label: 'Invite members' },
            { items: [{ label: 'Viewer' }, { label: 'Editor' }, { label: 'Owner' }], label: 'Default role' }
        ],
        label: 'Share'
    },
    { disabled: true, label: 'Archive' },
    { danger: true, hint: '⌫', label: 'Delete' }
],
    trigger = { class: 'button --background-blue --color-white', style: '--width: auto;' };


export default {
    name: 'nested-menu',
    variants: [
        {
            render: () => nestedMenu({ items, [nestedMenu.trigger]: trigger }, 'open menu'),
            title: 'drill down'
        },
        {
            render: () => nestedMenu({ animate: false, items, [nestedMenu.trigger]: trigger }, 'open menu'),
            title: 'instant'
        }
    ]
};
