import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { storyProgress } from '@esportsplus/ui';


let stories = [
    { caption: 'People tried the lab this week.', value: '12k' },
    { caption: 'Average rating across every component.', value: '4.8' },
    { caption: 'Fewer layout shifts since the last release.', value: '38%' },
    { caption: 'Commits that were only about easing curves.', value: '212' },
    { caption: 'Components that animate from scale zero.', value: '0' }
];


export default {
    name: 'story-progress',
    variants: [
        {
            render: () => storyProgress({ stories }),
            title: 'stories'
        },
        {
            render: () => {
                let state = reactive({ index: 2, paused: true });

                return html`
                    <div style='align-items: center; display: flex; flex-direction: column; gap: var(--size-400);'>
                        ${storyProgress({ duration: 2000, label: 'Quick stories', state, stories })}
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
