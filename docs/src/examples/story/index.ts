import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { story } from '@esportsplus/ui/components';
import '~/examples/story/scss/index.scss';


const STATS = [
    { caption: 'People tried the lab this week.', value: '12k' },
    { caption: 'Average rating across every component.', value: '4.8' },
    { caption: 'Fewer layout shifts since the last release.', value: '38%' },
    { caption: 'Commits that were only about easing curves.', value: '212' },
    { caption: 'Components that animate from scale zero.', value: '0' }
];


function stat({ caption, value }: typeof STATS[number]) {
    return html`
        <div class='story-demo'>
            <span class='story-demo-value'>${value}</span>
            <span class='story-demo-caption'>${caption}</span>
        </div>
    `;
}


export default {
    name: 'story',
    variants: [
        {
            render: () => story({ stories: STATS.map(stat) }),
            title: 'stories'
        },
        {
            render: () => story({
                label: 'Mixed stories',
                stories: [
                    stat(STATS[0]),
                    html`
                        <div class='story-demo story-demo--gradient'>
                            <span class='story-demo-caption'>Any content renders inside a story.</span>
                        </div>
                    `,
                    html`
                        <div class='story-demo'>
                            <span class='story-demo-caption'>Controls inside a story keep their own clicks.</span>
                            <div class='button button--tertiary' role='button' style='--width: auto;' tabindex='0'>
                                a button
                            </div>
                        </div>
                    `
                ]
            }),
            title: 'any content'
        },
        {
            render: () => {
                let state = reactive({ index: 2, paused: true });

                return html`
                    <div style='align-items: center; display: flex; flex-direction: column; gap: var(--size-400);'>
                        ${story({ duration: 2000, label: 'Quick stories', state, stories: STATS.map(stat) })}
                        <div style='display: flex; gap: var(--size-300);'>
                            <div class='button button--tertiary' style='--width: auto;' onclick='${() => state.paused = !state.paused}'>
                                ${() => state.paused ? 'play' : 'pause'}
                            </div>
                            <div class='button button--tertiary' style='--width: auto;' onclick='${() => state.index = 0}'>
                                first story
                            </div>
                        </div>
                    </div>
                `;
            },
            title: 'controlled, 2s per story'
        }
    ]
};
