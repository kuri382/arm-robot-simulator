# Module Structure Guide

This document explains the modular architecture of the SO-ARM101 Robot Simulator.

## Overview

The original `main.js` file (1800+ lines) has been split into 10 focused modules for better maintainability, testability, and code organization.

## Module Organization

### 1. **constants.js** - Configuration and Constants
- All configuration values and constants
- Joint names, physics parameters, game settings
- Camera/scene configuration
- Block and platform configurations
- No dependencies on other modules

**Exports:**
- `JOINT_NAMES` - Array of joint names
- `GRIP_THRESHOLD`, `RELEASE_THRESHOLD`, etc.
- `PHYSICS_TIMESTEP`, `PHYSICS_VELOCITY_ITERATIONS`
- `CAMERA_FOV`, `CAMERA_POSITION`, etc.
- `BLOCK_CONFIGS`, `PLATFORM_CONFIG`

---

### 2. **state.js** - Global State Management
- Centralized state for all mutable variables
- Exports state variables and setter functions
- Single source of truth for application state

**Exports:**
- Scene state: `scene`, `camera`, `renderer`, `controls`, `world`
- Robot state: `robot`, `joints`, `targetAngles`, `robotBodies`
- Game state: `score`, `gameMode`, `gameStartTime`, etc.
- Program state: `programMode`, `programSequence`, `programCurrentStep`
- Gripping state: `grippedBlock`, `gripJoint`, `autoGripEnabled`
- Setter functions: `setScene()`, `setCamera()`, etc.

---

### 3. **scene.js** - Scene Setup Functions
- Three.js scene initialization
- Lighting, camera, renderer setup
- Ground, platform, and block creation
- Window resize handling

**Key Functions:**
- `initPhysics()` - Initialize Rapier physics world
- `initScene()` - Create Three.js scene
- `initCamera()` - Setup perspective camera
- `initRenderer()` - Configure WebGL renderer
- `setupLighting()` - Add lights to scene
- `createGround()` - Create ground plane
- `createPlatform()` - Create block placement platform
- `createBlocks()` - Create all blocks from config
- `resetBlocks()` - Reset blocks to initial positions

---

### 4. **robot.js** - Robot Loading and Setup
- URDF file loading
- Joint extraction
- Robot collider setup

**Key Functions:**
- `loadRobot()` - Load robot from URDF file
- `extractJoints()` - Extract joint information (internal)
- `addRobotColliders()` - Add physics colliders to robot links (internal)
- `resetRobot()` - Reset robot to initial position

---

### 5. **physics.js** - Physics and Control
- PD controller for robot joints
- Physics updates
- Gripping mechanics
- Collision detection

**Key Functions:**
- `updateRobot()` - Update robot using PD control
- `setFastControlMode()` - Switch to fast PD gains
- `setNormalControlMode()` - Switch to normal PD gains
- `rotateVectorByQuaternion()` - Quaternion math utility
- `multiplyQuaternions()` - Quaternion multiplication
- `updateGripping()` - Monitor gripper angle and trigger grip/release
- `tryGrip()` - Attempt to grip nearest block
- `releaseGrip()` - Release currently gripped block
- `updateGrippedBlockPosition()` - Update gripped block position (kinematic mode)
- `updateRobotColliders()` - Sync robot colliders with visual model
- `syncBlocksWithPhysics()` - Sync block meshes with physics bodies

---

### 6. **game.js** - Game Mode Functions
- Game start/end logic
- Score tracking
- Timer management
- Confetti effects

**Key Functions:**
- `startGame()` - Start new game session
- `endGame()` - End game and show results
- `updateGameUI()` - Update game timer and score display
- `updateScore()` - Calculate score based on blocks on platform
- `createConfetti()` - Animated confetti effect
- `closeGameResult()` - Close game result dialog
- `toggleGamePanel()` - Toggle game panel visibility

---

### 7. **program.js** - Programming Mode Functions
- Position teaching
- Program execution and playback
- Import/export functionality
- Step management

