import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import URDFLoader from 'urdf-loader';
import RAPIER from '@dimforge/rapier3d-compat';

// グローバル変数
let scene, camera, renderer, controls;
let world;
let robot;
let joints = [];
let targetAngles = [0, 0, 0, 0, 0, 0]; // 6 joints for SO-ARM101
let jointNames = ['shoulder_pan', 'shoulder_lift', 'elbow_flex', 'wrist_flex', 'wrist_roll', 'gripper'];

// 積み木用
let blocks = [];

// 台（プラットフォーム）
let platform = null;

// スコア管理
let score = 0;
let blocksOnPlatform = new Set(); // 台の上にある積み木のIDを記録

// ロボットリンクの物理ボディ
let robotBodies = new Map();

// デバッグ用：コライダーの可視化
let debugMode = false;
let debugMeshes = [];

// グリッピング関連
let grippedBlock = null;
let gripJoint = null;
let grippedBlockRelativePos = null; // グリッパーからの相対位置
let grippedBlockRelativeRot = null; // グリッパーからの相対回転
let previousGripperAngle = 0;
let autoGripEnabled = true; // 自動グリップ機能のON/OFF
const GRIP_THRESHOLD = 0.26; // グリッパーが閉じたと判定する角度（15度 = 0.262ラジアン）
const RELEASE_THRESHOLD = 0.35; // グリッパーが開いたと判定する角度（20度）
const GRIP_DISTANCE = 0.1;  // グリッパーから積み木までの最大距離（10cm）
const USE_KINEMATIC_GRIP = true; // キネマティック制御を使用（振動を防ぐ）

// FPSカウンター
let lastTime = performance.now();
let frameCount = 0;

// 初期化
async function init() {
  // Rapier初期化
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

  // 物理エンジンの精度設定
  world.timestep = 1 / 120;
  world.maxVelocityIterations = 8;
  world.maxPositionIterations = 4;

  // Three.js基本セットアップ
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);
  scene.fog = new THREE.Fog(0x1a1a2e, 10, 50);

  // カメラ
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.01,
    100
  );
  camera.position.set(0.5, 0.3, 0.5);
  camera.lookAt(0, 0.1, 0);

  // レンダラー
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const container = document.getElementById('canvas-container');
  container.appendChild(renderer.domElement);

  // OrbitControls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 0.1, 0);

  // ライティング
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(0.5, 1, 0.5);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.left = -0.5;
  directionalLight.shadow.camera.right = 0.5;
  directionalLight.shadow.camera.top = 0.5;
  directionalLight.shadow.camera.bottom = -0.5;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x545454, 0.4);
  scene.add(hemisphereLight);

  // グリッド
  const gridHelper = new THREE.GridHelper(2, 10, 0x444444, 0x222222);
  scene.add(gridHelper);

  // 地面（ビジュアル）
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

  // 地面（物理）
  const groundColliderDesc = RAPIER.ColliderDesc.cuboid(1, 0.0, 1)
    .setFriction(1.0)       // 地面の摩擦
    .setRestitution(1.0);   // 地面の反発なし
  world.createCollider(groundColliderDesc);

  // URDFロード
  await loadRobot();

  // 台を作成
  createPlatform();

  // 積み木を作成
  createBlocks();

  // UI設定
  setupUI();

  // ウィンドウリサイズ対応
  window.addEventListener('resize', onWindowResize);

  // ローディング非表示
  document.getElementById('loading').classList.add('hidden');

  // アニメーションループ開始
  animate();
}

// ロボットをURDFから読み込み
async function loadRobot() {
  console.log('Starting URDF load...');

  const loader = new URDFLoader();
  loader.workingPath = import.meta.env.BASE_URL + 'soarm/';

  // LoadingManagerのイベント設定
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
        robot = urdfRobot;

        // スケール調整（メートル単位に）
        robot.scale.set(1, 1, 1);

        // ロボットの向きを修正
        // URDFの座標系とThree.jsの座標系の違いを補正
        robot.rotation.x = -Math.PI / 2;
        robot.rotation.y = 0;
        robot.rotation.z = 0;

        // ロボットをシーンに追加
        scene.add(robot);

        // シャドウを有効化
        robot.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // マテリアルの調整
            if (child.material) {
              child.material.roughness = 0.6;
              child.material.metalness = 0.3;
            }
          }
        });

        // ジョイント情報を取得
        extractJoints();

        // ロボットの物理コライダーを追加
        addRobotColliders();

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

