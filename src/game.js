/**
 * Game Mode Functions
 *
 * Handles game mode logic including:
 * - Game start/end
 * - Score tracking
 * - Timer management
 * - Confetti effects
 */

import { GAME_TIME_LIMIT, POINTS_PER_BLOCK, CONFETTI_COUNT, CONFETTI_COLORS } from './constants.js';
import {
  gameMode, setGameMode,
  gameStartTime, setGameStartTime,
  gameScore, setGameScore,
  score, setScore,
  blocksOnPlatform, setBlocksOnPlatform,
  blocks, platform,
  grippedBlock
} from './state.js';
import { resetRobot } from './robot.js';
import { resetBlocks } from './scene.js';
import { releaseGrip } from './physics.js';

/**
 * Start a new game session
 * Resets robot, blocks, and initializes game state
 */
export function startGame() {
  setGameMode(true);
  setGameStartTime(Date.now());
  setGameScore(0);
  setBlocksOnPlatform(new Set());

  // Reset robot position
  resetRobot();

  // Reset blocks to initial positions
  resetBlocks(blocks);

  // Release grip if holding a block
  if (grippedBlock) {
    releaseGrip();
  }

  // Update UI
  const startBtn = document.getElementById('start-game');
  if (startBtn) {
    startBtn.textContent = 'Game Running...';
    startBtn.disabled = true;
  }

  // Reset score display
  updateGameUI();

  console.log('Game started!');
}

/**
 * End the current game session
 * Shows results, confetti, and re-enables start button
 */
export function endGame() {
  setGameMode(false);

  // Determine message based on score
  let message = '';
  let title = '';

  if (gameScore === 0) {
    title = '😢 Time\'s Up!';
    message = 'Keep practicing! You can do it!';
  } else if (gameScore <= 10) {
    title = '👍 Well Done!';
    message = 'Good start! Try to place more blocks!';
  } else if (gameScore <= 20) {
    title = '😊 Good Job!';
    message = 'You\'re getting better!';
  } else if (gameScore <= 30) {
    title = '🎉 Great Work!';
    message = 'Excellent performance!';
  } else if (gameScore <= 40) {
    title = '🌟 Amazing!';
    message = 'You\'re a pro at this!';
  } else {
    title = '🏆 Perfect Score!';
    message = 'Incredible! You placed many many blocks!';
  }

  // Display final score and message
  const gameResult = document.getElementById('game-result');
  const titleEl = gameResult.querySelector('h1');
  const finalScoreEl = gameResult.querySelector('.final-score');
  const messageEl = gameResult.querySelector('p');

  if (titleEl) {
    titleEl.textContent = title;
  }
  if (finalScoreEl) {
    finalScoreEl.textContent = gameScore;
  }
  if (messageEl) {
    messageEl.textContent = message;
  }

  gameResult.classList.add('show');

  // Show confetti effect only if score > 0
  if (gameScore > 0) {
    createConfetti();
  }

  // Reset start button
  const startBtn = document.getElementById('start-game');
  if (startBtn) {
    startBtn.textContent = 'Start Game';
    startBtn.disabled = false;
  }

  console.log('Game ended! Final score:', gameScore);
}

/**
 * Update game UI (score and timer)
 * Called every frame during game mode
 */
export function updateGameUI() {
  const gameScoreEl = document.getElementById('game-score');
  const gameTimerEl = document.getElementById('game-timer');

  if (gameScoreEl) {
    gameScoreEl.textContent = gameScore;
  }

  if (gameMode && gameTimerEl) {
    const elapsedTime = (Date.now() - gameStartTime) / 1000;
    const remainingTime = Math.max(0, GAME_TIME_LIMIT - elapsedTime);
    const minutes = Math.floor(remainingTime / 60);
    const seconds = Math.floor(remainingTime % 60);
    gameTimerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Check for timeout
    if (remainingTime <= 0 && gameMode) {
      endGame();
    }
  } else if (gameTimerEl) {
    gameTimerEl.textContent = '1:00';
  }
}

/**
 * Update score based on blocks on platform
 * Checks which blocks are on the platform and stable
 */
export function updateScore() {
  if (!platform) return;

  let newScore = 0;
  const newBlocksOnPlatform = new Set();

  blocks.forEach(block => {
    const pos = block.body.translation();
    const vel = block.body.linvel();

    // Check if block is within platform bounds
    const isOnPlatform =
      pos.x >= platform.bounds.minX &&
      pos.x <= platform.bounds.maxX &&
      pos.y >= platform.bounds.minY &&
      pos.y <= platform.bounds.maxY &&
      pos.z >= platform.bounds.minZ &&
      pos.z <= platform.bounds.maxZ;

    // Check if block is stable (low velocity)
    const isStable = Math.abs(vel.x) < 0.01 && Math.abs(vel.y) < 0.01 && Math.abs(vel.z) < 0.01;

    if (isOnPlatform && isStable) {
      newBlocksOnPlatform.add(block.id);

      // Log when a new block is placed during game mode
      if (gameMode && !blocksOnPlatform.has(block.id)) {
        console.log(`Block ${block.id} placed on platform!`);
      }
    }
  });

  // Calculate score (number of blocks on platform × points per block)
  newScore = newBlocksOnPlatform.size * POINTS_PER_BLOCK;

  // Update score only if changed
  if (newScore !== score) {
    setScore(newScore);
    const scoreDisplay = document.getElementById('score');
    if (scoreDisplay) {
      scoreDisplay.textContent = newScore;
    }
  }

  // Update game score during game mode
  if (gameMode) {
    setGameScore(newScore);
  }

  setBlocksOnPlatform(newBlocksOnPlatform);

  // Update game UI if in game mode
  if (gameMode) {
    updateGameUI();
  }
}

/**
 * Create confetti animation effect
 * Shows animated confetti pieces falling on the screen
 */
export function createConfetti() {
  const canvas = document.getElementById('confetti');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const confettiPieces = [];

  // Create confetti pieces
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    confettiPieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      rotation: Math.random() * 360,
      speed: Math.random() * 3 + 2,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: Math.random() * 10 + 5
    });
  }

  /**
   * Animate confetti pieces
   * Recursive animation loop using requestAnimationFrame
   */
  function animateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    confettiPieces.forEach(piece => {
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.rotation * Math.PI / 180);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
      ctx.restore();

      piece.y += piece.speed;
      piece.rotation += 5;

      // Reset piece to top when it falls off screen
      if (piece.y > canvas.height) {
        piece.y = -20;
        piece.x = Math.random() * canvas.width;
      }
    });

    // Continue animation while game result is shown
    if (document.getElementById('game-result').classList.contains('show')) {
      requestAnimationFrame(animateConfetti);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  animateConfetti();
}

/**
 * Close game result dialog
 */
export function closeGameResult() {
  document.getElementById('game-result').classList.remove('show');
}

/**
 * Toggle game panel collapsed state
 */
export function toggleGamePanel() {
  const panel = document.getElementById('game-panel');
  if (!panel) return;
  panel.classList.toggle('collapsed');
}
