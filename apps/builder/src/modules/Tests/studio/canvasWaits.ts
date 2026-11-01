/**
 * The waits for the canvas drawn anew, answered together by the next one mounted: a flow chosen and played at once asks
 * twice, and a wait given up on after `ms` takes only itself away — a choice superseded by another once cleared the
 * wait of the play that followed it, which then never had its page.
 */
export const canvasWaits = (ms: number) => {
  const waiting = new Set<(iframe: HTMLIFrameElement) => void>();

  return {
    wait: () =>
      new Promise<HTMLIFrameElement>((resolve, reject) => {
        const answer = (iframe: HTMLIFrameElement) => {
          clearTimeout(late);
          resolve(iframe);
        };
        const late = setTimeout(() => {
          waiting.delete(answer);
          reject(new Error('The page on the left did not show again in time: choose the journey again.'));
        }, ms);
        waiting.add(answer);
      }),
    mounted: (iframe: HTMLIFrameElement) => {
      const answers = [...waiting];
      waiting.clear();
      answers.forEach(answer => answer(iframe));
    }
  };
};