// ジョイント情報を抽出
function extractJoints() {
  joints = [];

  jointNames.forEach((name, index) => {
    if (robot.joints[name]) {
      const joint = robot.joints[name];
      joints.push({
        name: name,
        joint: joint,
        index: index
      });

      // 初期角度を設定
      if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
        joint.setJointValue(0);
      }
    }
  });

  console.log('Extracted joints:', joints.map(j => j.name));
}

// 台（プラットフォーム）を作成
function createPlatform() {
  const platformSize = { width: 0.15, height: 0.05, depth: 0.15 };
  const platformPosition = { x: 0.1, y: platformSize.height / 2, z: 0.3 };

  // ビジュアル（Three.js）
  const geometry = new THREE.BoxGeometry(platformSize.width, platformSize.height, platformSize.depth);
  const material = new THREE.MeshStandardMaterial({
    color: 0x44aa88,
    roughness: 0.7,
    metalness: 0.3
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(platformPosition.x, platformPosition.y, platformPosition.z);
  scene.add(mesh);

  // 物理ボディ（静的）
  const rigidBodyDesc = RAPIER.RigidBodyDesc.fixed()
    .setTranslation(platformPosition.x, platformPosition.y, platformPosition.z);
  const rigidBody = world.createRigidBody(rigidBodyDesc);

  // コライダー（当たり判定）
  const halfWidth = platformSize.width / 2;
  const halfHeight = platformSize.height / 2;
  const halfDepth = platformSize.depth / 2;
  const colliderDesc = RAPIER.ColliderDesc.cuboid(halfWidth, halfHeight, halfDepth)
    .setFriction(1.5)
    .setRestitution(0.1);
  world.createCollider(colliderDesc, rigidBody);

  platform = {
    mesh: mesh,
    body: rigidBody,
    size: platformSize,
    position: platformPosition,
    bounds: {
      minX: platformPosition.x - halfWidth,
      maxX: platformPosition.x + halfWidth,
      minY: platformPosition.y + halfHeight, // 台の上面
      maxY: platformPosition.y + halfHeight + 0.1, // 上面から少し上まで
      minZ: platformPosition.z - halfDepth,
      maxZ: platformPosition.z + halfDepth
    }
  };

  console.log('Platform created at', platformPosition);
}

// 積み木を作成
function createBlocks() {
  const blockConfigs = [
    { size: 0.025, position: { x: 0.35, y: 0.0225, z: 0 }, color: 0xff6b6b },
    { size: 0.025, position: { x: 0.25, y: 0.0375, z: -0.1 }, color: 0x4ecdc4 },
    { size: 0.025, position: { x: 0.28, y: 0.0125, z: 0 }, color: 0xffe66d },
    { size: 0.03, position: { x: 0.22, y: 0.015, z: 0.05 }, color: 0x95e1d3 },
  ];

  blockConfigs.forEach((config, index) => {
    createBlock(config.size, config.position, config.color, index);
  });
}

// 個別の積み木を作成
function createBlock(size, position, color, id) {
  // ビジュアル（Three.js）
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

  // 物理ボディ（Rapier）
  const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(position.x, position.y, position.z);
  const rigidBody = world.createRigidBody(rigidBodyDesc);

  // コライダー（当たり判定）
  const halfSize = size / 2;
  const colliderDesc = RAPIER.ColliderDesc.cuboid(halfSize, halfSize, halfSize)
    .setDensity(1.0)
    .setFriction(1.2)     // 摩擦を上げて掴みやすく
    .setRestitution(0.1); // 反発を抑える
  world.createCollider(colliderDesc, rigidBody);

  // CCDを有効化（積み木のめり込み防止）
  rigidBody.enableCcd(true);

  // 管理用配列に追加
  blocks.push({
    id: id,
    mesh: mesh,
    body: rigidBody,
    size: size
  });

  console.log(`Block ${id} created at`, position);
}

// ロボットのリンクに物理コライダーを追加
function addRobotColliders() {
  // グリッパーと主要なリンクにコライダーを追加
  const linkColliders = [
    { name: 'gripper_link', type: 'box', size:  [0.01, 0.04, 0.1], offset: [-0.015, 0, -0.05] },
    { name: 'moving_jaw_so101_v1_link', type: 'box', size: [0.01, 0.15, 0.04], offset: [0, -0.01, 0.02] },
    { name: 'wrist_link', type: 'box', size: [0.03, 0.05, 0.03] },
    { name: 'lower_arm_link', type: 'box', size: [0.13, 0.03, 0.03] },
    { name: 'upper_arm_link', type: 'box', size: [0.12, 0.03, 0.03] },
  ];

  linkColliders.forEach(config => {
    const link = robot.links[config.name];
    if (!link) {
      console.warn(`Link ${config.name} not found`);
      return;
    }

    // キネマティック剛体として作成（ロボット制御に追従）
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    const body = world.createRigidBody(bodyDesc);

    // コライダーを作成
    let colliderDesc;
    if (config.type === 'box') {
      const [x, y, z] = config.size;
      colliderDesc = RAPIER.ColliderDesc.cuboid(x / 2, y / 2, z / 2);
    } else if (config.type === 'cylinder') {
      colliderDesc = RAPIER.ColliderDesc.cylinder(config.height / 2, config.radius);
    }

    // 物理パラメータを設定
    colliderDesc
      .setFriction(3.0)           // 高摩擦で滑りにくく
      .setRestitution(0.0)        // 弾性なし
      .setDensity(1.0);           // 密度設定

    const collider = world.createCollider(colliderDesc, body);

    // CCDを有効化（連続衝突検出でめり込みを防止）
    body.enableCcd(true);

    // デバッグ用：コライダーの可視化
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

    // リンクと物理ボディを関連付け（オフセット情報も保存）
    const offset = config.offset || [0, 0, 0];
    robotBodies.set(config.name, {
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
}

// UI設定
function setupUI() {
  // 全6軸のジョイント
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
        targetAngles[index] = value * Math.PI / 180;
        valueDisplay.textContent = `${value}°`;
      });
    }
  });

  // Reset button
  const resetBtn = document.getElementById('reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      targetAngles = [0, 0, 0, 0, 0, 0];
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

  // Auto Grip toggle button
  const toggleGripBtn = document.getElementById('toggle-grip');
  if (toggleGripBtn) {
    toggleGripBtn.addEventListener('click', () => {
      autoGripEnabled = !autoGripEnabled;

      if (autoGripEnabled) {
        toggleGripBtn.textContent = 'Auto Grip: ON';
        toggleGripBtn.style.background = '#2ecc71';
      } else {
        toggleGripBtn.textContent = 'Auto Grip: OFF';
        toggleGripBtn.style.background = '#95a5a6';

        // OFFにしたときに掴んでいる場合は離す
        if (grippedBlock) {
          releaseGrip();
        }
      }
    });
  }
}

// 物理/制御ステップ
const dt = 1 / 60; // 60Hz update rate
const Kp = 0.5;    // 比例ゲイン
const Kd = 0.1;    // 微分ゲイン

function updateRobot() {
  if (!robot || joints.length === 0) return;

  // 簡易PD制御で各ジョイントを目標角度に追従
  joints.forEach(({ joint, index }) => {
    if (joint.jointType === 'revolute' || joint.jointType === 'continuous') {
      const currentAngle = joint.angle || 0;
      const targetAngle = targetAngles[index];

      const error = targetAngle - currentAngle;

      // 速度を推定（前回との差分）
      const velocity = joint.velocity || 0;

      // PD制御
      const control = Kp * error - Kd * velocity;

      // ジョイント角度を更新（制御入力を積分）
      const newAngle = currentAngle + control * dt;

      // ジョイントリミットを考慮
      let clampedAngle = newAngle;
      if (joint.limit) {
        clampedAngle = Math.max(joint.limit.lower, Math.min(joint.limit.upper, newAngle));
      }

      // 速度を記録
      joint.velocity = (clampedAngle - currentAngle) / dt;

      // ジョイント値を設定
      joint.setJointValue(clampedAngle);
    }
  });
}

// クォータニオンでベクトルを回転
function rotateVectorByQuaternion(vec, quat) {
  // quat * vec * quat^-1
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

// クォータニオンの乗算
function multiplyQuaternions(q1, q2) {
  return {
    x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
    y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
    z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w,
    w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z
  };
}

// グリッピング処理
function updateGripping() {
  // 自動グリップが無効の場合は何もしない
  if (!autoGripEnabled) {
    return;
  }

  // グリッパージョイントを取得
  const gripperJoint = joints.find(j => j.name === 'gripper');
  if (!gripperJoint) {
    console.warn('Gripper joint not found');
    return;
  }

  // URDFローダーのジョイント角度を取得
  const currentAngle = targetAngles[5]; // グリッパーは6番目（インデックス5）

  // デバッグ用：角度をログ出力（最初の数回のみ）
  if (Math.random() < 0.01) {
    console.log('Gripper angle:', (currentAngle * 180 / Math.PI).toFixed(2), '°',
                'Grip threshold:', (GRIP_THRESHOLD * 180 / Math.PI).toFixed(2), '°',
                'Release threshold:', (RELEASE_THRESHOLD * 180 / Math.PI).toFixed(2), '°');
  }

  // グリッパーが閉じた（角度が閾値を下回った）- 小さい角度 = 閉じている
  if (currentAngle < GRIP_THRESHOLD && previousGripperAngle >= GRIP_THRESHOLD) {
    console.log('Gripper closing - trying to grip at angle:', (currentAngle * 180 / Math.PI).toFixed(2), '°');
    tryGrip();
  }
  // グリッパーが開いた（角度が閾値を超えた）- 大きい角度 = 開いている
  else if (currentAngle > RELEASE_THRESHOLD && previousGripperAngle <= RELEASE_THRESHOLD) {
    console.log('Gripper opening - releasing at angle:', (currentAngle * 180 / Math.PI).toFixed(2), '°');
    releaseGrip();
  }

  previousGripperAngle = currentAngle;
}

// 積み木を掴む試行
function tryGrip() {
  if (grippedBlock) {
    console.log('Already gripping a block');
    return; // すでに掴んでいる場合は何もしない
  }

  const gripperLink = robot.links['gripper_link'];
  if (!gripperLink) {
    console.warn('Gripper link not found');
    return;
  }

  // グリッパーのワールド座標を取得
  const gripperPos = new THREE.Vector3();
  gripperLink.getWorldPosition(gripperPos);

  console.log('Gripper position:', gripperPos);

  // 最も近い積み木を探す
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

  // 近くに積み木があれば掴む
  if (closestBlock) {
    console.log(`Found block ${closestBlock.id} at distance ${closestDistance.toFixed(3)}m`);
    grippedBlock = closestBlock;

    const gripperLink = robot.links['gripper_link'];
    const gripperBody = robotBodies.get('gripper_link').body;

    if (USE_KINEMATIC_GRIP) {
      // キネマティック制御方式（振動なし）

      // 積み木をキネマティックボディに変更
      closestBlock.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);

      // 現在の相対位置と回転を保存
      const blockPos = closestBlock.body.translation();
      const blockRot = closestBlock.body.rotation();

      // グリッパーのワールド座標を取得
      const gripperPos = new THREE.Vector3();
      const gripperQuat = new THREE.Quaternion();
      gripperLink.getWorldPosition(gripperPos);
      gripperLink.getWorldQuaternion(gripperQuat);

      // 相対位置を計算（Three.jsを使用）
      const relativePos = new THREE.Vector3(blockPos.x, blockPos.y, blockPos.z);
      relativePos.sub(gripperPos);

      // グリッパーのローカル座標系に変換
      const gripperQuatInv = gripperQuat.clone().invert();
      relativePos.applyQuaternion(gripperQuatInv);

      grippedBlockRelativePos = relativePos;

      // 相対回転を計算
      const blockQuat = new THREE.Quaternion(blockRot.x, blockRot.y, blockRot.z, blockRot.w);
      const relativeQuat = gripperQuatInv.clone().multiply(blockQuat);
      grippedBlockRelativeRot = relativeQuat;

      console.log('Gripped block (kinematic mode):', closestBlock.id);
    } else {
      // ジョイント方式（従来）
      const blockPos = closestBlock.body.translation();
      const blockRot = closestBlock.body.rotation();
      const gripperPos = gripperBody.translation();
      const gripperRot = gripperBody.rotation();

      const gripperRotInv = {
        x: -gripperRot.x,
        y: -gripperRot.y,
        z: -gripperRot.z,
        w: gripperRot.w
      };

      const relativePos = {
        x: blockPos.x - gripperPos.x,
        y: blockPos.y - gripperPos.y,
        z: blockPos.z - gripperPos.z
      };

      const localAnchor1 = rotateVectorByQuaternion(relativePos, gripperRotInv);
      const relativeRotation = multiplyQuaternions(gripperRotInv, blockRot);

      const jointParams = RAPIER.JointData.fixed(
        localAnchor1,
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 0, y: 0, z: 0 },
        relativeRotation
      );

      gripJoint = world.createImpulseJoint(jointParams, gripperBody, closestBlock.body, true);

      console.log('Gripped block (joint mode):', closestBlock.id);
    }

    // UI更新
    const gripStatus = document.getElementById('grip-status');
    if (gripStatus) {
      gripStatus.textContent = `Block ${closestBlock.id}`;
      gripStatus.style.color = '#4ecdc4';
    }
  } else {
    console.log('No block within grip distance');
  }
}

// 積み木を離す
function releaseGrip() {
  if (!grippedBlock) return;

  if (USE_KINEMATIC_GRIP) {
    // 積み木をダイナミックボディに戻す
    grippedBlock.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);

    // 現在の速度を保持（滑らかな離脱）
    grippedBlock.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    grippedBlock.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  } else {
    // ジョイントを削除
    if (gripJoint) {
      world.removeImpulseJoint(gripJoint, true);
      gripJoint = null;
    }
  }

  // UI更新
  const gripStatus = document.getElementById('grip-status');
  if (gripStatus) {
    gripStatus.textContent = 'None';
    gripStatus.style.color = 'white';
  }

  console.log('Released block:', grippedBlock.id);
  grippedBlock = null;
  grippedBlockRelativePos = null;
  grippedBlockRelativeRot = null;
}

