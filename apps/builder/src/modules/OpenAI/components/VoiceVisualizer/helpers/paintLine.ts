export const paintLine = ({
  context,
  color,
  rounded,
  x,
  y,
  w,
  h
}: {
  context: CanvasRenderingContext2D;
  color: string;
  rounded: number;
  x: number;
  y: number;
  w: number;
  h: number;
}) => {
  context.fillStyle = color;
  context.beginPath();

  if (typeof context.roundRect !== 'undefined') {
    // ensuring roundRect is supported by the browser
    context.roundRect(x, y, w, h, rounded);
    context.fill();
  } else {
    // Fallback for browsers that do not support roundRect
    context.fillRect(x, y, w, h);
  }
};
