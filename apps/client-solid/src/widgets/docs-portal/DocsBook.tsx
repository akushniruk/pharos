import { For, Show, createMemo, type JSX } from 'solid-js';

import {
  docsRouteUrlForSlug,
  docsSlugForPath,
  slugifyHeading,
} from '@features/docs-portal/slugRoutes';
import { docContentForPath } from '../../lib/docsPortalContent';
import { resolveMarkdownDocLink } from '../../lib/docsMarkdownLinks';

import { MermaidDiagram } from './MermaidDiagram';

type InlinePart =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; label: string; href: string }
  | { type: 'image'; alt: string; src: string }
  | { type: 'strong'; value: string }
  | { type: 'em'; value: string };

function resolveDocAssetSrc(src: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  const base = import.meta.env.BASE_URL;
  const path = src.replace(/^\.?\//, '');
  return `${base}${path}`;
}

function DocLink(props: {
  label: string;
  href: string;
  sourcePath?: string;
  onDocNavigate?: (path: string, fragment?: string) => void;
}) {
  const anchor = createMemo(() => {
    if (!props.sourcePath) {
      return (
        <a class="docs-book-link" href={props.href} target="_blank" rel="noreferrer">
          {props.label}
        </a>
      );
    }
    const r = resolveMarkdownDocLink(
      props.href,
      props.sourcePath,
      (p) => docContentForPath(p) !== undefined,
      (repoPath) => resolveDocAssetSrc(repoPath),
    );
    if (r.kind === 'internal') {
      const slug = docsSlugForPath(r.docPath);
      const url = docsRouteUrlForSlug(slug, r.fragment);
      return (
        <a
          class="docs-book-link"
          href={url}
          onClick={(e) => {
            if (e.defaultPrevented) return;
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            props.onDocNavigate?.(r.docPath, r.fragment);
          }}
        >
          {props.label}
        </a>
      );
    }
    if (r.kind === 'asset') {
      return (
        <a class="docs-book-link" href={r.href} target="_blank" rel="noreferrer">
          {props.label}
        </a>
      );
    }
    return (
      <a class="docs-book-link" href={r.href} target="_blank" rel="noreferrer">
        {props.label}
      </a>
    );
  });
  return <>{anchor()}</>;
}

export interface DocHeading {
  id: string;
  level: number;
  title: string;
}

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let index = 0;
  while (index < text.length) {
    const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)/.exec(text.slice(index));
    if (imageMatch) {
      parts.push({ type: 'image', alt: imageMatch[1], src: imageMatch[2] });
      index += imageMatch[0].length;
      continue;
    }
    const codeStart = text.indexOf('`', index);
    const linkStart = text.indexOf('[', index);
    const strongStart = text.indexOf('**', index);
    const emStart = text.indexOf('*', index);
    let next = -1;
    let mode: 'code' | 'link' | 'strong' | 'em' | null = null;
    if (codeStart >= 0 && (next < 0 || codeStart < next)) {
      next = codeStart;
      mode = 'code';
    }
    if (linkStart >= 0 && (next < 0 || linkStart < next)) {
      next = linkStart;
      mode = 'link';
    }
    if (strongStart >= 0 && (next < 0 || strongStart < next)) {
      next = strongStart;
      mode = 'strong';
    }
    if (
      emStart >= 0
      && (next < 0 || emStart < next)
      && text.slice(emStart, emStart + 2) !== '**'
    ) {
      next = emStart;
      mode = 'em';
    }
    if (next < 0 || mode === null) {
      parts.push({ type: 'text', value: text.slice(index) });
      break;
    }
    if (next > index) {
      parts.push({ type: 'text', value: text.slice(index, next) });
    }
    if (mode === 'code') {
      const codeEnd = text.indexOf('`', next + 1);
      if (codeEnd > next) {
        parts.push({ type: 'code', value: text.slice(next + 1, codeEnd) });
        index = codeEnd + 1;
      } else {
        parts.push({ type: 'text', value: text.slice(next) });
        break;
      }
    } else {
      if (mode === 'link') {
        const labelEnd = text.indexOf(']', next + 1);
        const openParen = labelEnd >= 0 ? text.indexOf('(', labelEnd + 1) : -1;
        const closeParen = openParen >= 0 ? text.indexOf(')', openParen + 1) : -1;
        if (labelEnd > next && openParen === labelEnd + 1 && closeParen > openParen) {
          parts.push({
            type: 'link',
            label: text.slice(next + 1, labelEnd),
            href: text.slice(openParen + 1, closeParen),
          });
          index = closeParen + 1;
        } else {
          parts.push({ type: 'text', value: text.slice(next, next + 1) });
          index = next + 1;
        }
      } else if (mode === 'strong') {
        const end = text.indexOf('**', next + 2);
        if (end > next + 1) {
          parts.push({ type: 'strong', value: text.slice(next + 2, end) });
          index = end + 2;
        } else {
          parts.push({ type: 'text', value: text.slice(next) });
          break;
        }
      } else if (mode === 'em') {
        const end = text.indexOf('*', next + 1);
        if (end > next) {
          parts.push({ type: 'em', value: text.slice(next + 1, end) });
          index = end + 1;
        } else {
          parts.push({ type: 'text', value: text.slice(next) });
          break;
        }
      } else {
        parts.push({ type: 'text', value: text.slice(next, next + 1) });
        index = next + 1;
      }
    }
  }
  return parts;
}

