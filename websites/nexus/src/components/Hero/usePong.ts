import { type RefObject, useEffect } from 'react';

import { IDLE_MS, isIdleAutoplay } from './heroAutoplay';
import { getGameContext, sizeCanvas } from './heroCanvas';
import { keyAxisY } from './heroKeys';
import { isPaused } from './heroPause';
import { minFrameMs } from './heroPerf';
import { type GamePublish } from './heroStore';
import { resumeAudio, sfx } from './heroSfx';
import { isHeroVisible } from './heroVisibility';

type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number };
type Star = { x: number; y: number; r: number; spd: number };

const PADDLE_H = 76;
const PADDLE_W = 11;
const BALL_R = 7;
const EDGE = 26;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const usePong = (canvasRef: RefObject<HTMLCanvasElement | null>, publish: GamePublish) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = getGameContext(canvas);
    if (!ctx) {
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;

    const stars: Star[] = [];
    const particles: Particle[] = [];
    const pointer = { y: 0, active: false, lastMove: 0 };
    const left = { y: 0 };
    const right = { y: 0 };
    const ball = { x: 0, y: 0, vx: 0, vy: 0 };
    const state = { score: 0, level: 0, lives: 3, hits: 0, best: 0 };
    let raf = 0;
    let shake = 0;
    let lastFrame = 0;

    const seedStars = () => {
      stars.length = 0;
      const count = Math.round(Math.min(140, (width * height) / 9000));
      for (let i = 0; i < count; i += 1) {
        stars.push({ x: rand(0, width), y: rand(0, height), r: rand(0.4, 1.6), spd: rand(0.08, 0.5) });
      }
    };

    const serve = (toLeft: boolean) => {
      ball.x = width / 2;
      ball.y = height / 2;
      // Relaxed serve; rallies and a gentle creep ease it up so points still happen without feeling frantic.
      const sp = 3.4;
      ball.vx = (toLeft ? -1 : 1) * sp;
      ball.vy = rand(-2, 2);
      state.level = 0;
    };

    const resize = () => {
      const size = sizeCanvas(canvas, ctx);
      width = size.width;
      height = size.height;
      left.y = left.y || height / 2;
      right.y = right.y || height / 2;
      seedStars();
      if (ball.vx === 0 && ball.vy === 0) {
        serve(Math.random() < 0.5);
      }
    };

    const burst = (x: number, y: number, hue: number, n: number) => {
      for (let i = 0; i < n; i += 1) {
        const a = rand(0, Math.PI * 2);
        const s = rand(0.6, 3);
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, hue });
      }
    };

    const resetGame = () => {
      state.best = Math.max(state.best, state.score);
      state.score = 0;
      state.lives = 3;
      publish({ best: state.best, score: 0, lives: 3, level: 0 });
      serve(Math.random() < 0.5);
    };

    const clampPaddle = (y: number) => Math.max(PADDLE_H / 2, Math.min(height - PADDLE_H / 2, y));

    const bounceOff = (paddleY: number, towardRight: boolean) => {
      const offset = (ball.y - paddleY) / (PADDLE_H / 2);
      const sp = Math.min(8, Math.hypot(ball.vx, ball.vy) + 0.2);
      ball.vx = (towardRight ? 1 : -1) * Math.abs(sp * 0.86);
      ball.vy = offset * sp * 0.7;
      state.level += 1;
      sfx.bounce();
      publish({ level: state.level });
      burst(ball.x, ball.y, 262, 8);
    };

    const update = (now: number) => {
      if (isPaused()) {
        return;
      }

      // Keyboard (↑/↓ or W/S) drives the left paddle directly; otherwise the cursor, and autopilot tracks the ball
      // with lag when idle.
      const ay = keyAxisY();
      if (ay !== 0) {
        left.y = clampPaddle(left.y + ay * 7);
      } else {
        const autopilot = !pointer.active || (isIdleAutoplay() && now - pointer.lastMove > IDLE_MS);
        const leftTarget = autopilot ? ball.y : pointer.y;
        left.y = clampPaddle(left.y + (leftTarget - left.y) * (autopilot ? 0.085 : 0.3));
      }

      // CPU is deliberately imperfect so points actually happen.
      right.y = clampPaddle(right.y + (ball.y + rand(-26, 26) - right.y) * 0.072);

      // Very slow creep so rallies can't last forever, but the ramp stays gentle.
      const sp = Math.hypot(ball.vx, ball.vy);
      if (sp > 0 && sp < 9) {
        ball.vx *= 1.0003;
        ball.vy *= 1.0003;
      }

      ball.x += ball.vx;
      ball.y += ball.vy;

      if (ball.y < BALL_R || ball.y > height - BALL_R) {
        ball.vy *= -1;
        ball.y = Math.max(BALL_R, Math.min(height - BALL_R, ball.y));
      }

      if (ball.vx < 0 && ball.x - BALL_R < EDGE + PADDLE_W && Math.abs(ball.y - left.y) < PADDLE_H / 2 + BALL_R) {
        ball.x = EDGE + PADDLE_W + BALL_R;
        bounceOff(left.y, true);
      }

      if (
        ball.vx > 0 &&
        ball.x + BALL_R > width - EDGE - PADDLE_W &&
        Math.abs(ball.y - right.y) < PADDLE_H / 2 + BALL_R
      ) {
        ball.x = width - EDGE - PADDLE_W - BALL_R;
        bounceOff(right.y, false);
      }

      if (ball.x > width + 30) {
        // Player scored past the CPU.
        state.score += 1;
        state.best = Math.max(state.best, state.score);
        sfx.hit();
        publish({ score: state.score, best: state.best });
        serve(false);
      }

      if (ball.x < -30) {
        // CPU scored — player loses a life.
        state.lives -= 1;
        shake = 12;
        sfx.hurt();
        if (state.lives <= 0) {
          resetGame();

          return;
        }

        publish({ lives: state.lives });
        serve(true);
      }
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      // While paused or scrolled off screen, skip BOTH physics and rendering: the canvas keeps its last frame and the
      // GPU goes idle.
      if (isPaused() || !isHeroVisible()) {
        return;
      }

      // Physics every tick (constant speed); only rendering is throttled in low-performance mode.
      update(now);
      if (now - lastFrame < minFrameMs()) {
        return;
      }

      lastFrame = now;
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = '#fff';
      for (const star of stars) {
        if (!reduced) {
          star.y += star.spd;
          if (star.y > height) {
            star.y = 0;
            star.x = rand(0, width);
          }
        }

        ctx.globalAlpha = star.r / 1.8;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;

      // Center net.
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 12]);
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.save();
      if (shake > 0) {
        ctx.translate(rand(-shake, shake), rand(-shake, shake));
        shake *= 0.85;
        if (shake < 0.4) {
          shake = 0;
        }
      }

      ctx.shadowBlur = 10;
      ctx.shadowColor = '#a78bfa';
      ctx.fillStyle = '#c4b5fd';
      ctx.fillRect(EDGE, left.y - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      ctx.shadowColor = '#7c3aed';
      ctx.fillStyle = '#a78bfa';
      ctx.fillRect(width - EDGE - PADDLE_W, right.y - PADDLE_H / 2, PADDLE_W, PADDLE_H);

      ctx.shadowColor = '#ede9fe';
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      for (let p = particles.length - 1; p >= 0; p -= 1) {
        const part = particles[p];
        part.x += part.vx;
        part.y += part.vy;
        part.vx *= 0.93;
        part.vy *= 0.93;
        part.life -= 0.028;
        ctx.globalAlpha = Math.max(0, part.life);
        ctx.fillStyle = `hsl(${part.hue}, 90%, 72%)`;
        ctx.beginPath();
        ctx.arc(part.x, part.y, Math.max(0, part.life * 2.6), 0, Math.PI * 2);
        ctx.fill();
        if (part.life <= 0) {
          particles.splice(p, 1);
        }
      }

      ctx.globalAlpha = 1;
      ctx.restore();

    };

    const onMove = (e: PointerEvent) => {
      resumeAudio();
      const rect = canvas.getBoundingClientRect();
      pointer.y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
      pointer.active = true;
      pointer.lastMove = performance.now();
    };

    const onLeave = () => {
      pointer.active = false;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    publish({ score: 0, level: 0, lives: 3, hits: 0, best: 0 });
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
    };
  }, [canvasRef, publish]);
};

export default usePong;
