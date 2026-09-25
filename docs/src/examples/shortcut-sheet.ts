import { shortcutSheet } from '@esportsplus/ui';
import type { Shortcut } from '~/components/shortcut-sheet';


let shortcuts: Shortcut[] = [
    { group: 'Navigation', id: 'search', keys: ['Mod', 'K'], label: 'Search' },
    { group: 'Navigation', id: 'back', keys: ['Mod', '['], label: 'Go back' },
    { group: 'Navigation', id: 'forward', keys: ['Mod', ']'], label: 'Go forward' },
    { group: 'Navigation', id: 'next', keys: ['J'], label: 'Next item' },
    { group: 'Navigation', id: 'prev', keys: ['K'], label: 'Previous item' },
    { group: 'Editing', id: 'undo', keys: ['Mod', 'Z'], label: 'Undo' },
    { group: 'Editing', id: 'redo', keys: ['Mod', 'Shift', 'Z'], label: 'Redo' },
    { group: 'Editing', id: 'duplicate', keys: ['Mod', 'D'], label: 'Duplicate' },
    { group: 'Editing', id: 'save', keys: ['Mod', 'S'], label: 'Save' },
    { group: 'Editing', id: 'rename', keys: ['F2'], label: 'Rename' },
    { group: 'View', id: 'sidebar', keys: ['Mod', 'B'], label: 'Toggle sidebar' },
    { group: 'View', id: 'zoom-in', keys: ['Mod', '='], label: 'Zoom in' },
    { group: 'View', id: 'zoom-out', keys: ['Mod', '-'], label: 'Zoom out' },
    { group: 'View', id: 'theme', keys: ['Mod', 'Shift', 'L'], label: 'Toggle theme' },
    { group: 'View', id: 'help', keys: ['?'], label: 'Show shortcuts' }
];


export default {
    name: 'shortcut-sheet',
    variants: [
        {
            render: () => shortcutSheet({ shortcuts }),
            title: 'press ? anywhere'
        },
        {
            render: () => shortcutSheet({
                class: 'shortcut-sheet--blur',
                label: 'Editor shortcuts',
                shortcuts: shortcuts.filter((shortcut) => shortcut.group === 'Editing')
            }),
            title: 'single group + blur'
        }
    ]
};