export function extractHeadings(markdown: string): DocHeading[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const counts = new Map<string, number>();
  const headings: DocHeading[] = [];
  for (const line of lines) {
    const match = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!match) continue;
    const level = match[1].length;
    if (level > 3) continue;
    const title = match[2].trim();
    const base = slugifyHeading(title);
    const seen = counts.get(base) ?? 0;
    const id = seen === 0 ? base : `${base}-${seen + 1}`;
    counts.set(base, seen + 1);
    headings.push({ id, level, title });
  }
  return headings;
}

function InlineText(props: {
  text: string;
  sourcePath?: string;
  onDocNavigate?: (path: string, fragment?: string) => void;
}) {
  return (
    <For each={parseInline(props.text)}>
      {(part) => (
        <Show
          when={part.type !== 'text'}
          fallback={<>{part.type === 'text' ? part.value : ''}</>}
        >
          <Show when={part.type === 'code'}>
            <code class="docs-book-inline-code">{part.type === 'code' ? part.value : ''}</code>
          </Show>
          <Show when={part.type === 'link'}>
            <DocLink
              label={part.type === 'link' ? part.label : ''}
              href={part.type === 'link' ? part.href : '#'}
              sourcePath={props.sourcePath}
              onDocNavigate={props.onDocNavigate}
            />
          </Show>
          <Show when={part.type === 'image'}>
            <img
              class="docs-book-inline-img"
              src={part.type === 'image' ? resolveDocAssetSrc(part.src) : ''}
              alt={part.type === 'image' ? part.alt : ''}
              loading="lazy"
              decoding="async"
              width="80"
              height="80"
            />
          </Show>
          <Show when={part.type === 'strong'}>
            <strong>{part.type === 'strong' ? part.value : ''}</strong>
          </Show>
          <Show when={part.type === 'em'}>
            <em>{part.type === 'em' ? part.value : ''}</em>
          </Show>
        </Show>
      )}
    </For>
  );
}

function splitTableRow(line: string): string[] {
  const stripped = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return stripped.split('|').map((cell) => cell.trim());
}

