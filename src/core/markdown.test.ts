import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders bold, italic and code inline', () => {
    expect(renderMarkdown('**a** *b* `c`')).toBe('<p><strong>a</strong> <em>b</em> <code>c</code></p>');
  });

  it('renders numbered lists', () => {
    expect(renderMarkdown('1. one\n2. two')).toBe('<ol><li>one</li><li>two</li></ol>');
  });

  it('renders headings and hr', () => {
    expect(renderMarkdown('### Titel')).toBe('<h4>Titel</h4>');
    expect(renderMarkdown('***')).toBe('<hr>');
  });

  it('escapes raw HTML to prevent injection', () => {
    expect(renderMarkdown('<script>alert(1)</script>')).toContain('&lt;script&gt;');
    expect(renderMarkdown('<b>x</b>')).not.toContain('<b>');
  });

  it('separates paragraphs and keeps single newlines as breaks', () => {
    expect(renderMarkdown('a\nb\n\nc')).toBe('<p>a<br>b</p><p>c</p>');
  });
});
