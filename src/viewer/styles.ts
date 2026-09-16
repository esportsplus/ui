import '@esportsplus/ui/fonts';

import '/src/themes/dark/button/scss/index.scss';
import '/src/themes/dark/link/scss/index.scss';
import '/src/css-utilities/index.scss';


// Vite hoists this eager glob above the explicit imports, so every component's
// source SCSS is injected first; the theme and utility sheets that follow win
// by source order. In dev the library resolves to `src`, whose SCSS has no
// `@layer` wrapper (that is added at build), so the cascade is plain source
// order rather than layers — hence the deliberate ordering here.
import.meta.glob('/src/components/*/scss/index.scss', { eager: true });
