import { effect, reactive } from '@esportsplus/reactivity';
import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import icon from '~/components/icon';
import modal from '~/components/modal';
import close from './svg/close.svg';
import saved from './svg/saved.svg';
import './scss/index.scss';


type A = Attributes<HTMLDialogElement> & {
    groups: Group[];
    labels?: { close?: string, saved?: string, title?: string };
    oncancel?: never;
    onclick?: never;
    onclose?: never;
    onconnect?: never;
    ondisconnect?: never;
    state?: State;
};

type Group = {
    items: Item[];
    label: Renderable<unknown>;
};

type Item = Attributes & {
    content: Renderable<unknown>;
    icon?: string;
    id?: string;
    onclick?: never;
    render?: () => Renderable<unknown>;
};

type State = {
    active: boolean;
    saved: boolean;
    selected?: string;
};


const SAVED_DURATION = 2000;

const SAVED_EXIT = 220;


export default component<A>(
    function({ groups, labels = {}, state, ...attributes }) {
        let pages: Record<string, Item> = {};

        for (let i = 0, n = groups.length; i < n; i++) {
            let items = groups[i].items;

            for (let j = 0, m = items.length; j < m; j++) {
                let item = items[j];

                if (item.id !== undefined && item.render) {
                    pages[item.id] ??= item;
                }
            }
        }

        let local = reactive({ saved: 'hidden', scrolled: false }),
            s = state ?? reactive<State>({ active: false, saved: false, selected: Object.keys(pages)[0] }),
            stop: VoidFunction | undefined,
            timer: ReturnType<typeof setTimeout> | undefined,
            title = labels.title ?? 'Settings';

        return modal.call(
            { attributes: { class: 'settings' } },
            { 'aria-label': title, ...attributes, state: s },
            html`
                <div
                    class='settings-panel'
                    ${{
                        onconnect: () => {
                            stop = effect(() => {
                                if (!s.active) {
                                    clearTimeout(timer);
                                    local.saved = 'hidden';
                                    return;
                                }

                                if (!s.saved) {
                                    return;
                                }

                                s.saved = false;
                                local.saved = 'shown';

                                clearTimeout(timer);
                                timer = setTimeout(() => {
                                    local.saved = 'leaving';
                                    // Re-arm below the edge once faded so the next save rises in again.
                                    timer = setTimeout(() => local.saved = 'hidden', SAVED_EXIT);
                                }, SAVED_DURATION);
                            });
                        },
                        ondisconnect: () => {
                            clearTimeout(timer);
                            stop?.();
                        }
                    }}
                >
                    <nav class='settings-nav --scrollbar' aria-label='${title} sections'>
                        ${groups.map(({ items, label }) => html`
                            <div class='settings-group'>
                                <div class='settings-group-label'>${label}</div>

                                ${items.map(({ content, icon: href, id, render, ...item }) => html`
                                    <button
                                        class='settings-item'
                                        type='button'
                                        ${item}
                                        ${{
                                            'aria-current': () => render && s.selected === id && 'page',
                                            class: () => render && s.selected === id && '--active',
                                            onclick: () => {
                                                if (!render || id === undefined) {
                                                    return;
                                                }

                                                local.scrolled = false;
                                                s.selected = id;
                                            }
                                        }}
                                    >
                                        ${href && icon({ 'aria-hidden': 'true', class: 'settings-item-icon' }, href)}
                                        <span class='settings-item-label'>${content}</span>
                                    </button>
                                `)}
                            </div>
                        `)}
                    </nav>

                    <div class='settings-main'>
                        <div class='settings-header'>
                            <h2 class='settings-title'>${() => pages[s.selected!]?.content}</h2>

                            <button
                                class='settings-close'
                                type='button'
                                ${{
                                    'aria-label': labels.close ?? `Close ${title.toLowerCase()}`,
                                    onclick: () => {
                                        s.active = false;
                                    }
                                }}
                            >
                                ${icon({ 'aria-hidden': 'true' }, close)}
                            </button>
                        </div>

                        <div class='settings-body'>
                            ${() => {
                                let id = s.selected!;

                                return html`
                                    <div
                                        class='settings-content --scrollbar'
                                        data-page='${id}'
                                        ${{
                                            onscroll: (e: Event) => {
                                                local.scrolled = (e.currentTarget as HTMLElement).scrollTop > 0;
                                            }
                                        }}
                                    >
                                        ${pages[id]?.render?.()}
                                    </div>
                                `;
                            }}

                            <div class='settings-fade ${() => local.scrolled && '--active'}' aria-hidden='true'></div>
                        </div>
                    </div>
                </div>

                <div class='settings-saved ${() => `--${local.saved}`}' aria-live='polite'>
                    ${icon({ 'aria-hidden': 'true', class: 'settings-saved-icon' }, saved)}
                    ${labels.saved ?? 'Saved'}
                </div>
            `
        );
    }
);
