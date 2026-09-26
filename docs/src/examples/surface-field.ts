import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { surfaceField, switch as toggle } from '@esportsplus/ui';
import editor from './surface-field-editor';
import './surface-field.scss';


type Settings = {
    accent: string;
    breathe: number;
    brightness: number;
    connected: boolean;
    gap: number;
    lineRadius: number;
    pointerPush: number;
    radius: number;
    ripplePush: number;
    still: boolean;
    surfacePadding: number;
    tint: number;
    wander: boolean;
};


const PRESETS: Record<string, Settings> = {
    Workspace: {
        accent: '#6683e8',
        breathe: 0,
        brightness: 0.2,
        connected: true,
        gap: 22,
        lineRadius: 200,
        pointerPush: 2,
        radius: 250,
        ripplePush: 6,
        still: false,
        surfacePadding: 0,
        tint: 0,
        wander: false
    },
    Aurora: {
        accent: '#8b5cf6',
        breathe: 0.35,
        brightness: 0.35,
        connected: true,
        gap: 18,
        lineRadius: 260,
        pointerPush: 4,
        radius: 360,
        ripplePush: 10,
        still: false,
        surfacePadding: 8,
        tint: 0.8,
        wander: true
    },
    Blueprint: {
        accent: '#3b82f6',
        breathe: 0,
        brightness: 0.45,
        connected: true,
        gap: 28,
        lineRadius: 420,
        pointerPush: 0,
        radius: 420,
        ripplePush: 4,
        still: false,
        surfacePadding: 12,
        tint: 1,
        wander: false
    },
    Dust: {
        accent: '#6683e8',
        breathe: 0.6,
        brightness: 0.3,
        connected: false,
        gap: 14,
        lineRadius: 0,
        pointerPush: 6,
        radius: 200,
        ripplePush: 12,
        still: false,
        surfacePadding: -4,
        tint: 0,
        wander: true
    }
};


function panel(settings: Settings, intro: string) {
    let ui = reactive({ preset: 'Workspace' });

    return html`
        <aside class='surface-field-demo-panel --scrollbar'>
            <p class='surface-field-demo-intro'>${intro}</p>

            <div class='surface-field-demo-group'>
                <h4>Preset</h4>
                <div class='surface-field-demo-preset'>
                    <select
                        aria-label='Field preset'
                        ${{
                            onchange: (event: Event) => {
                                ui.preset = (event.target as HTMLSelectElement).value;
                                Object.assign(settings, PRESETS[ui.preset]);
                            },
                            value: () => ui.preset
                        }}
                    >
                        ${Object.keys(PRESETS).map((name) => html`<option value='${name}'>${name}</option>`)}
                    </select>
                    <button
                        class='surface-field-demo-reset'
                        type='button'
                        ${{
                            onclick: () => {
                                Object.assign(settings, PRESETS[ui.preset]);
                            }
                        }}
                    >
                        Reset
                    </button>
                </div>
            </div>

            <div class='surface-field-demo-group'>
                <h4>Dots & lines</h4>
                ${slider(settings, 'gap', 'Spacing', 10, 48, 1, 'px')}
                ${slider(settings, 'radius', 'Light radius', 0, 800, 10, 'px')}
                ${slider(settings, 'brightness', 'Brightness', 0, 1, 0.01, '%')}
                ${switchRow(settings, 'connected', 'Connected lines')}
                ${slider(settings, 'lineRadius', 'Line reach', 0, 600, 10, 'px')}
            </div>

            <div class='surface-field-demo-group'>
                <h4>Interaction</h4>
                ${slider(settings, 'pointerPush', 'Cursor distortion', 0, 20, 1, 'px')}
                ${slider(settings, 'ripplePush', 'Ripple displacement', 0, 30, 1, 'px')}
                ${slider(settings, 'surfacePadding', 'Surface spacing', -16, 40, 1, 'px')}
            </div>

            <div class='surface-field-demo-group'>
                <h4>Color & motion</h4>
                <label class='surface-field-demo-row --inline'>
                    <span class='surface-field-demo-label'>Accent color</span>
                    <input
                        aria-label='Accent color'
                        type='color'
                        ${{
                            oninput: (event: Event) => {
                                settings.accent = (event.target as HTMLInputElement).value;
                            },
                            value: () => settings.accent
                        }}
                    >
                </label>
                ${slider(settings, 'tint', 'Accent blend', 0, 1, 0.01, '%')}
                ${switchRow(settings, 'wander', 'Wandering light', 'Let the light drift when idle')}
                ${slider(settings, 'breathe', 'Breathing dots', 0, 1, 0.01, '%')}
                ${switchRow(settings, 'still', 'Still field', 'Render a static texture')}
            </div>
        </aside>
    `;
}

