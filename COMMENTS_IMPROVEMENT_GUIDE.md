# Code Comments Improvement Guide

このガイドは、main.jsとindex.htmlのコメントをオープンソースプロジェクトとして公開できるプロフェッショナルなレベルに改善するための指針です。

## 全体的な原則

### 1. 言語の統一
- **すべてのコメントを英語に統一**
- 国際的なオープンソースコミュニティを考慮
- 日本語のコメントは英語に翻訳

### 2. JSDoc形式の採用
- 関数の説明にはJSDoc形式を使用
- パラメータと戻り値を明示
- 型情報を含める

### 3. コメントの明確性
- 「何を」だけでなく「なぜ」を説明
- 実装の意図やトレードオフを記載
- 最適化や制約事項を明記

## 具体的な改善パターン

### パターン1: グローバル変数

❌ Before:
```javascript
// グローバル変数
let scene, camera, renderer, controls;
let world;
```

✅ After:
```javascript
// ============================================================================
// Global State - Scene & Rendering
// ============================================================================

/** @type {THREE.Scene} Three.js scene container */
let scene;

/** @type {THREE.PerspectiveCamera} Main camera */
let camera;

/** @type {THREE.WebGLRenderer} WebGL renderer */
let renderer;

/** @type {OrbitControls} Camera orbit controls */
let controls;

// ============================================================================
// Global State - Physics
// ============================================================================

/** @type {RAPIER.World} Rapier physics world */
let world;
```

### パターン2: 定数の説明

❌ Before:
```javascript
const GRIP_THRESHOLD = 0.26; // グリッパーが閉じたと判定する角度（15度 = 0.262ラジアン）
```

✅ After:
```javascript
/**
 * Gripper angle threshold for triggering grip action
 * When gripper angle falls below this value, grip is activated
 * @const {number} 15 degrees = 0.262 radians
 */
const GRIP_THRESHOLD = 0.26;
```

### パターン3: 関数ドキュメント

❌ Before:
```javascript
// 初期化
async function init() {
  // Rapier初期化
  await RAPIER.init();
  // ...
}
```

✅ After:
```javascript
/**
 * Initialize the simulation
 *
 * Sets up the complete simulation environment including:
 * - Rapier physics engine
 * - Three.js scene and rendering
 * - Camera and lighting
 * - Robot model from URDF
 * - Scene objects (platform, blocks)
 * - UI event handlers
 *
 * @async
 * @returns {Promise<void>}
 * @throws {Error} If URDF loading fails
 */
async function init() {
  // Initialize Rapier physics engine
  await RAPIER.init();
  // ...
}
```

### パターン4: 複雑なロジックの説明

❌ Before:
```javascript
// 物理エンジンの精度設定（最適化）
world.timestep = 1 / 60;
world.maxVelocityIterations = 4; // 8から4に削減
world.maxPositionIterations = 2; // 4から2に削減
```

✅ After:
```javascript
// Configure physics engine for optimal performance
// These values are reduced from defaults for better frame rate
// while maintaining acceptable simulation accuracy
world.timestep = 1 / 60;             // 60 Hz update rate
world.maxVelocityIterations = 4;   // Reduced from 8 for performance
world.maxPositionIterations = 2;   // Reduced from 4 for performance
```

### パターン5: セクション区切り

❌ Before:
```javascript
let score = 0;
let blocksOnPlatform = new Set();
let gameMode = false;
```

✅ After:
```javascript
// ============================================================================
// Global State - Game Mode
// ============================================================================

/** Current score based on blocks on platform */
let score = 0;

/** Set of block IDs currently on the platform */
let blocksOnPlatform = new Set();

/** Whether game mode is currently active */
let gameMode = false;
```

### パターン6: アルゴリズムの説明

❌ Before:
```javascript
// 簡易PD制御で各ジョイントを目標角度に追従
const control = Kp * error - Kd * velocity;
```

