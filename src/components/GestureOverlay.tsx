// src/components/GestureOverlay.tsx
// Invisible overlay for gesture detection:
// - Triple-tap top-right corner: Open diagnostics
// - Double-tap bottom area: Skip current screen

import { useRef, useCallback } from 'react';

interface GestureOverlayProps {
  onTripleTapTopRight: () => void;
  onDoubleTapBottom: () => void;
}

export function GestureOverlay({ onTripleTapTopRight, onDoubleTapBottom }: GestureOverlayProps) {
  const topRightTapsRef = useRef<number[]>([]);
  const bottomTapsRef = useRef<number[]>([]);

  // Triple-tap detection for top-right corner (within 500ms between taps)
  const handleTopRightTap = useCallback(() => {
    const now = Date.now();
    const taps = topRightTapsRef.current;

    // Remove old taps (older than 1 second)
    const recentTaps = taps.filter(t => now - t < 1000);
    recentTaps.push(now);
    topRightTapsRef.current = recentTaps;

    console.log(`[GestureOverlay] Top-right tap count: ${recentTaps.length}`);

    if (recentTaps.length >= 3) {
      console.log('[GestureOverlay] Triple-tap detected! Opening diagnostics...');
      topRightTapsRef.current = [];
      onTripleTapTopRight();
    }
  }, [onTripleTapTopRight]);

  // Double-tap detection for bottom area (within 400ms between taps)
  const handleBottomTap = useCallback(() => {
    const now = Date.now();
    const taps = bottomTapsRef.current;

    // Remove old taps (older than 600ms)
    const recentTaps = taps.filter(t => now - t < 600);
    recentTaps.push(now);
    bottomTapsRef.current = recentTaps;

    console.log(`[GestureOverlay] Bottom tap count: ${recentTaps.length}`);

    if (recentTaps.length >= 2) {
      console.log('[GestureOverlay] Double-tap detected! Skipping screen...');
      bottomTapsRef.current = [];
      onDoubleTapBottom();
    }
  }, [onDoubleTapBottom]);

  return (
    <>
      {/* Top-right corner tap zone (100x100px) - invisible */}
      <div
        className="fixed top-0 right-0 w-24 h-24 z-[9999] cursor-pointer"
        onClick={handleTopRightTap}
        onTouchEnd={handleTopRightTap}
        style={{ backgroundColor: 'transparent' }}
        aria-label="Triple-tap for diagnostics"
      />

      {/* Bottom area tap zone (full width, 120px tall) - invisible */}
      <div
        className="fixed bottom-0 left-0 right-0 h-28 z-[9999] cursor-pointer"
        onClick={handleBottomTap}
        onTouchEnd={handleBottomTap}
        style={{ backgroundColor: 'transparent' }}
        aria-label="Double-tap to skip"
      />
    </>
  );
}
