# Routing accumulator and declaration-surface refactor plan

**Status:** design only; no refactor or new compiler experiment has been performed. Prepared against routing v0.10.6, commit `705f4df33b1c705c385e537396de5ede1fab1eb3`, and the retained TS2883 investigation. The only file written for this task is this document.

## 1. Decision and scope

Use **anonymous structural route data inside named public API types**. A registration should return `Router<T, { names: ...; paths: ... }, G>`, rather than `Register<...>`. Keep validation algorithms private. Preserve the existing registry model, method signatures, factory inference, and runtime implementation before considering algorithm changes.

Do not assume that this change alone makes an eight-type public surface viable. The evidence already includes TS7056 when an extracted method's unresolved validators are serialized. A method return annotation controls its result; it does not hide that method's generic parameter validation. Likewise, exporting `ClientUri` does not hide an inaccessible alias used as its type argument.

**Recommended target:** eleven public types: the eight desired API types plus three small, intentional callable interfaces, `RouteMethod`, `RouteOn`, and `ClientFactory`. These give the emitter names for extracted registration methods and the generic `router` function without exporting validators. First pressure-test the eight-type candidate; remove any unnecessary callable interface before release only if the full consumer matrix proves it redundant. Eleven is a conservative design target, not a demonstrated mathematical minimum or a claim that the unimplemented design already emits correctly.

The work must retain:

- The sole public runtime export `router` and its returned `back`, `forward`, `middleware`, `redirect`, `uri`, `listener`, and `shutdown` members.
- Builder calls `get`, `post`, `put`, `delete`, `on`, `group(...).routes(...)`, `match`, and `uri`, including existing type argument order and defaults.
- Route-name and path literals through chains, returning group callbacks, and separate factories; typed URI arguments and all existing rejection cases.
- HTTP-method/subdomain buckets, group scope restoration, middleware behavior, radix matching, navigation, and instance/prototype behavior.

`Router.routes` is currently a runtime record of named routes. The callback-taking `routes` function belongs to the object returned by `group`; it is not a root builder method. Preserve both meanings.

Do not implement runtime normalization fixes, change optional-path semantics, add new runtime properties, require consumers to annotate their exports, introduce source import aliases, or expand the package exports map as part of this refactor.

## 2. Evidence and baseline qualification

### Sources inspected

Local links identify the exact inputs; source line references below refer to the inspected checkout.

- [Accumulator and validators](G:/esportsplus/routing/src/client/types.ts), especially lines 6–19, 49–79, 102–119, 135–195, and 213–310.
- [Runtime Router and method declarations](G:/esportsplus/routing/src/client/router/index.ts), especially lines 58–62 and 166–305.
- [Client entry point](G:/esportsplus/routing/src/client/index.ts), especially lines 82–136 and 157–221.
- [Type fixtures](G:/esportsplus/routing/src/client/types.test-d.ts), [client tests](G:/esportsplus/routing/src/client/index.test.ts), [builder tests](G:/esportsplus/routing/src/client/router/index.test.ts), and [radix-node tests](G:/esportsplus/routing/src/client/router/node.test.ts).
- [Investigation REPORT.md](G:/esportsplus/routing-ts2883-investigation/REPORT.md), particularly its **Diagnosis** declaration-surface table, **Verification** table, and inference/completion findings.
- [Recommended patch](G:/esportsplus/routing-ts2883-investigation/recommended.patch), [surface probe](G:/esportsplus/routing-ts2883-investigation/ui/checks/declaration-surface-probe.ts), and [inference checks](G:/esportsplus/routing-ts2883-investigation/ui/checks/route-inference-check.ts).

### What is established, and what is not

The checkout still contains the investigation's two uncommitted export-list changes in `src/client/index.ts` and `src/client/types.ts`. `git show HEAD:src/client/index.ts` confirms that original v0.10.6 exposes only `Middleware`, `Next`, `Request`, `Route`, `Router`, and `RouteFactory`. The modified checkout is not evidence that those extra types have been published. Leave those files untouched during planning; do not silently use their expanded exports when evaluating a future minimal-surface prototype.

The verified patch exposes **27 types in total, 21 more than the original six**. It does not require `Bucket` or `MergeRegistry`. Four of its exports—`Expand`, `PathsConflict`, `Shape`, and `SyntaxError`—were needed together for the broader extracted-method probe. Each one alone failed that probe in [helper-matrix.log](G:/esportsplus/routing-ts2883-investigation/helper-matrix.log). This is evidence for that tested combination, not an exhaustive proof that every proper subset fails.

The investigation used the installed TypeScript **7.0.2** and the coordinated `@esportsplus/typescript` build. Its [baseline emit](G:/esportsplus/routing-ts2883-investigation/baseline-emit.log) reported two TS2883 errors for UI's destructured `redirect` and `uri`. The named-factory probe additionally reported `Register` and `Root`. Original anonymous default factories did not individually report that same diagnostic list: failed partial emit instead produced `any` returns. Successful exit, correct declarations, and downstream inference must therefore all be checked.

The report establishes passing additive-fix declaration emit, source and emitted inference checks, exact completions, and 65 runtime tests across three files. It also reports byte-identical generated runtime JS. These are **prior results**, not tests run for this plan. No route-count/depth limit for structural accumulation has been measured. The existing 100-route type fixture is not an external declaration stress result.

## 3. Current architecture and leakage map

### Registry flow

`Router<T, R, G>` carries response type `T`, registry `R`, and group context `G` only in its type system. Its runtime object mutates and each builder returns the same instance. Initially:

```ts
type EmptyRegistry = { names: {}; paths: never };
type Root = { name: ''; path: ''; subdomain: '' };
type Registry = {
    names: Record<string, { path: string }>;
    paths: string;
};
type Group = { name: string; path: string; subdomain: string };
```

`names` maps the full route name to the full, original path literal, retaining optional/wildcard syntax for parameter extraction. `paths` is a union of expanded path registrations, encoded as `METHOD|SUBDOMAIN|/path`, for conflict checking. These are different views of route data and neither can replace the other.

`Register` wraps `Router` with `R['names'] & RegisterNames<G, Name, Path>` and `R['paths'] | RegisterPaths<G, Method, Sub, Path>`. `RegistryOf` recovers a factory's returned registry. `AccumulateRoutes` recursively merges the factory tuple through `MergeRegistry`. `ValidateFactories` separately folds an accumulator through `RegistryConflict`; composing registries must not omit that validation step.

### Public entries and each method

“Observed” below means the report/probe/logs demonstrate leakage. “Potential” identifies reachable internal names that must be checked, not a claim that each one actually appeared in an error. A private type mentioned inside the package's own declaration is legal; the defect concerns references that another package must spell in its inferred declarations.