✅ After:
```javascript
/**
 * Simple PD (Proportional-Derivative) controller
 * Formula: u(t) = Kp * e(t) - Kd * v(t)
 * - Kp: Proportional gain (position error)
 * - Kd: Derivative gain (velocity damping)
 */
const control = Kp * error - Kd * velocity;
```

### パターン7: パラメータの根拠

❌ Before:
```javascript
const GRIP_DISTANCE = 0.1;  // グリッパーから積み木までの最大距離（10cm）
```

✅ After:
```javascript
/**
 * Maximum distance for grip detection (10cm)
 * This value is calibrated based on the gripper's physical reach
 * and provides a good balance between precision and usability
 * @const {number}
 */
const GRIP_DISTANCE = 0.1;
```

### パターン8: エラーハンドリング

❌ Before:
```javascript
// 初期化実行
init().catch(error => {
  console.error('Initialization failed:', error);
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = '<div style="color: red;">エラー: ロボットモデルの読み込みに失敗しました</div>';
  }
});
```

✅ After:
```javascript
/**
 * Initialize and start the simulation
 * If initialization fails, display error message to user
 */
init().catch(error => {
  console.error('Initialization failed:', error);
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML = '<div style="color: red;">Error: Failed to load robot model</div>';
  }
});
```

## HTMLコメント改善パターン

### パターン1: セクション区切り

❌ Before:
```html
<style>
  * {
    margin: 0;
  }
</style>
```

✅ After:
```html
<style>
  /* ========================================
     Reset Styles
     ======================================== */
  * {
    margin: 0;
  }
</style>
```

### パターン2: 複雑なCSSの説明

❌ Before:
```css
#program-panel.collapsed {
  right: -340px;
}
```

✅ After:
```css
/* Slide panel off-screen when collapsed
   Note: Width (360px) - visible tab (20px) = 340px offset */
#program-panel.collapsed {
  right: -340px;
}
```

## 優先度の高い改善箇所

### 高優先度
1. ファイルヘッダー（ライセンス、説明、著者情報）
2. 公開API関数（exportProgram, importProgramなど）
3. 複雑なアルゴリズム（PD制御、グリッピング、物理演算）
4. グローバル定数と設定値

### 中優先度
5. UI イベントハンドラー
6. ゲームモード関連
7. プログラミングモード関連

### 低優先度
8. 単純なgetter/setter
9. 自明な処理
10. 一時変数

## 推奨ツール

- **ESLint** with JSDoc plugin: コメント形式の検証
- **TypeScript JSDoc**: 型チェックの追加
- **Documentation.js**: APIドキュメントの自動生成

## チェックリスト

実装時に以下を確認:

- [ ] すべてのコメントが英語である
- [ ] すべての public 関数に JSDoc がある
- [ ] 複雑なロジックに説明がある
- [ ] マジックナンバーに説明がある
- [ ] エラーメッセージが英語である
- [ ] TODOやFIXMEがissueとして管理されている
- [ ] 不要な日本語の console.log がない

## サンプルファイルヘッダー

```javascript
/**
 * SO-ARM101 Robot Simulator
 *
 * A web-based physics simulation for the SO-ARM101 robotic arm featuring:
 * - Real-time 3D visualization using Three.js
 * - Physics simulation with Rapier3D
 * - URDF model loading
 * - Interactive joint control
 * - Programming mode for teaching and playback
 * - Game mode for block stacking challenges
 *
 * @author ABEJA PhysicalAI Team
 * @license MIT
 * @version 1.0.0
 * @see https://github.com/your-org/sophia-robot
 */
```

## 次のステップ

1. このガイドに従ってmain.jsを段階的に改善
2. index.htmlのコメントも同様に改善
3. README.mdを英語で作成
4. LICENSEファイルを追加
5. CONTRIBUTING.mdを作成
6. JSDocからAPIドキュメントを生成

## 参考リンク

- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
- [JSDoc Official Documentation](https://jsdoc.app/)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
- [MDN: Writing JavaScript Documentation](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Writing_style_guide/Code_style_guide/JavaScript)
