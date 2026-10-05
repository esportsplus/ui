import { batch, computed, reactive, read } from '@esportsplus/reactivity';
import { html, type Attributes } from '@esportsplus/template';
import { observeSize } from '~/shared/resize';
import tooltip from '~/components/tooltip';
import './scss/index.scss';


type Incident = {
    // Days before today: 0 is today.
    daysAgo: number;
    level: 'degraded' | 'outage';
    minutes: number;
    title: string;
};

type Service = {
    incidents: Incident[];
    name: string;
};


const COMPACT_WIDTH = 400;

const DAY_MINUTES = 1440;

const DAYS = 60;

const DAYS_COMPACT = 30;

// Caption keys: a day index names an incident, HEALTHY any clean day, IDLE no day selected.
const HEALTHY = -1;

const IDLE = -2;

const STATUS = {
    degraded: 'Degraded',
    operational: 'Operational',
    outage: 'Outage'
};


function ago(day: number) {
    if (day === 0) {
        return 'Today';
    }

    if (day === 1) {
        return 'Yesterday';
    }

    return `${day} days ago`;
}

function describe(incident: Incident) {
    let minutes = incident.minutes;

    return `${incident.title}, ${minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}`;
}

function find(service: Service, day: number) {
    return service.incidents.find((incident) => incident.daysAgo === day);
}

function percentage(service: Service, days: number) {
    let down = 0,
        incidents = service.incidents;

    for (let i = 0, n = incidents.length; i < n; i++) {
        let incident = incidents[i];

        if (incident.daysAgo >= days) {
            continue;
        }

        // Degraded counts at a third: slow isn't down, but it isn't fine.
        down += incident.level === 'outage' ? incident.minutes : incident.minutes / 3;
    }

    return (100 * (1 - down / (days * DAY_MINUTES))).toFixed(2);
}


const uptime = ({ services, state: api = reactive({ day: -1, row: -1 }), ...attributes }: Attributes & {
    services: Service[];
    state?: { day: number; row: number };
}) => {
    let layout = reactive({ days: DAYS }),
        // A narrow container gets half the history so every day stays a real, tappable bar.
        size = observeSize(({ width }) => {
            layout.days = width < COMPACT_WIDTH ? DAYS_COMPACT : DAYS;
        });

    function bars(day: () => number, service: Service) {
        let days = layout.days,
            render = [];

        for (let i = 0; i < days; i++) {
            let value = days - 1 - i,
                incident = find(service, value);

            render.push(html`
                <span class='uptime-bar ${incident && `uptime-bar--${incident.level}`} ${() => day() === value && '--active'}'></span>
            `);
        }

        return render;
    }

    function clear() {
        select(-1, -1);
    }

    function message(service: Service, key: number) {
        if (key === IDLE) {
            return '';
        }

        let incident = key === HEALTHY ? undefined : find(service, key);

        if (!incident) {
            return html`<span class='uptime-service-message uptime-service-message--ok'>No downtime</span>`;
        }

        return html`
            <span class='uptime-service-message uptime-service-message--active uptime-service-message--${incident.level}'>
                ${describe(incident)}
            </span>
        `;
    }

    function row(service: Service, index: number) {
        let day = computed(() => api.row === index ? api.day : -1),
            caption = computed(() => {
                let value = read(day);

                if (value === -1) {
                    return IDLE;
                }

                return find(service, value) ? value : HEALTHY;
            }),
            status: keyof typeof STATUS = find(service, 0)?.level ?? 'operational';

        return html`
            <div class='uptime-service'>
                <div class='uptime-service-header'>
                    <span class='uptime-service-name'>
                        <span class='uptime-service-label'>${service.name}</span>

                        ${tooltip.onhover(
                            { class: `uptime-service-status uptime-service-status--${status}` },
                            html`
                                <span aria-hidden='true' class='uptime-service-tooltip tooltip-message tooltip-message--e tooltip-message--morph'>
                                    ${STATUS[status]}
                                </span>
                            `
                        )}
                    </span>

                    <span class='uptime-service-caption'>
                        ${() => {
                            let value = read(day);

                            return value !== -1 && html`<span class='uptime-service-day'>${ago(value)}</span>`;
                        }}
                        ${() => message(service, read(caption))}
                    </span>
                </div>

                <div
                    aria-label='${() => `${service.name}: ${STATUS[status]}, ${percentage(service, layout.days)}% uptime over ${layout.days} days. Arrow keys step through days.`}'
                    class='uptime-bars ${() => api.row === index && '--active'}'
                    role='group'
                    style='${() => `--days: ${layout.days}`}'
                    tabindex='0'
                    ${{
                        onblur: clear,
                        onfocus: () => {
                            if (api.row !== index) {
                                select(index, 0);
                            }
                        },
                        onkeydown: (e: KeyboardEvent) => {
                            let days = layout.days,
                                step = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0;

                            if (e.key === 'End') {
                                e.preventDefault();
                                select(index, 0);
                            }
                            else if (e.key === 'Escape') {
                                clear();
                            }
                            else if (e.key === 'Home') {
                                e.preventDefault();
                                select(index, days - 1);
                            }
                            else if (step) {
                                e.preventDefault();
                                select(index, Math.min(days - 1, Math.max(0, (api.row === index ? api.day : 0) + step)));
                            }
                        },
                        onpointerleave: clear,
                        onpointermove: (e: PointerEvent) => {
                            let days = layout.days,
                                element = e.currentTarget as HTMLElement,
                                rect = element.getBoundingClientRect(),
                                width = element.offsetWidth,
                                // Divides out any CSS scale so the maths holds inside a scaled container.
                                x = (e.clientX - rect.left) / (rect.width / width || 1);

                            select(index, days - 1 - Math.min(days - 1, Math.max(0, Math.floor((x / width) * days))));
                        }
                    }}
                >
                    ${() => bars(() => read(day), service)}
                </div>

                <div class='uptime-service-axis'>
                    <span>${() => layout.days} days ago</span>
                    <span class='uptime-service-percentage'>${() => percentage(service, layout.days)}% uptime</span>
                    <span>Today</span>
                </div>
            </div>
        `;
    }

    function select(row: number, day: number) {
        if (api.day === day && api.row === row) {
            return;
        }

        batch(() => {
            api.day = day;
            api.row = row;
        });
    }

    return html`
        <div
            class='uptime'
            ${attributes}
            ${size}
        >
            ${services.map(row)}

            <p aria-live='polite' class='uptime-live'>
                ${() => {
                    let service = services[api.row];

                    if (!service) {
                        return '';
                    }

                    let incident = find(service, api.day);

                    return `${service.name}, ${ago(api.day)}: ${incident ? describe(incident) : 'no downtime'}`;
                }}
            </p>
        </div>
    `;
};


export default uptime;
export type { Incident, Service };
