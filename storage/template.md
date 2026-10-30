# @esportsplus/template: event API changes (proposal)

Status: draft for review. Nothing is implemented yet.

## Goals

- Every listener in `@esportsplus/ui` goes through the template. Inside `html```, the element a binding is
  defined on decides its lifetime, so cleanup is never wired by hand.
- Attribute keys stay simple and fixed: `on*`, `once*`, `ondocument*`, `onwindow*`. They never carry flags.
- Anything that needs options (capture, direct, passive, another target, early disposal) goes through one
  function, `on(target, event, listener, options?)`. Inside `html``` it comes from the `on` attribute, already
  tied to the element.
- Native listeners stay lazy: one per target, event and flags, added when the first binding needs it and removed
  when the last one goes. That's how delegation and `ondocument*`/`onwindow*` already work.

## Summary

| Area | Today | Proposed |
|---|---|---|
| Handler signature | `(this: Element, e)` | `(this: Element, e, dispose)` |
| Attribute keys | `on*`, `once*`, `ondocument*`, `onwindow*`, `onactive*` | unchanged, except `onactive*` is removed |
| New attribute | none | `on='${(on, element) => { … }}'` |
| Exported functions | `on`, `delegate`, `ondocument`, `onwindow` | `on(target, event, listener, options?) => dispose` only |
| Targets | the element, document, window | any `EventTarget` |
| Capture / direct / passive | not supported (`onactive*` gives a cancelable listener while a gesture lasts) | `on()` options only |
| `on()`'s last argument | `once: boolean` | options object |

## Handler signature

Every listener, whether bound by attribute or by `on()`, receives a disposer as its second argument. It stops
the binding for good, for conditions `once` can't express.

```ts
html`<form onsubmit='${function(this: HTMLFormElement, e: SubmitEvent, dispose: VoidFunction) {
    if (valid(this)) {
        dispose();
    }
}}'></form>`
```

The disposer arrives when the event fires. To cancel a binding before it has ever run, keep the disposer `on()`
returns.

## Attribute bindings

These stay as they are, apart from `onactive*`, which is removed (see below). The template still sees them at
build time, delegates them by default, and removes them with the element.

```ts
html`<div
    onclick='${select}'
    oncekeydown='${first}'
    ondocumentpointerdown='${outside}'
    onwindowresize='${measure}'
></div>`
```

### `onactive*` removed

`onactive*` bound a cancelable (`passive: false`) listener for `touchstart`, `touchmove` or `wheel`, only while a
gesture on the element lasted. Browsers only make a scroll wait on script when it starts over an element with a
cancelable listener, so a listener on the element for its lifetime costs about the same, and the gesture scoping
isn't worth a separate kind of attribute key. Use `on` with `passive: false` instead:

```ts
// before
{ onactivewheel: wheel }

// after
{ on: (on, element) => { on(element, 'wheel', wheel, { direct: true, passive: false }); } }
```

`src/event/onactive.ts`, its codegen branch, its types and its tests are deleted. `PASSIVE_EVENTS` stays: it's
still the default for those three events.

## The `on` attribute

The way to use `on()` inside a template. Its closure receives `on`, wrapped so every binding it makes belongs to
the element the attribute is defined on, plus that element.

```ts
html`<div on='${(on, element) => {
    on(document, 'keydown', key, { capture: true });
    on(element, 'pointerdown', press, { direct: true });
    on(element, 'scroll', viewport, { capture: true });
    on(element.closest('form')!, 'reset', reset);
}}'></div>`
```

- **Lifetime:** every binding made through the wrapped `on` goes when the element is disposed (a move doesn't
  dispose it). While the element is out of the document its listeners don't run, as `ondocument*` bindings behave
  today. Each call also returns its own disposer, and accepts `signal`, for listeners that should stop earlier.
- **When it runs:** once, the first time the element is connected, untracked, so reading signals inside doesn't
  re-run it. Waiting for connect means ancestors (the element's form, its scroll container) can be looked up
  inside it.
- **Composition:** like `onconnect`, an `on` attribute from each separate attribute object runs; they stack in
  order instead of replacing each other.

Listeners that only matter during a gesture are bound here for the element's lifetime and check whether the
gesture is running. The template shares one native listener per target and event, so each extra binding costs
one function call per event.

```ts
// editor/tree/drag.ts: the keys that switch copy/move while a drag lasts
on: (on) => {
    let check = (e: KeyboardEvent) => { if (mode) key(e); };

    on(document, 'keydown', check, { capture: true });
    on(document, 'keyup', check, { capture: true });
}
```

### Composing attribute objects

Pass helpers' attribute objects as separate objects, or as an array. Don't merge them with object spread.
`class` and `style` merge, `on`/`onconnect`/`ondisconnect` stack in order, and a later object's event handler or
plain attribute replaces an earlier one's, just as spread would.

```ts
html`<div ${popup} ${spanning} ${{ onconnect: (el) => { layer = el; } }}></div>`

