/**
 * UI Event Handlers
 *
 * Sets up all user interface event listeners including:
 * - Joint sliders
 * - Control buttons
 * - Game mode buttons
 * - Programming mode buttons
 * - Panel toggles
 */

import { targetAngles, setTargetAngles, autoGripEnabled, setAutoGripEnabled, grippedBlock, blocks, programMode, setProgramSequence } from './state.js';
import { releaseGrip } from './physics.js';
import { resetRobot } from './robot.js';
import { resetBlocks } from './scene.js';
import { startGame, closeGameResult, toggleGamePanel } from './game.js';
import {
  captureCurrentAngles,
  setAnglesFromArray,
  addProgramStep,
  runProgram,
  stopProgram,
  clearProgram,
  exportProgram,
  importProgram,
  toggleProgramPanel,
  updateProgramList
} from './program.js';

/**
 * Setup all UI event handlers
 * Attaches event listeners to buttons, sliders, and panels
 */
export function setupUI() {
  setupJointSliders();
  setupControlButtons();
  setupGameButtons();
  setupProgramButtons();
  setupPanelToggles();
}

/**
 * Setup joint sliders for manual control
 * Configures 6 joint sliders with value displays
 */
function setupJointSliders() {
  const allJoints = [
    { index: 0, name: 'shoulder_pan', label: 'Shoulder Pan' },
    { index: 1, name: 'shoulder_lift', label: 'Shoulder Lift' },
    { index: 2, name: 'elbow_flex', label: 'Elbow Flex' },
    { index: 3, name: 'wrist_flex', label: 'Wrist Flex' },
    { index: 4, name: 'wrist_roll', label: 'Wrist Roll' },
    { index: 5, name: 'gripper', label: 'Gripper' }
  ];

  allJoints.forEach(({ index }, uiIndex) => {
    const sliderNum = uiIndex + 1;
    const slider = document.getElementById(`joint${sliderNum}`);
    const valueDisplay = document.getElementById(`joint${sliderNum}-value`);

    if (slider && valueDisplay) {
      slider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        const newTargetAngles = [...targetAngles];
        newTargetAngles[index] = value * Math.PI / 180;
        setTargetAngles(newTargetAngles);
        valueDisplay.textContent = `${value}°`;
      });
    }
  });
}

/**
 * Setup control buttons (Reset, Reset Blocks, Reset All, Auto Grip)
 */
function setupControlButtons() {
  // Reset button - reset joint angles only
  const resetBtn = document.getElementById('reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const newTargetAngles = [0, 0, 0, 0, 0, 0];
      setTargetAngles(newTargetAngles);

      for (let i = 1; i <= 6; i++) {
        const slider = document.getElementById(`joint${i}`);
        const valueDisplay = document.getElementById(`joint${i}-value`);
        if (slider && valueDisplay) {
          slider.value = 0;
          valueDisplay.textContent = '0°';
        }
      }
    });
  }

  // Reset Blocks button
  const resetBlocksBtn = document.getElementById('reset-blocks');
  if (resetBlocksBtn) {
    resetBlocksBtn.addEventListener('click', () => {
      resetBlocks(blocks);

      // Release grip if holding a block
      if (grippedBlock) {
        releaseGrip();
      }
    });
  }

  // Reset All button
  const resetAllBtn = document.getElementById('reset-all');
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', resetAll);
  }

  // Auto Grip toggle button
  const toggleGripBtn = document.getElementById('toggle-grip');
  if (toggleGripBtn) {
    toggleGripBtn.addEventListener('click', () => {
      const newAutoGripEnabled = !autoGripEnabled;
      setAutoGripEnabled(newAutoGripEnabled);

      if (newAutoGripEnabled) {
        toggleGripBtn.textContent = 'Auto Grip: ON';
        toggleGripBtn.style.background = '#2ecc71';
      } else {
        toggleGripBtn.textContent = 'Auto Grip: OFF';
        toggleGripBtn.style.background = '#95a5a6';

        // Release grip when turning off
        if (grippedBlock) {
          releaseGrip();
        }
      }
    });
  }
}

