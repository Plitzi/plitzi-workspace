/**
 * A mutant that does not run — a name it does not define, a type it breaks, a syntax error, a space that does not
 * author, a server that never answers: its failure is its own, and proves nothing a test holds (a tester's mutant
 * naming no defined name read "fails on the mutant: it holds it"; two whose server never started — a module that did not
 * load, a space refused — read "1 of 1 line catches it").
 */
const BROKEN =
  /\b(?:ReferenceError|SyntaxError|TypeError: \S+ is not a function|ProjectModuleError)\b|error TS\d+:|from config\.webServer|the copy's server (?:stopped on an error|did not answer)/;

/** Whether what a check printed says the code it ran never ran: a mutant's own error, or a before that does not serve. */
export const neverRan = (output: readonly string[] | undefined): boolean =>
  (output ?? []).some(each => BROKEN.test(each));
