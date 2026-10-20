/** A command line as a shell reads it: words split at unquoted spaces, each command of `&&`, `||`, `;` or `|` apart. */
export const shellCommands = (line: string): string[][] => {
  const commands: string[][] = [[]];
  let word: string | undefined;
  let quote: string | undefined;
  const end = (): void => {
    if (word !== undefined) {
      commands[commands.length - 1]?.push(word);
      word = undefined;
    }
  };
  for (let index = 0; index < line.length; index += 1) {
    const char = line.charAt(index);
    if (quote !== undefined) {
      if (char === quote) {
        quote = undefined;
      } else {
        word = (word ?? '') + char;
      }
    } else if (char === '\x22' || char === '\x27') {
      quote = char;
      word = word ?? '';
    } else if (/\s/.test(char)) {
      end();
    } else if (char === ';' || char === '|' || char === '&') {
      end();
      if (commands.at(-1)?.length !== 0) {
        commands.push([]);
      }
    } else {
      word = (word ?? '') + char;
    }
  }

  end();

  return commands.filter(command => command.length > 0);
};
