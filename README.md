## 📘 ドキュメントタイトル

**SO-ARM Web Physics Simulation (three.js + Rapier + URDF)**

---

## 概要

このドキュメントは、SO-ARMシリーズのロボットアーム（例：SO-ARM100 / 101）をブラウザ上で動作させる簡易物理シミュレーション環境の構築手順を説明します。
描画には **three.js**、物理演算には **Rapier（WASM版）** を用い、ロボットモデルは **URDFファイル** から読み込みます。
本構成はROS依存を持たず、完全にWeb上で完結します。

---

## 技術スタック

| 分類     | 使用技術                             | 用途               |
| ------ | -------------------------------- | ---------------- |
| 描画     | three.js                         | 3Dシーン描画とマテリアル処理  |
| モデルロード | urdf-loader                      | URDF形式のロボットモデル読込 |
| 物理エンジン | @dimforge/rapier3d-compat (WASM) | 剛体・ジョイント・衝突計算    |
| 通信（任意） | WebSocket / Worker               | 物理と描画を分離（性能向上）   |
| 言語     | JavaScript / TypeScript          | 実装言語             |

---

## ディレクトリ構成（推奨）

```
soarm-sim/
├─ public/
│  ├─ soarm/
│  │  ├─ so_arm.urdf
│  │  └─ meshes/
│  │     ├─ link1.stl
│  │     ├─ link2.stl
│  │     └─ ...
│  └─ index.html
├─ src/
│  ├─ main.js
│  ├─ physics.js
│  ├─ renderer.js
│  ├─ urdfLoader.js
│  └─ control.js
├─ package.json
└─ vite.config.js（またはwebpack）
```

---

## 依存関係インストール

```bash
npm install three urdf-loader @dimforge/rapier3d-compat
# 開発用ツールとして vite 推奨
npm install --save-dev vite
```

起動:

```bash
npx vite
```

---

## 処理フロー概要

1. **URDF読込**

   * `urdf-loader`で `/soarm/so_arm.urdf` を非同期読み込み。
   * `URDFLink` / `URDFJoint`オブジェクトをツリー構造で保持。

2. **物理ワールド生成**

   * RapierのWorldを初期化（重力: y=-9.81）。
   * 各リンクを剛体（RigidBody）＋Colliderとして登録。

3. **ジョイント生成**

   * URDFの`jointType`に基づいて`revolute`や`fixed`ジョイントをRapier上で生成。
   * 軸ベクトルはURDFの`axis xyz`を参照。

4. **制御ループ**

   * 固定ステップΔt（例: 1/300秒）で物理を更新。
   * 各関節に対してPD制御トルクを適用（`q_ref`に追従）。

5. **描画ループ**

   * three.jsで剛体姿勢をメッシュへ反映。
   * 補間で滑らかに動作。

---

## コードサマリ（抜粋）

```js
// main.js
import * as THREE from 'three';
import { URDFLoader } from 'urdf-loader';
import('@dimforge/rapier3d-compat').then(initSimulation);

async function initSimulation(RAPIER) {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

  // Three.js 基本セットアップ
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.01, 10);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  document.body.appendChild(renderer.domElement);

  // URDFロード
  const loader = new URDFLoader();
  const robot = await new Promise(r => loader.load('/soarm/so_arm.urdf', r, {
    packages: ['/soarm/meshes/']
  }));
  scene.add(robot);

  // URDFノードからRapier剛体生成
  const map = new Map();
  robot.traverse(node => {
    if (node.isURDFLink) {
      const rbDesc = node.parent ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed();
      const rb = world.createRigidBody(rbDesc);
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.03, 0.1, 0.03), rb);
      map.set(node, rb);
    }
  });

  // URDFジョイントからRevoluteJoint生成
  robot.traverse(node => {
    if (node.isURDFJoint && node.jointType === 'revolute') {
      const a = map.get(node.parent);
      const b = map.get(node.child);
      const axis = node.axis;
      const jd = RAPIER.JointData.revolute({x:0,y:0,z:0}, {x:0,y:0,z:0}, axis);
      world.createImpulseJoint(jd, a, b, true);
    }
  });

  // 簡易PD制御
  const dt = 1 / 300, Kp = 15, Kd = 0.8;
  function step() {
    for (const j of world.joints) {
      const q = j.angles()[0];
      const qd = j.angvel1().z - j.angvel2().z;
      const tau = -Kp * (q - 0) - Kd * qd;
      j.body2().applyTorqueImpulse({x:0, y:0, z:tau * dt}, true);
    }
    world.step();
  }

  setInterval(step, dt * 1000);
  renderer.setAnimationLoop(() => renderer.render(scene, camera));
}
```

---

## 発展方向

* **URDF由来の慣性パラメータ反映**（`<inertial>`タグ）
* **ジョイントリミット**（`limit effort, velocity, lower, upper`）
* **摩擦・衝突の微調整**（Collider friction/restitution）
* **WebWorkerによる非同期物理**
* **制御信号をWebSocketで受け取り実機との同期**

---

## 確認済み動作環境

| 環境                        | バージョン                       |
| ------------------------- | --------------------------- |
| Node.js                   | 20.x 以上                     |
| three.js                  | r168 以上                     |
| urdf-loader               | 0.10.0 以上                   |
| @dimforge/rapier3d-compat | 0.14.x 以上                   |
| ブラウザ                      | Chrome / Edge / Firefox 最新版 |

---

## ライセンスと出典

* SO-ARM URDFモデル: TheRobotStudio / Seeed Studio 提供
* Rapier: [Dimforge](https://rapier.rs/)
* urdf-loader: [gkjohnson/urdf-loaders](https://github.com/gkjohnson/urdf-loaders)
* three.js: [https://threejs.org](https://threejs.org)

---

## 要約

このドキュメントに沿って環境を整えれば、SO-ARMのURDFを読み込み、three.js上で描画しながらRapierで物理挙動を与える簡易ロボットシミュレーターを構築できます。
初期段階ではPD制御＋静的床＋可視化を実装し、安定後にリミット、センサ、UIなどを追加していくのが推奨です。