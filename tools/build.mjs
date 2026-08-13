#!/usr/bin/env node
/**
 * Builds Thunderbird static themes from themes/<slug>/theme.json.
 *
 * theme.json is the single source of truth: the manifest is generated, never
 * hand-edited. The build refuses to produce an .xpi whose palette violates
 * WCAG AA (see tools/contrast.mjs) or uses a theme key Thunderbird does not
 * support — for an accessibility theme, that guarantee is the product.
 *
 *   node tools/build.mjs              # build every theme
 *   node tools/build.mjs sharpwing    # build one
 *   node tools/build.mjs --check      # audit only, emit nothing
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditColors, contrastRatio } from './contrast.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const THEMES_DIR = path.join(ROOT, 'themes');
const DIST_DIR = path.join(ROOT, 'dist');

/**
 * Theme colors Thunderbird actually reads, per the ThemeType definition:
 * https://webextension-api.thunderbird.net/en/latest/theme.html
 *
 * This is NOT the Firefox list — the two overlap but are not identical.
 * Anything not in here is silently ignored by Thunderbird at runtime, which is
 * exactly the kind of bug that survives review, so we fail the build instead.
 */
const SUPPORTED_COLOR_KEYS = new Set([
  'frame', 'frame_inactive',
  'toolbar', 'toolbar_text',
  'toolbar_bottom_separator', 'toolbar_top_separator', 'toolbar_vertical_separator',
  'tab_selected', 'tab_text', 'tab_background_text', 'tab_background_separator',
  'tab_line', 'tab_loading',
  'icons', 'icons_attention',
  'button_background_hover', 'button_background_active',
  'popup', 'popup_text', 'popup_border', 'popup_highlight', 'popup_highlight_text',
  'sidebar', 'sidebar_text', 'sidebar_border',
  'sidebar_highlight', 'sidebar_highlight_text', 'sidebar_highlight_border',
  'toolbar_field', 'toolbar_field_text', 'toolbar_field_border',
  'toolbar_field_focus', 'toolbar_field_text_focus', 'toolbar_field_border_focus',
  'toolbar_field_highlight', 'toolbar_field_highlight_text',
  'bookmark_text', 'ntp_background', 'ntp_text',
]);

const DEPRECATED_COLOR_KEYS = new Set(['accentcolor', 'textcolor']);

/** Theme property values that need a newer Thunderbird than the default floor. */
const PROPERTY_MIN_VERSION = {
  'color_scheme:system': 148,
  'content_color_scheme:system': 148,
};

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function fail(msg) {
  console.error(`${red('✗')} ${msg}`);
  process.exitCode = 1;
}

function validateVariant(theme, variantName, variant) {
  const where = `${theme.slug}/${variantName}`;
  const problems = [];

  for (const required of ['id', 'name', 'description', 'colors']) {
    if (!variant[required]) problems.push(`${where}: missing "${required}"`);
  }
  if (!variant.colors) return problems;

  for (const [key, value] of Object.entries(variant.colors)) {
    if (DEPRECATED_COLOR_KEYS.has(key)) {
      problems.push(`${where}: "${key}" is deprecated — use frame / tab_background_text`);
    } else if (!SUPPORTED_COLOR_KEYS.has(key)) {
      problems.push(`${where}: "${key}" is not a Thunderbird theme color key`);
    }
    if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(value))) {
      problems.push(`${where}: "${key}" is not a hex color (${value})`);
    }
  }

  const floor = parseInt(theme.strict_min_version, 10);
  for (const prop of ['color_scheme', 'content_color_scheme']) {
    const needed = PROPERTY_MIN_VERSION[`${prop}:${variant[prop]}`];
    if (needed && floor < needed) {
      problems.push(
        `${where}: ${prop}="${variant[prop]}" needs Thunderbird ${needed}+, ` +
        `but strict_min_version is ${theme.strict_min_version}`
      );
    }
  }

  return problems;
}

