type Palette = {
    colors: Record<string, Scale>;
    label: string;
    name: string;
};

type Scale = {
    300: string;
    400: string;
    500: string;
};


// Weights are TIGHT interactive steps, never a wide ramp: 300 = brighter hover,
// 400 = default, 500 = darker press. Alternatives keep that ~3% lightness spread
// and only push chroma (and small hue nudges toward vivid anchors) for punch.
const palettes: Palette[] = [
    {
        colors: {
            blue: { 300: 'oklch(54.49% 0.2514 268.2)', 400: 'oklch(51.45% 0.2712 266.6)', 500: 'oklch(48.45% 0.2617 266.3)' },
            green: { 300: 'oklch(87.03% 0.2708 144.9)', 400: 'oklch(83.70% 0.2711 144.0)', 500: 'oklch(78.97% 0.2560 144.0)' },
            purple: { 300: 'oklch(53.29% 0.2877 292.5)', 400: 'oklch(51.66% 0.2929 289.7)', 500: 'oklch(48.63% 0.2754 289.9)' },
            red: { 300: 'oklch(64.46% 0.2412 23.8)', 400: 'oklch(62.87% 0.2567 27.7)', 500: 'oklch(59.10% 0.2413 27.6)' },
            yellow: { 300: 'oklch(96.85% 0.1779 110.7)', 400: 'oklch(96.32% 0.2125 111.5)', 500: 'oklch(90.35% 0.2004 112.3)' }
        },
        label: 'Current (baseline)',
        name: 'current'
    },
    {
        colors: {
            blue: { 300: 'oklch(55% 0.28 264)', 400: 'oklch(52% 0.30 265)', 500: 'oklch(49% 0.29 266)' },
            green: { 300: 'oklch(84% 0.29 147)', 400: 'oklch(81% 0.30 146)', 500: 'oklch(77% 0.28 145)' },
            purple: { 300: 'oklch(54% 0.30 291)', 400: 'oklch(51% 0.32 290)', 500: 'oklch(48% 0.31 290)' },
            red: { 300: 'oklch(64% 0.25 25)', 400: 'oklch(61% 0.27 27)', 500: 'oklch(57% 0.26 28)' },
            yellow: { 300: 'oklch(94% 0.20 108)', 400: 'oklch(91% 0.21 110)', 500: 'oklch(87% 0.20 111)' }
        },
        label: 'Punchy',
        name: 'punchy'
    },
    {
        colors: {
            blue: { 300: 'oklch(56% 0.31 262)', 400: 'oklch(53% 0.32 263)', 500: 'oklch(50% 0.31 264)' },
            green: { 300: 'oklch(85% 0.32 148)', 400: 'oklch(82% 0.32 147)', 500: 'oklch(78% 0.30 146)' },
            purple: { 300: 'oklch(55% 0.33 289)', 400: 'oklch(52% 0.34 289)', 500: 'oklch(49% 0.33 290)' },
            red: { 300: 'oklch(65% 0.27 25)', 400: 'oklch(62% 0.29 27)', 500: 'oklch(58% 0.28 28)' },
            yellow: { 300: 'oklch(93% 0.22 106)', 400: 'oklch(90% 0.23 108)', 500: 'oklch(86% 0.22 110)' }
        },
        label: 'Electric',
        name: 'electric'
    },
    {
        colors: {
            blue: { 300: 'oklch(50% 0.28 262)', 400: 'oklch(47% 0.29 263)', 500: 'oklch(44% 0.28 264)' },
            green: { 300: 'oklch(70% 0.20 153)', 400: 'oklch(66% 0.21 154)', 500: 'oklch(61% 0.19 155)' },
            purple: { 300: 'oklch(49% 0.31 289)', 400: 'oklch(46% 0.32 289)', 500: 'oklch(43% 0.31 290)' },
            red: { 300: 'oklch(58% 0.26 24)', 400: 'oklch(55% 0.27 26)', 500: 'oklch(51% 0.26 27)' },
            yellow: { 300: 'oklch(85% 0.19 96)', 400: 'oklch(82% 0.20 99)', 500: 'oklch(78% 0.19 101)' }
        },
        label: 'Jewel',
        name: 'jewel'
    },
    {
        colors: {
            blue: { 300: 'oklch(56% 0.24 258)', 400: 'oklch(53% 0.26 259)', 500: 'oklch(50% 0.25 260)' },
            green: { 300: 'oklch(83% 0.28 145)', 400: 'oklch(80% 0.29 144)', 500: 'oklch(76% 0.27 143)' },
            purple: { 300: 'oklch(58% 0.27 340)', 400: 'oklch(55% 0.29 340)', 500: 'oklch(52% 0.28 341)' },
            red: { 300: 'oklch(66% 0.24 35)', 400: 'oklch(63% 0.26 38)', 500: 'oklch(59% 0.24 40)' },
            yellow: { 300: 'oklch(88% 0.19 92)', 400: 'oklch(85% 0.20 90)', 500: 'oklch(81% 0.19 88)' }
        },
        label: 'Sunset',
        name: 'sunset'
    },
    {
        colors: {
            blue: { 300: 'oklch(60% 0.30 252)', 400: 'oklch(57% 0.31 251)', 500: 'oklch(54% 0.30 250)' },
            green: { 300: 'oklch(88% 0.33 140)', 400: 'oklch(85% 0.33 139)', 500: 'oklch(81% 0.31 138)' },
            purple: { 300: 'oklch(58% 0.33 300)', 400: 'oklch(55% 0.34 300)', 500: 'oklch(52% 0.33 301)' },
            red: { 300: 'oklch(64% 0.29 12)', 400: 'oklch(61% 0.30 14)', 500: 'oklch(57% 0.29 16)' },
            yellow: { 300: 'oklch(94% 0.23 104)', 400: 'oklch(91% 0.24 105)', 500: 'oklch(87% 0.23 106)' }
        },
        label: 'Neon',
        name: 'neon'
    },
    {
        colors: {
            blue: { 300: 'oklch(70% 0.20 245)', 400: 'oklch(67% 0.22 244)', 500: 'oklch(63% 0.21 243)' },
            green: { 300: 'oklch(84% 0.22 160)', 400: 'oklch(81% 0.23 159)', 500: 'oklch(77% 0.21 158)' },
            purple: { 300: 'oklch(58% 0.30 296)', 400: 'oklch(55% 0.31 296)', 500: 'oklch(52% 0.30 297)' },
            red: { 300: 'oklch(66% 0.26 8)', 400: 'oklch(63% 0.28 10)', 500: 'oklch(59% 0.27 12)' },
            yellow: { 300: 'oklch(92% 0.20 100)', 400: 'oklch(89% 0.21 101)', 500: 'oklch(85% 0.20 102)' }
        },
        label: 'Candy',
        name: 'candy'
    }
];

const index: Record<string, Palette> = {};


for (let i = 0, n = palettes.length; i < n; i++) {
    index[palettes[i].name] = palettes[i];
}


const apply = (name: string): void => {
    let palette = index[name];

    if (!palette) {
        return;
    }

    let { style } = document.documentElement;

    for (let color in palette.colors) {
        let scale = palette.colors[color];

        style.setProperty(`--color-${color}-300`, scale[300]);
        style.setProperty(`--color-${color}-400`, scale[400]);
        style.setProperty(`--color-${color}-500`, scale[500]);
    }
};


export { apply, palettes };
export type { Palette, Scale };
