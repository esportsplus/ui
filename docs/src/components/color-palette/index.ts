import { html } from '../../app';
import { clipboard, icon, toast } from '@esportsplus/ui';
import type { Renderable } from '../../app';
import check from '/src/components/toast/svg/check.svg';
import copy from '/src/components/toast/svg/copy.svg';
import './scss/index.scss';


type ColorToken = { label: string; name: string; value: string };

const cssValue = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();


function colorContrast() {
    let context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;

    // Canvas resolves OKLCH and converts to sRGB for relative luminance.
    let luminance = (color: string) => {
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        let channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((value) => {
            let channel = value / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };
    let white = luminance(cssValue('--color-white-400')),
        text = luminance(cssValue('--color-text-400')),
        ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

    return (value: string) => {
        let background = luminance(value);
        return ratio(background, white) > ratio(background, text) ? '--color-white-400' : '--color-text-400';
    };
}

function colorPalette(values: ColorToken[]): Renderable<unknown> {
    let families = new Map<string, ColorToken[]>(),
        contrast = colorContrast();

    for (let token of values) {
        let family = token.label.replace(/-\d+$/, '');
        families.set(family, [...(families.get(family) ?? []), token]);
    }

    let palettes = [...families];

    return html`
        <div class='token-colors'>
            <div class='token-colors-toolbar'>
                <div class='token-colors-navigation' aria-label='Color palettes'>
                    <span class='token-colors-caption'>Palettes</span>
                    ${palettes.map(([name, shades]) => html`
                        <a class='token-colors-dot' href='#palette-${name}' aria-label='${name} palette'
                            title='${name}' style='background: var(${shades[Math.floor(shades.length / 2)].name});'></a>
                    `)}
                </div>
                <span class='token-colors-caption'>Click a shade to copy</span>
            </div>

            ${palettes.map(([name, shades], index) => html`
                <div class='token-colors-family' id='palette-${name}'>
                    <h3 class='token-colors-heading'>
                        <span class='token-colors-number'>${String(index + 1).padStart(2, '0')}</span>
                        ${name}
                    </h3>
                    <div class='token-colors-strip'>
                        ${shades.map((token) => clipboard.copy({
                            class: 'token-colors-swatch',
                            style: `background: var(${token.name}); color: var(${contrast(token.value)});`,
                            'aria-label': `Copy ${token.name}: ${token.value}`,
                            oncopied: () => toast.success('color copied correctly'),
                            onerror: () => toast.error('Could not copy color'),
                            timeout: 3000,
                            value: token.value
                        }, (state) => html`
                                <span class='token-colors-value ${state.copied ? '--copied' : ''}'>
                                    ${icon({ class: 'token-colors-copy', 'aria-hidden': 'true' }, state.copied ? check : copy)}
                                    <span>${token.value}</span>
                                </span>
                                <span class='token-colors-shade'>${token.label.slice(name.length + 1)}</span>
                        `))}
                    </div>
                </div>
            `)}
        </div>
    `;
}

export { colorPalette };
export type { ColorToken };
