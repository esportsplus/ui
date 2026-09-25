import { component, html, type Attributes, type Renderable } from '@esportsplus/template';
import { reactive } from '@esportsplus/reactivity';
import './scss/index.scss';


type A = Attributes & {
    [ANNOUNCEMENT_BANNER_CONTENT]?: Attributes;
    [ANNOUNCEMENT_BANNER_DISMISS]?: Attributes;
    icon?: Renderable<unknown>;
    label?: string;
    link?: { href: string, label: string };
    ondismiss?: () => void;
    state?: State;
};

type State = { open: boolean };


const ANNOUNCEMENT_BANNER_CONTENT = Symbol.for('@esportsplus/ui/announcement-banner.content');

const ANNOUNCEMENT_BANNER_DISMISS = Symbol.for('@esportsplus/ui/announcement-banner.dismiss');


export default Object.assign(
    component<A>(function(this, { icon, label = 'Announcement', link, ondismiss, state = reactive({ open: true }), ...attributes }, content) {
        let opened = false,
            returning = false;

        return html`
            <div
                class='announcement-banner'
                ${this?.attributes}
                ${attributes}
                ${{
                    class: () => {
                        if (state.open) {
                            opened = true;
                        }
                        else if (opened) {
                            // After a dismissal, showing again reverses it instead of sliding in.
                            returning = true;
                        }

                        return `${state.open ? '--active' : ''} ${returning ? 'announcement-banner--returning' : ''}`;
                    }
                }}
            >
                <div class='announcement-banner-clip'>
                    <section
                        aria-label='${label}'
                        class='announcement-banner-content'
                        tabindex='-1'
                        ${{ inert: () => !state.open }}
                        ${this?.attributes?.[ANNOUNCEMENT_BANNER_CONTENT]}
                        ${attributes[ANNOUNCEMENT_BANNER_CONTENT]}
                    >
                        ${icon && html`<span aria-hidden='true' class='announcement-banner-icon'>${icon}</span>`}
                        <p class='announcement-banner-text'>${content}</p>
                        ${link && html`<a class='announcement-banner-link' href='${link.href}'>${link.label}</a>`}
                        <button
                            aria-label='Dismiss announcement'
                            class='button announcement-banner-dismiss'
                            type='button'
                            onclick=${() => {
                                state.open = false;
                                ondismiss?.();
                            }}
                            ${this?.attributes?.[ANNOUNCEMENT_BANNER_DISMISS]}
                            ${attributes[ANNOUNCEMENT_BANNER_DISMISS]}
                        >
                            <svg viewBox='0 0 16 16'>
                                <path d='m4.5 4.5 7 7M11.5 4.5l-7 7' />
                            </svg>
                        </button>
                    </section>
                </div>
            </div>
        `;
    }),
    { content: ANNOUNCEMENT_BANNER_CONTENT, dismiss: ANNOUNCEMENT_BANNER_DISMISS } as const
);
