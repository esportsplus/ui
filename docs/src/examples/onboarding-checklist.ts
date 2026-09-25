import { reactive } from '@esportsplus/reactivity';
import { html } from '@esportsplus/template';
import { onboardingChecklist } from '@esportsplus/ui';
import './onboarding-checklist.scss';


let tasks = [
    {
        action: 'New project',
        description: 'Projects keep pages, settings and people together in one place.',
        id: 'project',
        title: 'Create your first project'
    },
    {
        action: 'Send invite',
        description: 'Work goes faster together. Each teammate gets their own login.',
        id: 'invite',
        title: 'Invite a teammate'
    },
    {
        action: 'Connect',
        description: 'Link a repository so commits and pull requests show up here.',
        id: 'github',
        title: 'Connect GitHub'
    },
    {
        action: 'Choose channels',
        description: 'Choose where you hear about mentions and reviews: email, desktop or both.',
        id: 'notifications',
        title: 'Set up notifications'
    },
    {
        action: 'Open settings',
        description: 'Add a logo and a name so the space feels like yours.',
        id: 'workspace',
        title: 'Personalize your workspace'
    }
];


export default {
    name: 'onboarding-checklist',
    variants: [
        {
            render: () => {
                let card: HTMLElement | undefined,
                    demo = reactive({ dismissed: false, round: 0 });

                return html`
                    <div class='onboarding-checklist-demo'>
                        ${() => {
                            if (demo.dismissed) {
                                return html`
                                    <button
                                        class='button onboarding-checklist-demo-restore'
                                        type='button'
                                        ${{
                                            onclick: () => {
                                                demo.round++;
                                                demo.dismissed = false;
                                            },
                                            onconnect: (element: HTMLElement) => element.focus()
                                        }}
                                    >
                                        Show checklist again
                                    </button>
                                `;
                            }

                            return html`
                                <div
                                    class='onboarding-checklist-demo-card'
                                    data-round='${demo.round}'
                                    ${{
                                        onrender: (element: HTMLElement) => {
                                            card = element;
                                        }
                                    }}
                                >
                                    ${onboardingChecklist({
                                        done: ['project'],
                                        ondismiss: () => {
                                            if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) {
                                                demo.dismissed = true;
                                                return;
                                            }

                                            // Leaves faster and smaller than it arrives.
                                            card.animate(
                                                { filter: ['none', 'blur(2px)'], opacity: [1, 0], transform: ['none', 'translateY(-4px) scale(0.98)'] },
                                                { duration: 150, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'forwards' }
                                            ).onfinish = () => {
                                                demo.dismissed = true;
                                            };
                                        },
                                        open: ['invite'],
                                        tasks
                                    })}
                                </div>
                            `;
                        }}
                    </div>
                `;
            },
            title: 'get started'
        },
        {
            render: () => onboardingChecklist({ done: ['project', 'invite', 'github', 'notifications'], tasks }),
            title: 'one task left'
        },
        {
            render: () => onboardingChecklist({
                style: '--accent: var(--color-blue-400); --background: var(--color-white-300);',
                tasks: tasks.slice(0, 3)
            }),
            title: 'custom accent'
        }
    ]
};
