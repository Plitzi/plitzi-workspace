const calculatePosition = (containerSize: number, spotSize: number, step = 1, totalSteps = 1) => {
  let newPos = containerSize * (step / (1 + totalSteps));
  if (newPos < spotSize * step) {
    newPos = spotSize * step;

    if (step > 1 && totalSteps > 1) {
      newPos += 2 * (step - 1);
    }
  }

  return newPos;
};

export { calculatePosition };
