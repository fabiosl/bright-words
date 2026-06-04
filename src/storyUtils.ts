export function splitWords(paragraph: string): string[] {
  return paragraph.trim().split(/\s+/).filter(Boolean);
}