return [press.attributes, { class: 'sortable', onconnect }];
```

## `on()`

```ts
on(target: EventTarget, event: string, listener: Handler, options?: {
    capture?: boolean;          // listen in the capture phase (implies direct on an element)
    direct?: boolean;           // attach to the element instead of delegating
    once?: boolean;
    passive?: boolean;          // default: the template's current per-event default
    signal?: AbortSignal;       // aborting it removes this binding
}): VoidFunction                // removes this binding
```

- **Target** is what to listen on: an element, `document`, `window`, a `MediaQueryList`, a canvas, a form, a
  scroll container found at runtime, a node that has left the DOM.
- **Lifetime:**
  - From the `on` attribute, the element it's defined on (see above).
  - On its own, outside `html```, nothing is tied to it. That code usually has its own teardown anyway. Where it
    needs one, pass a `signal` and abort it in the element's or component's `ondisconnect`.
- **Ending a binding**: the returned disposer, the handler's `dispose` argument, `once`, `signal` aborting, or
  (from the `on` attribute) the element's disposal, whichever comes first. The native listener is shared, so
  `signal` isn't passed to `addEventListener`; the binding listens for its `abort` and releases itself, removing
  that `abort` listener as it goes so a long-lived signal doesn't keep the binding alive. A signal that has
  already been aborted binds nothing. To combine signals, use `AbortSignal.any([a, b])`.
- **Delegation** is used only for an element target with an event that bubbles, isn't in `DIRECT_ATTACH_EVENTS`,
  and has neither `direct` nor `capture` set. Everything else attaches to the target. Delegated capture never
  exists, so the template never has to choose an order for it.
- **Shared, lazy native listeners**: one per `(target, event, capture, passive)`, created when the first binding
  needs it and removed when the last one is released. They're keyed per target with a `WeakMap`, so targets can
  be garbage-collected.
- **Calls add up**: each `on()` call is its own binding with its own disposer. Attribute keys keep their current
  rule (one per element and event; a later one replaces the earlier).
- **Types**: overloads on the target's type give the event name and the listener's event type
  (`Document` → `DocumentEventMap`, `Window` → `WindowEventMap`, `MediaQueryList`, `HTMLElement`, any other
  `EventTarget` → `Event`).

### Examples on its own

```ts
// One controller per gesture ends every listener it started, with no disposers to track.
let gesture = new AbortController(),
    signal = gesture.signal;

on(document, 'touchmove', scroll, { passive: false, signal });
on(e.target!, 'touchmove', scroll, { passive: false, signal });       // keeps working once the node is detached
// finish(): gesture.abort();

// The click that follows a drag, swallowed only within the same task
on(window, 'click', stop, { capture: true, once: true, signal: AbortSignal.timeout(0) });

// Page-lifetime singletons
on(matchMedia('(prefers-color-scheme: dark)'), 'change', recolor);
```

### Removed exports

`delegate`, `ondocument` and `onwindow` stop being exported. The compiler turns attribute keys into internal
calls with a hoisted options constant (`{ once: true }`, …); ordinary `on*` bindings pass no options and allocate
nothing.

## Compiler

- `once*` emits a hoisted `{ once: true }` constant in place of `, true`.
- `ondocument*` / `onwindow*` emit internal calls on `document` / `window`, tied to the element as today.
- `on='${fn}'` emits a runtime call, like the lifecycle attributes, that runs `fn(wrapped, element)` once on
  first connect, untracked.
- The types gain `on?: (on: typeof on, element: T) => void`. The wrapped `on` has the same signature as the
  exported one.

## Uses in `@esportsplus/ui`

| Site | Becomes |
|---|---|
| `editor/tree/drag.ts:402` keys during a drag | `on` attribute: `on(document, 'keydown' / 'keyup', …, { capture: true })` with a `mode` check |
| `panels/dnd.ts:90-98` document listeners during a drag | `ondocument*` on the drag ghost, which only exists during the drag |
| `shortcut-recorder:260`, `command/palette.ts:520` | `on` attribute: `on(window, 'keydown', …, { capture: true })` with a check |
| `tooltip/shared.ts:470` scroll while shown | `on` attribute: `on(window, 'scroll', …, { capture: true })` with an `if (!shown)` check |
| `shell:227-232`, `panels/group:331,333`, `inline-edit/rich:1411`, `surface-field:672` | `on` attribute: `on(element, …, { direct: true })` (`panels/group`'s click also `capture`) |
| `editor/workspace/{template,session,navigate}.ts`, `surface-field:677,679` | `on` attribute: `on(element / document / window, …, { capture: true })` |
| `textarea:88`, `surface-field:678` | `on` attribute: `on(element.form, 'reset', …)`, `on(matchMedia(…), 'change', …)` |
| `onactivewheel` in `editor/code/minimap.ts:159`, `select/index.ts:444`, `docs/src/examples/surface-field/editor.ts:183` | `on` attribute: `on(element, 'wheel', fn, { direct: true, passive: false })` |
| `theme:70` | `on(media, 'change', …)` on its own, for the page's lifetime |
| `surface-field/engine.ts:1311`, `nav/spy.ts:160`, `marquee/velocity.ts:136` | `on(target, …, { signal })` on their own, aborted by their existing teardown |
| `shared/press.ts:123-124,140`, `editor/tree/drag.ts:546` | `on(target, …, { passive / once, signal })` on their own |
| `surface-field:682` (listening for the abort) | removed, since cleanup comes from the element |

## Open decisions

1. **The `on` closure's arguments:** `(on, element)` as written, or an object `({ on }, element)` that can grow
   without breaking callers.

## Tests (template)

- `on` with each target type, including a node that has left the DOM.
- One shared native listener per `(target, event, capture, passive)`; removed when the last binding goes.
- `capture: true` runs before bubble listeners, and capture and bubble bindings on one element don't replace each
  other.
- `direct: true` reaches the element past nested bound content.
- `passive: false` lets `preventDefault` work on `touchmove` and `wheel`, the replacement for `onactive*`.
- `onactive*` keys no longer compile and are rejected by the types.
- `once`, the returned disposer, the handler's `dispose` argument, and `signal`, each removing only its own
  binding; an already-aborted signal binds nothing; releasing by any other route removes the `abort` listener.
- The `on` attribute: runs once on first connect, untracked; several across separate attribute objects all run;
  its bindings go when the element is disposed (not when it's moved), and don't run while it's out of the
  document.
- `on()` on its own is never removed by the template; only its disposer, `once` or `signal` end it.
- The compiler emits hoisted options constants; plain `on*` emits no options.
