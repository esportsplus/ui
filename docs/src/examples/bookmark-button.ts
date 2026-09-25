import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { bookmarkButton } from '@esportsplus/ui';
import './bookmark-button.scss';


export default {
    name: 'bookmark-button',
    variants: [
        {
            render: () => html`
                <div class='bookmark-button-demo'>
                    <article class='bookmark-button-demo-card'>
                        <p class='bookmark-button-demo-kicker'>Essay</p>
                        <h3 class='bookmark-button-demo-title'>Notes on interruptible motion</h3>
                        <p class='bookmark-button-demo-text'>
                            Why a transition that can change its mind halfway feels faster than one that always runs to the end.
                        </p>
                        <div class='bookmark-button-demo-footer'>
                            <span class='bookmark-button-demo-text'>6 min read</span>
                            ${bookmarkButton({ class: 'bookmark-button--white', count: 127 })}
                        </div>
                    </article>
                    ${bookmarkButton()}
                </div>
            `,
            title: 'article'
        },
        {
            render: () => {
                let state = reactive({ saved: true });

                return html`
                    <div class='bookmark-button-demo bookmark-button-demo--row'>
                        ${bookmarkButton({ label: 'Bookmark', savedLabel: 'Bookmarked', state })}
                        <span class='bookmark-button-demo-text'>${() => state.saved ? 'In your reading list' : 'Not saved'}</span>
                    </div>
                `;
            },
            title: 'controlled state'
        }
    ]
};
