/**
 * Input sanitization utilities.
 * Applied to all user-generated text before sending to Supabase.
 */

/**
 * Strip HTML tags to prevent XSS in reviews, descriptions, and names.
 * Preserves unicode characters (Chinese, Arabic, Korean, etc).
 */
export function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

/**
 * Sanitize a text field — strip HTML, trim whitespace, collapse multiple spaces.
 */
export function sanitizeText(input: string): string {
  return stripHtml(input)
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Sanitize a multiline text field (descriptions, reviews).
 * Preserves single line breaks but collapses 3+ into 2.
 */
export function sanitizeMultiline(input: string): string {
  return stripHtml(input)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .trim()
    .replace(/\n{3,}/g, '\n\n');
}
