// src/utils/exponentialProgress.ts
// Exponential progress curve: fast to 70%, then slow to 100%

/**
 * Converts linear progress (0-100) to exponential curve
 * Fast progress to 70%, then gradually slows down to 100%
 *
 * Formula: Uses logarithmic curve for first 70%, then linear slowdown
 *
 * @param linearProgress - Linear progress from 0 to 100
 * @returns Exponential progress that visually feels faster at start
 */
export function toExponentialProgress(linearProgress: number): number {
  // Clamp input to 0-100
  const p = Math.max(0, Math.min(100, linearProgress));

  // Exponential curve parameters
  // We want:
  // - At 30% linear → 70% visual
  // - At 100% linear → 100% visual

  if (p <= 30) {
    // Fast phase: 0-30% linear maps to 0-70% visual
    // Using ease-out curve for rapid initial progress
    const t = p / 30; // Normalize to 0-1
    const eased = 1 - Math.pow(1 - t, 2); // Quadratic ease-out
    return eased * 70;
  } else {
    // Slow phase: 30-100% linear maps to 70-100% visual
    const t = (p - 30) / 70; // Normalize to 0-1
    const eased = Math.pow(t, 2); // Quadratic ease-in (slows down)
    return 70 + eased * 30;
  }
}

/**
 * Creates a smooth animated progress updater
 * Animates from current to target using exponential curve
 *
 * @param setProgress - State setter for progress value
 * @param targetProgress - Target linear progress (0-100)
 * @param duration - Animation duration in ms (default 300)
 */
export function animateToProgress(
  setProgress: (value: number) => void,
  currentLinear: number,
  targetLinear: number,
  duration: number = 300
): void {
  const startTime = Date.now();
  const startValue = currentLinear;
  const deltaValue = targetLinear - startValue;

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(1, elapsed / duration);

    // Ease-out animation for smooth feeling
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const newLinear = startValue + deltaValue * easedProgress;

    setProgress(toExponentialProgress(newLinear));

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
}

/**
 * Starts a fake progress animation that accelerates quickly then slows
 * Useful when actual progress is unknown
 *
 * @param setProgress - State setter for progress value
 * @param onComplete - Callback when animation reaches near-end (95%)
 * @returns Cleanup function to stop animation
 */
export function startFakeProgress(
  setProgress: (value: number) => void,
  onNearComplete?: () => void
): () => void {
  let linearProgress = 0;
  let rafId: number;
  let lastTime = Date.now();
  let nearCompleteCalled = false;

  const animate = () => {
    const now = Date.now();
    const delta = now - lastTime;
    lastTime = now;

    // Progress speed varies by phase
    // Fast at start, slowing down significantly after 70%
    let speed: number;
    if (linearProgress < 30) {
      // Very fast: get to 30% in ~2 seconds
      speed = 15; // % per second
    } else if (linearProgress < 60) {
      // Medium: 30-60% in ~4 seconds
      speed = 7.5;
    } else if (linearProgress < 90) {
      // Slow: 60-90% in ~8 seconds
      speed = 3.75;
    } else {
      // Very slow: crawl to 95%
      speed = 0.5;
      // Stop at 95% - let actual completion push to 100%
      if (linearProgress >= 95) {
        if (!nearCompleteCalled && onNearComplete) {
          nearCompleteCalled = true;
          onNearComplete();
        }
        return; // Stop animating
      }
    }

    linearProgress += (speed * delta) / 1000;
    linearProgress = Math.min(95, linearProgress);

    setProgress(toExponentialProgress(linearProgress));

    rafId = requestAnimationFrame(animate);
  };

  rafId = requestAnimationFrame(animate);

  return () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
    }
  };
}

/**
 * Completes progress animation smoothly from current to 100%
 *
 * @param setProgress - State setter for progress value
 * @param currentProgress - Current visual progress (0-100)
 * @param duration - Animation duration in ms (default 500)
 */
export function completeProgress(
  setProgress: (value: number) => void,
  currentProgress: number,
  duration: number = 500
): Promise<void> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const startValue = currentProgress;
    const deltaValue = 100 - startValue;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);

      // Ease-out for satisfying completion
      const easedProgress = 1 - Math.pow(1 - progress, 2);
      const newProgress = startValue + deltaValue * easedProgress;

      setProgress(newProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    };

    requestAnimationFrame(animate);
  });
}
