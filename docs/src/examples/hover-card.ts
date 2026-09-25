import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { hoverCard } from '@esportsplus/ui';
import type { Group } from '~/components/hover-card';
import ava from './hover-card/ava.svg?url';
import ben from './hover-card/ben.svg?url';
import cara from './hover-card/cara.svg?url';
import './hover-card.scss';


type Profile = {
    avatar: string;
    bio: string;
    followers: number;
    following: number;
    handle: string;
    name: string;
};


let people: Record<'ava' | 'ben' | 'cara', Profile> = {
    ava: {
        avatar: ava,
        bio: 'Design engineer. Writes about springs, gestures and the details nobody notices.',
        followers: 12840,
        following: 312,
        handle: '@ava',
        name: 'Ava Chen'
    },
    ben: {
        avatar: ben,
        bio: 'Builds input systems. Currently teaching trackpads to feel like glass.',
        followers: 4096,
        following: 188,
        handle: '@ben',
        name: 'Ben Ortiz'
    },
    cara: {
        avatar: cara,
        bio: 'Docs and developer experience. If it needs a paragraph, it needs a better API.',
        followers: 2731,
        following: 540,
        handle: '@cara',
        name: 'Cara Nwosu'
    }
};


function mention(profile: Profile, group?: Group, variant = '') {
    let state = reactive({ following: false });

    return hoverCard(
        {
            card: html`
                <span class='hover-card-demo-top'>
                    <span class='hover-card-demo-avatar'>
                        <img alt='' src='${profile.avatar}' />
                    </span>
                    <button
                        aria-label='Follow ${profile.name}'
                        class='hover-card-demo-follow ${() => state.following && '--active'}'
                        type='button'
                        ${{
                            'aria-pressed': () => state.following ? 'true' : 'false',
                            onclick: () => {
                                state.following = !state.following;
                            }
                        }}
                    >
                        <span>Follow</span>
                        <span aria-hidden='true'>Following</span>
                    </button>
                </span>
                <span class='hover-card-demo-name'>${profile.name}</span>
                <span class='hover-card-demo-handle'>${profile.handle}</span>
                <span class='hover-card-demo-bio'>${profile.bio}</span>
                <span class='hover-card-demo-stats'>
                    <span>
                        <strong>${() => (profile.followers + (state.following ? 1 : 0)).toLocaleString('en-US')}</strong>
                        followers
                    </span>
                    <span>
                        <strong>${profile.following.toLocaleString('en-US')}</strong>
                        following
                    </span>
                </span>
            `,
            class: variant,
            group,
            label: `${profile.name}, ${profile.handle}`
        },
        profile.handle
    );
}


export default {
    name: 'hover-card',
    variants: [
        {
            render: () => {
                let group = hoverCard.group();

                return html`
                    <p class='hover-card-demo'>
                        Last week ${mention(people.ava, group)} shipped the new motion guidelines,
                        ${mention(people.ben, group)} rebuilt the gesture system on top of them, and
                        ${mention(people.cara, group)} is already writing the docs.
                        <span class='hover-card-demo-hint'>Hover a name to meet them.</span>
                    </p>
                `;
            },
            title: 'shared group (cards travel between names)'
        },
        {
            render: () => html`
                <p class='hover-card-demo'>
                    Independent cards, fade only: ${mention(people.ava, undefined, 'hover-card--fade')} and
                    ${mention(people.cara, undefined, 'hover-card--fade')} each wait out their own delay.
                </p>
            `,
            title: 'independent + fade'
        }
    ]
};
