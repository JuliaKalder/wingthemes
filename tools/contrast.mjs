/**
 * WCAG 2.1 relative luminance and contrast ratios.
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */

export function parseHex(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) throw new Error(`Not a hex color: ${hex}`);
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function channelLuminance(v) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(channelLuminance);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Pairs that must hold for the theme to ship.
 *
 * 4.5 — WCAG AA for normal-size text (1.4.3).
 * 3.0 — WCAG AA for UI components and graphical objects (1.4.11): icons,
 *       focus rings, field borders, separators that carry meaning.
 *
 * Hover/active button backgrounds are deliberately NOT hard-checked: hover is
 * never the sole carrier of information here, so 1.4.11 does not apply. They
 * are reported as info so a regression is still visible.
 */
export const REQUIRED_PAIRS = [
  ['toolbar_text', 'toolbar', 4.5, 'Toolbar label'],
  ['tab_text', 'tab_selected', 4.5, 'Selected tab label'],
  ['tab_background_text', 'frame', 4.5, 'Background tab label'],
  ['toolbar_field_text', 'toolbar_field', 4.5, 'Search field text'],
  ['toolbar_field_text_focus', 'toolbar_field_focus', 4.5, 'Search field text (focused)'],
  ['toolbar_field_highlight_text', 'toolbar_field_highlight', 4.5, 'Autocomplete selection'],
  ['sidebar_text', 'sidebar', 4.5, 'Folder pane text'],
  ['sidebar_highlight_text', 'sidebar_highlight', 4.5, 'Selected folder text'],
  ['popup_text', 'popup', 4.5, 'Menu / popup text'],
  ['popup_highlight_text', 'popup_highlight', 4.5, 'Selected menu item text'],

  ['icons', 'toolbar', 3.0, 'Toolbar icons'],
  ['icons_attention', 'toolbar', 3.0, 'Attention icons (unread, new mail)'],
  ['tab_line', 'tab_selected', 3.0, 'Active tab indicator line'],
  ['toolbar_field_border', 'toolbar', 3.0, 'Search field outline'],
  ['toolbar_field_border_focus', 'toolbar_field_focus', 3.0, 'Focus ring'],
  ['sidebar_border', 'sidebar', 3.0, 'Folder pane divider'],
  ['sidebar_highlight_border', 'sidebar', 3.0, 'Selected folder outline'],
  ['popup_border', 'popup', 3.0, 'Popup outline'],
  ['tab_background_separator', 'frame', 3.0, 'Tab separator'],
  ['toolbar_bottom_separator', 'toolbar', 3.0, 'Toolbar bottom edge'],
  ['toolbar_vertical_separator', 'toolbar', 3.0, 'Toolbar group separator'],
];

export const INFO_PAIRS = [
  ['button_background_hover', 'toolbar', 'Button hover surface'],
  ['button_background_active', 'toolbar', 'Button active surface'],
  ['toolbar', 'frame', 'Toolbar vs. header'],
  ['tab_selected', 'frame', 'Selected tab vs. header'],
];

/**
 * @returns {{failures: Array, results: Array, info: Array}}
 */
export function auditColors(colors) {
  const results = [];
  const failures = [];

  for (const [fg, bg, min, label] of REQUIRED_PAIRS) {
    if (!(fg in colors) || !(bg in colors)) {
      failures.push({ label, fg, bg, min, ratio: null, reason: 'missing color key' });
      continue;
    }
    const ratio = contrastRatio(colors[fg], colors[bg]);
    const entry = { label, fg, bg, min, ratio, pass: ratio >= min };
    results.push(entry);
    if (!entry.pass) failures.push({ ...entry, reason: 'below minimum' });
  }

  const info = INFO_PAIRS.filter(([a, b]) => a in colors && b in colors).map(
    ([a, b, label]) => ({ label, fg: a, bg: b, ratio: contrastRatio(colors[a], colors[b]) })
  );

  return { failures, results, info };
}
