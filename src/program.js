/**
 * Programming Mode Functions
 *
 * Handles robot programming features:
 * - Teaching (capturing positions)
 * - Program execution and playback
 * - Import/export of programs
 * - Step management
 */

import { JOINT_NAMES, ANGLE_THRESHOLD_STRICT, ANGLE_THRESHOLD_LOOSE, MAX_STEP_TIMEOUT, MIN_STEP_DURATION } from './constants.js';
import {
  programMode, setProgramMode,
  programSequence, setProgramSequence,
  programCurrentStep, setProgramCurrentStep,
  programStepStartTime, setProgramStepStartTime,
  programStepInitialized, setProgramStepInitialized,
  targetAngles, setTargetAngles,
  joints
} from './state.js';
import { setFastControlMode, setNormalControlMode } from './physics.js';

/**
 * Capture current robot joint angles
 * Converts angles to degrees and displays in UI
 */
export function captureCurrentAngles() {
  // Convert target angles from radians to degrees
  const currentAngles = targetAngles.map(angle => Math.round(angle * 180 / Math.PI));

  // Display in text area
  const anglesInput = document.getElementById('angles-input');
  if (anglesInput) {
    anglesInput.value = JSON.stringify(currentAngles);
  }

  console.log('Captured angles:', currentAngles);
}

/**
 * Set robot angles from array input
 * Parses JSON array and sets joint angles
 */
export function setAnglesFromArray() {
  const anglesInput = document.getElementById('angles-input');
  if (!anglesInput) return;

  try {
    const angles = JSON.parse(anglesInput.value);

    if (!Array.isArray(angles) || angles.length !== 6) {
      alert('Error: Array must contain exactly 6 values');
      return;
    }

    // Set angles for each joint
    const newTargetAngles = angles.map(angle => angle * Math.PI / 180);
    setTargetAngles(newTargetAngles);

    // Update UI sliders
    angles.forEach((angle, index) => {
      const slider = document.getElementById(`joint${index + 1}`);
      const valueDisplay = document.getElementById(`joint${index + 1}-value`);
      if (slider && valueDisplay) {
        slider.value = angle;
        valueDisplay.textContent = `${angle}°`;
      }
    });

    console.log('Set angles from array:', angles);
  } catch (error) {
    alert('Error: Invalid JSON format. Expected: [deg1, deg2, deg3, deg4, deg5, deg6]');
    console.error('Parse error:', error);
  }
}

/**
 * Add program step from current input
 * Validates and adds step to program sequence
 */
export function addProgramStep() {
  const anglesInput = document.getElementById('angles-input');
  const durationInput = document.getElementById('step-duration');

  if (!anglesInput || !durationInput) return;

  try {
    const angles = JSON.parse(anglesInput.value);
    const duration = parseInt(durationInput.value);

    if (!Array.isArray(angles) || angles.length !== 6) {
      alert('Error: Array must contain exactly 6 values');
      return;
    }

    if (isNaN(duration) || duration <= 0) {
      alert('Error: Duration must be a positive number');
      return;
    }

    // Add to program sequence
    const newSequence = [...programSequence, { angles, duration }];
    setProgramSequence(newSequence);

    // Update program list UI
    updateProgramList();

    console.log('Added step to program:', { angles, duration });
  } catch (error) {
    alert('Error: Invalid JSON format. Expected: [deg1, deg2, deg3, deg4, deg5, deg6]');
    console.error('Parse error:', error);
  }
}

/**
 * Update program list UI
 * Renders all program steps with remove buttons
 */
export function updateProgramList() {
  const programList = document.getElementById('program-list');
  if (!programList) return;

  programList.innerHTML = '';

  programSequence.forEach((step, index) => {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'program-step';
    stepDiv.innerHTML = `
      <span class="step-number">${index + 1}.</span>
      <span class="step-angles">${JSON.stringify(step.angles)}</span>
      <span class="step-duration">${step.duration}ms</span>
      <button class="remove-step-btn" data-index="${index}">Remove</button>
    `;

    // Add remove button event listener
    const removeBtn = stepDiv.querySelector('.remove-step-btn');
    removeBtn.addEventListener('click', () => {
      const newSequence = programSequence.filter((_, i) => i !== index);
      setProgramSequence(newSequence);
      updateProgramList();
    });

    programList.appendChild(stepDiv);
  });

  // Update step count display
  const stepCountDisplay = document.getElementById('step-count');
  if (stepCountDisplay) {
    stepCountDisplay.textContent = programSequence.length;
  }
}

/**
 * Run program from beginning
 * Starts program execution in fast mode
 */