function slider(settings: Settings, key: keyof Settings, label: string, min: number, max: number, step: number, unit: 'px' | '%') {
    return html`
        <label class='surface-field-demo-row'>
            <span class='surface-field-demo-label'>
                ${label}
                <b>${() => unit === '%' ? `${Math.round((settings[key] as number) * 100)}%` : `${settings[key]} px`}</b>
            </span>
            <input
                max='${max}'
                min='${min}'
                step='${step}'
                type='range'
                ${{
                    oninput: (event: Event) => {
                        (settings[key] as number) = Number((event.target as HTMLInputElement).value);
                    },
                    value: () => settings[key] as number
                }}
            >
        </label>
    `;
}

function swatch(label: string, x: number, y: number, width: number, height: number, content: string) {
    return surfaceField.surface({ height, label, width, x, y }, html`<p class='surface-field-demo-note'>${content}</p>`);
}

function switchRow(settings: Settings, key: 'connected' | 'still' | 'wander', label: string, hint?: string) {
    return html`
        <label class='surface-field-demo-row --inline'>
            <span class='surface-field-demo-label'>
                ${label}
                ${hint && html`<small>${hint}</small>`}
            </span>
            ${toggle({
                [toggle.input]: {
                    'aria-label': label,
                    checked: () => settings[key],
                    onchange: (event: Event) => {
                        settings[key] = (event.target as HTMLInputElement).checked;
                    }
                }
            })}
        </label>
    `;
}


export default {
    name: 'surface-field',
    variants: [
        {
            render: () => {
                let settings = reactive({ ...PRESETS.Workspace });

                return html`
                    <div class='surface-field-demo'>
                        ${panel(settings, 'Move your cursor, click the canvas, or drag and resize a surface.')}

                        ${surfaceField({ class: 'surface-field-demo-stage', state: settings }, [
                            swatch('note', 32, 96, 220, 150, 'Drag the bar to move me. The grid bends around my edges.'),
                            swatch('label', 280, 40, 160, 96, 'Resize from the corner.'),
                            swatch('swatch', 200, 350, 200, 110, 'Click the empty canvas for a ripple.')
                        ])}
                    </div>
                `;
            },
            title: 'playground'
        },
        {
            render: () => {
                let settings = reactive({ ...PRESETS.Workspace });

                return html`
                    <div class='surface-field-demo --stacked'>
                        ${panel(settings, 'The field as a node canvas background. Pan, zoom, move or resize a card: the grid follows the camera and every card carves its clearing.')}
                        ${editor(settings)}
                    </div>
                `;
            },
            title: 'node editor'
        },
        {
            render: () => surfaceField(
                { class: 'surface-field-demo-backdrop', radius: 320, wander: true },
                html`
                    <div class='surface-field-demo-hero'>
                        <div class='surface-field-demo-card' data-surface-field>
                            <h3>Any element can be a surface</h3>
                            <p>Mark it with <code>data-surface-field</code> and the field clears a space around it.</p>
                        </div>
                    </div>
                `
            ),
            title: 'backdrop with wandering light'
        }
    ]
};