| Entry or expression | Exact directly referenced types and return shape | Relevant downstream declaration boundary |
| --- | --- | --- |
| `router<T, const Factories extends readonly RouteFactory<T>[]>(...factories)` | Parameter intersection: `Factories & readonly RouteFactory<T>[] & ValidateFactories<Factories,T>`. Local `Routes = AccumulateRoutes<Factories,T>`. Anonymous result contains `ClientRedirect<Routes>`, `ClientUri<Routes>`, and middleware using `Middleware`, `Request`, `Route`, `Next`. | Concrete clients retain the two client aliases with a computed registry. Generic `const clientFactory = router` retains `AccumulateRoutes`, `ValidateFactories`, and both client aliases. Observed in the report table and `surface-baseline.log`. |
| `Router<T,R=EmptyRegistry,G=Root>` | Constraints `Registry`, `Group`; defaults `EmptyRegistry`, `Root`. | `Router` itself is public, but explicit inferred type arguments can preserve the private defaults. Observed for factories and group exports. |
| `get` | Options: `RouteOptions<T>`, literal `Name/Path/Sub`, `ValidateName<R,G,Name>`, `ValidatePath<R,G,'GET',Sub,Path>`. Return: `Register<T,R,G,'GET',Name,Sub,Path>`. | Chained factories preserve the final `Register` and its earlier registry. Extracted `get` additionally serializes parameter validators, partially evaluating the literal GET specialization. Observed TS2883 and TS7056. |
| `post` | Same signature structure; method literal `'POST'`; returns `Register<T,R,G,'POST',Name,Sub,Path>`. | Same risk as `get`; add an explicit probe because the old extracted-method fixture did not export it. |
| `put` | Same signature structure; method literal `'PUT'`; returns `Register<T,R,G,'PUT',Name,Sub,Path>`. | Same risk; separately verify. |
| `delete` | Same signature structure; method literal `'DELETE'`; returns `Register<T,R,G,'DELETE',Name,Sub,Path>`. | Same risk; separately verify. |
| `on` | `Methods extends readonly string[]`; `RouteOptions<T>`, `ValidateName`, `ValidatePath<R,G,Methods[number],Sub,Path>`; return `Register<T,R,G,Methods[number],Name,Sub,Path>`. | Extracted `on` retains the generic method union and validator aliases. Observed; cannot replace it with a single widened `string` registration. |
| `group` | `G2 extends Partial<Group>`; options `Options<T> & G2`; returns an anonymous object with `routes`. | Extracted `group` exposes `Group`, `Options`, defaults/constraints, and `MergeGroup`. Observed. |
| `group(...).routes` | `<R2 extends Registry = R>(fn: (router: Router<T,R,MergeGroup<G,G2>>) => Router<T,R2,MergeGroup<G,G2>> \| void) => Router<T,R2,G>`. | Group objects expose `Registry`, `EmptyRegistry`, `Root`, `MergeGroup`; a completed concrete grouped factory can already emit `Router` with structural registry and named `Root`. Observed. |
| `match` | `(method: string, path: string, subdomain?: string \| null) => { parameters?: Readonly<Record<string,string>>; route?: Readonly<Route<T>> }`. | No accumulator helper needed at its direct return boundary; `Route` is public. Preserve readonly/optional properties exactly. |
| Builder `uri` | `<Name extends keyof R['names'] & string>(name: Name, ...values: UriArguments<R,Name>) => string`. | Extracted `uri` preserves `UriArguments`, even on an empty builder. Observed. |
| Result `redirect` | `ClientRedirect<AccumulateRoutes<Factories,T>>`; generic named-route signature intersected with `(url: \`${string}://${string}\`) => void`. | `ClientRedirect` is observed missing. Its registry argument must independently become nameable. |
| Result `uri` | `ClientUri<AccumulateRoutes<Factories,T>>`. | `ClientUri` is observed missing. Same independent requirement for its argument. |
| Result `middleware` | Callable `(...middleware: Middleware<T>[]) => T`; `dispatch(request: Request<T>): T`; `match(fallback: Route<T>): (request: Request<T>, next: Next<T>) => T`. | Existing public types suffice for the observed result; avoid expanding `Request` or introducing a private returned host alias. |
| Result `back`, `forward`, `shutdown` | `() => void`. | No routing helper alias. |
| Result `listener` | `(event: MouseEvent) => void`. | DOM type only. |
| Exported `RouteFactory<T>` | `(router: Router<T,EmptyRegistry,Root>) => Router<T,Registry,Group>`. | Legal when referenced by public name. Annotating a concrete factory with this broad type loses the exact registry; keep inference. |
| Existing `Middleware<T>`, `Next<T>` | `NeverAsync<(input: Request<T>, next: Next<T>) => T>` and `NeverAsync<(input: Request<T>) => T>`, respectively. | Keep named; `NeverAsync` belongs to utilities, not the proposed routing export list. Verify its resolution in the external package test. |
| Existing `Request<T>` and `Route<T>` | `RequestState & { data: ReturnType<Router<T>['match']>; subdomain?: string }`; `Route` holds `Next<T>` and nullable name/path/subdomain. | `RequestState` can remain an internal dependency of public `Request`; it is not automatically an additional required barrel export. |
| Public builder fields | `bucket` refers to internal `Node<T>` and public `Route<T>`; `groups: Options<T>[]`; `routes: Record<string,Route<T>>`; `subdomains: string[] \| null`. | Preserve these accessible fields. Their independent extraction is an additional audit surface, especially `Node`; it was not covered by the original method probe. Do not remove fields to obtain a smaller declaration. |

This table expands the investigation's five-row **Diagnosis** table, rather than replacing its findings with an assumption that every reachable helper leaks. See [observed diagnostics](G:/esportsplus/routing-ts2883-investigation/surface-baseline.log) and [successful additive-fix declarations](G:/esportsplus/routing-ts2883-investigation/surface-final-emit/declaration-surface-probe.d.ts).

### Private dependency graph to retain

