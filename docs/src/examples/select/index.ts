import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { select } from '@esportsplus/ui/components';
import monitor from '@esportsplus/ui/svg/monitor.svg';
import moon from '@esportsplus/ui/svg/moon.svg';
import sun from '@esportsplus/ui/svg/sun.svg';
import 'docs/examples/select/scss/index.scss';
import type { Style, Variant } from 'docs/types';


// Every example is edged by default, with the plain select a pick away; the edge adds to any fill.
const STYLES: Style[] = [{ class: 'select--border', label: 'Border' }, { class: '', label: 'Default' }];


let fonts = [
        { label: 'Geist', value: 'geist' },
        { label: 'Inter', value: 'inter' },
        { label: 'Montserrat', value: 'montserrat' },
        { label: 'System UI', value: 'system' }
    ],
    timeZones = [
        { detail: 'UTC-10', label: 'Honolulu', value: 'honolulu' },
        { detail: 'UTC-9', label: 'Anchorage', value: 'anchorage' },
        { detail: 'UTC-8', label: 'Los Angeles', value: 'los-angeles' },
        { detail: 'UTC-7', label: 'Denver', value: 'denver' },
        { detail: 'UTC-6', label: 'Chicago', value: 'chicago' },
        { detail: 'UTC-5', label: 'New York', value: 'new-york' },
        { detail: 'UTC-3', label: 'São Paulo', value: 'sao-paulo' },
        { detail: 'UTC+0', label: 'London', value: 'london' },
        { detail: 'UTC+1', label: 'Berlin', value: 'berlin' },
        { detail: 'UTC+4', label: 'Dubai', value: 'dubai' },
        { detail: 'UTC+5:30', label: 'Kolkata', value: 'kolkata' },
        { detail: 'UTC+9', label: 'Tokyo', value: 'tokyo' }
    ],
    // The closed select's fills, which match the input's.
    modifiers = [
        ['', 'Default'],
        ['select--surface', 'Surface'],
        ['select--surface-primary', 'Surface Primary']
    ],
    weekStarts = [
        { label: 'Saturday', value: 'saturday' },
        { label: 'Sunday', value: 'sunday' },
        { label: 'Monday', value: 'monday' }
    ];


export default {
    name: 'select',
    variants: ([
        {
            render: (style: string) => html`
                <div class='select-menu-demo select-menu-demo--stack'>
                    ${modifiers.map(([modifier, label]) => html`
                        <div class='group group--column'>
                            <span aria-hidden='true' class='group-label'>${label}</span>
                            ${select({
                                class: `${modifier} ${style}`.trim(),
                                label,
                                options: { apples: 'Apples', bananas: 'Bananas', cherries: 'Cherries' }
                            })}
                        </div>
                    `)}
                </div>
            `,
            title: 'options'
        },
        {
            render: (style: string) => html`
                <div class='select-menu-demo select-menu-demo--stack'>
                    ${modifiers.map(([modifier, label]) => html`
                        <div class='group group--column'>
                            <span aria-hidden='true' class='group-label'>${label}</span>
                            ${select({
                                class: `${modifier} ${style} select--compact`.trim(),
                                label,
                                options: { apples: 'Apples', bananas: 'Bananas', cherries: 'Cherries' }
                            })}
                        </div>
                    `)}
                </div>
            `,
            title: 'compact'
        },
        {
            render: (style: string) => select({
                class: style,
                options: { eur: 'EUR', gbp: 'GBP', usd: 'USD' },
                selected: 'gbp'
            }),
            title: 'pre-selected'
        },
        {
            render: (style: string) => select({
                class: style,
                label: 'Language',
                options: {
                    de: { content: 'Deutsch (Deutschland)', selected: 'DE' },
                    en: { content: 'English (United States)', selected: 'EN' },
                    fr: { content: 'Français (France)', selected: 'FR' }
                },
                selected: 'en'
            }),
            title: 'short label in the trigger'
        },
        {
            render: (style: string) => select({
                class: style,
                label: 'Theme',
                options: [
                    { icon: sun, label: 'Light', value: 'light' },
                    { icon: moon, label: 'Dark', value: 'dark' },
                    { icon: monitor, label: 'System', value: 'system' },
                    { label: 'Custom', value: 'custom' }
                ],
                selected: 'system'
            }),
            title: 'icons'
        },
        {
            render: (style: string) => select({
                class: style,
                disabled: true,
                options: { eur: 'EUR', gbp: 'GBP', usd: 'USD' },
                selected: 'usd'
            }),
            title: 'disabled'
        },
        {
            render: (style: string) => select({
                class: style,
                label: 'Choose font',
                options: fonts,
                selected: 'inter'
            }),
            title: 'font picker'
        },
        {
            render: (style: string) => html`
                <div class='select-menu-demo'>
                    ${[
                        { label: 'Time zone', options: timeZones, selected: 'kolkata' },
                        { label: 'Week starts on', options: weekStarts, selected: 'monday' }
                    ].map((row) => html`
                        <div class='group group--grid select-menu-demo-row'>
                            <span aria-hidden='true' class='group-label'>${row.label}</span>
                            ${select({ ...row, class: style })}
                        </div>
                    `)}
                </div>
            `,
            title: 'settings'
        },
        {
            render: (style: string) => {
                let state = reactive({ active: false, error: '', selected: 'montserrat' });

                return html`
                    <div class='select-menu-demo'>
                        <div class='group group--grid select-menu-demo-row'>
                            <span aria-hidden='true' class='group-label'>Font</span>
                            ${select({ class: style, label: 'Font', name: 'font', options: fonts, state })}
                        </div>
                        <span class='select-menu-demo-status'>
                            selected: ${() => state.selected}${() => state.active && ' (open)'}
                        </span>
                    </div>
                `;
            },
            title: 'controlled state'
        },
        {
            render: () => select.expand({
                label: 'Size',
                options: [
                    { content: () => 'S', label: 'Small', value: 'small' },
                    { content: () => 'M', label: 'Medium', value: 'medium' },
                    { content: () => 'L', label: 'Large', value: 'large' }
                ],
                selected: 'medium'
            }),
            title: 'expand'
        }
    ] as Variant[]).map((variant) => variant.title === 'expand' ? variant : { ...variant, styles: STYLES })
};
