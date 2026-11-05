import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { icon, toolbar } from '@esportsplus/ui/components';
import type { Entry } from 'docs/types';
import boldSvg from '@esportsplus/ui/svg/bold.svg';
import codeSvg from '@esportsplus/ui/svg/code.svg';
import copySvg from '@esportsplus/ui/svg/copy.svg';
import downloadSvg from '@esportsplus/ui/svg/download.svg';
import highlightSvg from '@esportsplus/ui/svg/highlight.svg';
import italicSvg from '@esportsplus/ui/svg/italic.svg';
import linkSvg from '@esportsplus/ui/svg/link.svg';
import redoSvg from '@esportsplus/ui/svg/redo.svg';
import strikeSvg from '@esportsplus/ui/svg/strikethrough.svg';
import trashSvg from '@esportsplus/ui/svg/trash.svg';
import undoSvg from '@esportsplus/ui/svg/undo.svg';
import 'docs/examples/toolbar/scss/index.scss';


function apps(running: string[]) {
    return [
        {
            icon: () => html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'><path d='M3.5 10.5 12 4l8.5 6.5V19a1 1 0 0 1-1 1H15v-5.5H9V20H4.5a1 1 0 0 1-1-1Z' /></svg>`,
            label: 'Home'
        },
        {
            icon: () => html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'><circle cx='11' cy='11' r='6.5' /><path d='m20 20-4.35-4.35' /></svg>`,
            label: 'Search'
        },
        {
            icon: () => html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'><rect height='13' rx='2' width='17' x='3.5' y='5.5' /><path d='m4 7 8 6 8-6' /></svg>`,
            label: 'Mail'
        },
        {
            icon: () => html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'><rect height='15' rx='2' width='17' x='3.5' y='5' /><path d='M3.5 10h17M8 3v4M16 3v4' /></svg>`,
            label: 'Calendar'
        },
        {
            icon: () => html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'><path d='M9 18V5l11-2v13' /><circle cx='6' cy='18' r='3' /><circle cx='17' cy='16' r='3' /></svg>`,
            label: 'Music'
        },
        {
            icon: () => html`<svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'><path d='M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12' /><circle cx='16' cy='6' r='2' /><circle cx='10' cy='12' r='2' /><circle cx='18' cy='18' r='2' /></svg>`,
            label: 'Settings'
        }
    ].map((app) => toolbar.button({ ...app, running: running.includes(app.label) }));
}

// The formatting glyphs are outlines that carry no stroke of their own once inlined.
function glyph(href: string) {
    return () => icon({ 'aria-hidden': 'true', class: 'toolbar-demo-glyph' }, href);
}

function library() {
    return ['Canyon', 'Desert', 'Dune', 'Forest', 'Glacier', 'Harbor', 'Lagoon', 'Meadow', 'Reef', 'Tundra'].map((label) => toolbar.button({
        label,
        thumbnail: `https://picsum.photos/seed/${label.toLowerCase()}/120/120`
    }));
}

// Toggles, each pressed or not.
function marks() {
    return ([[boldSvg, 'Bold'], [italicSvg, 'Italic'], [strikeSvg, 'Strikethrough'], [codeSvg, 'Code'], [highlightSvg, 'Highlight']] as const)
        .map(([href, label]) => {
            let mark = reactive({ pressed: label === 'Bold' });

            return toolbar.button({
                'aria-pressed': () => mark.pressed ? 'true' : 'false',
                icon: glyph(href),
                label,
                onclick: () => {
                    mark.pressed = !mark.pressed;
                }
            });
        });
}

function thumbnails() {
    return ['Harbor', 'Desert', 'Forest', 'Glacier', 'Canyon', 'Meadow'].map((label) => toolbar.button({
        label,
        running: label === 'Harbor',
        thumbnail: `https://picsum.photos/seed/${label.toLowerCase()}/120/120`
    }));
}