| Operation | Helper dependencies |
| --- | --- |
| Register names | `RegisterNames` → `FullName`, `FullPath`; ignore widened names and `''`. |
| Register paths | `RegisterPaths` → `Bucket`, `Expand`, `FullPath`; widened method/path contributes `never`. |
| Duplicate names | `ValidateName` → `FullName`. |
| Validate path | `ValidatePath` → `SyntaxError`, `DuplicatePath`, `ParamConflict`; distributes over `Method`. |
| Syntax | `SyntaxError` → `SegmentsSyntax` → `SegmentError`. |
| Duplicate path shapes | `DuplicatePath` → `Bucket`, `FullPath`, `Shape`, `ShapeKeysOfPaths`; `Shape` → `NormalSeg`; shape keys → `EraseNames` → `EraseSeg`. |
| Parameter conflicts | `ParamConflict` → `PathsConflict`, `Bucket`, `Expand`, `FullPath`; `PathsConflict` → `Eq`, `ConflictWalk` → `Cmp` → `Eq`. |
| Factory accumulation/validation | `AccumulateRoutes` → `RegistryOf`, `MergeRegistry`, `EmptyRegistry`; `ValidateFactories` → `RegistryConflict`, `RegistryOf`, `MergeRegistry`; `RegistryConflict` → `ShapeKeysOfPaths`, `PathsConflict`. |
| URI arguments | `UriArguments` → `ExtractRequiredParams`, `ExtractWildcardParams`, `ExtractOptionalParams`, `PathParamsObject`; the latter combines those three key sets. |
| Group scope | `MergeGroup` concatenates name/path and conditionally overrides subdomain; root is `Root`. |

## 4. Target type architecture

### 4.1 Explicit public export contract

The recommended final `./client` barrel has this exact list:

```ts
export { router };
export type {
    Middleware, Next, Request, Route,
    Router, RouteFactory,
    ClientRedirect, ClientUri,
    RouteMethod, RouteOn, ClientFactory
};
```

`Router` remains a **type-only** export from `./client`; do not accidentally add a public constructor value. The final package exports map remains `./client` with the existing declaration and runtime targets.

`RouteMethod` represents the callable API shared by the four HTTP shortcuts. `RouteOn` represents the distinct two-argument generic method-list API. `ClientFactory` represents the callable API of `router`. These are behavioral public contracts, not aliases for individual validator internals. They still carry compatibility obligations; their names are not free merely because they are interfaces.

The eight-type experiment removes only those last three names. It must pass extracted-method and generic-re-export tests unchanged before becoming the release target. Do not hide equivalent public helpers under a `Router` namespace and claim they no longer count as public API.

Everything in the dependency graph above remains private **to the public package entry**. Some helpers may still need internal module exports for relative imports between shipped declaration files. Do not use `stripInternal` to erase declarations still referenced by public signatures.

### 4.2 Structural data, unchanged information

Keep the three generic parameters of `Router` in the current order. Write its externally instantiated defaults structurally:

```ts
// Signature sketch; the nominal/runtime bridge is discussed in section 4.5.
interface Router<
    T,
    R extends {
        names: Record<string, { path: string }>;
        paths: string;
    } = { names: {}; paths: never },
    G extends {
        name: string;
        path: string;
        subdomain: string;
    } = { name: ''; path: ''; subdomain: '' }
> {
    // Existing fields and methods are preserved.
}
```

Keep `names` entries as `{ path: FullPath }`, rather than replacing paths with precomputed parameter objects. The original path is needed both for the existing registry extraction contract and for the exact URI tuple rules. Keep original parameter names in the `paths` union so conflict detection can distinguish `/users/:id/posts` from `/users/:uid/comments`. A shape-only union would lose that validation.

Use an anonymous root object and anonymous merged group objects where they are passed as inferred `Router` type arguments. Merely changing `Register` to `Router<T, MergeRegistry<...>, Root>` still leaves two named leakage sites.

### 4.3 Registration signature and structural return

This is an illustrative GET signature, not implementation-ready code. `R`, `G`, and the private helpers have the existing constraints. The key is the written `Router` reference and anonymous registry, including the name insertion rather than an outer `Register` alias:

```ts
get<
    const Name extends string = '',
    const Path extends string = string,
    const Sub extends string = ''
>(
    options: RouteOptions<T>
        & { name?: Name; path?: Path; subdomain?: Sub }
        & {
            name?: ValidateName<R, G, Name>;
            path?: ValidatePath<R, G, 'GET', Sub, Path>;
        }
): Router<T, {
    names: R['names'] & (
        string extends Name ? {} :
        Name extends '' ? {} :
        { [K in `${G['name']}${Name}`]: { path: `${G['path']}${Path}` } }
    );
    paths: R['paths'] | (
        string extends Path ? never :
        `${Bucket<'GET', Sub extends '' ? G['subdomain'] : Sub>}|${Expand<`${G['path']}${Path}`>}`
    );
}, G>;
```

`Bucket` and `Expand` are still private computations here. For concrete registrations they should reduce to strings; this must be demonstrated in emitted output. Generic extraction leaves them symbolic, which is why section 4.4 provides a named callable boundary. Inline a residual helper only when the consumer fixture proves that a concrete type argument retains its inaccessible alias. Do not recursively inline every validator.

For the four shortcuts, substitute their fixed method literals. For `on`, use `Methods[number]` and retain **both** widened-method and widened-path guards from `RegisterPaths`: `string extends Methods[number] ? never : string extends Path ? never : ...`. Keep the original const generics and optional options properties. Do not turn unnamed routes into a string index signature.

Expected downstream shape for an ordinary factory:

```ts
export declare const routes: (r: Router<string>) => Router<string, {
    names: {
        home: { path: '/' };
    } & {
        user: { path: '/users/:id' };
    };
    paths: 'GET||/' | 'GET||/users/:id';
}, { name: ''; path: ''; subdomain: '' }>;
```

An anonymous intersection is acceptable. Do not require an aesthetically flattened object if that costs more instantiations. A `Simplify`, `Prettify`, or mapped-type wrapper is not a guaranteed alias-erasure mechanism and may itself survive inference.

### 4.4 Named callable boundaries for unresolved generic code

Place the registration signature above inside a **named public callable interface**:

```ts
// R and G constraints omitted here only to keep the sketch short.
interface RouteMethod<T, R, G, Method extends string> {
    // Same Name/Path/Sub const generics, options intersections, validators,
    // and direct Router<T, { names: ...; paths: ... }, G> result.
    // The implementation must include RegisterPaths' widened Method guard.
}

interface RouteOn<T, R, G> {
    // Same Methods/Name/Path/Sub generics and exact two-argument signature.
    // Return Router directly with the structural registry.
}

// On the type-only Router facade:
// get: RouteMethod<T, R, G, 'GET'>;
// post: RouteMethod<T, R, G, 'POST'>;
// put: RouteMethod<T, R, G, 'PUT'>;
// delete: RouteMethod<T, R, G, 'DELETE'>;
// on: RouteOn<T, R, G>;
// uri: ClientUri<R>;
```

