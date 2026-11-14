import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { icon, toolbar } from '@esportsplus/ui/components';
import type { Entry } from 'docs/types';
import boldSvg from '@esportsplus/ui/svg/bold.svg';
import calendarSvg from '@esportsplus/ui/svg/calendar.svg';
import codeSvg from '@esportsplus/ui/svg/code.svg';
import copySvg from '@esportsplus/ui/svg/copy.svg';
import downloadSvg from '@esportsplus/ui/svg/download.svg';
import highlightSvg from '@esportsplus/ui/svg/highlight.svg';
import homeSvg from '@esportsplus/ui/svg/home.svg';
import italicSvg from '@esportsplus/ui/svg/italic.svg';
import linkSvg from '@esportsplus/ui/svg/link.svg';
import mailSvg from '@esportsplus/ui/svg/mail.svg';
import musicSvg from '@esportsplus/ui/svg/music.svg';
import redoSvg from '@esportsplus/ui/svg/redo.svg';
import searchSvg from '@esportsplus/ui/svg/search.svg';
import slidersSvg from '@esportsplus/ui/svg/sliders.svg';
import strikeSvg from '@esportsplus/ui/svg/strikethrough.svg';
import trashSvg from '@esportsplus/ui/svg/trash.svg';
import undoSvg from '@esportsplus/ui/svg/undo.svg';
import 'docs/examples/toolbar/scss/index.scss';


// Sky, horizon and ground.
const SCENES: Record<string, [string, string, string]> = {
    Canyon: ['#f4a261', '#fcd5a5', '#9c4a1a'],
    Desert: ['#8ecae6', '#ffe8b0', '#d4a256'],
    Dune: ['#ffb4a2', '#ffe5d9', '#c9844a'],
    Forest: ['#a8dadc', '#e9f5db', '#2d6a4f'],
    Glacier: ['#5fa8d3', '#e0f4ff', '#cfe8f5'],
    Harbor: ['#4a6fa5', '#f6c28b', '#1d3557'],
    Lagoon: ['#48cae4', '#caf0f8', '#0f9d8a'],
    Meadow: ['#90e0ef', '#f1faee', '#6a994e'],
    Reef: ['#0077b6', '#90e0ef', '#f28482'],
    Tundra: ['#adb5bd', '#e9ecef', '#7f8c6b']
};

function apps(running: string[]) {
    return [
        {
            icon: homeSvg,
            label: 'Home'
        },
        {
            icon: searchSvg,
            label: 'Search'
        },
        {
            icon: mailSvg,
            label: 'Mail'
        },
        {
            icon: calendarSvg,
            label: 'Calendar'
        },
        {
            icon: musicSvg,
            label: 'Music'
        },
        {
            icon: slidersSvg,
            label: 'Settings'
        }
    ].map((app) => toolbar.button({ ...app, running: running.includes(app.label) }));
}

// Out of order on purpose, since the drawer sorts them; a number and an accent show where those file.
function catalog() {
    let scenes = Object.keys(SCENES);

    return [
        'Summit', 'Aurora', '7 Seas', 'Meadow', 'Éclair', 'Beacon', 'Orbit', 'Cascade', 'Willow', 'Harbor', 'Atlas',
        'Delta', 'Fjord', 'Zenith', 'Bloom', 'Glacier', 'Kelp', 'Nova', 'Prism', 'Reef', '2048', 'Lagoon', 'Cinder',
        'Ember', 'Grove', 'Horizon', 'Island', 'Jade', 'Lumen', 'Mesa', 'Oasis', 'Quarry', 'Ridge', 'Tundra', 'Vale',
        'Canyon', 'Dune', 'Forest', 'Desert'
    ].map((label, index) => toolbar.button({
        label,
        thumbnail: landscape(scenes[index % scenes.length])
    }));
}

// The formatting glyphs are outlines that carry no stroke of their own once inlined.
function glyph(href: string) {
    return () => icon({ 'aria-hidden': 'true', class: 'toolbar-demo-glyph' }, href);
}

// A sky over a ridge, in the scene's own colours: inline, so the demo needs no image host.
function landscape(scene: string) {
    let [sky, horizon, ground] = SCENES[scene];

    return `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'>` +
            `<defs><linearGradient id='s' x2='0' y2='1'><stop offset='0' stop-color='${sky}'/><stop offset='1' stop-color='${horizon}'/></linearGradient></defs>` +
            `<rect fill='url(#s)' height='120' width='120'/>` +
            `<path d='M0 80 30 58 52 72 82 46 120 74V120H0Z' fill='${ground}' opacity='0.6'/>` +
            `<path d='M0 96 40 78 74 92 120 82V120H0Z' fill='${ground}'/>` +
        `</svg>`
    )}`;
}

function library() {
    return ['Canyon', 'Desert', 'Dune', 'Forest', 'Glacier', 'Harbor', 'Lagoon', 'Meadow', 'Reef', 'Tundra'].map((label) => toolbar.button({
        label,
        thumbnail: landscape(label)
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
        thumbnail: landscape(label)
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
                <div class='toolbar-demo toolbar-demo--alphabetical toolbar-demo--drawer'>
                    ${toolbar({ alphabetical: true, apps: catalog(), drawer: true, items: apps(['Home', 'Mail']), mode: 'dock' })}
                </div>
            `,
            title: 'alphabetical drawer'
        },
        {
            render: () => html`
                <div class='toolbar-demo toolbar-demo--alphabetical toolbar-demo--drawer'>
                    ${toolbar({
                        alphabetical: true,
                        apps: catalog(),
                        drawer: true,
                        groups: true,
                        items: [...apps(['Home']), toolbar.group({ items: thumbnails().slice(0, 3) })],
                        mode: 'dock'
                    })}
                </div>
            `,
            title: 'groups'
        },
        {
            render: () => html`
                <div class='toolbar-demo toolbar-demo--alphabetical toolbar-demo--drawer'>
                    ${toolbar({
                        alphabetical: true,
                        apps: catalog(),
                        drawer: true,
                        groups: true,
                        items: [...apps(['Home']), toolbar.group({ items: thumbnails().slice(0, 5), label: 'Places' })],
                        labels: true,
                        mode: 'dock'
                    })}
                </div>
            `,
            title: 'groups + labels'
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
