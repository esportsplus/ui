import { header } from '@esportsplus/ui';
import { html, type Renderable } from '@esportsplus/template';


let action = '--font-size: var(--font-size-300); --padding-horizontal: var(--size-300); --padding-vertical: var(--size-100); --width: auto; height: 32px;',
    mark = 'display: grid; place-items: center; width: 24px; height: 24px; border-radius: var(--border-radius-300); background: var(--color-text-500); color: var(--color-white-400);',
    stage = 'position: relative; width: 100%; height: 32rem; overflow-y: auto; border: 1px dashed var(--color-border-400); border-radius: var(--border-radius-400); background: var(--color-white-400);';

let icons = {
    activity: (tint: string) => () => tinted(tint, html`
        <svg fill='var(--tint)' fill-opacity='0.15' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <rect width='18' height='18' x='3' y='3' rx='2' /><path d='M17 12h-2l-2 5-2-10-2 5H7' />
        </svg>
    `),
    bag: (tint: string) => () => tinted(tint, html`
        <svg fill='var(--tint)' fill-opacity='0.25' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='M16 10a4 4 0 0 1-8 0' /><path d='M3.103 6.034h17.794' /><path d='M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z' />
        </svg>
    `),
    book: (tint: string) => () => tinted(tint, html`
        <svg fill='var(--tint)' fill-opacity='0.15' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='M12 5v16' /><path d='M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z' />
        </svg>
    `),
    bot: (tint: string) => () => tinted(tint, html`
        <svg fill='var(--tint)' fill-opacity='0.15' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='M12 8V4H8' /><rect width='16' height='12' x='4' y='8' rx='2' /><path d='M2 14h2' /><path d='M20 14h2' /><path d='M15 13v2' /><path d='M9 13v2' />
        </svg>
    `),
    cloud: (tint: string) => () => tinted(tint, html`
        <svg fill='var(--tint)' fill-opacity='0.15' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' />
        </svg>
    `),
    cpu: (tint: string) => () => tinted(tint, html`
        <svg fill='var(--tint)' fill-opacity='0.15' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='M12 20v2M12 2v2M17 20v2M17 2v2M2 12h2M2 17h2M2 7h2M20 12h2M20 17h2M20 7h2M7 20v2M7 2v2' /><rect x='4' y='4' width='16' height='16' rx='2' /><rect x='8' y='8' width='8' height='8' rx='1' />
        </svg>
    `),
    croissant: (tint: string) => () => tinted(tint, html`
        <svg fill='var(--tint)' fill-opacity='0.15' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='M10.2 18H4.774a1.5 1.5 0 0 1-1.352-.97 11 11 0 0 1 .132-6.487' /><path d='M18 10.2V4.774a1.5 1.5 0 0 0-.97-1.352 11 11 0 0 0-6.486.132' /><path d='M18 5a4 3 0 0 1 4 3 2 2 0 0 1-2 2 10 10 0 0 0-5.139 1.42' /><path d='M5 18a3 4 0 0 0 3 4 2 2 0 0 0 2-2 10 10 0 0 1 1.42-5.14' /><path d='M8.709 2.554a10 10 0 0 0-6.155 6.155 1.5 1.5 0 0 0 .676 1.626l9.807 5.42a2 2 0 0 0 2.718-2.718l-5.42-9.807a1.5 1.5 0 0 0-1.626-.676' />
        </svg>
    `),
    gem: (tint: string) => () => tinted(tint, html`
        <svg fill='var(--tint)' fill-opacity='0.15' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='M10.5 3 8 9l4 13 4-13-2.5-6' /><path d='M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z' /><path d='M2 9h20' />
        </svg>
    `),
    notebook: (tint: string) => () => tinted(tint, html`
        <svg fill='var(--tint)' fill-opacity='0.15' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='M2 6h4M2 10h4M2 14h4M2 18h4' /><rect width='16' height='20' x='4' y='2' rx='2' /><path d='M16 2v20' />
        </svg>
    `),
    rocket: (tint: string) => () => tinted(tint, html`
        <svg fill='var(--tint)' fill-opacity='0.15' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5' /><path d='M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09' /><path d='M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z' /><path d='M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05' />
        </svg>
    `),
    shield: (tint: string) => () => tinted(tint, html`
        <svg fill='var(--tint)' fill-opacity='0.15' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z' />
        </svg>
    `),
    smartphone: (tint: string) => () => tinted(tint, html`
        <svg fill='var(--tint)' fill-opacity='0.15' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <rect width='14' height='20' x='5' y='2' rx='2' ry='2' /><path d='M12 18h.01' />
        </svg>
    `),
    sparkles: (tint: string) => () => tinted(tint, html`
        <svg fill='var(--tint)' fill-opacity='0.15' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
            <path d='M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z' /><path d='M20 2v4' /><path d='M22 4h-4' /><circle cx='4' cy='20' r='2' />
        </svg>
    `)
};