export function MarkdownDocument(props: {
  markdown: string;
  sourcePath?: string;
  onSelectDocPath?: (path: string, fragment?: string) => void;
}) {
  const blocks = createMemo(() => {
    const sourcePath = props.sourcePath;
    const onDocNavigate = props.onSelectDocPath;
    const source = props.markdown.replace(/\r\n/g, '\n');
    const lines = source.split('\n');
    const headingCounts = new Map<string, number>();
    const rendered: JSX.Element[] = [];
    let i = 0;
    let h2Index = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        i += 1;
        continue;
      }
      if (line.startsWith('```')) {
        const language = line.slice(3).trim();
        const body: string[] = [];
        i += 1;
        while (i < lines.length && !lines[i].startsWith('```')) {
          body.push(lines[i]);
          i += 1;
        }
        if (i < lines.length && lines[i].startsWith('```')) i += 1;
        const bodyText = body.join('\n');
        if (language === 'mermaid') {
          rendered.push(
            <div class="docs-book-mermaid-wrap">
              <MermaidDiagram source={bodyText} />
            </div>,
          );
        } else {
          rendered.push(
            <div class="docs-book-codeblock">
              <Show when={language}>
                <div class="docs-book-codeblock-lang">{language}</div>
              </Show>
              <pre class="docs-book-raw-code">{bodyText}</pre>
            </div>,
          );
        }
        continue;
      }
      const heading = /^(#{1,6})\s+(.*)$/.exec(line);
      if (heading) {
        const level = heading[1].length;
        const title = heading[2].trim();
        const base = slugifyHeading(title);
        const seen = headingCounts.get(base) ?? 0;
        const id = seen === 0 ? base : `${base}-${seen + 1}`;
        headingCounts.set(base, seen + 1);
        if (level === 2) {
          h2Index += 1;
          rendered.push(
            <div id={id} class="docs-book-h2-row">
              <span class="docs-book-h2-index">{h2Index}</span>
              <div class="docs-book-h docs-book-h2">
                <InlineText
                  text={title}
                  sourcePath={sourcePath}
                  onDocNavigate={onDocNavigate}
                />
              </div>
            </div>,
          );
        } else {
          rendered.push(
            <div id={id} class={`docs-book-h docs-book-h${level}`}>
              <InlineText
                text={title}
                sourcePath={sourcePath}
                onDocNavigate={onDocNavigate}
              />
            </div>,
          );
        }
        i += 1;
        continue;
      }
      const tableHeader = line.includes('|')
        && i + 1 < lines.length
        && /^\s*\|?[\s:-]+\|[\s|:-]*$/.test(lines[i + 1]);
      if (tableHeader) {
        const head = splitTableRow(line);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
          rows.push(splitTableRow(lines[i]));
          i += 1;
        }
        rendered.push(
          <div class="docs-book-table-wrap">
            <table class="docs-book-table">
              <thead>
                <tr>
                  <For each={head}>
                    {(cell) => (
                      <th>
                        <InlineText
                          text={cell}
                          sourcePath={sourcePath}
                          onDocNavigate={onDocNavigate}
                        />
                      </th>
                    )}
                  </For>
                </tr>
              </thead>
              <tbody>
                <For each={rows}>
                  {(row) => (
                    <tr>
                      <For each={row}>
                        {(cell) => (
                          <td>
                            <InlineText
                              text={cell}
                              sourcePath={sourcePath}
                              onDocNavigate={onDocNavigate}
                            />
                          </td>
                        )}
                      </For>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>,
        );
        continue;
      }
      if (/^\s*[-*]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
          i += 1;
        }
        rendered.push(
          <ul class="docs-book-ul">
            <For each={items}>
              {(item) => (
                <li>
                  <InlineText
                    text={item}
                    sourcePath={sourcePath}
                    onDocNavigate={onDocNavigate}
                  />
                </li>
              )}
            </For>
          </ul>,
        );
        continue;
      }
      if (/^\s*\d+\.\s+/.test(line)) {
        const items: string[] = [];
        let start = 1;
        const startMatch = /^\s*(\d+)\.\s+/.exec(line);
        if (startMatch) start = Number.parseInt(startMatch[1], 10);
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
          i += 1;
        }
        rendered.push(
          <ol class="docs-book-ol" start={start}>
            <For each={items}>
              {(item) => (
                <li>
                  <InlineText
                    text={item}
                    sourcePath={sourcePath}
                    onDocNavigate={onDocNavigate}
                  />
                </li>
              )}
            </For>
          </ol>,
        );
        continue;
      }
      if (/^>\s?/.test(line)) {
        const quoted: string[] = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quoted.push(lines[i].replace(/^>\s?/, ''));
          i += 1;
        }
        rendered.push(
          <aside class="docs-book-callout">
            <For each={quoted}>
              {(item) => (
                <p class="docs-book-callout-line">
                  <InlineText
                    text={item}
                    sourcePath={sourcePath}
                    onDocNavigate={onDocNavigate}
                  />
                </p>
              )}
            </For>
          </aside>,
        );
        continue;
      }
      if (/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(line)) {
        rendered.push(<hr class="docs-book-divider" />);
        i += 1;
        continue;
      }
      const paragraph: string[] = [];
      while (
        i < lines.length
        && lines[i].trim()
        && !/^(#{1,6})\s+/.test(lines[i])
        && !/^\s*[-*]\s+/.test(lines[i])
        && !/^\s*\d+\.\s+/.test(lines[i])
        && !/^>\s?/.test(lines[i])
        && !/^\s*(-{3,}|_{3,}|\*{3,})\s*$/.test(lines[i])
        && !lines[i].startsWith('```')
      ) {
        paragraph.push(lines[i].trim());
        i += 1;
      }
      if (paragraph.length > 0) {
        rendered.push(
          <p class="docs-book-paragraph">
            <InlineText
              text={paragraph.join(' ')}
              sourcePath={sourcePath}
              onDocNavigate={onDocNavigate}
            />
          </p>,
        );
        continue;
      }
      i += 1;
    }
    return rendered;
  });
  return <div class="docs-book-markdown">{blocks()}</div>;
}
