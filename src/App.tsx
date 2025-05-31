import { useState, useEffect } from 'react';
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

// Simple color palette - now with 12 colors
const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan', 'magenta', 'lime', 'indigo', 'amber'];
const TUBE_CAPACITY = 4;

function App() {
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [gameRunning, setGameRunning] = useState(false);
  const [tubes, setTubes] = useState<Tube[]>([]);
  const [selectedTube, setSelectedTube] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [gameWon, setGameWon] = useState(false);
  const [loading, setLoading] = useState(true);

  // Simple loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Helper function to determine grid class based on tube count
  const getTubeGridClass = (tubeCount: number) => {
    if (tubeCount <= 8) return 'tubes-5-8';
    if (tubeCount <= 12) return 'tubes-9-12';
    if (tubeCount <= 16) return 'tubes-13-16';
    if (tubeCount <= 24) return 'tubes-17-24';
    return 'tubes-25-plus';
  };

  // Simple game initialization
  const initializeGame = () => {
    // Simple level configuration
    const numColors = Math.min(3 + Math.floor(level / 2), 8);
    
    const newTubes: Tube[] = [];
    let ballId = 1;
    
    // Create 2 empty tubes first
    for (let i = 0; i < 2; i++) {
      newTubes.push({
        id: i,
        balls: [],
        maxCapacity: TUBE_CAPACITY
      });
    }
    
    // Create filled tubes - one per color
    for (let i = 0; i < numColors; i++) {
      const tube: Tube = {
        id: i + 2,
        balls: [],
        maxCapacity: TUBE_CAPACITY
      };
      
      // Fill tube with same color balls
      const color = COLORS[i];
      for (let j = 0; j < TUBE_CAPACITY; j++) {
        tube.balls.push({
          id: ballId++,
          color: color
        });
      }
      newTubes.push(tube);
    }
    
    // Simple shuffle - move some balls to create puzzle
    const shuffleTubes = newTubes.slice(2); // Only shuffle the filled tubes
    const allBalls: Ball[] = [];
    
    // Collect all balls
    shuffleTubes.forEach(tube => {
      allBalls.push(...tube.balls);
      tube.balls = [];
    });
    
    // Redistribute balls randomly but solvable
    const shuffledBalls = [...allBalls].sort(() => Math.random() - 0.5);
    let tubeIndex = 2; // Start with first filled tube
    
    for (let i = 0; i < shuffledBalls.length; i++) {
      if (newTubes[tubeIndex].balls.length >= TUBE_CAPACITY) {
        tubeIndex++;
        if (tubeIndex >= newTubes.length) {
          tubeIndex = 2; // Wrap around to filled tubes
        }
      }
      newTubes[tubeIndex].balls.push(shuffledBalls[i]);
    }
    
    setTubes(newTubes);
    setMoves(0);
    setGameWon(false);
    setSelectedTube(null);
  };

  // Simple win condition check
  const checkWinCondition = (currentTubes: Tube[]) => {
    return currentTubes.every(tube => {
      if (tube.balls.length === 0) return true; // Empty tubes are valid
      if (tube.balls.length !== TUBE_CAPACITY) return false; // Must be full
      const firstColor = tube.balls[0].color;
      return tube.balls.every(ball => ball.color === firstColor); // All same color
    });
  };

  // Simple move validation
  const isValidMove = (fromTube: Tube, toTube: Tube): boolean => {
    if (fromTube.balls.length === 0) return false; // Can't move from empty tube
    if (toTube.balls.length >= toTube.maxCapacity) return false; // Can't move to full tube
    
    if (toTube.balls.length === 0) return true; // Can move to empty tube
    
    const topBallFrom = fromTube.balls[fromTube.balls.length - 1];
    const topBallTo = toTube.balls[toTube.balls.length - 1];
    
    return topBallFrom.color === topBallTo.color; // Same color only
  };

  // Simple tube click handler
  const handleTubeClick = (tubeId: number) => {
    if (!gameRunning || gameWon) return;
    
    const tube = tubes.find(t => t.id === tubeId);
    if (!tube) return;
    
    if (selectedTube === null) {
      // Select tube if it has balls
      if (tube.balls.length > 0) {
        setSelectedTube(tubeId);
      }
    } else {
      if (selectedTube === tubeId) {
        // Deselect if clicking same tube
        setSelectedTube(null);
      } else {
        // Try to move ball
        const fromTube = tubes.find(t => t.id === selectedTube);
        const toTube = tube;
        
        if (fromTube && isValidMove(fromTube, toTube)) {
          // Valid move - update tubes
          const newTubes = tubes.map(t => {
            if (t.id === selectedTube) {
              return {
                ...t,
                balls: t.balls.slice(0, -1) // Remove top ball
              };
            } else if (t.id === tubeId) {
              const ballToMove = fromTube.balls[fromTube.balls.length - 1];
              return {
                ...t,
                balls: [...t.balls, ballToMove] // Add ball on top
              };
            }
            return t;
          });
          
          setTubes(newTubes);
          setMoves(moves + 1);
          setSelectedTube(null);
          
          // Check for victory
          if (checkWinCondition(newTubes)) {
            setGameWon(true);
            setScore(score + (100 * level) - moves);
          }
        } else {
          // Invalid move - just select the clicked tube if it has balls
          if (tube.balls.length > 0) {
            setSelectedTube(tubeId);
          } else {
            setSelectedTube(null);
          }
        }
      }
    }
  };

  // Game control functions
  const startGame = () => {
    setGameRunning(true);
    setScore(0);
    setLevel(1);
    initializeGame();
  };

  const resetGame = () => {
    initializeGame();
  };

  const nextLevel = () => {
    setLevel(level + 1);
    setMoves(0);
    setGameWon(false);
    initializeGame();
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">🧪 TUBE SORT 3D</div>
      </div>
    );
  }

  return (
    <div className="game-container">
      {/* Header */}
      <div className="game-header">
        <div className="game-title">🧪 Tube Sort 3D</div>
        <div className="game-stats">
          <div className="stat-item">Level {level}</div>
          <div className="stat-item">Score: {score}</div>
          <div className="stat-item">Moves: {moves}</div>
        </div>
      </div>

      {!gameRunning ? (
        /* Menu Screen */
        <div className="game-board" style={{ 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          textAlign: 'center',
          color: '#e2e8f0'
        }}>
          <h2 style={{ 
            fontSize: '36px', 
            marginBottom: '20px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Welcome to Tube Sort 3D
          </h2>
          <p style={{ 
            fontSize: '18px', 
            marginBottom: '30px', 
            maxWidth: '600px',
            lineHeight: '1.6'
          }}>
            Sort colored balls into tubes so each tube contains only one color.
            Vertical mobile-optimized design with 2x smaller balls and enhanced colors.
          </p>
          <button className="elite-button" onClick={startGame}>
            🚀 Start Game
          </button>
        </div>
      ) : (
        /* Game Board */
        <div className={`game-board ${getTubeGridClass(tubes.length)}`}>
          {tubes.map((tube) => (
            <div
              key={tube.id}
              className={`tube ${selectedTube === tube.id ? 'selected' : ''}`}
              onClick={() => handleTubeClick(tube.id)}
            >
              {/* Tube depth effect */}
              <div className="tube-depth" />
              
              {/* Balls */}
              {Array.from({ length: TUBE_CAPACITY }, (_, index) => {
                const ballIndex = TUBE_CAPACITY - 1 - index;
                const ball = tube.balls[ballIndex];
                return ball ? (
                  <div
                    key={`${ball.id}-${index}`}
                    className={`ball ${ball.color}`}
                    style={{
                      bottom: `${index * 35 + 8}px`
                    }}
                  >
                    <div className="rim-light" />
                  </div>
                ) : null;
              })}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      {gameRunning && (
        <div className="action-buttons">
          <button className="elite-button" onClick={resetGame}>
            🔄 Reset
          </button>
          {gameWon && (
            <button className="elite-button" onClick={nextLevel}>
              ⚡ Next Level
            </button>
          )}
        </div>
      )}

      {/* Victory Message */}
      {gameWon && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
          backdropFilter: 'blur(25px)',
          border: '2px solid rgba(59, 130, 246, 0.3)',
          borderRadius: '20px',
          padding: '30px',
          textAlign: 'center',
          color: '#e2e8f0',
          zIndex: 200,
          boxShadow: '0 25px 80px rgba(0, 0, 0, 0.4)'
        }}>
          <h3 style={{ 
            fontSize: '28px', 
            marginBottom: '15px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            🎉 Level Complete! 🎉
          </h3>
          <p>✨ Completed in {moves} moves</p>
          <p>💎 Score: +{(100 * level) - moves}</p>
        </div>
      )}
    </div>
  );
}

export default App;