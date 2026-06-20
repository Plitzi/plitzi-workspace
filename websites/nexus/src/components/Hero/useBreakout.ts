import { type RefObject, useEffect } from 'react';

import { IDLE_MS, isIdleAutoplay } from './heroAutoplay';
import { minFrameMs } from './heroPerf';
import { type GamePublish } from './heroStore';
import { resumeAudio, sfx } from './heroSfx';

type Brick = { x: number; y: number; w: number; h: number; alive: boolean; hue: number };
type PowerKind = 'wide' | 'slow' | 'life';
type Power = { x: number; y: number; kind: PowerKind };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number };
type Star = { x: number; y: number; r: number; spd: number };

const PADDLE_W = 96;
const PADDLE_H = 12;
const BALL_R = 6;
const POWER_COLORS: Record<PowerKind, string> = { wide: '#34d399', slow: '#60a5fa', life: '#f472b6' };
const POWER_LETTER: Record<PowerKind, string> = { wide: 'W', slow: 'S', life: '+' };
const POWER_KINDS: PowerKind[] = ['wide', 'slow', 'wide', 'slow', 'life'];

const rand = (min: number, max: number) => min + Math.random() * (max - min);

const useBreakout = (canvasRef: RefObject<HTMLCanvasElement | null>, publish: GamePublish) => {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;

    const stars: Star[] = [];
    const bricks: Brick[] = [];
    const powers: Power[] = [];
    const particles: Particle[] = [];
    const pointer = { x: 0, active: false, lastMove: 0 };
    const paddle = { x: 0, y: 0 };
    const ball = { x: 0, y: 0, vx: 0, vy: 0 };
    const state = { score: 0, level: 1, lives: 3, hits: 0, best: 0 };
    let raf = 0;
    let shake = 0;
    let lastFrame = 0;
    let wideUntil = 0;

    const paddleWidth = (now: number) => (now < wideUntil ? PADDLE_W * 1.6 : PADDLE_W);

    const seedStars = () => {
      stars.length = 0;
      const count = Math.round(Math.min(140, (width * height) / 9000));
      for (let i = 0; i < count; i += 1) {
        stars.push({ x: rand(0, width), y: rand(0, height), r: rand(0.4, 1.6), spd: rand(0.08, 0.5) });
      }
    };

    const launchBall = () => {
      ball.x = paddle.x;
      ball.y = paddle.y - 18;
      // Gentler opening: slower base speed, a small bump per level.
      const sp = 2.8 + state.level * 0.35;
      ball.vx = rand(-1, 1) * sp * 0.5;
      ball.vy = -sp;
    };

    const buildLevel = () => {
      bricks.length = 0;
      const cols = Math.max(6, Math.min(14, Math.floor((width - 80) / 60)));
      const rows = 5;
      const gap = 8;
      const brickW = (width - 80 - gap * (cols - 1)) / cols;
      const brickH = 16;
      const startX = 40;
      const startY = 130;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          bricks.push({
            x: startX + c * (brickW + gap),
            y: startY + r * (brickH + gap),
            w: brickW,
            h: brickH,
            alive: true,
            hue: 248 + r * 8
          });
        }
      }

      launchBall();
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paddle.y = height - 40;
      paddle.x = paddle.x || width / 2;
      seedStars();
      if (!bricks.length) {
        buildLevel();
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
      state.level = 1;
      state.lives = 3;
      publish({ best: state.best, score: 0, level: 1, lives: 3 });
      buildLevel();
    };

    const update = (now: number) => {
      const alive = bricks.filter(b => b.alive);
      if (!alive.length) {
        state.level += 1;
        publish({ level: state.level });
        buildLevel();

        return;
      }

      const pw = paddleWidth(now);

      // Autopilot tracks the ball with a touch of lag; the cursor takes over instantly.
      const autopilot = !pointer.active || (isIdleAutoplay() && now - pointer.lastMove > IDLE_MS);
      const target = autopilot ? ball.x : pointer.x;
      paddle.x += (target - paddle.x) * (autopilot ? 0.1 : 0.25);
      paddle.x = Math.max(pw / 2, Math.min(width - pw / 2, paddle.x));

      ball.x += ball.vx;
      ball.y += ball.vy;

      if (ball.x < BALL_R || ball.x > width - BALL_R) {
        ball.vx *= -1;
        ball.x = Math.max(BALL_R, Math.min(width - BALL_R, ball.x));
      }

      if (ball.y < BALL_R) {
        ball.vy *= -1;
        ball.y = BALL_R;
      }

      if (
        ball.vy > 0 &&
        ball.y + BALL_R > paddle.y &&
        ball.y < paddle.y + PADDLE_H &&
        ball.x > paddle.x - pw / 2 &&
        ball.x < paddle.x + pw / 2
      ) {
        const offset = (ball.x - paddle.x) / (pw / 2);
        const sp = Math.hypot(ball.vx, ball.vy);
        ball.vx = offset * sp * 0.8;
        ball.vy = -Math.abs(Math.sqrt(Math.max(1, sp * sp - ball.vx * ball.vx)));
        ball.y = paddle.y - BALL_R;
        sfx.bounce();
      }

      for (const brick of alive) {
        if (
          ball.x > brick.x &&
          ball.x < brick.x + brick.w &&
          ball.y - BALL_R < brick.y + brick.h &&
          ball.y + BALL_R > brick.y
        ) {
          brick.alive = false;
          ball.vy *= -1;
          state.score += 10 * state.level;
          state.hits += 1;
          state.best = Math.max(state.best, state.score);
          sfx.hit();
          burst(ball.x, ball.y, brick.hue, 10);
          publish({ score: state.score, hits: state.hits, best: state.best });
          if (powers.length < 2 && Math.random() < 0.14) {
            powers.push({
              x: brick.x + brick.w / 2,
              y: brick.y,
              kind: POWER_KINDS[Math.floor(rand(0, POWER_KINDS.length))]
            });
          }

          break;
        }
      }

      // Falling power-ups, caught on the paddle.
      for (let p = powers.length - 1; p >= 0; p -= 1) {
        const power = powers[p];
        power.y += 2.6;
        if (power.y > height) {
          powers.splice(p, 1);
          continue;
        }

        if (power.y > paddle.y - 8 && Math.abs(power.x - paddle.x) < pw / 2 + 8) {
          powers.splice(p, 1);
          if (power.kind === 'wide') {
            wideUntil = now + 8000;
          } else if (power.kind === 'slow') {
            ball.vx *= 0.62;
            ball.vy *= 0.62;
          } else {
            state.lives = Math.min(5, state.lives + 1);
            publish({ lives: state.lives });
          }

          sfx.power();
          burst(power.x, power.y, 50, 14);
        }
      }

      if (ball.y > height + 20) {
        state.lives -= 1;
        shake = 12;
        sfx.hurt();
        if (state.lives <= 0) {
          resetGame();

          return;
        }

        publish({ lives: state.lives });
        launchBall();
      }
    };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
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
      ctx.save();
      if (shake > 0) {
        ctx.translate(rand(-shake, shake), rand(-shake, shake));
        shake *= 0.85;
        if (shake < 0.4) {
          shake = 0;
        }
      }

      ctx.shadowBlur = 8;
      for (const brick of bricks) {
        if (!brick.alive) {
          continue;
        }

        const color = `hsl(${brick.hue}, 80%, 66%)`;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.fillRect(brick.x, brick.y, brick.w, brick.h);
      }

      const pw = paddleWidth(now);
      ctx.shadowColor = '#a78bfa';
      ctx.fillStyle = '#c4b5fd';
      ctx.fillRect(paddle.x - pw / 2, paddle.y, pw, PADDLE_H);

      ctx.shadowColor = '#ede9fe';
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
      ctx.fill();

      // Falling power-ups.
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const power of powers) {
        const color = POWER_COLORS[power.kind];
        ctx.shadowColor = color;
        ctx.strokeStyle = color;
        ctx.fillStyle = `${color}22`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(power.x, power.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(POWER_LETTER[power.kind], power.x, power.y + 0.5);
      }

      ctx.textAlign = 'start';
      ctx.textBaseline = 'alphabetic';

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
      pointer.x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      pointer.active = true;
      pointer.lastMove = performance.now();
    };

    const onLeave = () => {
      pointer.active = false;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    publish({ score: 0, level: 1, lives: 3, hits: 0, best: 0 });
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

export default useBreakout;
