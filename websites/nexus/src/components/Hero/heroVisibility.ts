// Whether the hero (and its running game) is on screen. Hero drives this from an IntersectionObserver; the game loops
// read it each frame and freeze when the section scrolls out of view, so a game you can't see stops burning CPU/GPU.
// Kept off the Nexus controls store on purpose — scroll visibility isn't a user action and shouldn't flood the log.
let visible = true;

export const setHeroVisible = (value: boolean) => {
  visible = value;
};

export const isHeroVisible = () => visible;
