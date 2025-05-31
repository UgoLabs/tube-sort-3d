import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [barriers, setBarriers] = useState<Barrier[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [gameOver, setGameOver] = useState(false);
  
  const gameRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const orbIdRef = useRef(1);
  const barrierIdRef = useRef(1);
  const lastSpawnRef = useRef(0);

  // Spawn a new orb
  const spawnOrb = useCallback(() => {
    if (!gameRef.current) return;
    
    const newOrb: Orb = {
      id: orbIdRef.current++,
      x: Math.random() * (400 - 2 * ORB_RADIUS) + ORB_RADIUS,
      y: -ORB_RADIUS,
      vx: (Math.random() - 0.5) * 2,
      vy: 0,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      radius: ORB_RADIUS,
      matched: false
    };
    
    setOrbs(prev => [...prev, newOrb]);
  }, []);

  // Physics collision detection
  const checkCollision = (orb: Orb, barrier: Barrier) => {
    // Line collision with circle - distance from point to line
    const A = barrier.y2 - barrier.y1;
    const B = barrier.x1 - barrier.x2;
    const C = barrier.x2 * barrier.y1 - barrier.x1 * barrier.y2;
    
    const distance = Math.abs(A * orb.x + B * orb.y + C) / Math.sqrt(A * A + B * B);
    return distance <= orb.radius;
  };

  // Update physics
  const updatePhysics = useCallback(() => {
    if (!gameRef.current || !gameRunning) return;

    setOrbs(prevOrbs => {
      return prevOrbs.map(orb => {
        if (orb.matched) return orb;

        let newX = orb.x + orb.vx;
        let newY = orb.y + orb.vy;
        let newVx = orb.vx;
        let newVy = orb.vy + GRAVITY;

        // Boundary collisions
        if (newX - orb.radius <= 0 || newX + orb.radius >= 400) {
          newVx = -newVx * BOUNCE_DAMPING;
          newX = orb.radius <= newX ? 400 - orb.radius : orb.radius;
        }

        if (newY + orb.radius >= 600) {
          newVy = -Math.abs(newVy) * BOUNCE_DAMPING;
          newY = 600 - orb.radius;
        }

        // Barrier collisions (simplified)
        barriers.forEach(barrier => {
          if (checkCollision(orb, barrier)) {
            newVy = -newVy * BOUNCE_DAMPING;
            newVx = newVx * BOUNCE_DAMPING;
          }
        });

        return {
          ...orb,
          x: newX,
          y: newY,
          vx: newVx,
          vy: newVy
        };
      });
    });

    // Update barriers (decay over time)
    setBarriers(prev => 
      prev.map(barrier => ({
        ...barrier,
        timeLeft: barrier.timeLeft - 16
      })).filter(barrier => barrier.timeLeft > 0)
    );
  }, [barriers, gameRunning]);

  // Check for color matches
  const checkColorMatches = useCallback(() => {
    const matchGroups: Orb[][] = [];
    const checked = new Set<number>();

    orbs.forEach(orb => {
      if (checked.has(orb.id) || orb.matched) return;

      const group: Orb[] = [orb];
      const toCheck = [orb];
      checked.add(orb.id);

      while (toCheck.length > 0) {
        const current = toCheck.pop()!;
        
        orbs.forEach(other => {
          if (checked.has(other.id) || other.matched || other.color !== current.color) return;
          
          const distance = Math.sqrt((current.x - other.x) ** 2 + (current.y - other.y) ** 2);
          if (distance <= (current.radius + other.radius) * 1.2) {
            group.push(other);
            toCheck.push(other);
            checked.add(other.id);
          }
        });
      }

      if (group.length >= 3) {
        matchGroups.push(group);
      }
    });

    if (matchGroups.length > 0) {
      // Mark matched orbs and calculate score
      let newScore = score;
      matchGroups.forEach(group => {
        const points = group.length * 100 * level * group.length; // Bonus for larger groups
        newScore += points;
      });
      setScore(newScore);

      // Remove matched orbs after a delay
      setOrbs(prevOrbs => 
        prevOrbs.map(orb => {
          const isMatched = matchGroups.some(group => group.some(groupOrb => groupOrb.id === orb.id));
          return isMatched ? { ...orb, matched: true } : orb;
        })
      );

      setTimeout(() => {
        setOrbs(prevOrbs => prevOrbs.filter(orb => !orb.matched));
      }, 500);

      // Level up based on score
      const newLevel = Math.floor(newScore / 5000) + 1;
      if (newLevel > level) {
        setLevel(newLevel);
      }
    }
  }, [orbs, score, level]);

  // Run color matching check periodically
  useEffect(() => {
    if (!gameRunning) return;
    
    const interval = setInterval(checkColorMatches, 100);
    return () => clearInterval(interval);
  }, [gameRunning, checkColorMatches]);
  useEffect(() => {
    if (!gameRunning) return;

    const gameLoop = () => {
      updatePhysics();
      
      // Spawn orbs periodically
      const now = Date.now();
      const spawnInterval = Math.max(1000 - level * 100, 300);
      if (now - lastSpawnRef.current > spawnInterval) {
        spawnOrb();
        lastSpawnRef.current = now;
      }

      // Check for game over (too many orbs)
      if (orbs.length > 30) {
        setGameOver(true);
        setGameRunning(false);
      }

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameRunning, updatePhysics, spawnOrb, level]);

  // Start game
  const startGame = () => {
    setScore(0);
    setLevel(1);
    setOrbs([]);
    setBarriers([]);
    setGameOver(false);
    setGameRunning(true);
    lastSpawnRef.current = Date.now();
  };

  // Mouse handlers for drawing barriers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!gameRunning || barriers.length >= MAX_BARRIERS) return;
    
    const rect = gameRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setDrawStart({ x, y });
      setIsDrawing(true);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !gameRunning) return;
    
    const rect = gameRef.current?.getBoundingClientRect();
    if (rect) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const distance = Math.sqrt((x - drawStart.x) ** 2 + (y - drawStart.y) ** 2);
      if (distance > 20) { // Minimum barrier length
        const newBarrier: Barrier = {
          id: barrierIdRef.current++,
          x1: drawStart.x,
          y1: drawStart.y,
          x2: x,
          y2: y,
          timeLeft: BARRIER_LIFETIME
        };
        setBarriers(prev => [...prev, newBarrier]);
      }
    }
    
    setIsDrawing(false);
  };

  return (
    <div className="app">
      <div className="game-container">
        <header className="game-header">
          <h1>⚡ Color Clash</h1>
          <div className="game-stats">
            <div className="stat">
              <span className="label">Score</span>
              <span className="value">{score.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="label">Orbs</span>
              <span className="value">{orbs.length}</span>
            </div>
            <div className="stat">
              <span className="label">Level</span>
              <span className="value">{level}</span>
            </div>
          </div>
        </header>

        <div className="game-board-container">
          <div 
            ref={gameRef}
            className="color-cascade-board"
            style={{ width: 400, height: 600 }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
          >
            {/* Render dynamic orbs */}
            {orbs.map(orb => (
              <div
                key={orb.id}
                style={{
                  position: 'absolute',
                  left: orb.x - orb.radius,
                  top: orb.y - orb.radius,
                  width: orb.radius * 2,
                  height: orb.radius * 2,
                  borderRadius: '50%',
                  backgroundColor: orb.color,
                  border: '2px solid rgba(255, 255, 255, 0.6)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                  opacity: orb.matched ? 0.5 : 1,
                  transition: orb.matched ? 'opacity 0.3s' : 'none',
                  pointerEvents: 'none'
                }}
              />
            ))}
            
            {/* Render barriers */}
            {barriers.map(barrier => (
              <div
                key={barrier.id}
                className="barrier-element"
                style={{
                  position: 'absolute',
                  left: Math.min(barrier.x1, barrier.x2),
                  top: Math.min(barrier.y1, barrier.y2),
                  width: Math.abs(barrier.x2 - barrier.x1),
                  height: Math.abs(barrier.y2 - barrier.y1),
                  opacity: Math.max(0.4, barrier.timeLeft / BARRIER_LIFETIME),
                  pointerEvents: 'none',
                  transformOrigin: 'center center'
                }}
              />
            ))}
            
            {/* Game status overlay */}
            {!gameRunning && (
              <div className="game-overlay" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '28px',
                fontWeight: 'bold',
                color: 'white'
              }}>
                {gameOver ? '💥 Game Over!' : '⚡ Click Start Game!'}
              </div>
            )}
          </div>
        </div>

        <div className="game-controls">
          <button 
            className="new-game-btn" 
            onClick={startGame}
          >
            {gameRunning ? 'Restart Game' : 'Start Game'}
          </button>
          <div className="instructions">
            <p>
              🎯 <strong>How to Play Color Clash:</strong> Drag to draw barriers and guide falling orbs. 
              Match 3+ orbs of the same color to score! Create combos for massive points!
            </p>
            <p>
              ⚡ <strong>Strategy Tips:</strong> Use barriers strategically to group orbs by color. 
              Higher levels spawn orbs faster. You can have up to 3 barriers at once.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;