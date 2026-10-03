import { describe, expect, it } from 'vitest';

import { createTw, tw } from './tw';
import { authorSpace, container, styles, text, tokens } from '../../index';

import type { SpaceSpec } from '../../schema';

const spaceWith = (classes: string): SpaceSpec => {
  const card = styles('card', tw(classes));

  return {
    name: 'Tw',
    permanentUrl: 'tw',
    classes: { card },
    pages: [{ id: 'home', name: 'Home', slug: '', body: [container({ class: card, children: [text('Hi')] })] }]
  };
};

describe('tw', () => {
  it('writes the rules the classes mean, states beside them', () => {
    expect(
      tw(
        'inline-flex items-center gap-2 px-5 py-2 rounded-full bg-slate-950/90 shadow-[0_0_20px_rgba(6,182,212,0.35)] hover:scale-105'
      )
    ).toEqual({
      css: {
        display: 'inline-flex',
        'align-items': 'center',
        'row-gap': '0.5rem',
        'column-gap': '0.5rem',
        'padding-left': '1.25rem',
        'padding-right': '1.25rem',
        'padding-top': '0.5rem',
        'padding-bottom': '0.5rem',
        'border-top-left-radius': '9999px',
        'border-top-right-radius': '9999px',
        'border-bottom-right-radius': '9999px',
        'border-bottom-left-radius': '9999px',
        'background-color': 'color-mix(in oklab, oklch(12.9% 0.042 264.695) 90%, transparent)',
        'box-shadow': '0 0 20px rgba(6,182,212,0.35)'
      },
      states: { hover: { transform: 'scale(105%, 105%)' } }
    });
  });

  it('turns the breakpoints of Tailwind into the ranges of Plitzi, desktop first', () => {
    expect(tw('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4').css).toEqual({
      desktop: { display: 'grid', 'grid-template-columns': 'repeat(4, minmax(0, 1fr))' },
      tablet: { 'grid-template-columns': 'repeat(2, minmax(0, 1fr))' },
      mobile: { 'grid-template-columns': 'repeat(1, minmax(0, 1fr))' }
    });
    expect(tw('hidden md:flex').css).toEqual({ desktop: { display: 'flex' }, mobile: { display: 'none' } });
    expect(tw('max-md:hidden').css).toEqual({ mobile: { display: 'none' } });
    // Nothing below `md` sets it, so on a phone it is as if no rule did.
    expect(tw('md:px-8').css).toEqual({
      desktop: { 'padding-left': '2rem', 'padding-right': '2rem' },
      mobile: { 'padding-left': 'revert', 'padding-right': 'revert' }
    });
  });

  it('puts a property several classes write together once, a state building on the element′s own parts', () => {
    expect(tw('-translate-x-1/2 rotate-3 hover:scale-110')).toEqual({
      css: { transform: 'translate(-50%, 0px) rotate(3deg)' },
      states: { hover: { transform: 'translate(-50%, 0px) rotate(3deg) scale(110%, 110%)' } }
    });
    expect(tw('bg-linear-to-r from-cyan-500 to-blue-500').css).toEqual({
      'background-image': 'linear-gradient(to right in oklab, oklch(71.5% 0.143 215.221), oklch(62.3% 0.214 259.815))'
    });
    expect(tw('shadow-md ring-2 ring-cyan-400/50').css).toEqual({
      'box-shadow':
        '0 0 0 2px color-mix(in oklab, oklch(78.9% 0.154 211.53) 50%, transparent), 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
    });
    expect(tw('blur-sm grayscale').css).toEqual({ filter: 'blur(8px) grayscale(100%)' });
    expect(tw('transition-colors duration-300').css).toEqual({
      'transition-property':
        'color, background-color, border-color, outline-color, text-decoration-color, fill, stroke',
      'transition-duration': '300ms',
      'transition-timing-function': 'cubic-bezier(0.4, 0, 0.2, 1)'
    });
  });

  it('reads text sizes with their line height, and a line height of its own after the slash', () => {
    expect(tw('text-sm').css).toEqual({ 'font-size': '0.875rem', 'line-height': 'calc(1.25 / 0.875)' });
    expect(tw('text-sm/6 font-semibold tracking-tight').css).toEqual({
      'font-size': '0.875rem',
      'line-height': '1.5rem',
      'font-weight': '600',
      'letter-spacing': '-0.025em'
    });
    expect(tw('text-[13px] text-[#0f172a]').css).toEqual({ 'font-size': '13px', color: '#0f172a' });
  });

  it('writes how the element looks inside an ancestor named by its class', () => {
    expect(tw('opacity-0 group-hover/card:opacity-100')).toEqual({
      css: { opacity: '0' },
      ancestors: { card: { states: { hover: { opacity: '1' } } } }
    });
  });

  it('lets the narrower class win, as Tailwind does, and refuses two that tie', () => {
    expect(tw('px-4 pl-2').css).toMatchObject({ 'padding-left': '0.5rem', 'padding-right': '1rem' });
    expect(() => tw('p-2 p-4')).toThrow(/\[tw-class-conflict\]/);
  });

  it('takes the space′s colours by name', () => {
    const variables = { color: { surface: { light: '#fff', dark: '#111', default: '#fff' } } };
    const themed = createTw({ colors: tokens(variables) });

    expect(themed('bg-surface text-surface/50 border-(--edge)').css).toMatchObject({
      'background-color': 'var(--surface)',
      color: 'color-mix(in oklab, var(--surface) 50%, transparent)',
      'border-top-color': 'var(--edge)'
    });
  });

  it('refuses a class it does not know, and one with no exact equivalent, saying what to write', () => {
    expect(() => tw('itmes-center')).toThrow(/\[tw-unknown-class\].*did you mean "items-center"/s);
    expect(() => tw('sm:flex')).toThrow(/\[tw-no-equivalent\].*tablet 48–64rem/s);
    expect(() => tw('dark:bg-black')).toThrow(/\[tw-no-equivalent\].*both values/s);
    expect(() => tw('space-x-4')).toThrow(/\[tw-no-equivalent\].*gap/s);
    expect(() => tw('group-hover:opacity-100')).toThrow(/group-hover\/<class>/);
    expect(() => tw('ps-4')).toThrow(/physical sides/);
    expect(() => tw('!p-4')).toThrow(/important/);
  });

  it('writes nothing the style editor cannot read back', () => {
    const everything = [
      'relative inset-0 -top-2 left-1/2 z-10 block flex-col flex-wrap items-start justify-between gap-x-3',
      'w-full h-screen min-w-0 max-w-7xl max-h-[80vh] size-10 basis-1/3 grow shrink-0 order-2 self-center',
      'grid-cols-[1fr_2fr] col-span-2 row-span-3 auto-rows-fr mx-auto my-4 -mt-1 p-[18px] aspect-video',
      'font-mono font-bold italic text-lg leading-relaxed tracking-wide text-center uppercase truncate line-clamp-3',
      'underline decoration-2 decoration-rose-500 underline-offset-4 whitespace-nowrap break-words',
      'bg-white bg-cover bg-center bg-no-repeat bg-[url(/hero.jpg)] border-2 border-dashed border-t-slate-200',
      'rounded-t-lg outline outline-offset-2 outline-sky-500 opacity-80 mix-blend-multiply backdrop-blur-md',
      'cursor-pointer select-none pointer-events-auto snap-x snap-start scroll-mt-16 overflow-x-auto',
      'object-cover transition ease-out delay-75 sr-only fill-current stroke-2 accent-pink-500 [mask-type:luminance]'
    ].join(' ');

    expect(() => authorSpace(spaceWith(everything.replace(' [mask-type:luminance]', '')))).not.toThrow();
  });
});
