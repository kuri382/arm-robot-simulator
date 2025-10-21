/**
 * Scene Setup Functions
 *
 * Handles Three.js scene initialization, lighting, camera,
 * and scene objects (platform, blocks, ground)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  SCENE_BACKGROUND_COLOR, FOG_NEAR, FOG_FAR,
  CAMERA_FOV, CAMERA_NEAR, CAMERA_FAR, CAMERA_POSITION, CAMERA_LOOK_AT,
  SHADOW_MAP_SIZE,
  BLOCK_CONFIGS,
  PLATFORM_CONFIG,
  PHYSICS_TIMESTEP, PHYSICS_VELOCITY_ITERATIONS, PHYSICS_POSITION_ITERATIONS
} from './constants.js';
import {
  setScene, setCamera, setRenderer, setControls, setWorld,
  setPlatform, setBlocks
} from './state.js';

/**
 * Initialize Rapier physics engine
 * Creates and configures the physics world
 *
 * @async
 * @returns {Promise<RAPIER.World>} Configured physics world
 */
export async function initPhysics() {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

  // Configure physics engine for optimal performance
  // These values are reduced from defaults for better frame rate
  // while maintaining acceptable simulation accuracy
  world.timestep = PHYSICS_TIMESTEP;
  world.maxVelocityIterations = PHYSICS_VELOCITY_ITERATIONS;
  world.maxPositionIterations = PHYSICS_POSITION_ITERATIONS;

  setWorld(world);
  return world;
}

/**
 * Initialize Three.js scene with lighting and fog
 *
 * @returns {THREE.Scene} Configured scene
 */
export function initScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BACKGROUND_COLOR);
  scene.fog = new THREE.Fog(SCENE_BACKGROUND_COLOR, FOG_NEAR, FOG_FAR);

  setScene(scene);
  return scene;
}

/**
 * Initialize camera with configured parameters
 *
 * @returns {THREE.PerspectiveCamera} Configured camera
 */
export function initCamera() {
  const camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    CAMERA_NEAR,
    CAMERA_FAR
  );
  camera.position.set(CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z);
  camera.lookAt(CAMERA_LOOK_AT.x, CAMERA_LOOK_AT.y, CAMERA_LOOK_AT.z);

  setCamera(camera);
  return camera;
}

/**
 * Initialize WebGL renderer with shadow support
 *
 * @returns {THREE.WebGLRenderer} Configured renderer
 */
export function initRenderer() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const container = document.getElementById('canvas-container');
  container.appendChild(renderer.domElement);

  setRenderer(renderer);
  return renderer;
}

/**
 * Initialize orbit controls for camera manipulation
 *
 * @param {THREE.PerspectiveCamera} camera - Camera to control
 * @param {HTMLCanvasElement} domElement - Renderer DOM element
 * @returns {OrbitControls} Configured orbit controls
 */
export function initControls(camera, domElement) {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(CAMERA_LOOK_AT.x, CAMERA_LOOK_AT.y, CAMERA_LOOK_AT.z);

  setControls(controls);
  return controls;
}

/**
 * Setup scene lighting
 * Adds ambient, directional, and hemisphere lights
 *
 * @param {THREE.Scene} scene - Scene to add lights to
 */
export function setupLighting(scene) {
  // Ambient light for overall illumination
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Directional light with shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(0.5, 1, 0.5);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.left = -0.5;
  directionalLight.shadow.camera.right = 0.5;
  directionalLight.shadow.camera.top = 0.5;
  directionalLight.shadow.camera.bottom = -0.5;
  directionalLight.shadow.mapSize.width = SHADOW_MAP_SIZE;
  directionalLight.shadow.mapSize.height = SHADOW_MAP_SIZE;
  scene.add(directionalLight);

  // Hemisphere light for natural sky/ground color
  const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x545454, 0.4);
  scene.add(hemisphereLight);
}

/**
 * Create ground plane with visual and physics components
 *
 * @param {THREE.Scene} scene - Scene to add ground to
 * @param {RAPIER.World} world - Physics world
 */
export function createGround(scene, world) {
  // Visual ground (Three.js)
  const groundGeometry = new THREE.BoxGeometry(2, 0.015, 2);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0xF0F8FF,
    roughness: 0.8,
    metalness: 0.2
  });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.receiveShadow = true;
  groundMesh.position.y = -0.01;
  scene.add(groundMesh);

  // Grid helper for reference
  const gridHelper = new THREE.GridHelper(2, 10, 0x444444, 0x222222);
  scene.add(gridHelper);

  // Physics ground (Rapier)
  const groundColliderDesc = RAPIER.ColliderDesc.cuboid(1, 0.0, 1)
    .setFriction(1.0)
    .setRestitution(1.0);  // No bounce
  world.createCollider(groundColliderDesc);
}

