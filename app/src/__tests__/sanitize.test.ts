import { stripHtml, sanitizeText, sanitizeMultiline } from '../lib/sanitize';

describe('stripHtml', () => {
  it('removes simple HTML tags', () => {
    expect(stripHtml('<b>bold</b>')).toBe('bold');
  });

  it('removes nested tags', () => {
    expect(stripHtml('<div><p>text</p></div>')).toBe('text');
  });

  it('removes script tags', () => {
    expect(stripHtml('<script>alert("xss")</script>')).toBe('alert("xss")');
  });

  it('preserves plain text', () => {
    expect(stripHtml('just text')).toBe('just text');
  });

  it('preserves unicode characters', () => {
    expect(stripHtml('清真美食 حلال')).toBe('清真美食 حلال');
  });

  it('handles empty string', () => {
    expect(stripHtml('')).toBe('');
  });
});

describe('sanitizeText', () => {
  it('trims whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('collapses multiple spaces', () => {
    expect(sanitizeText('hello    world')).toBe('hello world');
  });

  it('strips HTML and trims', () => {
    expect(sanitizeText('  <b>bold</b>  text  ')).toBe('bold text');
  });

  it('preserves Chinese characters', () => {
    expect(sanitizeText('  牛街惠民小吃  ')).toBe('牛街惠民小吃');
  });

  it('preserves Arabic characters', () => {
    expect(sanitizeText('  الأستاذ كباب  ')).toBe('الأستاذ كباب');
  });

  it('preserves Korean characters', () => {
    expect(sanitizeText('마칸 할랄 레스토랑')).toBe('마칸 할랄 레스토랑');
  });
});

describe('sanitizeMultiline', () => {
  it('preserves single line breaks', () => {
    expect(sanitizeMultiline('line 1\nline 2')).toBe('line 1\nline 2');
  });

  it('preserves double line breaks', () => {
    expect(sanitizeMultiline('para 1\n\npara 2')).toBe('para 1\n\npara 2');
  });

  it('collapses 3+ line breaks into 2', () => {
    expect(sanitizeMultiline('para 1\n\n\n\npara 2')).toBe('para 1\n\npara 2');
  });

  it('strips HTML from multiline text', () => {
    expect(sanitizeMultiline('<p>para 1</p>\n\n<p>para 2</p>')).toBe('para 1\n\npara 2');
  });

  it('trims and collapses spaces within lines', () => {
    const result = sanitizeMultiline('  hello   world  \n  foo  ');
    // Each line has spaces collapsed, whole string is trimmed
    expect(result).toBe('hello world\nfoo');
  });
});
