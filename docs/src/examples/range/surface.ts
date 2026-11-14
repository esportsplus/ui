import { range } from '@esportsplus/ui/components';


const DESIGNS = [
    { inline: false, label: 'Volume', title: 'Heading · Value above the track', unit: '%', value: 60 },
    { inline: true, label: 'Radius', title: 'Inline · Label and value inside the track', unit: 'px', value: 40 }
] as const;

const TICKS = [
    [undefined, ''],
    ['major', ' · 10% ticks'],
    ['all', ' · 10% and 2% ticks']
] as const;


export default DESIGNS.flatMap(({ inline, label, title, unit, value }) => TICKS.map(([ticks, suffix]) => ({
    render: () => range.surface({ inline, label, ticks, unit, value }),
    title: title + suffix
})));
