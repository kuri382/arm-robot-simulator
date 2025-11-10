# SO-ARM Web Simulator

A browser-based physics simulation environment for SO-ARM series robotic arms (SO-ARM100/101), featuring interactive control, teaching mode, and game functionality.

## Overview

This project provides a complete web-based simulation platform that combines 3D visualization, physics simulation, and robot control capabilities without requiring ROS dependencies. The simulator runs entirely in the browser using modern web technologies.

**Key Features:**
- Real-time 3D visualization with shadows and lighting
- Physics-based simulation with collision detection
- Manual and programmatic robot control
- Teaching/playback functionality for motion recording
- Interactive game mode with scoring system
- Auto-grip mechanism for object manipulation

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| 3D Rendering | three.js (r168+) | Scene rendering, materials, lighting |
| Robot Model | urdf-loader (0.12.3+) | URDF parsing and kinematics |
| Physics Engine | @dimforge/rapier3d-compat (0.14+) | Rigid body dynamics, collision detection |
| Build Tool | Vite (5.4+) | Development server, bundling |
| Deployment | Firebase Hosting | Production hosting |
| Language | JavaScript (ES6+) | Implementation |

## Project Structure

```
Sophia/
├── public/
│   └── soarm/
│       ├── so_arm.urdf          # Robot model definition
│       └── meshes/              # 3D mesh files (.stl)
├── src/
│   └── main.js                  # Main simulation logic (1600+ lines)
├── dist/                        # Build output
├── index.html                   # Application entry point
├── vite.config.js               # Vite configuration
├── firebase.json                # Firebase deployment config
├── package.json                 # Dependencies
└── README.md                    # This file
```

## Installation

### Prerequisites

- Node.js 20.x or higher
- npm or yarn package manager

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd Sophia

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will open automatically at `http://localhost:3000`.

## Usage

### Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview

# Build and deploy to Firebase
npm run deploy
```

### Application Features

#### 1. Manual Control Mode

Control the robot arm using six sliders for each joint:
- **Shoulder Pan**: -110° to 110°
- **Shoulder Lift**: -100° to 100°
- **Elbow Flex**: -95° to 95°
- **Wrist Flex**: -95° to 95°
- **Wrist Roll**: -157° to 163°
- **Gripper**: -10° to 100° (auto-grip enabled by default)

**Control Buttons:**
- `Reset Position`: Return all joints to zero position
- `Reset Blocks`: Reset object positions
- `Reset All`: Complete system reset
- `Auto Grip: ON/OFF`: Toggle automatic grip detection

#### 2. Teaching/Programming Mode

Record and playback motion sequences:

1. **Teach**: Capture current joint angles
2. **Set Angles**: Apply angles from array input
3. **Add Step**: Add current position to program sequence
4. **Run**: Execute programmed sequence
5. **Stop**: Interrupt execution
6. **Clear**: Delete all program steps

**Input Format:**
```javascript
[shoulder_pan, shoulder_lift, elbow_flex, wrist_flex, wrist_roll, gripper]
// Example: [45, 30, -20, 15, 0, 50]
```

**Step Properties:**
- Angles array (6 values in degrees)
- Duration (milliseconds)
- Automatic transition when target reached

#### 3. Game Mode

Timed challenge to place blocks on the platform:

- **Time Limit**: 120 seconds
- **Objective**: Place blocks on the platform
- **Scoring**: 10 points per block successfully placed
- **Win Conditions**: Blocks must be stable and within platform bounds

## Technical Implementation

### Architecture

The simulator implements a kinematic-dynamic hybrid approach:

1. **Robot Control**: Kinematic position control with PD feedback
2. **Object Physics**: Full dynamic simulation with Rapier physics
3. **Gripping**: Kinematic attachment for stable object manipulation
4. **Collision**: Continuous collision detection (CCD) for accurate interactions

### Key Parameters

```javascript
// Control System
Kp = 0.5          // Proportional gain (normal mode)
Kd = 0.1          // Derivative gain (normal mode)
Kp_FAST = 3.0     // Proportional gain (program mode)
Kd_FAST = 0.5     // Derivative gain (program mode)

