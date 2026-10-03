import { effect, reactive, untrack } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { colorPicker, range, select, surfaceField, switch as toggle, tooltip } from '@esportsplus/ui';
import worker from '@esportsplus/ui/surface-field/worker?worker&url';
import editor from './editor';
import './scss/index.scss';


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
        accent: '#6683E8',
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
        accent: '#8B5CF6',
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
        accent: '#3B82F6',
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
        accent: '#6683E8',
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


function accent(settings: Settings) {
    let picker = reactive({ error: '', value: settings.accent });

    // Two-way: a preset repaints the picker, the picker repaints the field. Each side only tracks its own source, or
    // the two would undo each other.
    effect(() => {
        let value = settings.accent;

        untrack(() => {
            if (value.toUpperCase() !== picker.value.toUpperCase()) {
                picker.value = value;
            }
        });
    });

    effect(() => {
        let value = picker.value;

        untrack(() => {
            if (value && value.toUpperCase() !== settings.accent.toUpperCase()) {
                settings.accent = value;
            }
        });
    });

    return html`
        <div class='surface-field-demo-row --inline'>
            <span class='surface-field-demo-label'>Accent color</span>
            ${tooltip.onclick(
                { class: 'surface-field-demo-accent' },
                html`
                    <button
                        aria-label='Accent color'
                        class='surface-field-demo-swatch'
                        style='${() => `--swatch: ${settings.accent};`}'
                        type='button'
                    ></button>
                    <div class='tooltip-content tooltip-content--se surface-field-demo-picker'>
                        ${colorPicker({ state: picker, value: settings.accent })}
                    </div>
                `
            )}
        </div>
    `;
}

function control(settings: Settings, key: keyof Settings, label: string, min: number, max: number, step: number, unit: 'px' | '%') {
    return range.filter({
        class: 'range--slider surface-field-demo-slider',
        format: (value: number) => unit === '%' ? `${Math.round(value * 100)}%` : `${value} px`,
        label,
        max,
        min,
        prefix: '',
        ticks: 0,
        value: settings[key] as number,
        // Reads and writes the setting itself, so a preset moves the thumb.
        state: {
            low: min,
            get high() {
                return settings[key] as number;
            },
            set high(value: number) {
                (settings[key] as number) = value;
            }
        },
        step
    });
}

function panel(settings: Settings, intro: string) {
    let preset = reactive({ active: false, error: '', render: false, selected: 'Workspace' as number | string });

    effect(() => {
        Object.assign(settings, PRESETS[preset.selected]);
    });

    return html`
        <aside class='surface-field-demo-panel --scrollbar'>
            <p class='surface-field-demo-intro'>${intro}</p>

            <div class='surface-field-demo-group'>
                <h4>Preset</h4>
                <div class='surface-field-demo-preset'>
                    ${select({
                        'aria-label': 'Field preset',
                        class: 'surface-field-demo-select',
                        options: Object.fromEntries(Object.keys(PRESETS).map((name) => [name, name])),
                        state: preset
                    })}
                    <button
                        class='button surface-field-demo-reset'
                        type='button'
                        ${{
                            onclick: () => {
                                Object.assign(settings, PRESETS[preset.selected]);
                            }
                        }}
                    >
                        Reset
                    </button>
                </div>
            </div>

            <div class='surface-field-demo-group'>
                <h4>Dots & lines</h4>
                ${control(settings, 'gap', 'Spacing', 10, 48, 1, 'px')}
                ${control(settings, 'radius', 'Light radius', 0, 800, 10, 'px')}
                ${control(settings, 'brightness', 'Brightness', 0, 1, 0.01, '%')}
                ${switchRow(settings, 'connected', 'Connected lines')}
                ${control(settings, 'lineRadius', 'Line reach', 0, 600, 10, 'px')}
            </div>

            <div class='surface-field-demo-group'>
                <h4>Interaction</h4>
                ${control(settings, 'pointerPush', 'Cursor distortion', 0, 20, 1, 'px')}
                ${control(settings, 'ripplePush', 'Ripple displacement', 0, 30, 1, 'px')}
                ${control(settings, 'surfacePadding', 'Surface spacing', -16, 40, 1, 'px')}
            </div>

            <div class='surface-field-demo-group'>
                <h4>Color & motion</h4>
                ${accent(settings)}
                ${control(settings, 'tint', 'Accent blend', 0, 1, 0.01, '%')}
                ${switchRow(settings, 'wander', 'Wandering light', 'Let the light drift when idle')}
                ${control(settings, 'breathe', 'Breathing dots', 0, 1, 0.01, '%')}
                ${switchRow(settings, 'still', 'Still field', 'Render a static texture')}
            </div>
        </aside>
    `;
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
                        ${panel(settings, 'Move your cursor, press the canvas, or drag and resize a surface. Click a title or note to edit it.')}

                        ${surfaceField(
                            {
                                class: 'surface-field-demo-stage',
                                links: [
                                    { from: 'note', motion: 'loop', to: 'pill' },
                                    { from: 'note', to: 'orb' }
                                ],
                                state: settings
                            },
                            [
                                surfaceField.surface({
                                    body: 'Drag the header to move me; a channel in the field runs to the pill.',
                                    editable: true,
                                    height: 150,
                                    name: 'note',
                                    title: 'Note',
                                    width: 240,
                                    x: 32,
                                    y: 32
                                }),
                                surfaceField.surface(
                                    { class: 'surface-field-demo-pill', height: 64, label: 'pill', name: 'pill', width: 190, x: 48, y: 260 },
                                    html`<p class='surface-field-demo-note'>Rounded and turned: the clearing follows both.</p>`
                                ),
                                surfaceField.surface(
                                    { class: 'surface-field-demo-orb', height: 140, label: 'orb', minWidth: 96, name: 'orb', width: 140, x: 200, y: 390 },
                                    html`<p class='surface-field-demo-note'>A circle clears a circle.</p>`
                                )
                            ]
                        )}
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
                        ${panel(settings, 'The field as a node canvas background. Pan, zoom, move or resize a card, or rename one: the grid follows the camera as a floor below it, and the links run through the field.')}
                        ${editor(settings)}
                    </div>
                `;
            },
            title: 'node editor'
        },
        {
            render: () => surfaceField(
                { class: 'surface-field-demo-backdrop', radius: 320, wander: true, worker },
                html`
                    <div class='surface-field-demo-hero'>
                        <div class='surface-field-demo-card' data-surface-field>
                            <h3>Any element can be a surface</h3>
                            <p>Mark it with <code>data-surface-field</code> and the field clears a space around it. This one draws in a worker.</p>
                        </div>
                    </div>
                `
            ),
            title: 'backdrop drawn in a worker'
        }
    ]
};
