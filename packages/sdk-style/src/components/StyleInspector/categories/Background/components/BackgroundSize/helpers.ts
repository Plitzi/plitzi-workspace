/** Which of the three ways a size is written: one of the two keywords, or a width and a height. */
export const sizePreset = (size: string): 'cover' | 'contain' | 'custom' =>
  size === 'cover' || size === 'contain' ? size : 'custom';

/** A size as its width and its height. One value is the width, the height then follows the image (`auto`). */
export const sizeParts = (size: string): [string, string] => {
  if (sizePreset(size) !== 'custom') {
    return ['auto', 'auto'];
  }

  const [width = 'auto', height = 'auto'] = size.split(' ').filter(Boolean);

  return [width, height];
};
