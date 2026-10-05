// One turn is a question and its answer. The minimap shows the title, and the answer as the card's description.
type Exchange = {
    description: string;
    question: string;
    title: string;
};


const CONVERSATION: Exchange[] = [
    {
        description: 'Start with the sticky-header spacing. The jump comes from the header switching to position: fixed, which takes it out of the flow, so everything below it moves up by its height. Reserve the space with a wrapper of the same height, or switch to position: sticky, which keeps its slot.',
        question: 'Our page jumps by about 60px whenever the header becomes sticky on scroll. What causes that?',
        title: 'Why does the page jump on scroll?'
    },
    {
        description: 'Sticky works as long as no ancestor clips overflow. The usual culprit is an overflow: hidden on a layout wrapper to stop horizontal scroll; overflow: clip does the same job without creating a scroll container, so sticky keeps working.',
        question: 'I switched to position: sticky but now it does not stick at all.',
        title: 'Sticky header not sticking'
    },
    {
        description: 'Use the header height as a custom property and read it from scroll-padding-top on the root. Anchor links and scrollIntoView then stop short of the header instead of sliding under it.',
        question: 'Anchor links now scroll the heading under the header. Can I offset them?',
        title: 'Offset anchor links below the header'
    },
    {
        description: 'Measure it once with a ResizeObserver on the header and write the height to the custom property. That covers the mobile menu opening, font loading and any banner above it, without listening to scroll at all.',
        question: 'The header height changes on mobile when the menu wraps. How do I keep the offset right?',
        title: 'Keep the offset in sync on mobile'
    },
    {
        description: 'Yes: give the header a transition on translate and hide it by translating it up by its own height while scrolling down, then back on the way up. Compare scroll positions in a requestAnimationFrame callback rather than on every scroll event.',
        question: 'Could the header hide while scrolling down and come back when scrolling up?',
        title: 'Hide the header on scroll down'
    },
    {
        description: 'Ignore small movements. Track a running delta and only flip direction once it passes a threshold of around 8px; trackpads report tiny reversals that otherwise make the header twitch.',
        question: 'It flickers on trackpads when I scroll slowly.',
        title: 'Stop the flicker on trackpads'
    },
    {
        description: 'Respect prefers-reduced-motion: keep the header always visible there, and drop the translate transition. The hide is a convenience, not information, so nothing is lost.',
        question: 'Anything to watch out for accessibility-wise?',
        title: 'Reduced motion and the hiding header'
    },
    {
        description: 'A fixed or sticky header covers the top of the viewport, so focused elements can end up hidden behind it. scroll-padding-top fixes keyboard focus scrolling too, which makes it the right place for the offset.',
        question: 'Tabbing through the page sometimes focuses links hidden behind the header.',
        title: 'Focused links hidden under the header'
    },
    {
        description: 'Here is the final version: a sticky header with overflow: clip on the wrapper, its height in --header-height from a ResizeObserver, scroll-padding-top on the root, and the hide-on-scroll gated behind prefers-reduced-motion.',
        question: 'Can you put it all together?',
        title: 'Putting it all together'
    }
];

const FOLLOW_UPS: Exchange[] = [
    {
        description: 'Put the observer in a small module that writes --header-height and returns a cleanup function, then call it from the layout. Tests can then mount the header alone and assert the property.',
        question: 'How would you structure that so it is testable?',
        title: 'Make the header logic testable'
    },
    {
        description: 'Only if the header changes height while sticking. A shadow or border that fades in when stuck can use a scroll-driven animation instead, with no script at all.',
        question: 'Do I still need JavaScript for a shadow when it sticks?',
        title: 'A shadow once the header sticks'
    },
    {
        description: 'Drop the hide-on-scroll on short pages: if the document is less than two viewports tall, there is nothing to reclaim and the motion only distracts.',
        question: 'Should short pages hide the header too?',
        title: 'Skip hiding on short pages'
    }
];

const TOPICS = [
    'Set up the repository',
    'Pick a router',
    'Lay out the routes',
    'Load data per route',
    'Handle loading states',
    'Add error boundaries',
    'Share layout between routes',
    'Model the database schema',
    'Write the first migration',
    'Seed development data',
    'Add an ORM',
    'Validate input on the server',
    'Return typed errors',
    'Add sessions',
    'Hash passwords',
    'Rate-limit sign in',
    'Send verification email',
    'Reset forgotten passwords',
    'Protect routes',
    'Add roles',
    'Build the settings page',
    'Upload avatars',
    'Resize images on upload',
    'Store files in object storage',
    'Generate signed URLs',
    'Paginate the activity feed',
    'Switch to cursor pagination',
    'Add full-text search',
    'Rank search results',
    'Highlight matches',
    'Cache hot queries',
    'Invalidate the cache',
    'Add background jobs',
    'Retry failed jobs',
    'Schedule a nightly digest',
    'Write integration tests',
    'Mock the email provider',
    'Run tests in CI',
    'Cache dependencies in CI',
    'Preview deploys per branch',
    'Add structured logging',
    'Trace slow requests',
    'Set up error alerts',
    'Add feature flags',
    'Roll out gradually',
    'Measure web vitals',
    'Lazy-load heavy routes',
    'Audit bundle size',
    'Write the launch checklist',
    'Ship it'
];


const long = () => TOPICS.map((title, i) => ({
    description: `Step ${i + 1} of ${TOPICS.length} in building the app: ${title.toLowerCase()}, and what to check before moving on.`,
    title
}));

const turns = () => CONVERSATION.map(({ description, title }) => ({ description, title }));


export { CONVERSATION, FOLLOW_UPS, long, turns };
export type { Exchange };