export function runProgram() {
  if (programSequence.length === 0) {
    alert('Error: Program is empty. Add steps first.');
    return;
  }

  if (programMode) {
    alert('Program is already running');
    return;
  }

  setProgramMode(true);
  setProgramCurrentStep(0);
  setProgramStepStartTime(Date.now());
  setProgramStepInitialized(false);

  // Switch to fast execution mode
  setFastControlMode();

  console.log('Starting program with', programSequence.length, 'steps (Fast mode)');

  // Update UI
  const runBtn = document.getElementById('run-program-btn');
  if (runBtn) {
    runBtn.disabled = true;
  }

  const stopBtn = document.getElementById('stop-program-btn');
  if (stopBtn) {
    stopBtn.disabled = false;
  }
}

/**
 * Stop program execution
 * Returns to normal control mode
 */
export function stopProgram() {
  setProgramMode(false);
  setProgramCurrentStep(0);
  setProgramStepStartTime(0);

  // Return to normal speed
  setNormalControlMode();

  console.log('Program stopped');

  // Update UI
  const runBtn = document.getElementById('run-program-btn');
  if (runBtn) {
    runBtn.disabled = false;
  }

  const stopBtn = document.getElementById('stop-program-btn');
  if (stopBtn) {
    stopBtn.disabled = true;
  }

  // Clear current step display
  const currentStepDisplay = document.getElementById('current-step');
  if (currentStepDisplay) {
    currentStepDisplay.textContent = '-';
  }
}

/**
 * Clear all program steps
 * Asks for confirmation before deleting
 */
export function clearProgram() {
  if (programMode) {
    const confirmed = confirm('Program is running. Stop and clear?\n\nWarning: This will delete all taught positions!');
    if (!confirmed) return;
    stopProgram();
  } else {
    const confirmed = confirm('Clear all program steps?\n\nWarning: This will delete all taught positions!');
    if (!confirmed) return;
  }

  setProgramSequence([]);
  updateProgramList();

  console.log('Program cleared');
}

/**
 * Update program execution state
 * Advances through program steps based on joint positions
 * Called every frame when program is running
 */
export function updateProgramExecution() {
  if (!programMode || programSequence.length === 0) return;

  const currentStep = programSequence[programCurrentStep];

  if (!currentStep) {
    // Program completed
    stopProgram();
    console.log('Program completed');
    return;
  }

  // Update current step display
  const currentStepDisplay = document.getElementById('current-step');
  if (currentStepDisplay) {
    currentStepDisplay.textContent = `${programCurrentStep + 1} / ${programSequence.length}`;
  }

  const currentTime = Date.now();
  const elapsedTime = currentTime - programStepStartTime;

  // Initialize step on first execution
  if (!programStepInitialized) {
    const newTargetAngles = currentStep.angles.map(angle => angle * Math.PI / 180);
    setTargetAngles(newTargetAngles);
    console.log('Step', programCurrentStep + 1, 'started:', currentStep.angles);
    setProgramStepInitialized(true);
  }

  // Check if all joints reached target angles
  let allJointsReached = true;
  const jointStatus = [];

  currentStep.angles.forEach((targetAngleDeg, index) => {
    const targetAngleRad = targetAngleDeg * Math.PI / 180;
    const currentAngle = joints[index]?.joint?.angle || 0;
    const angleDiff = Math.abs(targetAngleRad - currentAngle);

    jointStatus.push({
      name: JOINT_NAMES[index],
      target: targetAngleDeg.toFixed(1),
      current: (currentAngle * 180 / Math.PI).toFixed(1),
      diff: (angleDiff * 180 / Math.PI).toFixed(1),
      reached: angleDiff <= ANGLE_THRESHOLD_STRICT
    });

    if (angleDiff > ANGLE_THRESHOLD_STRICT) {
      allJointsReached = false;
    }
  });

  // Check timing conditions
  const minDuration = Math.min(MIN_STEP_DURATION, currentStep.duration);
  const hasMinTimePassed = elapsedTime >= minDuration;
  const hasTimedOut = elapsedTime >= MAX_STEP_TIMEOUT;

  // Loose threshold check for timeout fallback
  let allJointsReachedLoose = true;
  if (hasTimedOut) {
    currentStep.angles.forEach((targetAngleDeg, index) => {
      const targetAngleRad = targetAngleDeg * Math.PI / 180;
      const currentAngle = joints[index]?.joint?.angle || 0;
      const angleDiff = Math.abs(targetAngleRad - currentAngle);

      if (angleDiff > ANGLE_THRESHOLD_LOOSE) {
        allJointsReachedLoose = false;
      }
    });
  }

  // Determine if should move to next step
  // Conditions:
  // 1. Strict: all joints reached AND minimum time passed
  // 2. Timeout: max time passed AND loose threshold reached
  // 3. Force: max time * 1.5 passed (unconditional)
  const shouldMoveNext =
    (allJointsReached && hasMinTimePassed) ||
    (hasTimedOut && allJointsReachedLoose) ||
    (elapsedTime >= MAX_STEP_TIMEOUT * 1.5);

  // Debug logging for slow steps
  if (elapsedTime > 5000 && Math.random() < 0.05) {
    console.log('Step', programCurrentStep + 1, 'progress:');
    console.log('- Elapsed:', (elapsedTime / 1000).toFixed(1), 's');
    console.log('- Joint status:', jointStatus);
  }

  if (shouldMoveNext) {
    // Log completion reason
    if (allJointsReached) {
      console.log('Step', programCurrentStep + 1, 'completed (all joints reached)');
    } else if (hasTimedOut && allJointsReachedLoose) {
      console.warn('Step', programCurrentStep + 1, 'completed (timeout with loose threshold)');
      console.log('- Not reached joints:', jointStatus.filter(j => !j.reached));
    } else {
      console.warn('Step', programCurrentStep + 1, 'forced completion (max timeout)');
      console.log('- Joint status:', jointStatus);
    }

    setProgramCurrentStep(programCurrentStep + 1);
    setProgramStepStartTime(currentTime);
    setProgramStepInitialized(false);

    // Check if more steps exist
    if (programCurrentStep + 1 < programSequence.length) {
      console.log('Moving to step', programCurrentStep + 2);
    } else {
      // Program finished
      stopProgram();
      console.log('Program completed!');
    }
  }
}

