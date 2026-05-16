'use strict';

/* eslint-disable */
/**
 * FlatPaper note container filter
 *   ::: <type> [title]
 *   body
 *   :::
 *
 * Rewrites VitePress-style `:::` blocks to {% note %} tags before Hexo's
 * Nunjucks tag pass, so they share the exact same rendering / collapse /
 * escaping behavior as the {% note %} tag. Old `{% note %}` usage is
 * untouched.
 *
 * The rewrite skips fenced code (``` / ~~~) and 4-space indented code so
 * that ":::" appearing inside code samples is preserved verbatim.
 *
 * Line endings: every "\n" in the patterns is written as "\r?\n" so CRLF
 * sources (common on Windows or with editors that normalize on save) match
 * exactly the same way as LF.
 *
 * Mask tokens use \x00 sentinels written as escapes so the source file
 * stays pure ASCII — embedding raw NUL bytes makes ripgrep / git diff /
 * editor search treat the file as binary.
 */

const NOTE_TYPES = require('./_note-types');

const TYPE_ALT = NOTE_TYPES.join('|');

// One regex, anchored to line starts via /m. Captures: 1=type, 2=title, 3=body.
// `:::` opener must sit on its own line (optional trailing spaces); closer is
// a bare `:::` on its own line. Body is non-greedy so the nearest `:::`
// terminates the block. No nesting support — same constraint as {% note %}.
const NOTE_RE = new RegExp(
  '^:::[ \\t]*(' + TYPE_ALT + ')(?:[ \\t]+([^\\r\\n]*?))?[ \\t]*\\r?\\n' +
  '([\\s\\S]*?)' +
  '^:::[ \\t]*\\r?$',
  'gm'
);

// Mask order matters: fenced code first (multi-line, explicit delimiters),
// then indented code (line-by-line). Inline `code` spans aren't masked —
// `:::` inside an inline span on a single line wouldn't match NOTE_RE anyway
// (the opener regex requires a newline after the title).
const FENCED_RE = /^([ \t]*)(```+|~~~+)[^\r\n]*\r?\n[\s\S]*?\r?\n\1\2[ \t]*\r?$/gm;
const INDENTED_RE = /^(?: {4}|\t)[^\r\n]*(?:\r?\n(?: {4}|\t)[^\r\n]*)*/gm;

const MASK_TOKEN_RE = /\x00FP_NOTE_MASK_(\d+)\x00/g;

function makeToken(i) {
  return '\x00FP_NOTE_MASK_' + i + '\x00';
}

function mask(content) {
  const stash = [];
  let masked = content.replace(FENCED_RE, function (match) {
    const token = makeToken(stash.length);
    stash.push(match);
    return token;
  });
  masked = masked.replace(INDENTED_RE, function (match) {
    const token = makeToken(stash.length);
    stash.push(match);
    return token;
  });
  return { masked: masked, stash: stash };
}

function unmask(content, stash) {
  return content.replace(MASK_TOKEN_RE, function (_, i) {
    return stash[Number(i)];
  });
}

function rewrite(content) {
  return content.replace(NOTE_RE, function (_, type, title, body) {
    const t = (title || '').trim();
    const head = '{% note ' + type + (t ? ' ' + t : '') + ' %}';
    // Trim leading/trailing blank lines inside body so the rendered note
    // doesn't carry an empty paragraph. Hexo's renderMarkdown handles
    // remaining whitespace naturally.
    const inner = body.replace(/^\s*\r?\n/, '').replace(/\s+$/, '');
    return head + '\n' + inner + '\n{% endnote %}';
  });
}

hexo.extend.filter.register('before_post_render', function (data) {
  if (!data || typeof data.content !== 'string') return data;
  if (data.content.indexOf(':::') === -1) return data;

  const m = mask(data.content);
  const rewritten = rewrite(m.masked);
  data.content = unmask(rewritten, m.stash);
  return data;
}, 9);
