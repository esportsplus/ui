import { html } from '@esportsplus/template';
import { gradientText } from '@esportsplus/ui';
import './gradient-text.scss';


export default {
    name: 'gradient-text',
    variants: [
        {
            render: () => html`
                <a class='gradient-text-demo-pill' href='#gradient-text'>
                    <span aria-hidden='true' class='gradient-text-demo-ring'></span>
                    🎉
                    <hr class='gradient-text-demo-divider' />
                    ${gradientText({ class: 'gradient-text-demo-label' }, 'Introducing Magic UI')}
                    <svg aria-hidden='true' class='gradient-text-demo-chevron' fill='none' stroke='currentColor' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' viewBox='0 0 24 24'>
                        <path d='m9 18 6-6-6-6' />
                    </svg>
                </a>
            `,
            title: 'announcement pill'
        },
        {
            render: () => html`
                <p class='gradient-text-demo-headline'>
                    ${gradientText({ from: '#4ade80', speed: 2, to: '#06b6d4' }, 'Fast Gradient')}
                </p>
            `,
            title: 'custom colors, speed 2'
        }
    ]
};