function changelog() {
    return html`
        <a
            href='#changelog'
            style='position: relative; display: grid; align-content: end; min-height: 168px; margin-top: var(--size-100); padding: var(--size-300); overflow: hidden; border-radius: var(--border-radius-600); background: linear-gradient(to bottom right, #fdf2f8, rgb(255 255 255 / 0.5), #a7f3d0), #bfdbfe; box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-text-500) 10%, transparent); color: var(--color-text-500); text-decoration: none;'
        >
            <span style='position: absolute; inset: var(--size-500) var(--size-600) 40% var(--size-600); border-radius: var(--border-radius-600) var(--border-radius-600) 0 0; background: var(--color-white-400); box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.25), 0 0 0 1px color-mix(in srgb, var(--color-text-500) 10%, transparent); mask-image: linear-gradient(to bottom, black 35%, transparent);'></span>
            <span style='position: relative; font-size: 0.875rem; font-weight: var(--font-weight-500);'>Multimodal Learning</span>
            <span style='position: relative; overflow: hidden; color: var(--color-text-300); font-size: 0.75rem; text-overflow: ellipsis; white-space: nowrap;'>
                Explore how our platform integrates text, image, and audio processing into a unified framework.
            </span>
        </a>
    `;
}

function demo(size: string) {
    let stop: VoidFunction | undefined;

    return html`
        <div
            style='${stage} ${size}'
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
            ${header(
                {
                    brand: {
                        content: html`
                            <span style='${mark}'>
                                <svg aria-hidden='true' fill='none' height='14' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24' width='14'>
                                    <path d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' />
                                </svg>
                            </span>
                            <span style='font-weight: var(--font-weight-600);'>esportsplus</span>
                        `
                    },
                    options: [
                        {
                            content: 'Product',
                            sections: [
                                {
                                    links: [
                                        { content: 'AI', description: 'Generate Insights and Recommendations', href: '#ai', icon: icons.sparkles('#22c55e') },
                                        { content: 'Performance', description: 'Lightning-fast load times', href: '#performance', icon: icons.activity('#6366f1') },
                                        { content: 'Security', description: 'Keep your data safe and secure', href: '#security', icon: icons.shield('#3b82f6') }
                                    ],
                                    title: 'Features'
                                },
                                {
                                    columns: 2,
                                    links: [
                                        { content: 'Automation', description: 'Automate your workflow', href: '#automation', icon: icons.bot('#eab308') },
                                        { content: 'Scalability', description: 'Scale your application', href: '#scalability', icon: icons.rocket('#f97316') },
                                        { content: 'Backup', description: 'Keep your data backed up', href: '#backup', icon: icons.cloud('#14b8a6') },
                                        { content: 'Security', description: 'Keep your data safe and secure', href: '#security', icon: icons.shield('#3b82f6') },
                                        { content: 'Partnerships', description: 'Get help when you need it', href: '#partnerships', icon: icons.gem('#ec4899') },
                                        { content: 'Mobile App', description: 'Get help when you need it', href: '#mobile', icon: icons.smartphone('#71717a') }
                                    ],
                                    title: 'More Features'
                                },
                                {
                                    content: changelog(),
                                    title: 'Changelog'
                                }
                            ]
                        },
                        {
                            content: 'Solutions',
                            sections: [
                                {
                                    columns: 2,
                                    links: [
                                        { content: 'Marketplace', description: 'Find and buy AI tools', href: '#marketplace', icon: icons.bag('#10b981') },
                                        { content: 'API Integration', description: 'Integrate AI tools into your app', href: '#api', icon: icons.cpu('#3b82f6') },
                                        { content: 'Partnerships', description: 'Get help when you need it', href: '#partnerships', icon: icons.gem('#ec4899') },
                                        { content: 'Mobile App', description: 'Get help when you need it', href: '#mobile', icon: icons.smartphone('#71717a') }
                                    ],
                                    title: 'Use Cases'
                                },
                                {
                                    links: [
                                        { content: 'Announcements', href: '#announcements', icon: icons.book('#a855f7') },
                                        { content: 'Resources', href: '#resources', icon: icons.croissant('#ef4444') },
                                        { content: 'Blog', href: '#blog', icon: icons.notebook('#71717a') }
                                    ],
                                    title: 'Content'
                                }
                            ]
                        },
                        { content: 'Pricing', href: '#pricing' },
                        { content: 'Company', href: '#company' }
                    ],
                    style: '--screen: 32rem;'
                },
                html`
                    <a
                        class='button --background-white --border-border --color-text'
                        href='#login'
                        style='${action} --border-width: var(--border-width-400); border: var(--border-width) solid var(--border-color);'
                    >
                        Login
                    </a>
                    <a class='button --background-black --color-white' href='#start' style='${action}'>
                        Get Started
                    </a>
                `
            )}

            <div style='max-width: 48rem; margin: 0 auto; padding: 128px var(--size-600) 64rem; text-align: center;'>
                <h2>Hover Product or Solutions.</h2>
                <div class='text' style='margin-top: var(--size-400); --color-default: var(--color-text-300);'>
                    Scroll to frost the bar; the mega-menu grows the header to fit each panel.
                </div>
            </div>
        </div>
    `;
}


function tinted(tint: string, svg: Renderable<unknown>) {
    return html`<span style='display: contents; --tint: ${tint};'>${svg}</span>`;
}

export default {
    name: 'header',
    variants: [
        {
            // The header queries its own width, so render wide and scale down to show the desktop layout.
            render: () => demo('width: 200%; zoom: 0.5;'),
            title: 'desktop'
        },
        {
            render: () => demo('max-width: 390px;'),
            title: 'mobile menu'
        }
    ]
};
