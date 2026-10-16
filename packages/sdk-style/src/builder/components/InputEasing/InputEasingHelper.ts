export const easingGenerics: Record<string, [number, number, number, number]> = {
  // Default
  ease: [0.25, 0.1, 0.25, 1],
  linear: [0, 0, 1, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],

  // Ease In
  easeInQuad: [0.11, 0, 0.5, 0],
  easeInCubic: [0.32, 0, 0.67, 0],
  easeInQuart: [0.5, 0, 0.75, 0],
  easeInQuint: [0.64, 0, 0.78, 0],
  easeInSine: [0.12, 0, 0.39, 0],
  easeInExpo: [0.7, 0, 0.84, 0],
  easeInCirc: [0.55, 0, 1, 0.45],
  easeInBack: [0.36, 0, 0.66, -0.56],

  // Ease Out
  easeOutQuad: [0.5, 1, 0.89, 1],
  easeOutCubic: [0.33, 1, 0.68, 1],
  easeOutQuart: [0.25, 1, 0.5, 1],
  easeOutQuint: [0.22, 1, 0.36, 1],
  easeOutSine: [0.61, 1, 0.88, 1],
  easeOutExpo: [0.16, 1, 0.3, 1],
  easeOutCirc: [0, 0.55, 0.45, 1],
  easeOutBack: [0.34, 1.56, 0.64, 1],

  // Ease In Out
  easeInOutQuad: [0.45, 0, 0.55, 1],
  easeInOutCubic: [0.65, 0, 0.35, 1],
  easeInOutQuart: [0.76, 0, 0.24, 1],
  easeInOutQuint: [0.83, 0, 0.17, 1],
  easeInOutSine: [0.37, 0, 0.63, 1],
  easeInOutExpo: [0.87, 0, 0.13, 1],
  easeInOutCirc: [0.85, 0, 0.15, 1],
  easeInOutBack: [0.68, -0.6, 0.32, 1.6]
};
