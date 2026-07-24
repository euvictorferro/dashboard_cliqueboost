// src/components/markdown.tsx
// ponytail: parser leve pra um subconjunto do markdown do Trello (negrito, itálico, código,
// links, listas, citação, título, linha horizontal) — não é CommonMark completo (sem tabelas,
// listas aninhadas, etc.), mas cobre o que aparece nas descrições reais dos cards. Constrói nodes
// React diretamente (sem dangerouslySetInnerHTML) pra não abrir espaço pra HTML injetado.
import { Fragment, type ReactNode } from "react";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const key = `${keyPrefix}-${i++}`;
    if (match[2] !== undefined) nodes.push(<strong key={key}>{match[2]}</strong>);
    else if (match[3] !== undefined) nodes.push(<em key={key}>{match[3]}</em>);
    else if (match[4] !== undefined)
      nodes.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 text-[0.9em]">
          {match[4]}
        </code>,
      );
    else if (match[5] !== undefined)
      nodes.push(
        <a key={key} href={match[6]} target="_blank" rel="noopener noreferrer" className="text-brand-accent hover:underline">
          {match[5]}
        </a>,
      );
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function renderBlock(block: string, bi: number): ReactNode {
  if (!block) return null;

  if (/^-{3,}$/.test(block)) return <hr key={bi} className="border-border" />;

  const heading = block.match(/^(#{1,6})\s+(.*)$/);
  if (heading) {
    const level = heading[1].length;
    return (
      <p key={bi} className={level <= 2 ? "text-base font-bold text-card-foreground" : "text-sm font-bold text-card-foreground"}>
        {renderInline(heading[2], `${bi}`)}
      </p>
    );
  }

  const lines = block.split("\n");

  if (lines.every((l) => /^[-*]\s+/.test(l.trim()))) {
    return (
      <ul key={bi} className="list-disc space-y-1 pl-5">
        {lines.map((l, li) => (
          <li key={li}>{renderInline(l.trim().replace(/^[-*]\s+/, ""), `${bi}-${li}`)}</li>
        ))}
      </ul>
    );
  }

  if (lines.every((l) => /^\d+\.\s+/.test(l.trim()))) {
    return (
      <ol key={bi} className="list-decimal space-y-1 pl-5">
        {lines.map((l, li) => (
          <li key={li}>{renderInline(l.trim().replace(/^\d+\.\s+/, ""), `${bi}-${li}`)}</li>
        ))}
      </ol>
    );
  }

  if (lines.every((l) => l.trim().startsWith(">"))) {
    return (
      <blockquote key={bi} className="border-l-2 border-border pl-3 text-muted-foreground">
        {lines.map((l, li) => (
          <p key={li}>{renderInline(l.trim().replace(/^>\s?/, ""), `${bi}-${li}`)}</p>
        ))}
      </blockquote>
    );
  }

  return (
    <p key={bi}>
      {lines.map((l, li) => (
        <Fragment key={li}>
          {li > 0 && <br />}
          {renderInline(l, `${bi}-${li}`)}
        </Fragment>
      ))}
    </p>
  );
}

export function renderMarkdown(text: string): ReactNode {
  const blocks = text.split(/\n{2,}/);
  return <div className="space-y-3">{blocks.map((block, bi) => renderBlock(block.trim(), bi))}</div>;
}
