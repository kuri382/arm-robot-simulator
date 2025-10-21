/**
 * SO-ARM101 Robot Simulator - Main Entry Point
 *
 * A web-based physics simulation for the SO-ARM101 robotic arm featuring:
 * - Real-time 3D visualization using Three.js
 * - Physics simulation with Rapier3D
 * - URDF model loading
 * - Interactive joint control
 * - Programming mode for teaching and playback
 * - Game mode for block stacking challenges
 *
 * @author ABEJA PhysicalAI Team
 * @license MIT
 */

import {
  initPhysics,
  initScene,
  initCamera,
  initRenderer,
  initControls,
  setupLighting,
  createGround,
  createPlatform,
  createBlocks,
  onWindowResize
} from './scene.js';
import { loadRobot } from './robot.js';
import {
  updateRobot,
  updateGripping,
  updateRobotColliders,
  updateGrippedBlockPosition,
  syncBlocksWithPhysics
} from './physics.js';
import { updateScore } from './game.js';
import { updateProgramExecution } from './program.js';
import { setupUI } from './ui.js';
import { updateFPS, hideLoading, showError } from './utils.js';
import {
  scene, camera, renderer, controls, world,
  programMode,
  lastFPSUpdate, frameCount,
  grippedBlock
} from './state.js';
import { USE_KINEMATIC_GRIP } from './constants.js';

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize the simulation
 * Sets up physics engine, 3D scene, lighting, robot model, and UI
 *
 * @async
 * @returns {Promise<void>}
 */
async function init() {
  try {
    // Initialize physics world
    const physicsWorld = await initPhysics();

    // Initialize Three.js scene
    const threeScene = initScene();

    // Initialize camera
    const threeCamera = initCamera();

    // Initialize renderer
    const threeRenderer = initRenderer();

    // Initialize orbit controls
    const orbitControls = initControls(threeCamera, threeRenderer.domElement);

    // Setup lighting
    setupLighting(threeScene);

    // Create ground
    createGround(threeScene, physicsWorld);

    // Load robot model
    await loadRobot();

    // Create platform
    createPlatform(threeScene, physicsWorld);

    // Create blocks
    createBlocks(threeScene, physicsWorld);

    // Setup UI event handlers
    setupUI();

    // Setup window resize handler
    window.addEventListener('resize', () => {
      onWindowResize(camera, renderer);
    });

    // Hide loading indicator
    hideLoading();

    // Start animation loop
    animate();

  } catch (error) {
    console.error('Initialization failed:', error);
    showError('Error: Failed to load robot model');
    throw error;
  }
}

// ============================================================================
// Animation Loop
// ============================================================================

/**
 * Main animation loop
 * Updates physics, rendering, and UI every frame
 */
function animate() {
  requestAnimationFrame(animate);

  // Update program execution
  if (programMode) {
    updateProgramExecution();
  }

  // Update robot (PD control)
  updateRobot();

  // Update gripping state
  updateGripping();

  // Update robot collider positions
  updateRobotColliders();

  // Step physics simulation
  world.step();

  // Update gripped block position (kinematic mode)
  if (grippedBlock && USE_KINEMATIC_GRIP) {
    updateGrippedBlockPosition();
  }

  // Sync block visual meshes with physics
  syncBlocksWithPhysics();

  // Update score
  updateScore();

  // Update orbit controls
  controls.update();

  // Render scene
  renderer.render(scene, camera);

  // Update FPS display
  updateFPS(lastFPSUpdate, frameCount);
}

// ============================================================================
// Start Application
// ============================================================================

// Start initialization
init().catch(error => {
  console.error('Fatal error during initialization:', error);
});
