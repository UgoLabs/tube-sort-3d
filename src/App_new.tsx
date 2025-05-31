import { useState, useCallback } from 'react';
import './App.css';

interface Ball {
  id: number;
  color: string;
}

interface Tube {
  id: number;
  balls: Ball[];
  maxCapacity: number;
}

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3'];
const TUBE_CAPACITY = 4;
const INITIAL_TUBES = 6;

function App() {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameRunning, setGameRunning] = useState(false);
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [selectedTube, setSelectedTube] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  // Initialize game
  const initializeGame = useCallback(() => {
    const newTubes: Tube[] = [];
    let ballId = 1;
    
    // Create tubes with mixed colored balls
    for (let i = 0; i < INITIAL_TUBES - 2; i++) {
      const tube: Tube = {
        id: i,
        balls: [],
        maxCapacity: TUBE_CAPACITY
      };
      
      // Fill each tube with balls of the same color, but we'll shuffle later
      const color = COLORS[i % COLORS.length];
      for (let j = 0; j < TUBE_CAPACITY; j++) {
        tube.balls.push({
          id: ballId++,
          color: color
        });
      }
      newTubes.push(tube);
    }
    
    // Add 2 empty tubes for sorting
    for (let i = INITIAL_TUBES - 2; i < INITIAL_TUBES; i++) {
      newTubes.push({
        id: i,
        balls: [],
        maxCapacity: TUBE_CAPACITY
      });
    }
    
    // Shuffle balls between tubes to create the puzzle
    const allBalls: Ball[] = [];
    newTubes.forEach(tube => {
      allBalls.push(...tube.balls);
      tube.balls = [];
    });
    
    // Redistribute balls randomly
    for (let i = 0; i < allBalls.length; i++) {
      const tubeIndex = Math.floor(Math.random() * (INITIAL_TUBES - 2));
      if (newTubes[tubeIndex].balls.length < TUBE_CAPACITY) {
        newTubes[tubeIndex].balls.push(allBalls[i]);
      } else {
        // Find another tube with space
        const availableTube = newTubes.find(t => t.balls.length < TUBE_CAPACITY);
        if (availableTube) {
          availableTube.balls.push(allBalls[i]);
        }
      }
    }
    
    setTubes(newTubes);
    setMoves(0);
    setGameWon(false);
    setGameOver(false);
    setSelectedTube(null);
  }, []);

  // Check if game is won
  const checkWinCondition = useCallback((currentTubes: Tube[]) => {
    return currentTubes.every(tube => {
      if (tube.balls.length === 0) return true;
      if (tube.balls.length !== TUBE_CAPACITY) return false;
      const firstColor = tube.balls[0].color;
      return tube.balls.every(ball => ball.color === firstColor);
    });
  }, []);

  // Check if move is valid
  const isValidMove = (fromTube: Tube, toTube: Tube): boolean => {
    if (fromTube.balls.length === 0) return false;
    if (toTube.balls.length >= toTube.maxCapacity) return false;
    
    if (toTube.balls.length === 0) return true;
    
    const topBallFrom = fromTube.balls[fromTube.balls.length - 1];
    const topBallTo = toTube.balls[toTube.balls.length - 1];
    
    return topBallFrom.color === topBallTo.color;
  };

  // Handle tube click
  const handleTubeClick = (tubeId: number) => {
    if (!gameRunning || gameWon || gameOver) return;
    
    const tube = tubes.find(t => t.id === tubeId);
    if (!tube) return;
    
    if (selectedTube === null) {
      // Select tube if it has balls
      if (tube.balls.length > 0) {
        setSelectedTube(tubeId);
      }
    } else {
      if (selectedTube === tubeId) {
        // Deselect if clicking the same tube
        setSelectedTube(null);
      } else {
        // Try to move ball
        const fromTube = tubes.find(t => t.id === selectedTube);
        const toTube = tube;
        
        if (fromTube && isValidMove(fromTube, toTube)) {
          const newTubes = tubes.map(t => {
            if (t.id === selectedTube) {
              return {
                ...t,
                balls: t.balls.slice(0, -1)
              };
            } else if (t.id === tubeId) {
              const ballToMove = fromTube.balls[fromTube.balls.length - 1];
              return {
                ...t,
                balls: [...t.balls, ballToMove]
              };
            }
            return t;
          });
          
          setTubes(newTubes);
          setMoves(moves + 1);
          setSelectedTube(null);
          
          // Check win condition
          if (checkWinCondition(newTubes)) {
            setGameWon(true);
            setScore(score + (100 * level) - moves);
          }
        } else {
          setSelectedTube(tubeId);
        }
      }
    }
  };

  // Start game
  const startGame = () => {
    setGameRunning(true);
    setScore(0);
    setLevel(1);
    initializeGame();
  };

  // Reset game
  const resetGame = () => {
    initializeGame();
  };

  // Next level
  const nextLevel = () => {
    setLevel(level + 1);
    initializeGame();
  };

  return (
    <div className="app">
      <div className="game-header">
        <h1 className="game-title">
          <span className="title-icon">⚡</span>
          Color Clash
        </h1>
        <div className="game-stats">
          <div className="stat">
            <span className="stat-label">Score:</span>
            <span className="stat-value">{score}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Level:</span>
            <span className="stat-value">{level}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Moves:</span>
            <span className="stat-value">{moves}</span>
          </div>
        </div>
      </div>

      {!gameRunning ? (
        <div className="menu-screen">
          <div className="menu-content">
            <h2>Welcome to Color Clash!</h2>
            <p className="game-description">
              Sort colored balls into tubes so each tube contains only one color.
              <br />
              • Click a tube to select it
              <br />
              • Click another tube to move the top ball
              <br />
              • You can only place balls on the same color or in empty tubes
              <br />
              • Complete each level with fewer moves for higher scores!
            </p>
            <button className="start-btn" onClick={startGame}>
              Start Game
            </button>
          </div>
        </div>
      ) : (
        <div className="game-area">
          <div className="tubes-container">
            {tubes.map((tube) => (
              <div
                key={tube.id}
                className={`tube ${selectedTube === tube.id ? 'selected' : ''}`}
                onClick={() => handleTubeClick(tube.id)}
              >
                <div className="tube-body">
                  {Array.from({ length: TUBE_CAPACITY }, (_, index) => {
                    const ballIndex = TUBE_CAPACITY - 1 - index;
                    const ball = tube.balls[ballIndex];
                    return (
                      <div
                        key={index}
                        className={`ball-slot ${ball ? 'filled' : 'empty'}`}
                        style={{
                          backgroundColor: ball ? ball.color : 'transparent'
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="game-controls">
            <button className="control-btn" onClick={resetGame}>
              Reset Level
            </button>
            {gameWon && (
              <button className="control-btn next-btn" onClick={nextLevel}>
                Next Level
              </button>
            )}
          </div>

          {gameWon && (
            <div className="win-message">
              <h3>Level Complete!</h3>
              <p>Completed in {moves} moves</p>
              <p>Score: +{(100 * level) - moves}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
