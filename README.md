# wingthemes

Thunderbird themes powered by wings.

| Theme | Status | What it is |
|---|---|---|
| **SharpWing** | in development | High-contrast light and dark themes. Every text and UI pair meets WCAG AA — enforced by the build, not by hand. |
| _GlassWing_ | planned | Frosted, translucent chrome with a soft accent. |

## Build

Requires Node 18+ and `zip` (both present by default on macOS).

```sh
npm run build              # audit + package every theme into dist/
npm run check              # audit only, write nothing
node tools/build.mjs sharpwing
```

The build prints a contrast table per variant and **exits non-zero if any pair
falls below its WCAG threshold** — a palette that breaks the promise never
becomes an `.xpi`. See [docs/accessibility.md](docs/accessibility.md).

Output: `dist/<slug>-<variant>-<version>.xpi`, ready to upload to ATN or to
install via *Add-ons Manager → Install Add-on From File*.

## Layout

```
themes/<slug>/theme.json   single source of truth — palette + metadata
themes/<slug>/icon.svg
tools/build.mjs            theme.json -> manifest.json -> .xpi, with the audit
tools/contrast.mjs         WCAG luminance math + the checked pairs
docs/accessibility.md      what is guaranteed, what isn't, manual test matrix
```

`manifest.json` is **generated**. Edit `theme.json`; never hand-edit the output
in `dist/`.

## Adding a theme

Copy a directory under `themes/`, change the slug, ids, and palette. The build
picks it up automatically. Each variant is its own add-on with its own id and
its own ATN listing — a static Thunderbird theme carries exactly one palette,
so light and dark cannot share an `.xpi`.

## Releases

Tag per theme, so the two never collide:

```sh
git tag sharpwing-v0.1.0 && git push --tags
```

## License

MIT — see [LICENSE](LICENSE).
