import { html } from '@esportsplus/template';
import { navigationMenu } from '@esportsplus/ui';
import type { Variant } from '../types';
import './navigation-menu.scss';


// Kobra's navigation menu (https://kobra.systems/components/navigation-menu), rebuilt on our template and
// reactivity. Shown on the morphing-nav page so the two can be compared side by side.


function demo({ align, modifier = '' }: { align?: 'center' | 'end' | 'start'; modifier?: string } = {}) {
    let stop: VoidFunction | undefined;

    return html`
        <div
            class='navigation-menu-demo'
            ${{
                // The docs router would follow the demo's placeholder links.
                onconnect: (element: HTMLElement) => {
                    let prevent = (e: Event) => e.preventDefault();

                    element.addEventListener('click', prevent);
                    stop = () => element.removeEventListener('click', prevent);
                },
                ondisconnect: () => {
                    stop?.();
                }
            }}
        >
            ${navigationMenu({
                align,
                class: modifier,
                items: items()
            })}
        </div>
    `;
}

function items() {
    return [
        {
            content: html`
                <div class='navigation-menu-demo-panel navigation-menu-demo-panel--feature'>
                    <a class='navigation-menu-link navigation-menu-demo-feature' href='#'>
                        <span class='navigation-menu-demo-feature-art'>
                            <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.25' viewBox='0 0 24 24'>
                                <path d='M12 3 3.5 7.5 12 12l8.5-4.5L12 3ZM3.5 12 12 16.5l8.5-4.5M3.5 16.5 12 21l8.5-4.5' />
                            </svg>
                        </span>
                        <span class='navigation-menu-link-title'>One platform</span>
                        <span class='navigation-menu-link-description'>Compute, storage and global delivery in a single stack.</span>
                    </a>
                    <div class='navigation-menu-demo-stack'>
                        ${link('Hosting', 'Deploy any framework to a global edge network in seconds.')}
                        ${link('SQL Database', 'A fully managed Postgres database that scales with you.')}
                        ${link('CDN', 'Cache and serve assets from hundreds of locations worldwide.')}
                    </div>
                </div>
            `,
            label: 'Products'
        },
        {
            content: html`
                <div class='navigation-menu-demo-panel'>
                    <div class='navigation-menu-demo-grid'>
                        ${link('Startups', 'Everything you need to ship fast and scale when it matters.')}
                        ${link('AI features', 'Add search, chat and recommendations powered by AI.')}
                        ${link('Enterprise', 'Advanced security, SSO and SLAs for larger organizations.')}
                        ${link('Security', 'Block threats early with built-in WAF and bot protection.')}
                        ${link('Agencies', 'Manage unlimited client projects from a single dashboard.')}
                        ${link('Performance', 'Speed up every page with smart caching and compression.')}
                    </div>
                    <div class='navigation-menu-demo-footer'>
                        <a class='navigation-menu-link navigation-menu-link--compact navigation-menu-demo-all' href='#'>
                            See all solutions
                            <svg aria-hidden='true' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
                                <path d='M5 12h14M13 6l6 6-6 6' />
                            </svg>
                        </a>
                        <span class='navigation-menu-demo-footer-links'>
                            ${['Sales', 'Careers', 'Partners', 'Status', 'Support'].map((label) => html`
                                <a class='navigation-menu-link navigation-menu-link--compact' href='#'>${label}</a>
                            `)}
                        </span>
                    </div>
                </div>
            `,
            label: 'Solutions'
        },
        {
            content: html`
                <div class='navigation-menu-demo-panel navigation-menu-demo-grid'>
                    ${link('Documentation', 'Guides, references and examples for every feature.')}
                    ${link('Tutorials', 'Step-by-step lessons that take you from zero to deployed.')}
                    ${link('API Reference', 'Detailed docs for every endpoint and SDK method.')}
                    ${link('Blog', 'Product news, engineering deep dives and best practices.')}
                    ${link('Community', 'Ask questions and share what you build with others.')}
                    ${link('Support', 'Get help fast from our team and the wider community.')}
                </div>
            `,
            label: 'Resources'
        },
        {
            href: '#',
            label: 'Pricing'
        }
    ];
}

function link(title: string, description: string) {
    return html`
        <a class='navigation-menu-link' href='#'>
            <span class='navigation-menu-link-title'>${title}</span>
            <span class='navigation-menu-link-description'>${description}</span>
        </a>
    `;
}


export function navigationMenuVariants(): Variant[] {
    return [
        {
            render: () => demo(),
            title: 'navigation-menu (kobra)'
        },
        {
            render: () => demo({ align: 'center' }),
            title: 'navigation-menu (kobra) · align center'
        },
        {
            render: () => demo({ modifier: 'navigation-menu--muted' }),
            title: 'navigation-menu (kobra) · navigation-menu--muted'
        }
    ];
}
