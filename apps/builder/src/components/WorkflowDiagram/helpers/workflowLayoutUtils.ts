const getSegment = (size: number, steps = 1) => size * (1 / steps);

const getCenter = (size: number, step = 1, steps = 1) => {
  if (step <= 0) {
    step = 1;
  }

  const segment = getSegment(size, steps);
  const segments = (step - 1) * segment;
  const halfSegment = segment / 2;

  return segments + halfSegment;
};

export { getSegment, getCenter };
