/** The share card's title (R-WEB-14): its size by its length, so a long one still fits in three or four lines. */
export const cardTitle = (title: string): { text: string; size: number } => {
  const text = title.trim();
  if (text.length <= 40) {
    return { text, size: 80 };
  }
  if (text.length <= 80) {
    return { text, size: 66 };
  }
  if (text.length <= 130) {
    return { text, size: 54 };
  }
  // Longer than any title should be: cut at a word, with an ellipsis.
  const cut = text.slice(0, 160);
  return { text: `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`, size: 48 };
};