function buildManifest(theme, variant) {
  const properties = {};
  if (variant.color_scheme) properties.color_scheme = variant.color_scheme;
  if (variant.content_color_scheme) {
    properties.content_color_scheme = variant.content_color_scheme;
  }

  return {
    manifest_version: 2,
    name: variant.name,
    description: variant.description,
    version: theme.version,
    author: theme.author,
    homepage_url: theme.homepage_url,
    browser_specific_settings: {
      gecko: {
        // Thunderbird does not sign add-ons; without an id the theme will not
        // install and ATN will reject the upload.
        id: variant.id,
        strict_min_version: theme.strict_min_version,
      },
    },
    icons: { 128: 'icon.svg' },
    theme: {
      colors: variant.colors,
      ...(Object.keys(properties).length ? { properties } : {}),
    },
  };
}

function printAudit(label, audit) {
  console.log(`\n  ${bold(label)}`);
  for (const r of audit.results) {
    const mark = r.pass ? green('✓') : red('✗');
    const ratio = `${r.ratio.toFixed(2)}:1`.padStart(8);
    console.log(`    ${mark} ${ratio} ${dim(`(min ${r.min})`)}  ${r.label}`);
  }
  for (const i of audit.info) {
    console.log(`    ${dim('·')} ${dim(`${i.ratio.toFixed(2)}:1  ${i.label}`)}`);
  }
}

function packageXpi(stageDir, xpiPath) {
  fs.rmSync(xpiPath, { force: true });
  // -X drops extra file attributes so the archive is reproducible.
  execFileSync('zip', ['-r', '-X', '-q', xpiPath, '.'], { cwd: stageDir });
}

function buildTheme(slug, { checkOnly }) {
  const themeDir = path.join(THEMES_DIR, slug);
  const theme = JSON.parse(fs.readFileSync(path.join(themeDir, 'theme.json'), 'utf8'));
  theme.slug ??= slug;

  console.log(`\n${bold(theme.displayName)} ${dim(`v${theme.version}`)}`);

  let ok = true;
  for (const [variantName, variant] of Object.entries(theme.variants)) {
    const problems = validateVariant(theme, variantName, variant);
    problems.forEach(fail);
    if (problems.length) {
      ok = false;
      continue;
    }

    const audit = auditColors(variant.colors);
    printAudit(variant.name, audit);

    if (audit.failures.length) {
      ok = false;
      for (const f of audit.failures) {
        fail(
          `${variant.name}: ${f.label} — ${f.fg} on ${f.bg} is ` +
          `${f.ratio ? `${f.ratio.toFixed(2)}:1, needs ${f.min}:1` : f.reason}`
        );
      }
      continue;
    }
    if (checkOnly) continue;

    const stageDir = path.join(DIST_DIR, 'build', `${theme.slug}-${variantName}`);
    fs.rmSync(stageDir, { recursive: true, force: true });
    fs.mkdirSync(stageDir, { recursive: true });
    fs.writeFileSync(
      path.join(stageDir, 'manifest.json'),
      JSON.stringify(buildManifest(theme, variant), null, 2) + '\n'
    );
    fs.copyFileSync(path.join(themeDir, 'icon.svg'), path.join(stageDir, 'icon.svg'));

    const xpiPath = path.join(DIST_DIR, `${theme.slug}-${variantName}-${theme.version}.xpi`);
    packageXpi(stageDir, xpiPath);
    console.log(`    ${green('→')} ${path.relative(ROOT, xpiPath)}`);
  }

  return ok;
}

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const requested = args.filter((a) => !a.startsWith('--'));

const slugs = requested.length
  ? requested
  : fs.readdirSync(THEMES_DIR).filter((d) =>
      fs.existsSync(path.join(THEMES_DIR, d, 'theme.json'))
    );

if (!slugs.length) {
  fail('No themes found under themes/');
  process.exit(1);
}

fs.mkdirSync(DIST_DIR, { recursive: true });

let allOk = true;
for (const slug of slugs) {
  if (!buildTheme(slug, { checkOnly })) allOk = false;
}

console.log(
  allOk
    ? `\n${green('All contrast checks passed.')}\n`
    : `\n${red('Build failed — palette does not meet its own promise.')}\n`
);
process.exit(allOk ? 0 : 1);