/**
 * Create platform for block placement
 * Creates both visual mesh and physics body
 *
 * @param {THREE.Scene} scene - Scene to add platform to
 * @param {RAPIER.World} world - Physics world
 * @returns {Object} Platform object with mesh, body, and bounds
 */
export function createPlatform(scene, world) {
  const { size, position, color, friction, restitution } = PLATFORM_CONFIG;

  // Visual (Three.js)
  const geometry = new THREE.BoxGeometry(size.width, size.height, size.depth);
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.7,
    metalness: 0.3
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(position.x, position.y, position.z);
  scene.add(mesh);

  // Physics body (static)
  const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(position.x, position.y, position.z);
  const rigidBody = world.createRigidBody(rigidBodyDesc);

  // Collider (collision detection)
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  const halfDepth = size.depth / 2;
  const colliderDesc = RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight, halfDepth)
    .setFriction(friction)
    .setRestitution(restitution);
  world.createCollider(colliderDesc, rigidBody);

  const platform = {
    mesh: mesh,
    body: rigidBody,
    size: size,
    position: position,
    bounds: {
      minX: position.x - halfWidth,
      maxX: position.x + halfWidth,
      minY: position.y + halfHeight,  // Platform top surface
      maxY: position.y + halfHeight + 0.05,  // 5cm above surface
      minZ: position.z - halfDepth,
      maxZ: position.z + halfDepth
    }
  };

  setPlatform(platform);
  console.log('Platform created at', position);
  return platform;
}

/**
 * Create all blocks from configuration
 *
 * @param {THREE.Scene} scene - Scene to add blocks to
 * @param {RAPIER.World} world - Physics world
 * @returns {Array} Array of block objects
 */
export function createBlocks(scene, world) {
  const blocks = [];

  BLOCK_CONFIGS.forEach((config, index) => {
    const block = createBlock(scene, world, config.size, config.position, config.color, index);
    blocks.push(block);
  });

  setBlocks(blocks);
  return blocks;
}

/**
 * Create individual block with visual and physics components
 *
 * @param {THREE.Scene} scene - Scene to add block to
 * @param {RAPIER.World} world - Physics world
 * @param {number} size - Block size (cube dimensions)
 * @param {Object} position - Initial position {x, y, z}
 * @param {number} color - Block color (hex)
 * @param {number} id - Block identifier
 * @returns {Object} Block object with mesh and physics body
 */
function createBlock(scene, world, size, position, color, id) {
  // Visual (Three.js)
  const geometry = new THREE.BoxGeometry(size, size, size);
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.5,
    metalness: 0.1
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(position.x, position.y, position.z);
  scene.add(mesh);

  // Physics body (dynamic)
  const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z);
  const rigidBody = world.createRigidBody(rigidBodyDesc);

  // Collider (collision detection)
  const halfSize = size / 2;
  const colliderDesc = RAPIER.ColliderDesc.cuboid(halfSize, halfSize, halfSize)
    .setDensity(1.0)
    .setFriction(1.2)     // Higher friction for easier gripping
    .setRestitution(0.1); // Low bounce
  world.createCollider(colliderDesc, rigidBody);

  // Enable CCD to prevent block tunneling
  rigidBody.enableCcd(true);

  console.log(`Block ${id} created at`, position);

  return {
    id: id,
    mesh: mesh,
    body: rigidBody,
    size: size
  };
}

/**
 * Reset blocks to initial positions
 * Resets physics body positions, rotations, and velocities
 *
 * @param {Array} blocks - Array of block objects to reset
 */
export function resetBlocks(blocks) {
  const initialPositions = BLOCK_CONFIGS.map(config => config.position);

  blocks.forEach((block, index) => {
    if (initialPositions[index]) {
      const pos = initialPositions[index];

      // Reset physics body position and velocity
      block.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
      block.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      block.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      block.body.setAngvel({ x: 0, y: 0, z: 0 }, true);

      // Reset visual mesh position
      block.mesh.position.set(pos.x, pos.y, pos.z);
      block.mesh.quaternion.set(0, 0, 0, 1);
    }
  });

  console.log('Blocks reset to initial positions');
}

/**
 * Handle window resize events
 * Updates camera aspect ratio and renderer size
 *
 * @param {THREE.PerspectiveCamera} camera - Camera to update
 * @param {THREE.WebGLRenderer} renderer - Renderer to update
 */
export function onWindowResize(camera, renderer) {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
