/**
 * Physics and Control Functions
 *
 * Handles robot control (PD controller), physics updates,
 * gripping mechanics, and collision detection
 */

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  DT, KP_NORMAL, KD_NORMAL, KP_FAST, KD_FAST,
  GRIP_THRESHOLD, RELEASE_THRESHOLD, GRIP_DISTANCE,
  USE_KINEMATIC_GRIP
} from './constants.js';
import {
  robot, joints, targetAngles, robotBodies, blocks,
  grippedBlock, setGrippedBlock,
  gripJoint, setGripJoint,
  grippedBlockRelativePos, setGrippedBlockRelativePos,
  grippedBlockRelativeRot, setGrippedBlockRelativeRot,
  previousGripperAngle, setPreviousGripperAngle,
  autoGripEnabled
} from './state.js';

// ============================================================================
// Control Parameters
// ============================================================================

/** Current proportional gain (changes during program execution) */
let Kp = KP_NORMAL;

/** Current derivative gain (changes during program execution) */
let Kd = KD_NORMAL;

/**
 * Set control gains to fast mode for program execution
 */
export function setFastControlMode() {
  Kp = KP_FAST;
  Kd = KD_FAST;
}

/**
 * Set control gains to normal mode for manual control
 */
export function setNormalControlMode() {
  Kp = KP_NORMAL;
  Kd = KD_NORMAL;
}

// ============================================================================
// Robot Control (PD Controller)
// ============================================================================

/**
 * Update robot joint angles using PD control
 * Applies proportional-derivative control to smoothly move joints to target angles
 */
export function updateRobot() {
  if (!robot || joints.length === 0) return;

  // Simple PD control for each joint to follow target angle
  // Formula: u(t) = Kp * e(t) - Kd * v(t)
  joints.forEach(({ joint, index }) => {
    if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
      const currentAngle = joint.angle || 0;
      const targetAngle = targetAngles[index];

      const error = targetAngle - currentAngle;

      // Estimate velocity (difference from previous frame)
      const velocity = joint.velocity || 0;

      // PD control calculation
      const control = Kp * error - Kd * velocity;

      // Update joint angle (integrate control input)
      const newAngle = currentAngle + control * DT;

      // Apply joint limits
      let clampedAngle = newAngle;
      if (joint.limit) {
        clampedAngle = Math.max(joint.limit.lower, Math.min(joint.limit.upper, newAngle));
      }

      // Record velocity for next iteration
      joint.velocity = (clampedAngle - currentAngle) / DT;

      // Set joint value
      joint.setJointValue(clampedAngle);
    }
  });
}

// ============================================================================
// Quaternion Utilities
// ============================================================================

/**
 * Rotate a vector by a quaternion
 * Formula: quat * vec * quat^-1
 *
 * @param {{x: number, y: number, z: number}} vec - Vector to rotate
 * @param {{x: number, y: number, z: number, w: number}} quat - Rotation quaternion
 * @returns {{x: number, y: number, z: number}} Rotated vector
 */
export function rotateVectorByQuaternion(vec, quat) {
  const ix = quat.w * vec.x + quat.y * vec.z - quat.z * vec.y;
  const iy = quat.w * vec.y + quat.z * vec.x - quat.x * vec.z;
  const iz = quat.w * vec.z + quat.x * vec.y - quat.y * vec.x;
  const iw = -quat.x * vec.x - quat.y * vec.y - quat.z * vec.z;

  return {
    x: ix * quat.w + iw * -quat.x + iy * -quat.z - iz * -quat.y,
    y: iy * quat.w + iw * -quat.y + iz * -quat.x - ix * -quat.z,
    z: iz * quat.w + iw * -quat.z + ix * -quat.y - iy * -quat.x
  };
}

/**
 * Multiply two quaternions
 *
 * @param {{x: number, y: number, z: number, w: number}} q1 - First quaternion
 * @param {{x: number, y: number, z: number, w: number}} q2 - Second quaternion
 * @returns {{x: number, y: number, z: number, w: number}} Result quaternion
 */
export function multiplyQuaternions(q1, q2) {
  return {
    x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
    y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
    z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w,
    w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z
  };
}

// ============================================================================
// Gripping System
// ============================================================================

/**
 * Update gripping state based on gripper angle
 * Monitors gripper angle and triggers grip/release actions
 */