The intended inferred declaration for `r.get` is `RouteMethod<T, structuralR, structuralG, 'GET'>`, not a freshly serialized generic function body. Validators are then referenced inside the package-owned interface declaration and are not reproduced in the downstream package. A call to that interface still returns the direct `Router` signature, so a concrete factory need not emit `RouteMethod` in its result.

Use callable interfaces as the first candidate because they provide a named object type. Do not assert that naming a function alias, or spelling a type as `Router<T,R,G>['get']`, forces the emitter to preserve that spelling. Test the actual inference from an unannotated `r.get`. An indexed-access annotation can be a consumer workaround, but requiring it would fail this task's inferred-public-position goal.

For `group`, first keep an anonymous function/object signature with **inline** options, constraints, and merged context. Its own generic computation is small and stops at named `Router` references. Replace `MergeGroup<G,G2>` at each public-facing position with:

```ts
{
    name: `${G['name']}${G2 extends { name: infer N extends string } ? N : ''}`;
    path: `${G['path']}${G2 extends { path: infer P extends string } ? P : ''}`;
    subdomain: G2 extends { subdomain: infer S extends string }
        ? '' extends S ? G['subdomain'] : S
        : G['subdomain'];
}
```

Keep the `routes` callback's default registry, its `Router | void` return, and restoration of the parent `G`. Inline `Options<T>` there as its four existing fields (`middleware`, `name`, `path`, `subdomain`), not as a new public options alias. Stress exported group objects and extracted `routes` independently. If this still fails, revisit a named group callable/result contract as an explicit design change; do not silently enlarge the eleven-type list.

### 4.5 Runtime-preserving declaration integration

A class method cannot receive an arbitrary callable-interface annotation for the entire method value merely by changing its return annotation. Changing prototype methods into initialized arrow-function fields to solve that problem changes identity, allocation, binding, and potentially subclass behavior. It is outside the constraints.

Prototype a **type-only public Router facade** while leaving the runtime class named `Router` with its current bodies and prototype methods. Import that class under a local type alias such as `RuntimeRouter` in the facade module. Investigate an interface extending the implementation class, overriding only the callable member types with equivalent signatures:

```ts
// Architectural sketch; compatibility must be proved before adoption.
interface Router<T, R extends Registry = { names: {}; paths: never },
                 G extends Group = { name: ''; path: ''; subdomain: '' }>
    extends RuntimeRouter<T, R, G> {
    get: RouteMethod<T, R, G, 'GET'>;
    // post/put/delete/on/uri, plus the structural group signature.
}
```

The final declaration should use the structural constraints from section 4.2 where their names would otherwise escape. The private `Registry`/`Group` names in this abbreviated sketch are not proposed public exports.

Extending the implementation type is preferable to copying only its public members: it can retain the class's existing private-member origin and therefore nominal compatibility. This is a feasibility gate, not an assumption. Check recursive assignability in both directions between the actual class and facade, extraction of `R` through `Router<infer T,infer R,infer G>`, response inference, generic instantiation, method variance, and interface-extension compatibility. Do not paper over a mismatch with `any` or a blanket `unknown` assertion. If the bridge cannot be made equivalent, stop and redesign it before replacing the public Router type.

Keep `bucket`, `groups`, `routes`, `subdomains`, `match`, and their exact mutability/readonly details. Keep runtime class exports used by local tests. Do not merge a callable property declaration with an incompatible existing class method and assume TypeScript will permit it. A separate public type module also makes the implementation/facade dependency cycle visible for review.

At integration, type-check the existing `router` function against the public callable contract; use the existing narrowly scoped registry casts only for the same-instance accumulation that already needs them. Runtime JS should remain byte-identical under the same build toolchain.

### 4.6 Factories and the generic client factory

Retain the current factory input and output contract, using structural defaults/constraints in the emitted public-facing positions. Do not change `RouteFactory<T>` into a return annotation consumers must apply. Continue inferring each factory, including `satisfies RouteFactory<T>` usage where compatible, and use `RegistryOf` privately to recover the exact returned registry.

`AccumulateRoutes`, `MergeRegistry`, and `ValidateFactories` can remain private recursive aliases. The anonymous client result should use projected registry fields rather than passing the outer `AccumulateRoutes` alias directly:

```ts
interface ClientFactory {
    <T, const F extends readonly RouteFactory<T>[]>(
        ...factories: F & readonly RouteFactory<T>[] & ValidateFactories<F, T>
    ): {
        back: () => void;
        forward: () => void;
        listener: (event: MouseEvent) => void;
        middleware: {
            (...stages: Middleware<T>[]): T;
            dispatch: (request: Request<T>) => T;
            match: (fallback: Route<T>) =>
                (request: Request<T>, next: Next<T>) => T;
        };
        redirect: ClientRedirect<{
            names: AccumulateRoutes<F, T>['names'];
            paths: AccumulateRoutes<F, T>['paths'];
        }>;
        uri: ClientUri<{
            names: AccumulateRoutes<F, T>['names'];
            paths: AccumulateRoutes<F, T>['paths'];
        }>;
        shutdown: () => void;
    };
}

// Type annotation only; preserve the current function implementation.
// const router: ClientFactory = <T, const F ...>(...factories) => { ... };
```

The private recursive fold occurs inside a named public callable declaration. `export const clientFactory = router` should then emit `ClientFactory`. For a concrete call, the fold should reduce into the projected structural registry, retaining `ClientRedirect` and `ClientUri`. Avoid introducing a private `ClientResult<T,R>` alias as the call result: exporting a concrete whole client could retain it and recreate TS2883.

In the eight-type experiment, a direct `export { router }` and `typeof router` may be adequate for explicit aliases; nevertheless the investigation shows the unannotated `const clientFactory = router` expanding today. Making that exact form pass is required. A completely generic forwarding wrapper is an additional symbolic surface and must be measured separately; `ClientFactory` does not automatically give every arbitrary wrapper a named type.

### 4.7 URI contracts remain precise

Keep `ClientUri<R>` and `ClientRedirect<R>` exported by name and their implementation helpers private. Initially retain their current registry parameter shape, including `paths`, to minimize simultaneous representation changes. A later name-only projection could reduce serialized data, but is not necessary to establish this refactor and would need another compatibility/emit comparison.

The defining signatures remain:

```ts
type ClientUri<R extends Registry> =
    <Name extends keyof R['names'] & string>(
        name: Name, ...values: UriArguments<R, Name>
    ) => string;

type ClientRedirect<R extends Registry> =
    (<Name extends keyof R['names'] & string>(
        name: Name, ...values: UriArguments<R, Name>
    ) => void)
    & ((url: `${string}://${string}`) => void);
