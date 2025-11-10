/**
 * Robot Loading and Setup Functions
 *
 * Handles URDF loading, joint extraction, and robot collider setup
 */

import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import RAPIER from '@dimforge/rapier3d-compat';
import { JOINT_NAMES, ROBOT_COLLIDER_CONFIGS } from './constants.js';
import {
  scene, world,
  robot, joints, setTargetAngles,
  setRobot, setJoints, setRobotBodies,
  debugMode, debugMeshes
} from './state.js';

/**
 * Load robot model from URDF file
 * Sets up robot visual model, joints, and physics colliders
 *
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If URDF loading fails
 */
export async function loadRobot() {
  console.log('Starting URDF load...');

  const loader = new URDFLoader();
  loader.workingPath = import.meta.env.BASE_URL + 'soarm/';

  // Setup LoadingManager event handlers
  loader.manager.onLoad = function() {
    console.log('LoadingManager: All resources loaded');
  };

  loader.manager.onProgress = function(url, itemsLoaded, itemsTotal) {
    console.log('LoadingManager: Loading', url, `(${itemsLoaded}/${itemsTotal})`);
  };

  loader.manager.onError = function(url) {
    console.error('LoadingManager: Error loading', url);
  };

  return new Promise((resolve, reject) => {
    const onLoad = (urdfRobot) => {
      try {
        console.log('onLoad callback called!');
        console.log('URDF parsed successfully!', urdfRobot);
        const robot = urdfRobot;

        // Scale adjustment (to meters)
        robot.scale.set(1, 1, 1);

        // Fix robot orientation
        // Compensate for URDF coordinate system vs Three.js coordinate system
        robot.rotation.x = -Math.PI / 2;
        robot.rotation.y = 0;
        robot.rotation.z = 0;

        // Add robot to scene
        scene.add(robot);

        // Enable shadows (optimized: only important parts)
        robot.traverse((child) => {
          if (child.isMesh) {
            // Enable shadows only for important parts (optimization)
            const importantParts = ['gripper', 'lower_arm', 'upper_arm'];
            const isImportant = importantParts.some(part => child.name.includes(part));

            if (isImportant) {
              child.castShadow = true;
              child.receiveShadow = true;
            } else {
              child.castShadow = false;
              child.receiveShadow = false;
            }

            // Adjust material properties
            if (child.material) {
              child.material.roughness = 0.6;
              child.material.metalness = 0.3;
            }
          }
        });

        // Extract joint information
        extractJoints(robot);

        // Add physics colliders to robot
        addRobotColliders(robot);

        // Update global state
        setRobot(robot);

        console.log('Robot setup completed');
        console.log('Joints:', robot.joints);

        resolve();
      } catch (error) {
        console.error('Error in onLoad:', error);
        reject(error);
      }
    };

    const onError = (error) => {
      console.error('URDF load error:', error);
      reject(error);
    };

    const urdfPath = import.meta.env.BASE_URL + 'soarm/so_arm.urdf';
    console.log('Loading URDF from:', urdfPath);

    try {
      loader.load(urdfPath, onLoad, undefined, onError);
    } catch (error) {
      console.error('Error calling loader.load:', error);
      reject(error);
    }
  });
}

/**
 * Extract joint information from loaded robot
 * Populates joints array with metadata for each joint
 *
 * @param {THREE.Group} robot - Loaded URDF robot model
 */
function extractJoints(robot) {
  const joints = [];

  JOINT_NAMES.forEach((name, index) => {
    if (robot.joints[name]) {
      const joint = robot.joints[name];
      joints.push({
        name: name,
        joint: joint,
        index: index
      });

      // Set initial angle
      if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
        joint.setJointValue(0);
      }
    }
  });

  setJoints(joints);

  console.log('Extracted joints:', joints.map(j => j.name));
}

/**
 * Add physics colliders to robot links
 * Creates kinematic rigid bodies that follow the visual model
 *
 * @param {THREE.Group} robot - Loaded URDF robot model
 */
function addRobotColliders(robot) {
  const robotBodiesMap = new Map();

  ROBOT_COLLIDER_CONFIGS.forEach(config => {
    const link = robot.links[config.name];
    if (!link) {
      console.warn(`Link ${config.name} not found`);
      return;
    }

    // Create as kinematic rigid body (follows robot control)
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    const body = world.createRigidBody(bodyDesc);

    // Create collider
    let colliderDesc;
    if (config.type === 'box') {
      const [x, y, z] = config.size;
      colliderDesc = RAPIER.ColliderDesc.cuboid(x / 2, y / 2, z / 2);
    } else if (config.type === 'cylinder') {
      colliderDesc = RAPIER.ColliderDesc.cylinder(config.height / 2, config.radius);
    }

    // Set physics parameters
    colliderDesc
      .setFriction(3.0)           // High friction to prevent slipping
      .setRestitution(0.0)        // No bounce
      .setDensity(1.0);           // Set density

    const collider = world.createCollider(colliderDesc, body);

    // Enable CCD (Continuous Collision Detection) to prevent tunneling
    body.enableCcd(true);

    // Debug visualization of colliders
    let debugMesh = null;
    if (debugMode) {
      let debugGeometry;
      if (config.type === 'box') {
        const [x, y, z] = config.size;
        debugGeometry = new THREE.BoxGeometry(x, y, z);
      } else if (config.type === 'cylinder') {
        debugGeometry = new THREE.CylinderGeometry(config.radius, config.radius, config.height, 16);
      }

      const debugMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true,
        transparent: true,
        opacity: 0.3
      });
      debugMesh = new THREE.Mesh(debugGeometry, debugMaterial);
      scene.add(debugMesh);
      debugMeshes.push(debugMesh);
    }

    // Associate link with physics body (save offset information)
    const offset = config.offset || [0, 0, 0];
    robotBodiesMap.set(config.name, {
      link: link,
      body: body,
      collider: collider,
      debugMesh: debugMesh,
      offset: new THREE.Vector3(offset[0], offset[1], offset[2])
    });

    console.log(`Collider added to ${config.name}`, {
      type: config.type,
      size: config.size,
      offset: offset
    });
  });

  setRobotBodies(robotBodiesMap);
}

/**
 * Reset robot to initial position
 * Resets all joint angles to zero and updates UI sliders
 */
export function resetRobot() {
  // Reset joint angles
  const newTargetAngles = [0, 0, 0, 0, 0, 0];
  setTargetAngles(newTargetAngles);

  joints.forEach(({ joint }) => {
    if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
      joint.setJointValue(0);
    }
  });

  // Reset UI sliders
  for (let i = 1; i <= 6; i++) {
    const slider = document.getElementById(`joint${i}`);
    const valueDisplay = document.getElementById(`joint${i}-value`);
    if (slider && valueDisplay) {
      slider.value = 0;
      valueDisplay.textContent = '0°';
    }
  }

  console.log('Robot reset to initial position');
}
