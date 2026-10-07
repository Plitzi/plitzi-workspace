/** Text set inside HTML as text: never markup, whatever it holds. */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/gu, character => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