export function updateGripping() {
  // Do nothing if auto-grip is disabled
  if (!autoGripEnabled) {
    return;
  }

  // Get gripper joint
  const gripperJoint = joints.find(j => j.name === 'gripper');
  if (!gripperJoint) {
    console.warn('Gripper joint not found');
    return;
  }

  // Get current gripper angle from target angles
  const currentAngle = targetAngles[5]; // Gripper is 6th joint (index 5)

  // Gripper closed (angle fell below threshold) - small angle = closed
  if (currentAngle < GRIP_THRESHOLD && previousGripperAngle >= GRIP_THRESHOLD) {
    console.log('Gripper closing - trying to grip at angle:', (currentAngle * 180 / Math.PI).toFixed(2), '°');
    tryGrip();
  }
  // Gripper opened (angle exceeded threshold) - large angle = opened
  else if (currentAngle > RELEASE_THRESHOLD && previousGripperAngle <= RELEASE_THRESHOLD) {
    console.log('Gripper opening - releasing at angle:', (currentAngle * 180 / Math.PI).toFixed(2), '°');
    releaseGrip();
  }

  setPreviousGripperAngle(currentAngle);
}

/**
 * Attempt to grip the nearest block within range
 * Uses kinematic control for stable gripping without physics vibration
 */
export function tryGrip() {
  if (grippedBlock) {
    console.log('Already gripping a block');
    return;
  }

  const gripperLink = robot.links['gripper_link'];
  if (!gripperLink) {
    console.warn('Gripper link not found');
    return;
  }

  // Get gripper world position
  const gripperPos = new THREE.Vector3();
  gripperLink.getWorldPosition(gripperPos);

  console.log('Gripper position:', gripperPos);

  // Find nearest block within range
  let closestBlock = null;
  let closestDistance = GRIP_DISTANCE;

  blocks.forEach(block => {
    const blockPos = block.body.translation();
    const distance = Math.sqrt(
      Math.pow(gripperPos.x - blockPos.x, 2) +
      Math.pow(gripperPos.y - blockPos.y, 2) +
      Math.pow(gripperPos.z - blockPos.z, 2)
    );

    console.log(`Block ${block.id} distance:`, distance.toFixed(3), 'm');

    if (distance < closestDistance) {
      closestDistance = distance;
      closestBlock = block;
    }
  });

  // Grip the nearest block
  if (closestBlock) {
    console.log(`Found block ${closestBlock.id} at distance ${closestDistance.toFixed(3)}m`);
    setGrippedBlock(closestBlock);

    const gripperBody = robotBodies.get('gripper_link').body;

    if (USE_KINEMATIC_GRIP) {
      // Kinematic control method (no vibration)

      // Change block to kinematic body
      closestBlock.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);

      // Save current relative position and rotation
      const blockPos = closestBlock.body.translation();
      const blockRot = closestBlock.body.rotation();

      // Get gripper world coordinates
      const gripperWorldPos = new THREE.Vector3();
      const gripperQuat = new THREE.Quaternion();
      gripperLink.getWorldPosition(gripperWorldPos);
      gripperLink.getWorldQuaternion(gripperQuat);

      // Calculate relative position (using Three.js)
      const relativePos = new THREE.Vector3(blockPos.x, blockPos.y, blockPos.z);
      relativePos.sub(gripperWorldPos);

      // Transform to gripper local coordinate system
      const gripperQuatInv = gripperQuat.clone().invert();
      relativePos.applyQuaternion(gripperQuatInv);

      setGrippedBlockRelativePos(relativePos);

      // Calculate relative rotation
      const blockQuat = new THREE.Quaternion(blockRot.x, blockRot.y, blockRot.z, blockRot.w);
      const relativeQuat = gripperQuatInv.clone().multiply(blockQuat);
      setGrippedBlockRelativeRot(relativeQuat);

      console.log('Gripped block (kinematic mode):', closestBlock.id);
    } else {
      // Joint method (traditional)
      const blockPos = closestBlock.body.translation();
      const blockRot = closestBlock.body.rotation();
      const gripperPhysPos = gripperBody.translation();
      const gripperRot = gripperBody.rotation();

      const gripperRotInv = {
        x: -gripperRot.x,
        y: -gripperRot.y,
        z: -gripperRot.z,
        w: gripperRot.w
      };

      const relativePos = {
        x: blockPos.x - gripperPhysPos.x,
        y: blockPos.y - gripperPhysPos.y,
        z: blockPos.z - gripperPhysPos.z
      };

      const localAnchor1 = rotateVectorByQuaternion(relativePos, gripperRotInv);
      const relativeRotation = multiplyQuaternions(gripperRotInv, blockRot);

      const jointParams = RAPIER.JointData.fixed(
        localAnchor1,
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 0, y: 0, z: 0 },
        relativeRotation
      );

      const newGripJoint = world.createImpulseJoint(jointParams, gripperBody, closestBlock.body, true);
      setGripJoint(newGripJoint);

      console.log('Gripped block (joint mode):', closestBlock.id);
    }

    // Update UI
    const gripStatus = document.getElementById('grip-status');
    if (gripStatus) {
      gripStatus.textContent = `Block ${closestBlock.id}`;
      gripStatus.style.color = '#4ecdc4';
    }
  } else {
    console.log('No block within grip distance');
  }
}