function tools() {
    return [
        toolbar.button({ icon: glyph(undoSvg), label: 'Undo' }),
        toolbar.button({ icon: glyph(redoSvg), label: 'Redo' }),
        toolbar.divider(),
        ...marks(),
        toolbar.divider(),
        toolbar.button({ icon: glyph(linkSvg), label: 'Link' })
    ];
}


export default {
    name: 'toolbar',
    variants: [
        {
            render: () => html`<div class='toolbar-demo'>${toolbar({ items: tools() })}</div>`,
            title: 'default'
        },
        {
            render: () => html`
                <div class='toolbar-demo toolbar-demo--drawer'>
                    ${toolbar({
                        apps: [
                            toolbar.button({ icon: glyph(copySvg), label: 'Copy' }),
                            toolbar.button({ icon: glyph(downloadSvg), label: 'Download' }),
                            toolbar.button({ icon: glyph(trashSvg), label: 'Delete' })
                        ],
                        drawer: true,
                        items: tools(),
                        search: false
                    })}
                </div>
            `,
            title: 'drawer, no search'
        },
        {
            render: () => html`<div class='toolbar-demo'>${toolbar({ items: apps(['Home', 'Mail']), mode: 'dock' })}</div>`,
            title: 'dock'
        },
        {
            render: () => html`
                <div class='toolbar-demo toolbar-demo--drawer'>
                    ${toolbar({ apps: library(), drawer: true, items: apps(['Home', 'Mail']), mode: 'dock' })}
                </div>
            `,
            title: 'dock drawer'
        },
        {
            render: () => html`
                <div class='toolbar-demo toolbar-demo--s'>
                    ${toolbar({ apps: library(), direction: 's', drawer: true, items: apps(['Home', 'Mail']), mode: 'dock' })}
                </div>
            `,
            title: 'direction s'
        },
        {
            render: () => html`
                <div class='toolbar-demo toolbar-demo--e'>
                    ${toolbar({ apps: library(), direction: 'e', drawer: true, items: apps(['Home', 'Mail']), mode: 'dock' })}
                </div>
            `,
            title: 'direction e'
        },
        {
            render: () => html`
                <div class='toolbar-demo toolbar-demo--w'>
                    ${toolbar({ apps: library(), direction: 'w', drawer: true, items: apps(['Home', 'Mail']), mode: 'dock' })}
                </div>
            `,
            title: 'direction w'
        },
        {
            render: () => html`
                <div class='toolbar-demo toolbar-demo--narrow'>
                    ${toolbar({ arrows: true, items: [...apps(['Home']), ...thumbnails()], mode: 'dock' })}
                </div>
            `,
            title: 'arrows'
        },
        {
            render: () => {
                let list = apps([]).map((app) => ({ ...app, state: reactive({ running: false }) })),
                    state = reactive({ last: 'click an icon to launch it' });

                return html`
                    <div class='toolbar-demo'>
                        ${toolbar({
                            items: list,
                            mode: 'dock',
                            onlaunch: (label: string) => {
                                state.last = `launched ${label}`;
                            }
                        })}
                        <span class='toolbar-demo-status'>${() => state.last}</span>
                        <button class='button toolbar-demo-button' onclick=${() => {
                            for (let app of list) {
                                app.state.running = false;
                            }

                            state.last = 'all apps quit';
                        }} type='button'>
                            quit all
                        </button>
                    </div>
                `;
            },
            title: 'controlled running state + onlaunch'
        },
        {
            render: () => html`<div class='toolbar-demo'>${toolbar({ items: thumbnails(), mode: 'dock' })}</div>`,
            title: 'thumbnails'
        },
        {
            render: () => html`<div class='toolbar-demo'>${toolbar({ items: [...thumbnails().slice(0, 3), ...apps([]).slice(0, 3)], mode: 'dock' })}</div>`,
            title: 'thumbnails and icons'
        }
    ]
} satisfies Entry;
