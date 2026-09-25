import { html } from '@esportsplus/template';
import { featureSpotlight } from '@esportsplus/ui';
import type { Feature } from '~/components/feature-spotlight';
import './feature-spotlight.scss';


let features: Feature[] = [
        {
            body: 'Revenue, churn and payouts update the moment a charge settles, so the morning check takes one glance.',
            spot: 'metrics',
            title: 'Your numbers before your coffee'
        },
        {
            body: 'Ninety days of revenue on one line, with the dip on the 14th called out before anyone has to ask.',
            spot: 'revenue',
            title: 'Trends you can actually read'
        },
        {
            body: 'Each transfer lists the customer, the fees taken and when it lands, ready to reconcile in two clicks.',
            spot: 'payouts',
            title: 'Every payout, itemized'
        },
        {
            body: 'Run the parent company and both subsidiaries from one login, with books that never mix.',
            spot: 'workspaces',
            title: 'A workspace for every entity'
        }
    ],
    // Plotted as data, not decoration: a 90 day revenue series.
    points = [40, 44, 43, 48, 52, 50, 56, 58, 55, 38, 46, 57, 62, 60, 66, 70, 68, 74, 78, 76, 82, 88],
    size = { height: 440, width: 640 };


// The demo's product: a finance dashboard built at 640 x 440 design pixels with real type sizes, then shown
// scaled down like a screenshot.
function dashboard() {
    let h = 96,
        w = 430,
        step = w / (points.length - 1),
        y = (v: number) => h - ((v - 30) / 60) * h,
        line = points.map((v, i) => `${i ? 'L' : 'M'}${(i * step).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

    return html`
        <div class='feature-spotlight-demo-dashboard'>
            <aside class='feature-spotlight-demo-aside'>
                <div class='feature-spotlight-demo-workspaces' data-spot='workspaces'>
                    <div class='feature-spotlight-demo-switcher'>
                        <span class='feature-spotlight-demo-logo'>A</span>
                        <span class='feature-spotlight-demo-grow'>Acme Inc</span>
                        <svg fill='none' stroke='currentColor' stroke-width='1.5' viewBox='0 0 16 16'>
                            <path d='M5 6.5 8 3.5l3 3M5 9.5l3 3 3-3' />
                        </svg>
                    </div>
                    <p class='feature-spotlight-demo-caption'>Workspaces</p>
                    ${['Acme Europe', 'Acme Labs', 'Add entity'].map((name, i) => html`
                        <div class='feature-spotlight-demo-entity'>
                            <span class='feature-spotlight-demo-swatch ${i === 2 && 'feature-spotlight-demo-swatch--add'}'></span>
                            <span>${name}</span>
                        </div>
                    `)}
                </div>
                <div class='feature-spotlight-demo-rule'></div>
                ${['Overview', 'Payouts', 'Customers', 'Reports'].map((name, i) => html`
                    <div class='feature-spotlight-demo-nav ${i === 0 && '--active'}'>${name}</div>
                `)}
            </aside>

            <div class='feature-spotlight-demo-main'>
                <div class='feature-spotlight-demo-heading'>
                    <p>Overview</p>
                    <span>Last 90 days</span>
                </div>
                <div class='feature-spotlight-demo-metrics' data-spot='metrics'>
                    ${[['MRR', '$48.2k', '+4.1%'], ['Churn', '1.8%', '−0.3%'], ['Next payout', '$12.9k', 'Fri']].map(([label, value, delta]) => html`
                        <div class='feature-spotlight-demo-metric'>
                            <span class='feature-spotlight-demo-muted'>${label}</span>
                            <span class='feature-spotlight-demo-metric-row'>
                                <span class='feature-spotlight-demo-value'>${value}</span>
                                <span class='feature-spotlight-demo-muted'>${delta}</span>
                            </span>
                        </div>
                    `)}
                </div>
                <div class='feature-spotlight-demo-revenue' data-spot='revenue'>
                    <div class='feature-spotlight-demo-metric-row'>
                        <span class='feature-spotlight-demo-muted'>Revenue</span>
                        <span class='feature-spotlight-demo-muted'>Dip on Aug 14: failed card retries</span>
                    </div>
                    <svg class='feature-spotlight-demo-chart' preserveAspectRatio='none' viewBox='0 0 430 96'>
                        <path class='feature-spotlight-demo-area' d='${`${line} L${w} ${h} L0 ${h} Z`}' />
                        <path class='feature-spotlight-demo-line' d='${line}' fill='none' stroke-linejoin='round' stroke-width='2' vector-effect='non-scaling-stroke' />
                        <circle class='feature-spotlight-demo-marker' cx='${9 * step}' cy='${y(38)}' r='4' stroke-width='2' />
                    </svg>
                </div>
                <div class='feature-spotlight-demo-payouts' data-spot='payouts'>
                    ${[['Northwind Traders', 'Lands Fri', '$6,420.00'], ['Globex Retail', 'Lands Mon', '$4,180.50'], ['Initech', 'Settled', '$2,315.00']].map(([name, when, amount]) => html`
                        <div class='feature-spotlight-demo-payout'>
                            <span class='feature-spotlight-demo-grow'>${name}</span>
                            <span class='feature-spotlight-demo-when'>${when}</span>
                            <span class='feature-spotlight-demo-amount'>${amount}</span>
                        </div>
                    `)}
                </div>
            </div>
        </div>
    `;
}


export default {
    name: 'feature-spotlight',
    variants: [
        {
            // A scrolling page mock, so the section works inside the docs; on a real page the window drives it.
            render: () => html`
                <div class='feature-spotlight-demo'>
                    <header class='feature-spotlight-demo-header'>
                        <p class='feature-spotlight-demo-eyebrow'>Ledgerly for finance teams</p>
                        <h2 class='feature-spotlight-demo-headline'>Everything you check before the first meeting</h2>
                        <p class='feature-spotlight-demo-lede'>
                            Scroll through the four things teams open Ledgerly for. The screenshot follows along.
                        </p>
                    </header>
                    ${featureSpotlight({ features, screenshot: dashboard(), size })}
                    <footer class='feature-spotlight-demo-footer'>
                        <p class='feature-spotlight-demo-cta'>Start a 14 day trial</p>
                        <p class='feature-spotlight-demo-muted'>No card needed. Import last year's books in minutes.</p>
                    </footer>
                </div>
            `,
            title: 'scroll-driven camera'
        }
    ]
};
