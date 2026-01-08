# @esportsplus/ui

A reactive component library built on compile-time template transformations. Provides typed, tree-shakeable UI components with integrated SCSS theming.

## Installation

```bash
pnpm add @esportsplus/ui
```

## Dependencies

- `@esportsplus/template` - Tagged template literals with compile-time transforms and reactive state management
- `@esportsplus/action` - Response/error handling
- `@esportsplus/utilities` - Core utilities

## Quick Start

```typescript
import { button, form, input, select } from '@esportsplus/ui';
import { html } from '@esportsplus/template';

// Simple component
html`${button({}, 'Click Me')}`;

// Form with validation
html`
  ${form.action({
    action: async ({ input: data }) => {
      const result = await api.submit(data);
      return result.ok ? { errors: [] } : { errors: result.errors };
    }
  }, html`
    ${input({ name: 'email', type: 'email' })}
    ${button({}, 'Submit')}
  `)}
`;

// Select with reactive state
html`
  ${select({
    options: { a: 'Option A', b: 'Option B' },
    selected: 'a'
  }, (state) => html`Selected: ${state.selected}`)}
`;
```

## Components

### Form Controls
| Component | Description | Variants |
|-----------|-------------|----------|
| `input` | Text input with validation state | - |
| `textarea` | Multi-line text input | - |
| `checkbox` | Checkbox with label | - |
| `radio` | Radio button group | - |
| `range` | Range slider | - |
| `select` | Dropdown with custom options | - |
| `switch` | Toggle switch | - |
| `form` | Form wrapper | `form.action`, `form.input` |

### Interactive
| Component | Description | Variants |
|-----------|-------------|----------|
| `button` | Standard button | `button.hold` |
| `tooltip` | Popup content | `tooltip.menu`, `tooltip.onclick`, `tooltip.onhover` |
| `accordion` | Collapsible sections | - |
| `clipboard` | Copy to clipboard | `clipboard.onclick`, `clipboard.write` |
| `alert` | Notifications | error, info, success types |

### Display
| Component | Description |
|-----------|-------------|
| `counter` | Animated number with currency formatting |
| `loader` | Loading spinner |
| `loading` | Border loading indicator |
| `typewriter` | Animated typing effect |
| `highlight` | Viewport intersection highlight |
| `ellipsis` | Animated dots |
| `icon` | SVG sprite wrapper |
| `number` | Number formatting |
| `truncate` | Text truncation |
| `json` | JSON display |

### Layout
| Component | Description |
|-----------|-------------|
| `scrollbar` | Custom scrollbar container |
| `frame` | Scrollable frame |
| `sidebar` | Side navigation |
| `site` | Site wrapper |
| `overlay` | Modal/overlay container |

### Utility
| Component | Description |
|-----------|-------------|
| `back` | Back navigation link |
| `root` | Global event coordination (`root.onclick`) |
| `template` | Template factory helper |

## Component Patterns

### Factory Pattern

Components use `template.factory()` supporting flexible call signatures:

```typescript
// No arguments
component()

// Attributes only
component({ class: 'custom' })

// Content only
component(html`<span>Content</span>`)

// Both
component({ class: 'custom' }, html`<span>Content</span>`)
```

### Reactive State

Components can accept and return reactive state:

```typescript
import { reactive } from '@esportsplus/template';

let state = reactive({ active: false });

accordion({ state }, html`
  ${() => state.active ? 'Open' : 'Closed'}
`);
```

### Form Integration

```typescript
form.action({
  action: async ({ input, response }) => {
    // input: parsed FormData with dot-notation support
    // response: error handling utilities
    return { errors: [] };
  }
}, content);

// Input with error state
form.input(element, { error: 'Required field' });
```

## Styling

### CSS Layers

Styles are organized into layers for proper cascade:

```
@layer normalize
@layer components
@layer themes
@layer css-utilities
```

### Importing Styles

```scss
// All component styles
@use '@esportsplus/ui/*.scss';

// Specific component
@use '@esportsplus/ui/button.scss';

// CSS utilities
@use '@esportsplus/ui/css-utilities.scss';

// Design tokens
@use '@esportsplus/ui/tokens.scss';

// Theme
@use '@esportsplus/ui/themes/dark/*.scss';
```

### Design Tokens

Located in `tokens.scss`:

- **Colors**: `--color-{name}-{300|400|500}` (black, white, red, green, blue, purple, yellow, grey)
- **Sizing**: `--size-{300-800}` (12px-80px)
- **Spacing**: `--spacing-{0-600}`
- **Border**: `--border-radius-{100-900}`, `--border-width-{100-700}`
- **Typography**: `--font-size-*`, `--font-weight-*`, `--line-height-*`

### CSS Utilities

```html
<!-- Layout -->
<div class="--flex --flex-center --gap-200">

<!-- Spacing -->
<div class="--margin-400 --padding-200">

<!-- Typography -->
<p class="--text-uppercase --color-grey-400">

<!-- States -->
<div class="--skeleton --disabled --hidden">
```

### Component Variables

Each component exposes CSS custom properties:

```scss
.ui-button {
  --background: var(--color-blue-400);
  --color: var(--color-white);
  --border-radius: var(--border-radius-300);
  --padding-horizontal: 16px;
  --padding-vertical: 8px;
}
```

## Theming

```typescript
// JavaScript
import '@esportsplus/ui/themes/dark';

// SCSS
@use '@esportsplus/ui/themes/dark/*.scss';
```

Themes override component variables. Create custom themes by overriding CSS custom properties.

## Build

```bash
pnpm build         # Full build (SCSS + TypeScript)
pnpm build:vite    # SCSS compilation only
pnpm build:ts      # TypeScript compilation only
```

### Output Structure

```
build/
├── components/
│   ├── {component}/
│   │   ├── index.js
│   │   ├── index.d.ts
│   │   └── scss/index.scss
│   └── index.js
├── css-utilities/
├── themes/
│   ├── dark/
│   └── light/
└── fonts/
```

## TypeScript

Full type safety with zero `any` types:

```typescript
import type { Attributes } from '@esportsplus/template';

// Components are generic
template.factory<A extends Attributes, C>(fn);

// State types are explicit
type State = {
  active: boolean;
  error: string;
};
```

## Performance

- **Compile-time transforms**: Template expressions optimized at build
- **Tree-shakeable**: Import only what you use
- **WeakMap caching**: Memoized formatters and icons
- **Object pooling**: Reused queue structures
- **RAF batching**: Coalesced DOM updates
- **CSS layers**: Efficient cascade resolution

## License

MIT
