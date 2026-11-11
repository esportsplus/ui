import { range } from '@esportsplus/ui/components';


export default [
    {
        render: () => range.filter({ format: (value: number) => `${value}%`, label: 'Volume', max: 100, min: 0, orientation: 'vertical', prefix: '', step: 1, ticks: 5, value: 50 }),
        title: 'vertical slider'
    },
    {
        render: () => range.filter({ format: (value: number) => `${value}%`, label: 'Range', max: 100, min: 0, orientation: 'vertical', prefix: '', step: 1, ticks: 5, value: [20, 70] }),
        title: 'vertical dual-thumb slider'
    },
    {
        render: () => range.filter({ disabled: true, format: (value: number) => `${value}%`, label: 'Allocation', max: 100, min: 0, orientation: 'vertical', prefix: '', step: 1, ticks: 5, value: [20, 70] }),
        title: 'disabled vertical slider'
    }
];