// Physics
timestep = 1/60   // 60 Hz physics update
dt = 1/60         // Control update rate

// Gripping
GRIP_THRESHOLD = 0.26     // 15° - Close threshold
RELEASE_THRESHOLD = 0.35  // 20° - Open threshold
GRIP_DISTANCE = 0.1       // 10 cm - Max grip range
```

### Performance Optimizations

- Reduced shadow map resolution (1024×1024)
- Selective shadow casting (important parts only)
- Reduced physics solver iterations (4 velocity, 2 position)
- Optimized render loop (60 FPS target)

## Configuration

### Vite Configuration

```javascript
// vite.config.js
{
  server: { port: 3000, open: true },
  build: { outDir: 'dist' },
  optimizeDeps: { include: ['urdf-loader'] },
  publicDir: 'public'
}
```

### Firebase Configuration

```json
// firebase.json
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"]
  }
}
```

## Browser Compatibility

| Browser | Minimum Version | Status |
|---------|----------------|--------|
| Chrome | Latest | ✅ Fully Supported |
| Edge | Latest | ✅ Fully Supported |
| Firefox | Latest | ✅ Fully Supported |
| Safari | Latest | ⚠️ Limited Testing |

**Requirements:**
- WebGL 2.0 support
- WebAssembly support
- ES6+ module support

## Development Guidelines

### Code Organization

The main simulation logic (`src/main.js`) is structured as follows:

```javascript
// Global State Management
init()                      // Initialize scene, physics, robot
loadRobot()                 // Load URDF and create visual model
setupUI()                   // Configure controls and event handlers

// Core Loop
animate()                   // Main render loop (60 FPS)
  ├── updateRobot()         // PD control for joints
  ├── updateGripping()      // Auto-grip detection
  ├── updateRobotColliders()// Sync visual and physics
  ├── world.step()          // Physics simulation
  └── renderer.render()     // Render frame

// Feature Modules
updateProgramExecution()    // Program playback
updateGameUI()              // Game state management
updateScore()               // Scoring system
```

### Adding New Features

1. **New Objects**: Use `createBlock()` pattern with physics body
2. **UI Controls**: Add to `setupUI()` with event handlers
3. **Physics Interactions**: Configure colliders in `addRobotColliders()`
4. **Visual Effects**: Extend `animate()` loop

## Troubleshooting

### Common Issues

**Robot not loading:**
- Check browser console for URDF loading errors
- Verify mesh files exist in `public/soarm/meshes/`
- Ensure correct `BASE_URL` path resolution

**Physics instability:**
- Reduce `Kp`/`Kd` gains for smoother motion
- Increase collision margin in collider descriptors
- Enable CCD for fast-moving objects

**Performance issues:**
- Disable shadows: Set `renderer.shadowMap.enabled = false`
- Lower resolution: Adjust `renderer.setPixelRatio(1)`
- Reduce physics iterations in `world` configuration

## Credits and License

### Dependencies

- **three.js**: MIT License - [threejs.org](https://threejs.org)
- **urdf-loader**: MIT License - [gkjohnson/urdf-loaders](https://github.com/gkjohnson/urdf-loaders)
- **Rapier**: Apache 2.0 License - [Dimforge/Rapier](https://rapier.rs/)

### Robot Model

- SO-ARM URDF provided by TheRobotStudio / Seeed Studio
- Model files located in `public/soarm/`

## Roadmap

**Potential Enhancements:**

- [ ] Inverse kinematics (IK) solver
- [ ] Custom object import (.obj, .gltf)
- [ ] Multi-robot simulation
- [ ] WebSocket remote control
- [ ] VR/AR support via WebXR
- [ ] Path planning visualization
- [ ] Force/torque feedback
- [ ] Motion recording export (.csv, .json)

## Support

For issues, questions, or contributions:

1. Check existing issues in the repository
2. Review browser console for error messages
3. Ensure dependencies are up to date (`npm update`)
4. Verify Node.js version meets requirements

## Summary

This simulator provides a foundation for SO-ARM robot programming education, algorithm development, and interactive demonstrations. The modular architecture enables easy extension while maintaining performance and stability across modern browsers.

**Quick Start:** `npm install && npm run dev`