/**
 * Release the currently gripped block
 * Converts block back to dynamic body and clears grip state
 */
export function releaseGrip() {
  if (!grippedBlock) return;

  if (USE_KINEMATIC_GRIP) {
    // Convert block back to dynamic body
    grippedBlock.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);

    // Reset velocity for smooth release
    grippedBlock.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    grippedBlock.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  } else {
    // Remove joint
    if (gripJoint) {
      world.removeImpulseJoint(gripJoint, true);
      setGripJoint(null);
    }
  }

  // Update UI
  const gripStatus = document.getElementById('grip-status');
  if (gripStatus) {
    gripStatus.textContent = 'None';
    gripStatus.style.color = 'white';
  }

  console.log('Released block:', grippedBlock.id);
  setGrippedBlock(null);
  setGrippedBlockRelativePos(null);
  setGrippedBlockRelativeRot(null);
}

/**
 * Update gripped block position to follow gripper (kinematic mode only)
 * Called every frame when a block is gripped
 */
export function updateGrippedBlockPosition() {
  if (!grippedBlock || !USE_KINEMATIC_GRIP || !grippedBlockRelativePos || !grippedBlockRelativeRot) {
    return;
  }

  const gripperLink = robot.links['gripper_link'];
  if (!gripperLink) return;

  // Get gripper world coordinates
  const gripperPos = new THREE.Vector3();
  const gripperQuat = new THREE.Quaternion();
  gripperLink.getWorldPosition(gripperPos);
  gripperLink.getWorldQuaternion(gripperQuat);

  // Transform relative position to world coordinates
  const blockWorldPos = grippedBlockRelativePos.clone();
  blockWorldPos.applyQuaternion(gripperQuat);
  blockWorldPos.add(gripperPos);

  // Transform relative rotation to world coordinates
  const blockWorldQuat = gripperQuat.clone().multiply(grippedBlockRelativeRot);

  // Update block physics body
  grippedBlock.body.setTranslation(
    { x: blockWorldPos.x, y: blockWorldPos.y, z: blockWorldPos.z },
    true
  );
  grippedBlock.body.setRotation(
    { x: blockWorldQuat.x, y: blockWorldQuat.y, z: blockWorldQuat.z, w: blockWorldQuat.w },
    true
  );
}

// ============================================================================
// Robot Collider Update
// ============================================================================

/**
 * Update robot collider positions to match visual model
 * Synchronizes kinematic physics bodies with Three.js visual links
 */
export function updateRobotColliders() {
  robotBodies.forEach((data) => {
    const { link, body, debugMesh, offset } = data;

    // Get link world coordinates
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();

    link.getWorldPosition(worldPos);
    link.getWorldQuaternion(worldQuat);

    // Apply offset (in link's local coordinate system)
    if (offset) {
      const offsetWorld = offset.clone().applyQuaternion(worldQuat);
      worldPos.add(offsetWorld);
    }

    // Update physics body position and rotation
    body.setTranslation({ x: worldPos.x, y: worldPos.y, z: worldPos.z }, true);
    body.setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }, true);

    // Sync debug mesh if exists
    if (debugMesh) {
      debugMesh.position.copy(worldPos);
      debugMesh.quaternion.copy(worldQuat);
    }
  });
}

/**
 * Synchronize block visual meshes with physics bodies
 * Updates Three.js mesh positions/rotations to match Rapier bodies
 */
export function syncBlocksWithPhysics() {
  blocks.forEach(block => {
    const pos = block.body.translation();
    const rot = block.body.rotation();
    block.mesh.position.set(pos.x, pos.y, pos.z);
    block.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  });
}
