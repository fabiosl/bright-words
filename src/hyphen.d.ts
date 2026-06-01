declare module 'hyphen/en-us/index.js' {
  const hyphenator: {
    hyphenateSync: (text: string, options?: { hyphenChar?: string; minWordLength?: number }) => string;
  };

  export default hyphenator;
}

declare module 'hyphen/pt/index.js' {
  const hyphenator: {
    hyphenateSync: (text: string, options?: { hyphenChar?: string; minWordLength?: number }) => string;
  };

  export default hyphenator;
}