/**
 * Export program to JSON file
 * Downloads program as a timestamped JSON file
 */
export function exportProgram() {
  if (programSequence.length === 0) {
    alert('Error: Program is empty. Nothing to export.');
    return;
  }

  // Create program data in JSON format
  const programData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    steps: programSequence
  };

  // Convert to JSON string
  const jsonString = JSON.stringify(programData, null, 2);

  // Create blob
  const blob = new Blob([jsonString], { type: 'application/json' });

  // Create download link
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;

  // Generate filename with timestamp
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = `robot-program-${dateStr}.json`;

  // Trigger download
  document.body.appendChild(a);
  a.click();

  // Cleanup
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('Program exported:', programSequence.length, 'steps');
}

/**
 * Import program from JSON file
 * Validates and loads program from file input
 *
 * @param {Event} event - File input change event
 */
export function importProgram(event) {
  const file = event.target.files[0];

  if (!file) return;

  // Check file type
  if (!file.name.endsWith('.json')) {
    alert('Error: Please select a JSON file (.json)');
    return;
  }

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const jsonString = e.target.result;
      const programData = JSON.parse(jsonString);

      // Version check (for future compatibility)
      if (!programData.version) {
        alert('Warning: Old format detected. Attempting to load...');
      }

      // Validate program steps
      if (!programData.steps || !Array.isArray(programData.steps)) {
        throw new Error('Invalid program format: missing steps array');
      }

      // Validate each step
      for (let i = 0; i < programData.steps.length; i++) {
        const step = programData.steps[i];

        if (!step.angles || !Array.isArray(step.angles) || step.angles.length !== 6) {
          throw new Error(`Invalid step ${i + 1}: angles must be an array of 6 numbers`);
        }

        if (typeof step.duration !== 'number' || step.duration <= 0) {
          throw new Error(`Invalid step ${i + 1}: duration must be a positive number`);
        }
      }

      // Confirm if program is running
      if (programMode) {
        const confirmed = confirm('Program is running. Stop and import new program?');
        if (!confirmed) return;
        stopProgram();
      } else if (programSequence.length > 0) {
        // Confirm if existing program exists
        const confirmed = confirm('Current program will be replaced. Continue?');
        if (!confirmed) return;
      }

      // Import program
      setProgramSequence(programData.steps);
      updateProgramList();

      // Success message
      alert(`Program imported successfully!\n${programData.steps.length} steps loaded.`);
      console.log('Program imported:', programData.steps.length, 'steps');

    } catch (error) {
      alert(`Error importing program:\n${error.message}`);
      console.error('Import error:', error);
    }
  };

  reader.onerror = function() {
    alert('Error: Failed to read file');
    console.error('FileReader error:', reader.error);
  };

  // Read file as text
  reader.readAsText(file);

  // Reset input to allow re-selecting same file
  event.target.value = '';
}

/**
 * Toggle program panel collapsed state
 */
export function toggleProgramPanel() {
  const panel = document.getElementById('program-panel');
  if (!panel) return;
  panel.classList.toggle('collapsed');
}
