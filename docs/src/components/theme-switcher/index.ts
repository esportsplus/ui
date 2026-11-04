import { html } from 'docs/app';
import { theme } from '@esportsplus/ui/components';
import { mode } from 'docs/data/theme';
import 'docs/components/theme-switcher/scss/index.scss';


// Switches the theme from any page.
const themeSwitcher = () => html`
    <div class='theme-switcher'>
        ${theme.swatches({ mode })}
    </div>
`;


export { themeSwitcher };
