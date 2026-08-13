# Accessibility promise

SharpWing claims that every text and UI-component pair in the Thunderbird
chrome meets **WCAG 2.1 Level AA**. This document says exactly what that covers,
what it does not, and how the claim is enforced.

## What is enforced automatically

`node tools/build.mjs` audits the palette before packaging and **refuses to emit
an `.xpi`** if any required pair falls short. The thresholds:

| Tier | Ratio | Applies to |
|---|---|---|
| Text (WCAG 1.4.3) | **4.5:1** | Toolbar labels, tab labels, folder pane, menus, search field, all selection states |
| UI components (WCAG 1.4.11) | **3:1** | Icons, focus ring, field outlines, active-tab indicator, meaningful separators |

The full pair list lives in `REQUIRED_PAIRS` in `tools/contrast.mjs`. Adding a
color key to a palette without adding its pair is the one gap the tooling cannot
catch on its own — extend both together.

Hover and active button surfaces are reported but **not** enforced. Hover is
never the sole carrier of information in Thunderbird's chrome, so 1.4.11 does
not apply; they are printed so a regression stays visible.

The build also rejects any color key Thunderbird does not actually read. The
supported set differs from Firefox's — an unsupported key is silently ignored at
runtime, which looks like a working theme until someone notices the color never
appears.

## A deliberate design decision

`toolbar` vs. `frame` sits at ~1.37:1 (light) and ~1.15:1 (dark). That is
intentional: the header and toolbar are separated by `toolbar_top_separator` and
`toolbar_bottom_separator`, both above 5:1, rather than by a surface-brightness
step. Boundaries drawn with lines survive at any brightness setting; boundaries
drawn with near-identical greys do not.

## What a static theme cannot fix

Be honest about this in the ATN description — over-promising is what turns an
accessibility add-on into a bad review.

- **Message list and message content** are not themeable via `theme.colors`.
  Content rendering follows Thunderbird's own light/dark setting and the
  message's own HTML.
- **Font size, row density, and spacing** are Thunderbird settings
  (*View → Density* / *Font Size*), not theme properties.
- **Focus ring thickness** is fixed by Thunderbird's CSS. The theme controls its
  color and therefore its contrast, not its width.
- **Windows High Contrast Mode** overrides theme colors entirely. That is
  correct behaviour and should not be fought.

Anything beyond the above needs `theme_experiment` or a user-installed
`userChrome.css`, both of which trade away the guarantee that the theme is
purely declarative and cannot break on a Thunderbird update.

## Manual test matrix

Automated contrast checks verify the palette, not the experience. Before each
release, check in a real profile:

- [ ] Light and dark variant, each against Thunderbird's own light **and** dark
      mode (four combinations — `color_scheme` only controls part of the UI)
- [ ] Keyboard-only pass: is the focused element always identifiable?
- [ ] Unread / flagged / tagged messages still distinguishable in the folder pane
- [ ] Search field: empty, focused, with autocomplete open
- [ ] Right-click context menu and the account dropdown (popup colors)
- [ ] macOS *Increase Contrast* and Windows High Contrast Mode: nothing unreadable
- [ ] Zoom to 200%: no clipped or overlapping chrome

## Target

`strict_min_version` is **128.0** (ESR), matching TemplateWing. Note that
`color_scheme: "system"` requires Thunderbird 148+ — the build enforces this
version gate, so raising the floor is a deliberate edit, not an accident.
