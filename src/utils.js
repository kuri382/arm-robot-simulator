/**
 * Utility Functions
 *
 * General utility functions that don't fit into other modules
 * - FPS counter
 * - Window resize handling
 */

import { setLastFPSUpdate, setFrameCount } from './state.js';

/**
 * Update FPS display
 * Calculates and displays frames per second
 *
 * @param {number} lastFPSUpdate - Timestamp of last FPS update
 * @param {number} frameCount - Number of frames since last update
 * @returns {{lastFPSUpdate: number, frameCount: number}} Updated FPS tracking state
 */
export function updateFPS(lastFPSUpdate, frameCount) {
  const currentTime = performance.now();

  if (currentTime >= lastFPSUpdate + 1000) {
    const fpsDisplay = document.getElementById('fps');
    if (fpsDisplay) {
      fpsDisplay.textContent = frameCount;
    }

    setFrameCount(0);
    setLastFPSUpdate(currentTime);

    return { lastFPSUpdate: currentTime, frameCount: 0 };
  }

  setFrameCount(frameCount + 1);
  return { lastFPSUpdate, frameCount: frameCount + 1 };
}

/**
 * Hide loading indicator
 * Removes loading screen after initialization
 */
export function hideLoading() {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
  }
}

/**
 * Show error message in loading screen
 *
 * @param {string} message - Error message to display
 */
export function showError(message) {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = `<div style="color: red;">${message}</div>`;
  }
}
