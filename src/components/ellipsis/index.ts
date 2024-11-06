import { html } from '@esportsplus/template';


export default (attributes?: Record<string, string>) => html`
<div class="ellipsis" ${attributes}>
    <span></span>
    <span></span>
    <span></span>
</div>
`;