// ロボットのコライダー位置を更新
function updateRobotColliders() {
  robotBodies.forEach((data) => {
    const { link, body, debugMesh, offset } = data;

    // リンクのワールド座標を取得
    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();

    link.getWorldPosition(worldPos);
    link.getWorldQuaternion(worldQuat);

    // オフセットを適用（リンクのローカル座標系で）
    if (offset) {
      const offsetWorld = offset.clone().applyQuaternion(worldQuat);
      worldPos.add(offsetWorld);
    }

    // 物理ボディの位置と回転を更新
    body.setTranslation({ x: worldPos.x, y: worldPos.y, z: worldPos.z }, true);
    body.setRotation({ x: worldQuat.x, y: worldQuat.y, z: worldQuat.z, w: worldQuat.w }, true);

    // デバッグメッシュも同期
    if (debugMesh) {
      debugMesh.position.copy(worldPos);
      debugMesh.quaternion.copy(worldQuat);
    }
  });
}

// スコア更新
function updateScore() {
  if (!platform) return;

  let newScore = 0;
  const newBlocksOnPlatform = new Set();

  blocks.forEach(block => {
    const pos = block.body.translation();
    const vel = block.body.linvel();

    // 積み木が台の範囲内にあるかチェック
    const isOnPlatform =
      pos.x >= platform.bounds.minX &&
      pos.x <= platform.bounds.maxX &&
      pos.y >= platform.bounds.minY &&
      pos.y <= platform.bounds.maxY &&
      pos.z >= platform.bounds.minZ &&
      pos.z <= platform.bounds.maxZ;

    // 速度が小さい（静止している）かチェック
    const isStable = Math.abs(vel.x) < 0.01 && Math.abs(vel.y) < 0.01 && Math.abs(vel.z) < 0.01;

    if (isOnPlatform && isStable) {
      newBlocksOnPlatform.add(block.id);

      // 新しく台に乗った積み木の場合、スコアを加算
      if (!blocksOnPlatform.has(block.id)) {
        console.log(`Block ${block.id} placed on platform! +10 points`);
      }
    }
  });

  // スコアを計算（台の上にある積み木の数 × 10点）
  newScore = newBlocksOnPlatform.size * 10;

  // スコアが変わった場合のみ更新
  if (newScore !== score) {
    score = newScore;
    const scoreDisplay = document.getElementById('score');
    if (scoreDisplay) {
      scoreDisplay.textContent = score;
    }
  }

  blocksOnPlatform = newBlocksOnPlatform;
}

