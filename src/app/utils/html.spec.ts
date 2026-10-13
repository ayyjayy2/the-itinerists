import { escapeHtml, html, safeColor } from './html';

describe('escapeHtml', () => {
  it('turns markup characters into text', () => {
    expect(escapeHtml(`<img src=x onerror="alert(1)">&'`)).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;&#39;');
  });

  it('copes with empty and missing values', () => {
    expect(escapeHtml('')).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(42)).toBe('42');
  });
});

describe('html (escapes every value by default)', () => {
  it('escapes interpolated text', () => {
    const name = '<script>alert(1)</script>';
    expect(String(html`<b>${name}</b>`)).toBe('<b>&lt;script&gt;alert(1)&lt;/script&gt;</b>');
  });

  it('escapes inside attributes, so a value cannot break out of the quotes', () => {
    const v = '" onmouseover="alert(1)';
    expect(String(html`<div title="${v}"></div>`)).toBe('<div title="&quot; onmouseover=&quot;alert(1)"></div>');
  });

  it('keeps fragments it built itself, so pieces can be nested without double escaping', () => {
    const notes = 'a & b';
    const inner = html`<i>${notes}</i>`;
    expect(String(html`<div>${inner}</div>`)).toBe('<div><i>a &amp; b</i></div>');
  });

  it('joins lists of fragments and skips empty values', () => {
    const rows = ['<x>', 'y'].map(t => html`<li>${t}</li>`);
    expect(String(html`<ul>${rows}</ul>`)).toBe('<ul><li>&lt;x&gt;</li><li>y</li></ul>');
    expect(String(html`<p>${null}${undefined}${false}${''}</p>`)).toBe('<p></p>');
  });

  it('a plain string that looks like markup is still escaped, even inside a list', () => {
    expect(String(html`${['<b>']}`)).toBe('&lt;b&gt;');
  });
});

describe('safeColor', () => {
  it('passes real colour codes and replaces anything else with the fallback', () => {
    expect(safeColor('#8BAF7C', '#000')).toBe('#8BAF7C');
    expect(safeColor('#abc', '#000')).toBe('#abc');
    expect(safeColor('red;background:url(x)', '#000')).toBe('#000');
    expect(safeColor('#12345g', '#000')).toBe('#000');
    expect(safeColor(undefined, '#000')).toBe('#000');
  });
});
