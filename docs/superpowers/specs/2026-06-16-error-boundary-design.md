# ErrorBoundary — Design Spec

**Date:** 2026-06-16
**Status:** Approved
**Gap reference:** `GAP_ANALYSIS.md` §17 #7 — "No `ErrorBoundary` components in `src/presentation/`; unhandled component errors show the default white-screen."

## Goal

Stop uncaught render/lifecycle errors from white-screening the whole PWA.
Provide a themed fallback with recovery actions, scoped so a single page
crash does not take down the app shell.

## Decisions (from brainstorming)

1. **Placement:** root **and** per-route.
2. **Logging:** dev-only `console.error`, zero egress, never logs vault state.
   (No remote reporting — would violate strict CSP / zero-CDN-egress.)

## Components

### `src/presentation/components/ErrorBoundary.tsx`
Generic reusable class component (boundaries must be class components).

- State: `{ hasError: boolean; error: Error | null }`.
- `static getDerivedStateFromError(error)` → `{ hasError: true, error }`.
- `componentDidCatch(error, info)` → `if (import.meta.env.DEV) console.error(...)`
  with `error` and `info.componentStack` only. Never serializes props/state
  (avoids leaking decrypted credential data per the no-sensitive-logging rule).
  Calls optional `onError?(error, info)`.
- `reset()` → clears state to `{ hasError: false, error: null }`; calls
  optional `onReset?()`.
- Props:
  - `children: ReactNode`
  - `fallback: (error: Error, reset: () => void) => ReactNode` (render prop)
  - `onReset?: () => void`
  - `onError?: (error, info) => void`
- Render: `hasError ? fallback(error, reset) : children`.

### `src/presentation/components/RouteErrorBoundary.tsx`
Thin functional wrapper that adapts `ErrorBoundary` for route content.

- `useLocation()` → passes `key={pathname}` to `ErrorBoundary` so a route
  change **remounts** the boundary and auto-clears a prior error.
- `useNavigate()` → "Go to dashboard" action in the fallback.
- Supplies the **route fallback**: in-content MUI panel, actions
  **Try again** (`reset`) + **Go to dashboard** (`navigate('/dashboard')`).
- The app shell (`MobileNavigation`, notifications) stays mounted because this
  boundary wraps only `<Suspense><Routes/></Suspense>`.

### Fallback UI
MUI, mirroring `CryptoAPIError.tsx` (Container / centered Box / `Warning`
icon / `Typography` / `Button`). Two variants:
- **App (root):** full-screen "Something went wrong" + **Reload app**
  (`window.location.reload()`). Reset alone may not recover a broken shell.
- **Route:** in-content "This page hit an error" + **Try again** + **Go to
  dashboard**.

App-level fallback may be a small inline function in `App.tsx` (or a tiny
`AppErrorFallback`); route fallback lives in `RouteErrorBoundary.tsx`.

## Placement in `App.tsx`

```
<ThemeProvider><CssBaseline/>
  <ErrorBoundary fallback={appFallback}>      {/* root: shell/provider crashes */}
    <ClipboardNotification/> <MobileNavigation/> ...
    <RouteErrorBoundary>                        {/* per-route, keyed by pathname */}
      <Suspense fallback={<PageLoader/>}>
        <Routes>...</Routes>
      </Suspense>
    </RouteErrorBoundary>
  </ErrorBoundary>
</ThemeProvider>
```

Root boundary sits **inside** `ThemeProvider`/`CssBaseline` so the fallback is
themed. One `RouteErrorBoundary` covers every route — no need to wrap each
`<Route>`.

## Known limitations (documented, out of scope)

React error boundaries catch errors only in render, lifecycle methods, and
constructors of descendants. They do **not** catch: event handlers, async
code (`setTimeout`, promises), SSR, or errors thrown in the boundary itself.

## Testing (vitest + React Testing Library)

`__tests__/ErrorBoundary.test.tsx` with a `ThrowingComponent` helper:
1. Renders children normally when no error.
2. Renders `fallback` when a child throws.
3. `reset()` (Try again) restores children after the child stops throwing.
4. `RouteErrorBoundary`: a thrown route shows the route fallback while a
   sibling shell node still renders (isolation).
5. Changing `pathname` remounts the boundary and clears a prior error.
6. Dev `console.error` is called on catch (and suppressed as expected noise
   in the test via a spy).

## Files

- add `src/presentation/components/ErrorBoundary.tsx`
- add `src/presentation/components/RouteErrorBoundary.tsx`
- add `src/presentation/components/__tests__/ErrorBoundary.test.tsx`
- edit `src/presentation/App.tsx` (wrap with root + route boundaries)
