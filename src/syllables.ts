import hyphenateEn from 'hyphen/en-us/index.js';
import hyphenatePt from 'hyphen/pt/index.js';
import type { Story } from './types';

const separator = ' · ';

export function splitIntoSyllables(word: string, story: Story) {
  const match = word.match(/^([^A-Za-zÀ-ÖØ-öø-ÿ]*)([A-Za-zÀ-ÖØ-öø-ÿ]+)([^A-Za-zÀ-ÖØ-öø-ÿ]*)$/);
  if (!match) {
    return word;
  }

  const [, prefix, core, suffix] = match;
  const hyphenator = story.language === 'en-US' ? hyphenateEn : hyphenatePt;
  const split = hyphenator.hyphenateSync(core, {
    hyphenChar: separator,
    minWordLength: 3,
  });

  return `${prefix}${split}${suffix}`;
}