```

Here private `Registry` and `UriArguments` are legitimate dependencies within the defining package. The outside declaration should name `ClientUri<structuralR>` or `ClientRedirect<structuralR>`, not inline these signatures.

| Full path's parameter sets | Required call tuple after the name |
| --- | --- |
| No required, optional, or wildcard parameters | `[]`; reject even an extra `{}` argument. |
| Optional parameters only | `[params?: PathParamsObject<P>]`; object and its optional keys may be omitted. |
| Any required parameter | `[params: PathParamsObject<P>]`; required keys use `string \| number`. |
| Any wildcard parameter | Required object; wildcard keys use `string \| number \| (string \| number)[]`. |

Preserve overload behavior: absolute URLs are accepted by `redirect` through its existing template-literal overload, not by `uri`; unknown route names that do not match that URL form are rejected. Preserve the current optional-segment behavior; do not add stricter prefix-dependent parameter requirements during this change.

## 5. Behavior-to-design mapping and existing limits

| Preserved behavior | Target mechanism and assertions |
| --- | --- |
| Chain accumulation | Structural `names` intersection and `paths` union on every returned `Router`; assert first, middle, and last route names and literal paths, not only the last call. |
| Separate factory accumulation | Private tuple fold over each inferred returned registry; retain cross-factory validation and response-type agreement. Assert exact combined nine-name UI union and a 100-route tuple fixture. |
| Duplicate full route names | Preserve `ValidateName`, including group name concatenation; preserve `RegistryConflict` across factories. Names are global, not method/subdomain-local. |
| Duplicate path shapes | Preserve `Shape` and `ShapeKeysOfPaths` against matching method/subdomain buckets; test optional expansions, dynamic and wildcard shape collisions. |
| Parameter-name conflicts | Preserve original parameter spellings and aligned-prefix comparison; test paths with different suffixes so this is not accidentally just a duplicate-shape test. Include cross-factory conflicts. |
| Path syntax | Keep `SyntaxError`/segment checks for leading slash, empty names, standalone optional/wildcard syntax, and final wildcard position. No widened-string fallback may make literal failures pass. |
| Groups | Anonymous merged context retains concatenated name/path, inherited or overridden subdomain, and restores parent context after `.routes`. Returning callbacks carry the new registry; `void` callbacks retain the existing type-level limitations. |
| Subdomains and methods | Preserve the exact bucket computation and all method entries in `on`. Different methods/subdomains may reuse paths; duplicate names still cannot. |
| Middleware and response types | Preserve `T`, `NeverAsync`, request/next contracts, and the host's `dispatch`/`match`; mixed incompatible factory response types remain errors. |
| Runtime routing/navigation | Same class methods, register loop, node tree, URI construction, group `try/finally`, history calls, event listener lifecycle, and subdomain matching. |

Do not claim guarantees stronger than the baseline. Characterize these boundaries first and track any defects separately:

- `ValidateFactories` skips tuple validation for a non-tuple array (`number extends length`), while `AccumulateRoutes` bottoms out to the empty registry for that widened array. Do not silently start accepting arbitrary names to compensate. Precise readonly tuples and separate arguments are the inference contract being preserved.
- Widened names/paths/methods intentionally lose static knowledge. Mutating an existing builder without using its returned type likewise does not update the variable's generic parameters. A `void` group callback cannot recover route data from its statement side effects.
- Runtime registration uppercases methods, but `Bucket` uses its `Method` type parameter as supplied. Its subdomain rule is `Uppercase<Sub extends 'www' ? '' : Sub>`: literal lowercase `www` gets special treatment before case folding. Runtime first lowercases the subdomain, then normalizes `www`. Probe lowercase methods, uppercase `WWW`, and mixed-method conflict cases; do not disguise a normalization behavior change as alias cleanup.
- Optional expansion yields prefix stops, not every independent subset of optional segments. An optional-first path may produce the empty prefix in the type union, whereas runtime uses `/`; trailing-slash/group concatenation also deserves baseline characterization. Preserve current behavior and separate any correction.
- Syntax validation currently begins with the route's `Path`, while duplicate/parameter checks use the concatenated full path. Do not assume group options already receive all path-syntax validation.

## 6. TS7056 risk analysis and decision gates

### Why structural expansion helps, and where it stops helping

For a concrete factory, `Router` can stop expansion of all builder members while its anonymous type arguments contain only literal data. For an extracted generic method, there is no enclosing `Router` reference to stop expansion; options, validators, and conditional results may all need spelling. A named callable interface supplies that stopping point. A named `ClientUri` similarly prevents repeated URI-validator serialization, but cannot abbreviate arbitrarily large anonymous registry arguments.

The compiler's alias choice is not a language-level guarantee about every equivalent type spelling. As a reference implementation, the official [TypeScript 5.9.3 checker](https://raw.githubusercontent.com/microsoft/TypeScript/v5.9.3/src/compiler/checker.ts) checks alias accessibility/expansion conditions and tracks an approximate serialization length; its truncation path can report an error even with the node-builder `NoTruncation` flag. This explains the mechanism, but is not evidence for exact thresholds or internals of the investigation's 7.0.2 toolchain. Do not advertise a fixed compiler character limit or treat `noErrorTruncation` as a fix.

The relevant observed limit is more actionable: the investigation already failed extracted `get` on an **empty input registry** after partial export fixes. Zero routes can therefore be enough to overflow unresolved signature serialization. Route count alone is an inadequate budget.

### Growth model

Let `N` be route count, `D` average full-path length/depth, `O` optional segments per route, and `M` method count per registration. For this prefix-expansion algorithm, the number of path variants is approximately `K = sum(M_i * (O_i + 1))`, before union deduplication. It is not `2^O` independent optional combinations.

Names and literal path data grow roughly with `N*D` plus the total text of expanded prefixes. Long prefixes repeated for many optional stops increase bytes beyond a short-route count estimate. Group nesting lengthens full names/paths and can retain nested conditional expressions when its inputs are generic.

Validation has another cost: naive pairwise conflict comparisons can approach `K^2` path comparisons, each walking path segments. Compiler caching may reduce this; measure rather than assuming it does. Deep recursion may hit TS2589, large unions TS2590, or resource limits before TS7056. Those are separate failures and must be reported separately.

Exporting whole clients, both destructured functions, and multiple extracted methods can repeat the same structural registry in several declarations. Named outer types avoid duplicating algorithms, not necessarily the data. Flattening every accumulated intersection at every call may itself create quadratic work. Start with the current intersection/union representation.

### Representation choices and mitigations

| Risk | First mitigation | Escalation if measured tests fail |
| --- | --- | --- |
| `Register`, `Root`, or `MergeGroup` retained by concrete factories | Direct `Router` return; anonymous registry and group defaults/results. | Inline only the surviving concrete helper/projection, then rerun the same probe. |
| Validators explode on extracted shortcuts | Public `RouteMethod` callable interface; `RouteOn` for method lists. | Inspect whether the callable itself or its arguments expanded. Do not export all validator internals as part of this design. |
| `UriArguments` escapes builder `uri` | Expose the member's type as `ClientUri<R>` in the type-only facade. | Inspect whether the alias is retained on extraction; reconsider callable representation without changing accepted tuples. |
| Generic `router` re-export retains recursion/validators | Public `ClientFactory`; anonymous projected concrete result. | Audit generic forwarding wrappers; keep failing symbolic surfaces explicit rather than asserting an eight-type solution. |
| Group signature retains helper names | Inline the small group/options/constraint shapes. | A separately named public group contract requires an explicit revision of the surface budget and compatibility review. |
| Large concrete data exceeds serialization budget | Preserve public named outer types; avoid multiplying the registry and eagerly flattening it. | Evaluate name-only client projection first; then a deliberately public compact route-state representation or factory-reference-based state. Both are separate designs requiring full validation. Merely renaming `{names,paths}` to `Registry<R>` does not compress its still-large argument. |
| Private callable facade changes assignability | Inherit implementation identity and test exact members/variance before wiring it in. | Reject the facade version; do not accept broad casts or a widened `Router` as a fix. |

No finite structural encoding promises unlimited inference. If a candidate fails an established baseline use case or the agreed minimum matrix, it does not satisfy this refactor's release gate. Consumer annotations or splitting route modules may help particular users, but cannot be the required solution for the existing inferred exports.

### Concrete stress matrix

Generate real literal call chains/tuples, not a loop whose type widens names and hides the workload. Run positive and negative cases separately so an expected diagnostic cannot mask an emit failure.

| Dimension | Required cases | Extended boundary search |
| --- | --- | --- |
| Total routes | 0, 1, UI's 9, 25, 50, 100 | 250, 500, 1,000; binary-search first failure for each shape. |
| Factory split | One chain; five factories × 20; 25 factories × 4; 100 singleton factories | Same 250/500/1,000 totals with chain length and factory count varied independently. |
| Path content | Static; required params; optional-only; terminal wildcard; required + optional + wildcard; shared dynamic prefixes with consistent names | Compare disjoint prefixes with maximum shared prefixes; inject a conflicting name near the final route. |
| Path depth | 1, 4, 8 segments; optional counts 0, 1, 4 | 16/32 segments; 8/16 optionals; measure prefix-union growth. |
| Group nesting | 0, 1, 4, 8 returning nested groups; named/path-param groups; sibling groups; `void` callbacks | 16/32 levels and long prefixes; group output reused across exports. |
| Name/path text length | Short literals and approximately 64-character names/segments | Approximately 256-character names/segments at fixed N. |
| Methods/subdomains | Each shortcut; `on(['GET','POST'])`; four-method tuple; root, `api`, nested override, lowercase `www` | Generic/widened methods and subdomains; baseline normalization edge cases from section 5. |
| Export form | Named and default factories in separate files; whole clients; destructured redirect/uri; grouped factories; exported group builder and extracted `.routes` | Multiple barrels and a second re-emitting downstream library. |
| Extracted functions | Each shortcut, `on`, `group`, `uri`, `match`, separately and in one object, at 0/9/100 routes | Generic `R/G` extractors, specialized nonempty/grouped builders, bound methods as an additional case. |
| Generic client export | `export const clientFactory = router`; direct re-export; explicit `typeof router` annotation | Generic forwarding wrapper preserving `Factories`; record its independent outcome. |
| Toolchain/resolution | Investigation's 7.0.2 raw compiler plus coordinated routing/UI toolchain; public exports map; NodeNext and Bundler where supported | Oldest supported compiler once established; newest supported stable version at implementation time, pinned in CI. |

Use representative combinations, not the entire Cartesian product: every export form at 0/1/9 routes; all count/factory splits with shallow static paths; 100 routes with eight-segment paths/four optionals and separate terminal-wildcard cases; eight nested groups on a small fixture and on a representative 100-route composition. Add the most expensive combined case discovered during measurement.

**Proposed minimum acceptance target:** the existing UI, every investigation inference/probe fixture, 100 routes for all required factory splits, and the required depth/group cases above. This is an engineering target to validate, not a measured safe envelope. Also require no regression on any extended case the additive-fix baseline successfully supports. Record the measured maximum passing combinations, not a misleading single “maximum route count.”

Capture compiler/version, fixture seed/dimensions, diagnostics, largest exported declaration, total declaration bytes, check/emit duration, and peak memory or available compiler diagnostics. Compare three candidates: verified additive baseline, structural eight-type candidate, and named-callable target. Investigate a reproducible >25% median time/memory regression; that number is a proposed review trigger, not a promised performance budget.

## 7. Incremental migration sequence

Each stage must type-check and keep existing tests green. New known-failing external cases initially belong to a diagnostic characterization harness that asserts the documented baseline failure; promote them to mandatory successful emit as their stage lands. Do not disable existing checks to make a stage pass.

If working from original v0.10.6, characterize its known failure and keep it confined to that harness until fixed. If working from the investigation's additive branch, retain its existing exports until the final surface-pruning stage. Do not land a fresh public additive-export release just to provide temporary scaffolding for this refactor.

| Stage | Work and boundaries | Exit gate |
| --- | --- | --- |
| 0. Freeze baseline and harness | Record actual installed toolchain and exports, retain patch/logs as controls, integrate external package fixture and source/emitted assertions. Confirm `types.test-d.ts` is explicitly checked; Vitest's `src/**/*.test.ts` include does not run it. | Runtime suite and current source type checks pass; baseline consumer defects reproduced in the characterization harness; no behavior changes. |
| 1. Isolated feasibility proof | In a future disposable test package, compare eight-type structural signatures with the named-callable target. Start with one GET, extracted GET on empty registry, grouped builder, generic `router` alias, and required URI params. Prove facade/implementation assignability and exact inferred registry. | Zero TS2883/TS7056 and no `any` fallback for the named-callable candidate; no validation regression. If this gate fails, revise design before production migration. |
| 2. Structural registration returns | Change one shortcut, then remaining shortcuts and `on`, to direct `Router` results with anonymous registry. Inline root/group argument shapes where necessary. Keep private validators and current runtime bodies/casts. | All existing runtime/type fixtures pass; concrete named/default factory emit succeeds for converted methods; first/middle/last names survive. Extracted-method characterization may still document its baseline failure. |
| 3. Public callable facade | Add `RouteMethod`, `RouteOn`, and the type-only Router facade; expose builder `uri` as `ClientUri<R>`. Preserve private nominal origin and public fields. Make group signatures structural. | Unannotated extracted methods, group objects/routes, and builder URI emit successfully. Strict assignability, request/response, `RegistryOf`, and no-widening fixtures pass. Runtime JS comparison passes. |
| 4. Client/factory boundary | Add `ClientRedirect`/`ClientUri` public exports and annotate `router` with `ClientFactory`. Use anonymous projected registries in its anonymous result. Retain private `AccumulateRoutes` and `ValidateFactories`. | UI's whole/destructured client emit and unannotated generic alias succeed; cross-factory validations and exact nine-name inference pass from source and emitted declarations. |
| 5. Size and compiler gates | Execute stress matrix and compare representations. Optimize only observed bottlenecks, one change at a time. Evaluate removing the three extra callable names if the eight-type alternative now passes the identical tests. | Required envelope passes; no baseline capacity regression; documented size/performance results; selected final public list recorded. |
| 6. Prune and integrate | Remove obsolete private `Register` machinery where no longer used; remove prototype-only barrel exports if they have not been released. Keep internal shipped declarations required by public types. Wire external emit/consume tests into CI and release validation. | Exact export allowlist, no private routing references in consumer output, all negative tests active, runtime JS unchanged, clean package-only consumption. |

Separate accumulation-algorithm optimization from stages 2–4. Tail-recursive folds or alternate lookup structures may be useful for depth/performance, but combining those changes with alias control makes regressions difficult to attribute.

## 8. External-consumer declaration regression suite

### Package boundary and two-hop validation

Build and assemble a future test package using only the actual published file layout (`package.json` and `build`), including all declaration files it references. Install/copy that package into an isolated consumer's `node_modules/@esportsplus/routing`. Resolve imports through `@esportsplus/routing/client` and its real `exports` map. No `paths` entry for routing, no source redirect, no `build/client/types` deep import, and no extra entry in the exports map.

The isolated test should have two layers:

1. **Library A:** imports routing, exports inferred factories/client/methods, and emits declarations.
2. **Consumer B:** imports only A's emitted declarations and routing's packaged declarations, then performs all positive/negative assertions. Also re-emit a small B library to catch second-hop alias leakage.

Assert resolution actually reaches packaged `build/client/index.d.ts`; trace resolution in the harness when this assertion fails. A monorepo build against source is not sufficient. The purpose of declaration output is the external API contract, as described by the official [TypeScript declaration option](https://www.typescriptlang.org/tsconfig/declaration.html).

Suggested standalone consumer configuration (adapt the module pair for the Bundler leg):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "declaration": true,
    "emitDeclarationOnly": true,
    "noEmitOnError": true,
    "skipLibCheck": false,
    "incremental": false,
    "rootDir": "src",
    "outDir": "dist",
    "declarationDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

Preserve a separate UI-config reproduction leg using its real inherited configuration and coordinated compiler. Override **both** `outDir` and `declarationDir` when isolating that output. Determine the actual raw compiler executable from the installed package; the investigation shows why assuming a `tsc` shim is the raw compiler is unsafe. All builds, temporary packages, generated fixtures, and logs described here are future implementation work, not actions performed for this plan.

### Declaration assertions

Require compiler exit zero and zero emit/declaration diagnostics, specifically including TS2883 and TS7056. Also reject TS2589, TS2590, inaccessible-name diagnostics under other compiler versions, and missing output. Never consume partial declarations from a failed run.

Parse consumer declarations and inspect routing references. Every routing import/reference must target `@esportsplus/routing/client` and one of the selected public names. For the eleven-type target, use the list in section 4.1. Reject consumer references to `Register`, `AccumulateRoutes`, `Registry`, `Root`, `Group`, `EmptyRegistry`, `MergeGroup`, `ValidateFactories`, `ValidateName`, `ValidatePath`, `UriArguments`, `Options`, `RouteOptions`, `RequestState`, `Expand`, `PathsConflict`, `Shape`, `SyntaxError`, `Bucket`, `MergeRegistry`, `PathParamsObject`, and any other private routing export. Also reject absolute workspace paths, `node_modules` paths, and internal package subpaths.

These restrictions apply to **consumer output**. Routing's own declarations may legally contain private helpers and relative imports. Do not use a global string ban that mistakes an unrelated property named `paths` or a test-local alias for a routing import.

Check exact route keys and literal paths with the checker, plus `IsAny` assertions on factory returns, recovered registries, and URI APIs. Reject broadened `string` name unions, lost entries, or accidental `never` registries. Snapshot a few normalized declarations for review, but do not rely on exact whitespace/intersection ordering across compiler versions.

### Reuse the investigation fixtures

Port [route-inference-check.ts](G:/esportsplus/routing-ts2883-investigation/ui/checks/route-inference-check.ts) with its **14 assertions and 10 negative checks**. Preserve the complete union:

```ts
type ExpectedNames =
    | 'components' | 'components.detail'
    | 'css-utilities' | 'css-utilities.detail'
    | 'docs' | 'home' | 'fonts' | 'themes' | 'tokens';
