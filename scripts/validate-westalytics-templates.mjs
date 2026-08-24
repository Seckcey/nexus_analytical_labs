// Guards the Jinja templates Westalytics is allowed to edit automatically.
// Every template must stay valid UTF-8 with balanced Jinja delimiters
// ({% %}, {{ }}, {# #}), matched block/if/for tags, balanced HTML comments,
// and at most one <title>, <h1> and meta description per file. Because pages
// inherit from base.html, the templates together must contain exactly one
// <title> and at least one meta description. Node built-ins only; run from
// anywhere: node scripts/validate-westalytics-templates.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const templatesRoot = join(repositoryRoot, 'templates');

const failures = [];
let checkedFiles = 0;
let titleTotal = 0;
let metaDescriptionTotal = 0;

function collectTemplates(directory) {
  const results = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectTemplates(fullPath));
    } else if (fullPath.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

function count(source, pattern) {
  return (source.match(pattern) || []).length;
}

function checkTemplate(filePath) {
  const label = relative(repositoryRoot, filePath).replaceAll('\\', '/');
  const bytes = readFileSync(filePath);
  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    failures.push(`${label}: not valid UTF-8`);
    return;
  }
  checkedFiles += 1;

  const pairs = [
    ['{%', /\{%/g, '%}', /%\}/g],
    ['{{', /\{\{/g, '}}', /\}\}/g],
    ['{#', /\{#/g, '#}', /#\}/g],
    ['<!--', /<!--/g, '-->', /-->/g],
  ];
  for (const [openName, openPattern, closeName, closePattern] of pairs) {
    const opens = count(source, openPattern);
    const closes = count(source, closePattern);
    if (opens !== closes) {
      failures.push(`${label}: ${opens} "${openName}" but ${closes} "${closeName}"`);
    }
  }

  const tags = [
    ['block', /\{%-?\s*block\s/g, /\{%-?\s*endblock/g],
    ['if', /\{%-?\s*if\s/g, /\{%-?\s*endif/g],
    ['for', /\{%-?\s*for\s/g, /\{%-?\s*endfor/g],
  ];
  for (const [name, openPattern, closePattern] of tags) {
    const opens = count(source, openPattern);
    const closes = count(source, closePattern);
    if (opens !== closes) {
      failures.push(`${label}: ${opens} {% ${name} %} but ${closes} {% end${name} %}`);
    }
  }

  const titles = count(source, /<title[\s>]/gi);
  if (titles > 1) failures.push(`${label}: expected at most one <title>, found ${titles}`);
  titleTotal += titles;

  const headings = count(source, /<h1[\s>]/gi);
  if (headings > 1) failures.push(`${label}: expected at most one <h1>, found ${headings}`);

  const descriptions = count(source, /<meta[^>]*name\s*=\s*["']description["']/gi);
  if (descriptions > 1) {
    failures.push(`${label}: expected at most one meta description, found ${descriptions}`);
  }
  metaDescriptionTotal += descriptions;
}

for (const filePath of collectTemplates(templatesRoot)) {
  checkTemplate(filePath);
}
if (titleTotal !== 1) {
  failures.push(`templates: expected exactly one <title> across all templates, found ${titleTotal}`);
}
if (metaDescriptionTotal < 1) {
  failures.push('templates: no meta description remains in any template');
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `PASS: ${checkedFiles} templates checked (balanced Jinja and comments, single title, meta description present).\n`
  );
}
