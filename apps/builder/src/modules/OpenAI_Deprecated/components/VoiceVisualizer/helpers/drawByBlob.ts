// Relatives
import { initialCanvasSetup } from './initialCanvasSetup';
import { paintLine } from './paintLine';

export const drawByBlob = ({
  barsData,
  canvas,
  barWidth,
  gap,
  backgroundColor,
  mainBarColor,
  rounded
}: {
  barsData: { max: number }[];
  canvas: HTMLCanvasElement;
  barWidth: number;
  gap: number;
  backgroundColor: string;
  mainBarColor: string;
  rounded: number;
}) => {
  const canvasData = initialCanvasSetup({ canvas, backgroundColor });
  if (!canvasData) {
    return;
  }

  const { context, height } = canvasData;
  barsData.forEach((barData, i) => {
    paintLine({
      context,
      color: mainBarColor,
      rounded,
      x: i * (barWidth + gap * barWidth),
      y: height / 2 - barData.max,
      h: barData.max * 2,
      w: barWidth
    });
  });
};
