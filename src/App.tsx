import { useState, useEffect } from 'react';
import './App.css';

interface Ball {
  id: number;
  color: string;
  isLocked?: boolean; // Added for locked balls
}

interface Tube {
  id: number;
  balls: Ball[];
  maxCapacity: number; // Will now vary
}

const DEFAULT_TUBE_CAPACITY = 4; // Renamed for clarity
const COLORS = [
  '#FF3B82', // Vibrant Pink
  '#00D9FF', // Electric Blue  
  '#32D74B', // Neon Green
  '#FF9F0A', // Electric Orange
  '#BF5AF2', // Purple Glow
  '#FF453A', // Bright Red
  '#5AC8FA', // Sky Blue
  '#FFCC02'  // Golden Yellow
];

// Helper to check if a single tube is sorted
const isTubeSorted = (tube: Tube): boolean => {
  if (tube.balls.length === 0) return true; // Empty is considered sorted for this check's purpose
  if (tube.balls.length !== tube.maxCapacity) return false;
  const firstColor = tube.balls[0].color;
  return tube.balls.every(ball => ball.color === firstColor && !ball.isLocked); // Sorted tube shouldn't contain locked balls
};


function App() {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameRunning, setGameRunning] = useState(false);
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [selectedTube, setSelectedTube] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);

  // Mobile haptic feedback
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy') => {
    if ('vibrate' in navigator) {
      const patterns = { light: [10], medium: [20], heavy: [30] };
      navigator.vibrate(patterns[type]);
    }
  };

  // Create a ball
  const createBall = (id: number, color: string, isLocked = false): Ball => ({ id, color, isLocked });

  // Create a tube
  const createTube = (id: number, maxCapacity: number): Tube => ({
    id,
    balls: [],
    maxCapacity
  });

  // Unlock all balls
  const unlockAllBalls = (currentTubes: Tube[]): Tube[] => {
    return currentTubes.map(tube => ({
      ...tube,
      balls: tube.balls.map(ball => ({ ...ball, isLocked: false }))
    }));
  };
  
  // Check win condition
  const checkWinCondition = (currentTubes: Tube[]): boolean => {
    return currentTubes.every(tube => {
      if (tube.balls.length === 0) return true;
      // For win condition, a tube must be full to its capacity with same colored, unlocked balls
      if (tube.balls.length !== tube.maxCapacity) return false; 
      const firstColor = tube.balls[0].color;
      return tube.balls.every(ball => ball.color === firstColor && !ball.isLocked);
    });
  };

  // Check if move is valid
  const isValidMove = (fromTube: Tube, toTube: Tube): boolean => {
    if (fromTube.balls.length === 0) return false;
    if (toTube.balls.length >= toTube.maxCapacity) return false; // Use tube's specific maxCapacity

    const movingBall = fromTube.balls[fromTube.balls.length - 1];
    if (movingBall.isLocked) return false; // Cannot move locked balls

    if (toTube.balls.length === 0) return true;
    
    const topBall = toTube.balls[toTube.balls.length - 1];
    
    return movingBall.color === topBall.color && !topBall.isLocked; // Cannot stack on a locked ball if it's the top one
  };

  // Initialize game
  const initializeGame = (targetLevel: number) => {
    const numColors = Math.min(3 + Math.floor(targetLevel / 2), COLORS.length);
    const ballsPerColor = DEFAULT_TUBE_CAPACITY; // Each color group has this many balls
    let numTubes = numColors + 2; // Start with 2 extra empty tubes

    // --- Variable Capacity Tubes ---
    const newTubes: Tube[] = [];
    let totalCapacity = 0;
    const minTubeCapacity = 2; // Minimum capacity for a tube

    for (let i = 0; i < numTubes; i++) {
      let capacity = DEFAULT_TUBE_CAPACITY;
      if (targetLevel >= 3 && i < numColors) { // Only vary capacity of initially filled tubes
        if (i % 3 === 0 && targetLevel >= 5) { // Example: Every 3rd tube in harder levels
            capacity = Math.max(minTubeCapacity, DEFAULT_TUBE_CAPACITY -1);
        } else if (i % 4 === 0 && targetLevel >= 7) {
             capacity = Math.max(minTubeCapacity, DEFAULT_TUBE_CAPACITY -2);
        }
      }
      newTubes.push(createTube(i + 1, capacity));
      totalCapacity += capacity;
    }
    
    // Ensure enough total capacity for all balls
    const requiredTotalBalls = numColors * ballsPerColor;
    if (totalCapacity < requiredTotalBalls) {
        // If not enough, add a tube or revert some capacities to default.
        // For simplicity, we'll add one more default capacity tube if short.
        // This logic can be refined for more complex level design.
        const diff = requiredTotalBalls - totalCapacity;
        const extraTubesNeeded = Math.ceil(diff / DEFAULT_TUBE_CAPACITY);
        for(let k=0; k < extraTubesNeeded; k++) {
            newTubes.push(createTube(newTubes.length + 1, DEFAULT_TUBE_CAPACITY));
            numTubes++;
        }
    }


    // --- Create and Distribute Balls ---
    const allBalls: Ball[] = [];
    let ballId = 1;
    for (let colorIndex = 0; colorIndex < numColors; colorIndex++) {
      for (let i = 0; i < ballsPerColor; i++) {
        // --- Locked Balls ---
        let shouldLock = false;
        if (targetLevel >= 4 && colorIndex < 2 && i === 0) { // Lock the first ball of the first two colors on level 4+
            shouldLock = true;
        }
         if (targetLevel >= 6 && colorIndex < numColors && i < 2 && Math.random() < 0.2) { // Lock first 2 balls of any color randomly on higher levels
            shouldLock = true;
        }
        allBalls.push(createBall(ballId++, COLORS[colorIndex], shouldLock));
      }
    }
    
    // Shuffle balls
    for (let i = allBalls.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allBalls[i], allBalls[j]] = [allBalls[j], allBalls[i]];
    }
    
    // Distribute balls into tubes, respecting individual capacities
    let ballIndex = 0;
    for (let i = 0; i < numColors; i++) { // Only fill the initial 'numColors' tubes
        if (ballIndex >= allBalls.length) break;
        const tube = newTubes[i];
        const ballsToPlaceInTube = Math.min(tube.maxCapacity, ballsPerColor); // Don't overfill based on color count alone
        for (let j = 0; j < ballsToPlaceInTube && ballIndex < allBalls.length; j++) {
            if(tube.balls.length < tube.maxCapacity) {
                tube.balls.push(allBalls[ballIndex++]);
            }
        }
    }
    // Ensure remaining tubes are empty
     for (let i = numColors; i < newTubes.length; i++) {
        newTubes[i].balls = [];
    }

    setTubes(newTubes);
    setMoves(0);
    setGameWon(false);
    // setGameRunning(true); // This is set by startGame or nextLevel
  };

  // Handle tube click
  const handleTubeClick = (tubeId: number) => {
    if (!gameRunning || gameWon) return;
    
    const clickedTubeIndex = tubes.findIndex(t => t.id === tubeId);
    if (clickedTubeIndex === -1) return;

    triggerHaptic('light');
    
    if (selectedTube === null) {
      const tube = tubes[clickedTubeIndex];
      if (tube.balls.length > 0) {
        const topBall = tube.balls[tube.balls.length - 1];
        if (topBall.isLocked) {
          triggerHaptic('heavy'); // Indicate locked ball
          // Optionally, add a visual cue like shaking the ball/tube
          return;
        }
        setSelectedTube(tubeId);
        triggerHaptic('medium');
      }
    } else {
      const fromTubeIndex = tubes.findIndex(t => t.id === selectedTube);
      const toTubeIndex = clickedTubeIndex;

      if (fromTubeIndex === -1) { // Should not happen if selectedTube is not null
          setSelectedTube(null);
          return;
      }

      if (selectedTube === tubeId) { // Clicked the same tube again
        setSelectedTube(null);
        triggerHaptic('light');
      } else {
        const fromTube = tubes[fromTubeIndex];
        const toTube = tubes[toTubeIndex];
        
        if (isValidMove(fromTube, toTube)) {
          let newTubes = tubes.map(t => ({ ...t, balls: [...t.balls] })); // Deep copy for modification
          const movingBall = newTubes[fromTubeIndex].balls.pop()!;
          newTubes[toTubeIndex].balls.push(movingBall);
          
          setMoves(prev => prev + 1);
          setSelectedTube(null);
          triggerHaptic('medium');

          // --- Check for unlocking balls ---
          let shouldUnlock = false;
          if (isTubeSorted(newTubes[toTubeIndex])) { // Check if the tube the ball moved TO is now sorted
            shouldUnlock = true;
          }
          if (shouldUnlock) {
            newTubes = unlockAllBalls(newTubes);
          }
          
          setTubes(newTubes); // Set tubes after potential unlock

          if (checkWinCondition(newTubes)) {
            setGameWon(true);
            setGameRunning(false);
            setScore(prev => prev + Math.max(0, (100 * level) - (moves + 1)));
            triggerHaptic('heavy');
          }
        } else {
          triggerHaptic('heavy');
          setSelectedTube(null); // Deselect if move is invalid
        }
      }
    }
  };

  // Start game
  const startGame = () => {
    setLevel(1); // Reset level to 1 when starting a new game
    setScore(0); // Reset score
    setGameRunning(true);
    initializeGame(1);
  };

  // Next level
  const nextLevel = () => {
    const newLevel = level + 1;
    setLevel(newLevel);
    initializeGame(newLevel);
    setGameRunning(true);
  };

  // Reset game
  const resetGame = () => {
    setGameRunning(true); 
    initializeGame(level); // Re-initialize current level
    setMoves(0); // Reset moves for the current level attempt
  };

  return (
    <div className="game-container">
      {/* Header */}
      <div className="game-header">
        <h1 className="game-title">🎯 Ball Sort</h1>
        <div className="game-stats">
          <div className="stat">
            <span className="stat-label">Level</span>
            <span className="stat-value">{level}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Score</span>
            <span className="stat-value">{score}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Moves</span>
            <span className="stat-value">{moves}</span>
          </div>
        </div>
      </div>

      {/* Game Board */}
      {gameRunning && (
        <div className="game-board">
          {tubes.map((tube) => (
            <div
              key={tube.id}
              className={`tube ${selectedTube === tube.id ? 'selected' : ''}`}
              onClick={() => handleTubeClick(tube.id)}
            >
              {/* Visual representation of tube capacity could be done here if desired, e.g. different height style */}
              <div className="tube-container">
                {/* Render ball slots up to tube.maxCapacity */}
                {Array.from({ length: tube.maxCapacity }, (_, index) => {
                  const ball = tube.balls[index];
                  return (
                    <div
                      key={index}
                      className={`ball-slot ${ball ? 'filled' : 'empty'}`}
                    >
                      {ball && (
                        <div
                          className={`ball ${ball.isLocked ? 'locked' : ''}`}
                          style={{ backgroundColor: ball.isLocked ? '#777' : ball.color }} // Grey out locked balls or use color
                        >
                          {ball.isLocked && <span className="lock-icon">🔒</span>} {/* Simple lock icon */}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Menu */}
      {!gameRunning && !gameWon && (
        <div className="menu">
          <h2 className="menu-subtitle">Sort the glowing orbs!</h2>
          <p className="menu-description">
            Tap tubes to move balls. Group same colors in each tube.
            Complete a tube to unlock any locked balls!
          </p>
          <button className="start-button" onClick={startGame}>
            🎮 Start Game
          </button>
        </div>
      )}

      {/* Controls */}
      {gameRunning && !gameWon && (
        <div className="controls">
          <button className="control-button" onClick={resetGame}>
            🔄 Reset
          </button>
        </div>
      )}

      {/* Victory */}
      {gameWon && (
        <div className="victory">
          <h2 className="victory-title">🎉 Level Complete!</h2>
          <p className="victory-text">Completed in {moves} moves</p>
          <p className="victory-bonus">+{Math.max(0, (100 * level) - moves)} points</p>
          <button className="control-button next" onClick={nextLevel}>
            ⭐ Next Level
          </button>
        </div>
      )}
    </div>
  );
}

export default App;