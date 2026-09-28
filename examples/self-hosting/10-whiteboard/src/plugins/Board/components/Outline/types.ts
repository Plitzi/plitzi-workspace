/** What the list can do to the board — each one what the canvas does, named by id. */
export type OutlineActions = {
  show: (id: string) => void;
  edit: (id: string) => void;
  toggleDone: (id: string) => void;
  moveCard: (id: string, column: string) => void;
  remove: (id: string) => void;
  addCard: (column: string, text: string) => void;
  addNote: (text: string) => void;
};
