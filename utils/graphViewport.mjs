const MIN_SCALE = 0.78;
const MAX_SCALE = 1.85;
const STEP = 0.12;

export const clampScale = (value) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, Number(value.toFixed(4))));

export const stepScale = (current, direction) => {
  if (direction === "in") {
    return clampScale(current + STEP);
  }
  return clampScale(current - STEP);
};

export const GRAPH_SCALE_LIMITS = {
  min: MIN_SCALE,
  max: MAX_SCALE,
  step: STEP,
};
