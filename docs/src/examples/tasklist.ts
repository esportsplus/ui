import { tasklist } from '@esportsplus/ui';


// Opaque rows so a row sliding past its neighbours covers them instead of overlapping their text
let style = `
        --background: var(--color-white-400);
        max-width: 360px;
        width: 100%;
    `;


export default {
    name: 'tasklist',
    variants: [
        {
            render: () => tasklist({
                style,
                tasks: [
                    { checked: true, label: 'Ship the changelog' },
                    { label: 'Record a preview for the gallery' },
                    { description: 'Blocks the Friday release', label: 'Review the pull request' },
                    { label: 'Update the component docs with the new animation timings and examples' }
                ]
            }),
            title: 'default'
        },
        {
            render: () => tasklist({
                class: 'tasklist--plan',
                reorder: false,
                style,
                tasks: [
                    { checked: true, description: 'query_lane_performance on RTM→FXT', label: 'Pull week-28 lane performance' },
                    { checked: true, description: 'search_incidents, 13–20 July', label: 'Cross-check incidents at Rotterdam' },
                    { checked: true, description: 'compare_to_sla for Meridian Lines', label: 'Compare observed transit to the SLA' },
                    { checked: true, description: 'Held for your approval before sending', label: 'Draft the carrier notice' }
                ]
            }),
            title: 'plan'
        },
        {
            render: () => tasklist({
                class: 'tasklist--plan',
                reorder: false,
                style,
                tasks: [
                    { checked: true, label: 'Pull week-28 lane performance' },
                    { label: 'Cross-check incidents at Rotterdam' },
                    { checked: true, label: 'Compare observed transit to the SLA' },
                    { checked: true, label: 'Draft the carrier notice' }
                ]
            }),
            title: 'plan with a step switched off'
        }
    ]
};
