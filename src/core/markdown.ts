/**
 * Minimal, safe Markdown → HTML for chat answers. HTML is escaped first, then
 * only our own tags are emitted, so model output can't inject markup. Handles
 * the subset models actually use: bold, italic, code, headings, lists, hr, paras.
 */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

export function renderMarkdown(src: string): string {
  return esc(src.trim())
    .split(/\n{2,}/)
    .map((raw) => {
      const t = raw.trim();
      if (!t) return '';
      if (/^(\*\*\*+|---+|___+)$/.test(t)) return '<hr>';
      const heading = /^(#{1,6})\s+([\s\S]+)$/.exec(t);
      if (heading) return `<h4>${inline(heading[2]!)}</h4>`;
      const lines = t.split('\n');
      if (lines.every((l) => /^\s*\d+\.\s+/.test(l))) {
        return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('')}</ol>`;
      }
      if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${lines.map(inline).join('<br>')}</p>`;
    })
    .join('');
}
