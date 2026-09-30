# Interface accessibility and language

`preferences.ts` stores browser preferences and notifies React with
`useSyncExternalStore`. App subscribes so changing language redraws the active
view without remounting the session or clearing forms. Document `lang`, dates
and number formatting follow the selected language. The modal is portaled to
`body` to avoid inheriting the compact sidebar footer typography.

Spanish display strings are the keys in `en.json`. Call `t` (imported as
`translate` in views) on visible text, accessible names, placeholders, tooltips
and messages at the render boundary. Keep identifiers, option values, request
payloads and user-entered content in their original form. Static resource
labels from the management API are also covered by the catalog. No remote
translation service receives operational data.

Dynamic messages use numbered placeholders (`{0}`, `{1}`) in the catalog.
Keep the entire sentence in one template string when its word order changes
between languages. Add both language forms when adding new system messages;
unknown free-form content is shown verbatim, rather than guessed or hidden.

Text sizes use rem so Large text increases them by 25%. High contrast uses
explicit surface, text and border colors. Reduced motion respects both the
user preference and the operating system, including animated numbers and map
marker interpolation. Live data continues updating.

Run `npm run build`, `npm run lint`, and the Playwright accessibility test in
`tests/browser/accessibility.spec.ts`. It covers both language switches,
persistence, keyboard dismissal/focus, main route titles, logistics field
labels, high contrast, text scaling, and desktop/mobile dialog screenshots.
