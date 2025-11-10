/**
 * Global State Management
 *
 * Centralized state for the SO-ARM101 simulator
 * All mutable state variables are exported from this module
 */

// ============================================================================
// Scene & Rendering State
// ============================================================================

/** @type {THREE.Scene|null} Three.js scene container */
export let scene = null;

/** @type {THREE.PerspectiveCamera|null} Main camera */
export let camera = null;

/** @type {THREE.WebGLRenderer|null} WebGL renderer */
export let renderer = null;

/** @type {OrbitControls|null} Camera orbit controls */
export let controls = null;

// ============================================================================
// Physics State
// ============================================================================

/** @type {RAPIER.World|null} Rapier physics world */
export let world = null;

// ============================================================================
// Robot State
// ============================================================================

/** @type {THREE.Group|null} Robot model loaded from URDF */
export let robot = null;

/** @type {Array} Array of robot joints with metadata */
export let joints = [];

/**
 * Target angles for each joint in radians
 * Order: shoulder_pan, shoulder_lift, elbow_flex, wrist_flex, wrist_roll, gripper
 * @type {number[]}
 */
export let targetAngles = [0, 0, 0, 0, 0, 0];

/**
 * Map of robot link names to their physics bodies
 * @type {Map<string, {link: THREE.Object3D, body: RAPIER.RigidBody, collider: RAPIER.Collider, debugMesh: THREE.Mesh, offset: THREE.Vector3}>}
 */
export let robotBodies = new Map();

// ============================================================================
// Scene Objects State
// ============================================================================

/**
 * Array of block objects in the scene
 * @type {Array<{id: number, mesh: THREE.Mesh, body: RAPIER.RigidBody, size: number}>}
 */
export let blocks = [];

/**
 * Platform object for block placement
 * @type {{mesh: THREE.Mesh, body: RAPIER.RigidBody, size: object, position: object, bounds: object}|null}
 */
export let platform = null;

// ============================================================================
// Game Mode State
// ============================================================================

/** Current score based on blocks on platform */
export let score = 0;

/** Set of block IDs currently on the platform */
export let blocksOnPlatform = new Set();

/** Whether game mode is currently active */
export let gameMode = false;

/** Timestamp when game started (milliseconds) */
export let gameStartTime = 0;

/** Current game session score */
export let gameScore = 0;

// ============================================================================
// Programming Mode State
// ============================================================================

/** Whether programming mode is currently executing */
export let programMode = false;

/**
 * Program sequence of taught positions
 * @type {Array<{angles: number[], duration: number}>}
 */
export let programSequence = [];

/** Current step index in program execution */
export let programCurrentStep = 0;

/** Timestamp when current step started */
export let programStepStartTime = 0;

/** Whether current program step has been initialized */
export let programStepInitialized = false;

// ============================================================================
// Gripping System State
// ============================================================================

/** Currently gripped block reference */
export let grippedBlock = null;

/** Physics joint for gripped block (joint mode) */
export let gripJoint = null;

/** Relative position of gripped block to gripper */
export let grippedBlockRelativePos = null;

/** Relative rotation of gripped block to gripper */
export let grippedBlockRelativeRot = null;

/** Previous gripper angle for edge detection */
export let previousGripperAngle = 0;

/** Whether auto-grip feature is enabled */
export let autoGripEnabled = true;

// ============================================================================
// Debug & Performance State
// ============================================================================

/** Whether debug mode is enabled for collider visualization */
export let debugMode = false;

/** Array of debug visualization meshes */
export let debugMeshes = [];

/** Timestamp of last FPS update */
export let lastFPSUpdate = performance.now();

/** Frame counter for FPS calculation */
export let frameCount = 0;

// ============================================================================
// State Setters
// ============================================================================
// These functions allow other modules to update state

export function setScene(value) { scene = value; }
export function setCamera(value) { camera = value; }
export function setRenderer(value) { renderer = value; }
export function setControls(value) { controls = value; }
export function setWorld(value) { world = value; }
export function setRobot(value) { robot = value; }
export function setJoints(value) { joints = value; }
export function setTargetAngles(value) { targetAngles = value; }
export function setRobotBodies(value) { robotBodies = value; }
export function setBlocks(value) { blocks = value; }
export function setPlatform(value) { platform = value; }
export function setScore(value) { score = value; }
export function setBlocksOnPlatform(value) { blocksOnPlatform = value; }
export function setGameMode(value) { gameMode = value; }
export function setGameStartTime(value) { gameStartTime = value; }
export function setGameScore(value) { gameScore = value; }
export function setProgramMode(value) { programMode = value; }
export function setProgramSequence(value) { programSequence = value; }
export function setProgramCurrentStep(value) { programCurrentStep = value; }
export function setProgramStepStartTime(value) { programStepStartTime = value; }
export function setProgramStepInitialized(value) { programStepInitialized = value; }
export function setGrippedBlock(value) { grippedBlock = value; }
export function setGripJoint(value) { gripJoint = value; }
export function setGrippedBlockRelativePos(value) { grippedBlockRelativePos = value; }
export function setGrippedBlockRelativeRot(value) { grippedBlockRelativeRot = value; }
export function setPreviousGripperAngle(value) { previousGripperAngle = value; }
export function setAutoGripEnabled(value) { autoGripEnabled = value; }
export function setDebugMode(value) { debugMode = value; }
export function setDebugMeshes(value) { debugMeshes = value; }
export function setLastFPSUpdate(value) { lastFPSUpdate = value; }
export function setFrameCount(value) { frameCount = value; }
