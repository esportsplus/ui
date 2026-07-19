# Components

## Consumer inert pairing for `--active` toggles

Modal, sidebar, frame, overlay, and direct-use anchor cannot carry `inert` at the library level: they receive `--active` as a class string from consumers and own no reactive state (sidebar/frame/overlay are `scrollbar.bind({ class })` wrappers; modal is style-only and consumers mount/unmount it). Their inactive styling (`opacity: 0` + `pointer-events: none`) hides content visually but leaves it in tab order and the accessibility tree.

**Convention**: a consumer toggling `--active` on one of these components via reactive state pairs it with an `inert` binding on the same element, driven by the same state:

```ts
html`
    <div
        class='sidebar ${() => state.active && '--active'}'
        ${{ inert: () => !state.active }}
    >
        ...
    </div>
`;
```

`@esportsplus/template` removes a boolean attribute when its binding returns falsy, so `inert` is present while inactive and absent while active — there is no `inert="false"` footgun. In-library references: accordion, alert, select, and tooltip menu all bind `inert: () => !state.active`.

**The pairing is unnecessary when**:

1. The component is fully unmounted while inactive (conditional render, e.g. the modal demo pattern) — nothing hidden remains in the DOM.
2. Usage is purely static/always-active (showcase pages) — there is no hidden state to suppress.

**No shared helper**: recorded decision — YAGNI. The binding is one line; a helper or directive would add an abstraction over a 1-liner without reducing duplication meaningfully.