// アニメーションループ
function animate() {
  requestAnimationFrame(animate);

  // ロボット更新（キネマティクス）
  updateRobot();

  // グリッピング処理
  updateGripping();

  // ロボットのコライダー位置を更新
  updateRobotColliders();

  // 物理ステップ
  world.step();

  // 掴んでいる積み木の位置を更新（キネマティック制御）
  if (grippedBlock && USE_KINEMATIC_GRIP && grippedBlockRelativePos && grippedBlockRelativeRot) {
    const gripperLink = robot.links['gripper_link'];
    if (gripperLink) {
      // グリッパーのワールド座標を取得
      const gripperPos = new THREE.Vector3();
      const gripperQuat = new THREE.Quaternion();
      gripperLink.getWorldPosition(gripperPos);
      gripperLink.getWorldQuaternion(gripperQuat);

      // 相対位置をワールド座標に変換
      const blockWorldPos = grippedBlockRelativePos.clone();
      blockWorldPos.applyQuaternion(gripperQuat);
      blockWorldPos.add(gripperPos);

      // 相対回転をワールド座標に変換
      const blockWorldQuat = gripperQuat.clone().multiply(grippedBlockRelativeRot);

      // 積み木の物理ボディを更新
      grippedBlock.body.setTranslation(
        { x: blockWorldPos.x, y: blockWorldPos.y, z: blockWorldPos.z },
        true
      );
      grippedBlock.body.setRotation(
        { x: blockWorldQuat.x, y: blockWorldQuat.y, z: blockWorldQuat.z, w: blockWorldQuat.w },
        true
      );
    }
  }

  // 積み木の位置を物理エンジンと同期
  blocks.forEach(block => {
    const pos = block.body.translation();
    const rot = block.body.rotation();
    block.mesh.position.set(pos.x, pos.y, pos.z);
    block.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  });

  // スコア更新
  updateScore();

  controls.update();
  renderer.render(scene, camera);

  // FPS表示
  frameCount++;
  const currentTime = performance.now();
  if (currentTime >= lastTime + 1000) {
    const fpsDisplay = document.getElementById('fps');
    if (fpsDisplay) {
      fpsDisplay.textContent = frameCount;
    }
    frameCount = 0;
    lastTime = currentTime;
  }
}

// ウィンドウリサイズ
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// 初期化実行
init().catch(error => {
  console.error('Initialization failed:', error);
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = '<div style="color: red;">エラー: ロボットモデルの読み込みに失敗しました</div>';
  }
});
