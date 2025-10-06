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

// FPSカウンター
let lastTime = performance.now();
let frameCount = 0;

// 初期化
async function init() {
  // Rapier初期化
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

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
  const gridHelper = new THREE.GridHelper(1, 10, 0x444444, 0x222222);
  scene.add(gridHelper);

  // 地面（ビジュアル）
  const groundGeometry = new THREE.BoxGeometry(2, 0.02, 2);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c2c2c,
    roughness: 0.8,
    metalness: 0.2
  });
  const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
  groundMesh.receiveShadow = true;
  groundMesh.position.y = -0.01;
  scene.add(groundMesh);

  // 地面（物理）
  const groundCollider = RAPIER.ColliderDesc.cuboid(1, 0.01, 1);
  world.createCollider(groundCollider);

  // URDFロード
  await loadRobot();

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

  // デフォルトのマネージャーを取得
  loader.manager.onStart = function(url, itemsLoaded, itemsTotal) {
    console.log('Started loading:', url);
  };

  loader.manager.onLoad = function() {
    console.log('All resources loaded');
  };

  loader.manager.onProgress = function(url, itemsLoaded, itemsTotal) {
    console.log('Loading file:', url, `(${itemsLoaded}/${itemsTotal})`);

    // ローディング表示を更新
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv && !loadingDiv.classList.contains('hidden')) {
      const progress = Math.round((itemsLoaded / itemsTotal) * 100);
      loadingDiv.querySelector('div:last-child').textContent =
        `モデル読み込み中... ${itemsLoaded}/${itemsTotal} (${progress}%)`;
    }
  };

  loader.manager.onError = function(url) {
    console.error('Error loading:', url);
  };

  return new Promise((resolve, reject) => {
    const onLoad = (urdfRobot) => {
      try {
        console.log('URDF parsed successfully!', urdfRobot);
        robot = urdfRobot;

        // スケール調整（メートル単位に）
        robot.scale.set(1, 1, 1);

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

        console.log('Robot setup completed');
        console.log('Joints:', robot.joints);

        resolve();
      } catch (error) {
        console.error('Error in onLoad:', error);
        reject(error);
      }
    };

    const onProgress = (progress) => {
      if (progress && progress.total > 0) {
        const percent = (progress.loaded / progress.total * 100).toFixed(2);
        console.log('Loading progress:', percent + '%');
      }
    };

    const onError = (error) => {
      console.error('URDF load error:', error);
      reject(error);
    };

    try {
      loader.load('/soarm/so_arm.urdf', onLoad, onProgress, onError);
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

// UI設定
function setupUI() {
  // Joint sliders - 主要な3関節のみUI表示
  const mainJoints = [
    { index: 0, name: 'shoulder_pan', label: 'Joint 1 (Pan)' },
    { index: 1, name: 'shoulder_lift', label: 'Joint 2 (Lift)' },
    { index: 2, name: 'elbow_flex', label: 'Joint 3 (Elbow)' }
  ];

  mainJoints.forEach(({ index }, uiIndex) => {
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
      for (let i = 1; i <= 3; i++) {
        const slider = document.getElementById(`joint${i}`);
        const valueDisplay = document.getElementById(`joint${i}-value`);
        if (slider && valueDisplay) {
          slider.value = 0;
          valueDisplay.textContent = '0°';
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

// アニメーションループ
function animate() {
  requestAnimationFrame(animate);

  // ロボット更新
  updateRobot();

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
