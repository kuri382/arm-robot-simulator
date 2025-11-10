/**
 * Constants and Configuration
 *
 * All constants used throughout the application
 */

// Joint names for SO-ARM101
export const JOINT_NAMES = [
  'shoulder_pan',
  'shoulder_lift',
  'elbow_flex',
  'wrist_flex',
  'wrist_roll',
  'gripper'
];

// Gripping configuration
export const GRIP_THRESHOLD = 0.26;      // 15 degrees = 0.262 radians
export const RELEASE_THRESHOLD = 0.35;   // 20 degrees
export const GRIP_DISTANCE = 0.1;        // 10cm
export const USE_KINEMATIC_GRIP = true;

// Physics configuration
export const PHYSICS_TIMESTEP = 1 / 60;  // 60 Hz
export const PHYSICS_VELOCITY_ITERATIONS = 4;
export const PHYSICS_POSITION_ITERATIONS = 2;

// Control parameters
export const DT = 1 / 60;           // 60Hz update rate
export const KP_NORMAL = 0.5;       // Normal proportional gain
export const KD_NORMAL = 0.1;       // Normal derivative gain
export const KP_FAST = 3.0;         // Fast mode proportional gain
export const KD_FAST = 0.5;         // Fast mode derivative gain

// Game configuration
export const GAME_TIME_LIMIT = 120; // seconds
export const POINTS_PER_BLOCK = 10;

// Program execution configuration
export const ANGLE_THRESHOLD_STRICT = 0.05;  // ~3 degrees
export const ANGLE_THRESHOLD_LOOSE = 0.15;   // ~9 degrees
export const MAX_STEP_TIMEOUT = 10000;       // 10 seconds
export const MIN_STEP_DURATION = 500;        // 500ms

// Scene configuration
export const SCENE_BACKGROUND_COLOR = 0x1a1a2e;
export const FOG_NEAR = 10;
export const FOG_FAR = 50;

// Camera configuration
export const CAMERA_FOV = 60;
export const CAMERA_NEAR = 0.01;
export const CAMERA_FAR = 100;
export const CAMERA_POSITION = { x: 0.5, y: 0.3, z: 0.5 };
export const CAMERA_LOOK_AT = { x: 0, y: 0.1, z: 0 };

// Shadow configuration
export const SHADOW_MAP_SIZE = 1024;

// Block configurations
export const BLOCK_CONFIGS = [
  { size: 0.025, position: { x: 0.35, y: 0.0225, z: 0 }, color: 0xff6b6b },
  { size: 0.025, position: { x: 0.25, y: 0.0375, z: -0.1 }, color: 0x4ecdc4 },
  { size: 0.025, position: { x: 0.28, y: 0.0125, z: 0 }, color: 0xffe66d },
  { size: 0.03, position: { x: 0.22, y: 0.015, z: 0.05 }, color: 0x95e1d3 },
  { size: 0.025, position: { x: 0.15, y: 0.125, z: 0 }, color: 0xff6b6b },
  { size: 0.025, position: { x: 0.15, y: 0.25, z: -0.3 }, color: 0xff6b6b },
  { size: 0.03, position: { x: 0.3, y: 0.25, z: -0.3 }, color: 0x95e1d3 },
  { size: 0.03, position: { x: 0.3, y: 0.25, z: 0.2 }, color: 0xffe66d },
];

// Platform configuration
export const PLATFORM_CONFIG = {
  size: { width: 0.15, height: 0.03, depth: 0.15 },
  position: { x: 0.1, y: 0.015, z: 0.3 }, // y = height / 2
  color: 0xb4b4b4,
  friction: 1.5,
  restitution: 0.1
};

// Robot collider configurations
export const ROBOT_COLLIDER_CONFIGS = [
  { name: 'gripper_link', type: 'box', size: [0.01, 0.04, 0.1], offset: [-0.015, 0, -0.05] },
  { name: 'moving_jaw_so101_v1_link', type: 'box', size: [0.01, 0.15, 0.04], offset: [0, -0.01, 0.02] },
  { name: 'wrist_link', type: 'box', size: [0.03, 0.05, 0.03] },
  { name: 'lower_arm_link', type: 'box', size: [0.13, 0.03, 0.03] },
  { name: 'upper_arm_link', type: 'box', size: [0.12, 0.03, 0.03] },
];

// Confetti configuration
export const CONFETTI_COUNT = 150;
export const CONFETTI_COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#2ecc71', '#3498db'];
