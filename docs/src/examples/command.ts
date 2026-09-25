import { command } from '@esportsplus/ui';
import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';


export default {
    name: 'command',
    variants: [
        {
            render: () => {
                let state = reactive({ active: false, query: '' }),
                    selected = reactive({ label: '' });

                function item(label: string) {
                    return {
                        label,
                        onclick: () => {
                            selected.label = label;
                        }
                    };
                }

                return html`
                    <div class='--flex-column --gap-300'>
                        <div class='button button--primary' style='--width: auto;' onclick='${() => state.active = true}'>
                            open command palette
                        </div>

                        <div class='text'>${() => selected.label ? `Selected: ${selected.label}` : 'Nothing selected yet'}</div>
                    </div>

                    ${command({
                        groups: [
                            {
                                items: ['Animated Drawer', 'Blocks', 'Charts', 'Components', 'Create', 'Directory', 'Docs'].map(item),
                                label: 'Pages'
                            },
                            {
                                items: [
                                    'Accordion', 'Alert', 'Alert Dialog', 'Avatar', 'Badge', 'Breadcrumb', 'Button',
                                    'Calendar', 'Card', 'Carousel', 'Chart', 'Checkbox', 'Combobox', 'Command',
                                    'Dialog', 'Drawer', 'Dropdown Menu', 'Input', 'Navigation Menu', 'Popover',
                                    'Select', 'Sidebar', 'Table', 'Tabs', 'Tooltip'
                                ].map(item),
                                label: 'Components'
                            }
                        ],
                        state
                    })}
                `;
            },
            title: 'grouped results'
        }
    ]
};