```

Keep each of the six factory-name assertions, `/components/:slug`, the required `slug` tuple for both APIs, and non-`any` checks. Recover the registry through the public `Router<infer T,infer R,infer G>` pattern already used by that fixture, not through a newly exported helper. Keep unknown names, missing/wrong/invalid params, extra static params, and cross-factory name/path-shape negatives. An unused `@ts-expect-error` must fail CI.

Port [declaration-surface-probe.ts](G:/esportsplus/routing-ts2883-investigation/ui/checks/declaration-surface-probe.ts) unchanged in inference style, then extend it with every shortcut, extracted `match`, extracted group `.routes`, nonempty/grouped method extraction, empty clients, and multi-hop re-exports. Do not annotate these exports just to make emit pass.

Repeat language-service completion checks against A's source and against only emitted declarations. Route completions must be the exact nine names above; parameter completion for `components.detail` must include `slug` with required status. Reuse [source completions](G:/esportsplus/routing-ts2883-investigation/completions-source.log) and [emitted completions](G:/esportsplus/routing-ts2883-investigation/completions-emitted.log) as expected results.

### Additional type-level cases

| Area | Positive cases | Negative cases |
| --- | --- | --- |
| Names and chains | Named/unnamed mixed chain; all methods; return from nested/sibling groups; empty-name route does not widen keys | Unknown name; duplicate full name in a chain, group, or another factory; same name across different methods/subdomains still rejected |
| Required params | String/number for all route and group parameters; exact inferred tuples | Missing tuple/object key; wrong key; boolean value |
| Optional params | Omitted object; `{}`; supplied optional keys; required-plus-optional path | Missing required key in mixed path; invalid optional value |
| Wildcards | Required scalar string/number or string/number array; terminal wildcard after group params | Missing wildcard; invalid array elements; nonterminal/empty wildcard syntax |
| Static paths | No argument after name | Any extra parameter object |
| Duplicate shapes | Reuse path in a different method/subdomain; distinct static branch | Same shape, optional-prefix overlap, wildcard shape, within and across factories |
| Parameter conflicts | Same parameter spelling on aligned prefix with different suffixes | `/:id/posts` versus `/:uid/comments`, within and across factories, including group prefixes |
| Syntax | Existing supported required/optional/wildcard paths | Missing leading slash; empty `:`, `?:`, `*:` names; embedded optional/wildcard; wildcard followed by another segment |
| HTTP lists | Readonly method tuple retains all registrations | Duplicate/conflict through any registered bucket; separately characterize mixed existing/new method lists before asserting baseline behavior |
| Factories | Exact `T` inference, explicit compatible responses, returning callbacks, readonly tuples | Incompatible response types; lost names/params after composition |
| Compatibility | Explicit existing Router generic arguments, `RouteFactory<T>` constraints, generic factory helper, current `Request` and middleware contracts | A facade widening route state or accepting previously rejected assignments |

Keep the existing runtime suite covering static/parameter/wildcard precedence and fallback, optional prefix registration and URI stopping, subdomain normalization/overrides/order, middleware cascades, group cleanup on throws, navigation updates, and browser click handling. Compare generated runtime JS for the same five files used in the prior report; explain any nonsemantic build-tool noise rather than silently accepting changed method implementations.

## 9. Compatibility and release policy

The value API and runtime behavior are intended to stay identical. The original six type exports remain, and the target adds five intentional types (or two if the eight-type experiment succeeds). Keep `Router<T,R,G>` and `RouteFactory<T>` generic order, defaults, and accepted usage. A change from a class-derived public type to a facade can still alter variance, nominal compatibility, inference, or declaration augmentation, so “type-only” is not sufficient evidence for backward compatibility.

If none of the prototype's 21 extra exports has shipped, removing them from the development branch does not remove a published API. With full compatibility checks passing, this can be released as a declaration bug fix under the maintainer's policy. Given the facade/generic changes, prefer a reviewed **0.11.0** release unless the maintainer explicitly accepts patch-level compatibility evidence. This is a release recommendation, not a claim that runtime changes require a major release.

If the additive exports have already shipped, those public names must not disappear in a compatible release. Keep deprecated forwarding aliases for the current compatibility line, even if inferred declarations no longer use them. The genuinely minimized export list then requires the project's next breaking release boundary (for example 0.11.0 if that is its pre-1.0 policy). Confirm actual published history before implementation/release planning; the local patch alone cannot answer it. Do not describe deprecation-only retention as having already achieved the eleven-export count.

Likewise, correcting any normalization or validation gaps listed in section 5 may newly reject existing source; keep that separate from this representation refactor and assess its versioning independently.

## 10. Risks, open questions, and recommendation

| Risk or question | Required decision/evidence |
| --- | --- |
| Can the eight-type candidate handle extracted methods? | Prior logs make failure plausible even at zero routes. Use the unannotated probe; accept eight only after full proof. Do not promise it now. |
| Will named callable interfaces remain named in the supported compilers? | Actual downstream emit must demonstrate `RouteMethod`, `RouteOn`, and `ClientFactory` retention and literal type arguments. They are a design hypothesis until stage 1. |
| Can the facade preserve class identity and variance? | Bidirectional assignability and member-level inference checks, without blanket casts. Reject a structural copy that silently drops private-member constraints. |
| What compiler versions are supported? | The investigation pins 7.0.2, but package metadata does not establish a complete supported range. Establish that range and test its endpoints before claiming portability. |
| What route/group limits are safe? | None measured for this design. Publish per-shape stress results and avoid a universal route-count guarantee. |
| Does the existing 100-route file actually run in CI? | Vitest's current include does not cover `types.test-d.ts`; add an explicit compiler check and confirm which inherited build config currently includes it. |
| Do public field exports expose `Node` or `Options`? | Audit them without removing fields. If independent field extraction requires another public contract, document it as a surface-budget decision; do not secretly export the radix implementation. |
| Will symbolic generic wrappers still expose a private fold? | Test separately from direct `const clientFactory = router`; consider whether another result contract is justified only with a concrete failing supported usage. |
| Has the additive patch shipped elsewhere? | Verify published version/export history during implementation; it controls whether helpers can be removed or only deprecated. |
| Can validators remain behaviorally identical during optimization? | Preserve diagnostic/rejection fixtures and avoid changing bucket normalization, optional expansion, tuple handling, or error precedence concurrently. |

Comparison:

| Option | Effort | Public API cost | Breakage/performance risk | Maintainability |
| --- | --- | --- | --- | --- |
| Verified additive export fix | Small; two type-export-list changes plus integrating existing regression fixtures | 27 public types, including accumulator/validator internals | Lowest immediate risk; demonstrated successful emit and unchanged runtime for the retained fixtures | Internals become compatibility obligations; future inferred surfaces can need more exports |
| Structural returns with eight public types | Moderate prototype work; deceptively small initial edit | Best nominal export count | High uncertainty for extracted methods and symbolic factory re-exports; structural expansion can increase size | Attractive only if the complete matrix passes; indiscriminate inlining duplicates implementation details |
| Structural data plus eleven intentional callable/API types | Larger, staged type-design and test effort; allow multiple review cycles, with feasibility first | Small semantic surface; validators/folds remain private | Facade assignability and size limits need proof; less exposed unresolved computation than the eight-type attempt | Better separation between public callable contracts and private algorithms; external emit tests become permanent protection |

**Recommendation:** pursue the staged eleven-type design if minimizing supported internal API is worth a dedicated refactor. Give the eight-type experiment a bounded feasibility gate before production changes, rather than treating its success as a prerequisite that justifies weakening inference. Keep the verified additive fix as the lowest-risk release alternative if this design cannot meet the complete inferred-export and capacity requirements. Do not land an incomplete structural rewrite that merely exchanges TS2883 for TS7056.

The refactor is complete only when ordinary inferred factories and clients, extracted methods/groups, and the generic router alias emit portable declarations through the real package boundary; all positive/negative inference checks survive consuming those declarations; the selected export allowlist is enforced; runtime behavior and JS remain unchanged; and the measured capacity is no worse than the baseline for the required workloads.
