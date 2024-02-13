// Relatives
import { initialCanvasSetup } from './initialCanvasSetup';
import { paintLine } from './paintLine';
import { paintLineFromCenterToRight } from './paintLineFromCenterToRight';

export const drawByLiveStream = ({
  audioData,
  unit,
  index,
  index2,
  canvas,
  isRecording,
  isPausedRecording,
  picks,
  backgroundColor,
  barWidth,
  mainBarColor,
  rounded,
  animateCurrentPick,
  fullscreen
}) => {
  const canvasData = initialCanvasSetup({ canvas, backgroundColor });
  if (!canvasData) {
    return;
  }

  const { context, height, width, halfWidth } = canvasData;
  const finalWidth = fullscreen ? width : halfWidth;
  if (audioData?.length && isRecording) {
    const maxPick = Math.max(...audioData);

    if (!isPausedRecording) {
      if (index2.current >= barWidth) {
        index2.current = 0;
        const startY = ((height - (maxPick / 258) * height) / height) * 100;
        const barHeight = ((-height + (maxPick / 258) * height * 2) / height) * 100;
        let newPick = null;
        if (index.current === barWidth) {
          newPick = { startY, barHeight };
        }

        if (index.current >= unit) {
          index.current = barWidth;
        } else {
          index.current += barWidth;
        }

        // quantity of picks enough for visualisation
        if (picks.length > finalWidth / barWidth) {
          picks.pop();
        }
        picks.unshift(newPick);
      }

      index2.current += 1;
    }

    if (!fullscreen) {
      paintLineFromCenterToRight({
        context,
        color: mainBarColor,
        rounded,
        width,
        height,
        barWidth
      });
    }

    // animate current pick
    if (animateCurrentPick) {
      paintLine({
        context,
        rounded,
        color: mainBarColor,
        x: finalWidth,
        y: height - (maxPick / 258) * height,
        h: -height + (maxPick / 258) * height * 2,
        w: barWidth
      });
    }

    // picks visualisation
    let x = finalWidth - index2.current;
    picks.forEach(pick => {
      if (pick) {
        paintLine({
          context,
          color: mainBarColor,
          rounded,
          x,
          y: (pick.startY * height) / 100 > height / 2 - 1 ? height / 2 - 1 : (pick.startY * height) / 100,
          h: (pick.barHeight * height) / 100 > 2 ? (pick.barHeight * height) / 100 : 2,
          w: barWidth
        });
      }
      x -= barWidth;
    });
  } else {
    picks.length = 0;
  }
};