/**
 * Setup game mode buttons
 */
function setupGameButtons() {
  // Start Game button
  const startGameBtn = document.getElementById('start-game');
  if (startGameBtn) {
    startGameBtn.addEventListener('click', startGame);
  }

  // Close Result button
  const closeResultBtn = document.getElementById('close-result');
  if (closeResultBtn) {
    closeResultBtn.addEventListener('click', closeGameResult);
  }
}

/**
 * Setup programming mode buttons
 */
function setupProgramButtons() {
  // Teaching button - capture current angles
  const teachBtn = document.getElementById('teach-btn');
  if (teachBtn) {
    teachBtn.addEventListener('click', captureCurrentAngles);
  }

  // Set Angles button - set angles from array
  const setAnglesBtn = document.getElementById('set-angles-btn');
  if (setAnglesBtn) {
    setAnglesBtn.addEventListener('click', setAnglesFromArray);
  }

  // Add Step button - add program step
  const addStepBtn = document.getElementById('add-step-btn');
  if (addStepBtn) {
    addStepBtn.addEventListener('click', addProgramStep);
  }

  // Run Program button
  const runProgramBtn = document.getElementById('run-program-btn');
  if (runProgramBtn) {
    runProgramBtn.addEventListener('click', runProgram);
  }

  // Stop Program button
  const stopProgramBtn = document.getElementById('stop-program-btn');
  if (stopProgramBtn) {
    stopProgramBtn.addEventListener('click', stopProgram);
  }

  // Clear Program button
  const clearProgramBtn = document.getElementById('clear-program-btn');
  if (clearProgramBtn) {
    clearProgramBtn.addEventListener('click', clearProgram);
  }

  // Export Program button
  const exportProgramBtn = document.getElementById('export-program-btn');
  if (exportProgramBtn) {
    exportProgramBtn.addEventListener('click', exportProgram);
  }

  // Import Program button
  const importProgramBtn = document.getElementById('import-program-btn');
  if (importProgramBtn) {
    importProgramBtn.addEventListener('click', () => {
      const fileInput = document.getElementById('import-file-input');
      if (fileInput) {
        fileInput.click();
      }
    });
  }

  // File input change handler
  const importFileInput = document.getElementById('import-file-input');
  if (importFileInput) {
    importFileInput.addEventListener('change', importProgram);
  }
}

/**
 * Setup panel toggle buttons
 */
function setupPanelToggles() {
  // Toggle Program Panel
  const programPanelHeader = document.getElementById('program-panel-header');
  if (programPanelHeader) {
    programPanelHeader.addEventListener('click', toggleProgramPanel);
  }

  // Toggle Game Panel
  const gamePanelHeader = document.getElementById('game-panel-header');
  if (gamePanelHeader) {
    gamePanelHeader.addEventListener('click', toggleGamePanel);
  }
}

/**
 * Reset all - robot, blocks, program, and grip
 * Asks for confirmation before resetting
 */
function resetAll() {
  const confirmed = confirm(
    'Reset everything? This will:\n' +
    '- Reset robot position\n' +
    '- Reset blocks\n' +
    '- Clear program\n' +
    '- Release grip\n\n' +
    'Are you sure?'
  );

  if (!confirmed) return;

  // Stop and clear program if running
  if (programMode) {
    stopProgram();
  }
  setProgramSequence([]);
  updateProgramList();

  // Reset robot
  resetRobot();

  // Reset blocks
  resetBlocks(blocks);

  // Release grip
  if (grippedBlock) {
    releaseGrip();
  }

  // Reset Angle Array input
  const anglesInput = document.getElementById('angles-input');
  if (anglesInput) {
    anglesInput.value = '[0, 0, 0, 0, 0, 0]';
  }

  console.log('All reset completed');
}