**Key Functions:**
- `captureCurrentAngles()` - Capture current robot position
- `setAnglesFromArray()` - Set robot angles from JSON array
- `addProgramStep()` - Add step to program sequence
- `updateProgramList()` - Update program list UI
- `runProgram()` - Start program execution
- `stopProgram()` - Stop program execution
- `clearProgram()` - Clear all program steps
- `updateProgramExecution()` - Execute current program step
- `exportProgram()` - Export program to JSON file
- `importProgram()` - Import program from JSON file
- `toggleProgramPanel()` - Toggle programming panel visibility

---

### 8. **ui.js** - UI Event Handlers
- All UI event listener setup
- Button click handlers
- Slider input handlers
- Panel toggle handlers

**Key Functions:**
- `setupUI()` - Main function to setup all UI handlers
- `setupJointSliders()` - Configure 6 joint sliders (internal)
- `setupControlButtons()` - Setup Reset/Auto Grip buttons (internal)
- `setupGameButtons()` - Setup game mode buttons (internal)
- `setupProgramButtons()` - Setup programming buttons (internal)
- `setupPanelToggles()` - Setup panel collapse toggles (internal)
- `resetAll()` - Reset everything with confirmation (internal)

---

### 9. **utils.js** - Utility Functions
- FPS counter
- Loading screen management
- General utilities

**Key Functions:**
- `updateFPS()` - Calculate and display FPS
- `hideLoading()` - Hide loading indicator
- `showError()` - Show error message

---

### 10. **main_modular.js** - Main Entry Point
- Orchestrates all modules
- Initialization sequence
- Main animation loop

**Key Functions:**
- `init()` - Initialize entire application
- `animate()` - Main animation loop (60 FPS)

---

## Dependency Graph

```
main_modular.js
├── scene.js (depends on: constants, state)
├── robot.js (depends on: constants, state)
├── physics.js (depends on: constants, state)
├── game.js (depends on: constants, state, robot, scene, physics)
├── program.js (depends on: constants, state, physics)
├── ui.js (depends on: state, physics, robot, scene, game, program)
└── utils.js (depends on: state)

constants.js (no dependencies)
state.js (no dependencies)
```

## Benefits of Modular Structure

### 1. **Maintainability**
- Each module has a single, clear responsibility
- Easier to locate and fix bugs
- Changes are isolated to relevant modules

### 2. **Testability**
- Individual modules can be tested in isolation
- Mock dependencies easily
- Clear input/output contracts

### 3. **Reusability**
- Functions can be imported and used elsewhere
- Core logic separated from UI concerns
- Physics/game logic can be reused in other projects

### 4. **Readability**
- 100-400 lines per module vs. 1800 line monolith
- Clear module names indicate purpose
- Well-documented functions with JSDoc

### 5. **Collaboration**
- Multiple developers can work on different modules
- Reduced merge conflicts
- Clear ownership boundaries

## Migration Path

The original `main.js` is preserved. To use the modular version:

1. **Current (Monolithic)**:
   ```html
   <script type="module" src="/src/main.js"></script>
   ```

2. **New (Modular)**:
   ```html
   <script type="module" src="/src/main_modular.js"></script>
   ```

## File Sizes

| File | Lines | Purpose |
|------|-------|---------|
| `constants.js` | ~93 | Configuration |
| `state.js` | ~150 | State management |
| `scene.js` | ~260 | Scene setup |
| `robot.js` | ~220 | Robot loading |
| `physics.js` | ~330 | Physics & control |
| `game.js` | ~220 | Game mode |
| `program.js` | ~400 | Programming mode |
| `ui.js` | ~220 | UI handlers |
| `utils.js` | ~40 | Utilities |
| `main_modular.js` | ~130 | Orchestration |
| **Total** | **~2,063** | **(vs 1,800 original)** |

*Note: Slightly more lines due to module exports/imports and improved documentation*

## Code Quality Improvements

1. **JSDoc Comments**: All public functions documented
2. **English Comments**: All comments in English for international collaboration
3. **Type Hints**: JSDoc type annotations for better IDE support
4. **Consistent Naming**: Clear, descriptive function and variable names
5. **Error Handling**: Improved error messages and validation

## Next Steps

1. Test the modular version thoroughly
2. Update `index.html` to use `main_modular.js`
3. Consider adding unit tests for individual modules
4. Generate API documentation from JSDoc comments
5. Add TypeScript type definitions (.d.ts files)
