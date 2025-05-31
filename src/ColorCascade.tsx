import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

// Types
type Orb = {
  id: number;
  x: number;
  y: number;
  color: number;
  vx: number; // velocity x
  vy: number; // velocity y
  radius: number;
  locked: boolean;
  markedForRemoval?: boolean;
};

type Barrier = {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  active: boolean;
  timeLeft: number;
};

// Game constants
const BOARD_WIDTH = 400;
const BOARD_HEIGHT = 600;
const ORB_RADIUS = 15;
const GRAVITY = 0.3;
const FRICTION = 0.98;
const BOUNCE = 0.7;
const BARRIER_DURATION = 3000; // 3 seconds
const SPAWN_INTERVAL = 2000; // 2 seconds
const MATCH_DISTANCE = ORB_RADIUS * 2.5;

// Vibrant colors for orbs
const ORB_COLORS = [
  '#FF6B6B', // Red
  '#4ECDC4', // Teal
  '#45B7D1', // Blue
  '#96CEB4', // Green
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
];

function ColorCascade() {
  const [orbs, setOrbs] = useState<Orb[]>([]);
  const [barriers, setBarriers] = useState<Barrier[]>([]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [matches, setMatches] = useState(0);
  const [combo, setCombo] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [currentBarrier, setCurrentBarrier] = useState<Partial<Barrier> | null>(null);
  const [gameTime, setGameTime] = useState(0);
  
  const gameLoopRef = useRef<number>();
  const lastSpawnRef = useRef<number>(0);
  const orbIdRef = useRef<number>(0);
  const barrierIdRef = useRef<number>(0);

  // Initialize game
  useEffect(() => {
    const savedBestScore = localStorage.getItem('colorCascadeBestScore');
    if (savedBestScore) {
      setBestScore(parseInt(savedBestScore, 10));
    }
    startNewGame();
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, []);

  // Generate random orb
  const createOrb = useCallback((x?: number) => {
    const spawnX = x ?? Math.random() * (BOARD_WIDTH - ORB_RADIUS * 2) + ORB_RADIUS;
    const newOrb: Orb = {
      id: orbIdRef.current++,
      x: spawnX,
      y: -ORB_RADIUS,
      color: Math.floor(Math.random() * ORB_COLORS.length),
      vx: (Math.random() - 0.5) * 2,
      vy: 0,
      radius: ORB_RADIUS,
      locked: false,
    };
    return newOrb;
  }, []);

  // Physics collision detection
  const checkOrbCollision = useCallback((orb1: Orb, orb2: Orb): boolean => {
    const dx = orb1.x - orb2.x;
    const dy = orb1.y - orb2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < (orb1.radius + orb2.radius);
  }, []);

  // Resolve orb collision
  const resolveOrbCollision = useCallback((orb1: Orb, orb2: Orb) => {
    const dx = orb1.x - orb2.x;
    const dy = orb1.y - orb2.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return; // Prevent division by zero
    
    // Normalize collision vector
    const nx = dx / distance;
    const ny = dy / distance;
    
    // Separate overlapping orbs
    const overlap = (orb1.radius + orb2.radius) - distance;
    const separation = overlap / 2;
    
    orb1.x += nx * separation;
    orb1.y += ny * separation;
    orb2.x -= nx * separation;
    orb2.y -= ny * separation;
    
    // Calculate relative velocity
    const dvx = orb1.vx - orb2.vx;
    const dvy = orb1.vy - orb2.vy;
    const dvn = dvx * nx + dvy * ny;
    
    // Do not resolve if velocities are separating
    if (dvn > 0) return;
    
    // Collision impulse
    const impulse = 2 * dvn / 2; // Assuming equal mass
    orb1.vx -= impulse * nx * BOUNCE;
    orb1.vy -= impulse * ny * BOUNCE;
    orb2.vx += impulse * nx * BOUNCE;
    orb2.vy += impulse * ny * BOUNCE;
  }, []);

  // Check barrier collision
  const checkBarrierCollision = useCallback((orb: Orb, barrier: Barrier): boolean => {
    if (!barrier.active) return false;
    
    // Point-to-line distance calculation
    const A = barrier.y2 - barrier.y1;
    const B = barrier.x1 - barrier.x2;
    const C = barrier.x2 * barrier.y1 - barrier.x1 * barrier.y2;
    
    const distance = Math.abs(A * orb.x + B * orb.y + C) / Math.sqrt(A * A + B * B);
    
    // Check if orb is close enough to barrier and within barrier bounds
    if (distance < orb.radius) {
      const minX = Math.min(barrier.x1, barrier.x2);
      const maxX = Math.max(barrier.x1, barrier.x2);
      const minY = Math.min(barrier.y1, barrier.y2);
      const maxY = Math.max(barrier.y1, barrier.y2);
      
      return orb.x >= minX - orb.radius && orb.x <= maxX + orb.radius &&
             orb.y >= minY - orb.radius && orb.y <= maxY + orb.radius;
    }
    
    return false;
  }, []);

  // Resolve barrier collision
  const resolveBarrierCollision = useCallback((orb: Orb, barrier: Barrier) => {
    const dx = barrier.x2 - barrier.x1;
    const dy = barrier.y2 - barrier.y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return;
    
    // Normal vector to the barrier
    const nx = -dy / length;
    const ny = dx / length;
    
    // Reflect velocity
    const dot = orb.vx * nx + orb.vy * ny;
    orb.vx -= 2 * dot * nx * BOUNCE;
    orb.vy -= 2 * dot * ny * BOUNCE;
  }, []);

  // Find matching orbs
  const findMatches = useCallback((orbs: Orb[]): Orb[][] => {
    const visited = new Set<number>();
    const matches: Orb[][] = [];
    
    orbs.forEach(orb => {
      if (visited.has(orb.id) || !orb.locked) return;
      
      const group: Orb[] = [];
      const queue = [orb];
      
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.id)) continue;
        
        visited.add(current.id);
        group.push(current);
        
        // Find adjacent orbs of same color
        orbs.forEach(other => {
          if (visited.has(other.id) || !other.locked || other.color !== current.color) return;
          
          const dx = current.x - other.x;
          const dy = current.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance <= MATCH_DISTANCE) {
            queue.push(other);
          }
        });
      }
      
      if (group.length >= 3) {
        matches.push(group);
      }
    });
    
    return matches;
  }, []);

  // Update physics and game logic
  const updateGame = useCallback((timestamp: number) => {
    if (isPaused || isGameOver) return;
    
    setGameTime(prev => prev + 16); // Assume 60fps
    
    setOrbs(currentOrbs => {
      let newOrbs = [...currentOrbs];
      
      // Spawn new orbs
      if (timestamp - lastSpawnRef.current > SPAWN_INTERVAL - level * 100) {
        const newOrb = createOrb();
        newOrbs.push(newOrb);
        lastSpawnRef.current = timestamp;
      }
      
      // Update orb physics
      newOrbs = newOrbs.map(orb => {
        if (orb.locked) return orb;
        
        // Apply gravity
        orb.vy += GRAVITY;
        
        // Update position
        orb.x += orb.vx;
        orb.y += orb.vy;
        
        // Apply friction
        orb.vx *= FRICTION;
        orb.vy *= FRICTION;
        
        // Boundary collisions
        if (orb.x - orb.radius < 0) {
          orb.x = orb.radius;
          orb.vx *= -BOUNCE;
        }
        if (orb.x + orb.radius > BOARD_WIDTH) {
          orb.x = BOARD_WIDTH - orb.radius;
          orb.vx *= -BOUNCE;
        }
        
        // Lock orb if it hits the bottom or moves slowly
        if (orb.y + orb.radius >= BOARD_HEIGHT - 10) {
          orb.y = BOARD_HEIGHT - orb.radius - 10;
          orb.vy = 0;
          orb.vx *= 0.5;
          
          if (Math.abs(orb.vx) < 0.1 && Math.abs(orb.vy) < 0.1) {
            orb.locked = true;
          }
        }
        
        return orb;
      });
      
      // Handle orb collisions
      for (let i = 0; i < newOrbs.length; i++) {
        for (let j = i + 1; j < newOrbs.length; j++) {
          if (checkOrbCollision(newOrbs[i], newOrbs[j])) {
            resolveOrbCollision(newOrbs[i], newOrbs[j]);
          }
        }
      }
      
      // Handle barrier collisions
      barriers.forEach(barrier => {
        newOrbs.forEach(orb => {
          if (checkBarrierCollision(orb, barrier)) {
            resolveBarrierCollision(orb, barrier);
          }
        });
      });
      
      // Check for matches
      const matchGroups = findMatches(newOrbs);
      if (matchGroups.length > 0) {
        let totalMatched = 0;
        matchGroups.forEach(group => {
          totalMatched += group.length;
          group.forEach(orb => {
            orb.markedForRemoval = true;
          });
        });
        
        // Update score with combo multiplier
        const baseScore = totalMatched * 100;
        const comboMultiplier = Math.max(1, combo + 1);
        const newScore = baseScore * comboMultiplier * level;
        setScore(prev => prev + newScore);
        setMatches(prev => prev + matchGroups.length);
        setCombo(prev => prev + 1);
        
        // Level up based on matches
        if (matches > 0 && matches % 5 === 0) {
          setLevel(prev => prev + 1);
        }
        
        // Remove matched orbs after a short delay
        setTimeout(() => {
          setOrbs(currentOrbs => currentOrbs.filter(orb => !orb.markedForRemoval));
        }, 200);
      } else {
        setCombo(0); // Reset combo if no matches
      }
      
      // Game over if orbs pile up too high
      const highOrbs = newOrbs.filter(orb => orb.y < 100 && orb.locked);
      if (highOrbs.length > 10) {
        setIsGameOver(true);
      }
      
      return newOrbs;
    });
    
    // Update barriers
    setBarriers(currentBarriers => 
      currentBarriers.map(barrier => ({
        ...barrier,
        timeLeft: barrier.timeLeft - 16,
        active: barrier.timeLeft > 0
      })).filter(barrier => barrier.timeLeft > 0)
    );
  }, [isPaused, isGameOver, level, createOrb, checkOrbCollision, resolveOrbCollision, barriers, checkBarrierCollision, resolveBarrierCollision, findMatches, matches, combo]);

  // Game loop
  useEffect(() => {
    const gameLoop = (timestamp: number) => {
      updateGame(timestamp);
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    };
    
    if (!isPaused && !isGameOver) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    }
    
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [updateGame, isPaused, isGameOver]);

  // Handle mouse/touch events for drawing barriers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (barriers.length >= 3) return; // Limit barriers
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setDrawing(true);
    setCurrentBarrier({ x1: x, y1: y, x2: x, y2: y });
  }, [barriers.length]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!drawing || !currentBarrier) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCurrentBarrier(prev => prev ? { ...prev, x2: x, y2: y } : null);
  }, [drawing, currentBarrier]);

  const handleMouseUp = useCallback(() => {
    if (!drawing || !currentBarrier) return;
    
    const newBarrier: Barrier = {
      id: barrierIdRef.current++,
      x1: currentBarrier.x1!,
      y1: currentBarrier.y1!,
      x2: currentBarrier.x2!,
      y2: currentBarrier.y2!,
      active: true,
      timeLeft: BARRIER_DURATION,
    };
    
    // Only add if barrier is long enough
    const length = Math.sqrt(
      Math.pow(newBarrier.x2 - newBarrier.x1, 2) + 
      Math.pow(newBarrier.y2 - newBarrier.y1, 2)
    );
    
    if (length > 20) {
      setBarriers(prev => [...prev, newBarrier]);
    }
    
    setDrawing(false);
    setCurrentBarrier(null);
  }, [drawing, currentBarrier]);

  // Update best score
  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      localStorage.setItem('colorCascadeBestScore', score.toString());
    }
  }, [score, bestScore]);

  // Start new game
  const startNewGame = () => {
    setOrbs([]);
    setBarriers([]);
    setScore(0);
    setLevel(1);
    setMatches(0);
    setCombo(0);
    setIsGameOver(false);
    setIsPaused(false);
    setDrawing(false);
    setCurrentBarrier(null);
    setGameTime(0);
    lastSpawnRef.current = 0;
  };

  return (
    <div className="app">
      <div className="game-container">
        <header className="game-header">
          <h1>🌈 Color Cascade</h1>
          <div className="game-stats">
            <div className="stat">
              <span className="label">Score</span>
              <span className="value">{score.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="label">Best</span>
              <span className="value">{bestScore.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="label">Level</span>
              <span className="value">{level}</span>
            </div>
            <div className="stat">
              <span className="label">Matches</span>
              <span className="value">{matches}</span>
            </div>
            {combo > 0 && (
              <div className="stat combo-stat">
                <span className="label">Combo</span>
                <span className="value combo-value">×{combo}</span>
              </div>
            )}
          </div>
        </header>

        <div className="game-board-container">
          <div 
            className="color-cascade-board"
            style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Render orbs */}
            {orbs.map(orb => (
              <div
                key={orb.id}
                className={`orb ${orb.locked ? 'locked' : 'falling'} ${orb.markedForRemoval ? 'removing' : ''}`}
                style={{
                  left: orb.x - orb.radius,
                  top: orb.y - orb.radius,
                  width: orb.radius * 2,
                  height: orb.radius * 2,
                  backgroundColor: ORB_COLORS[orb.color],
                }}
              />
            ))}
            
            {/* Render barriers */}
            {barriers.map(barrier => (
              <svg
                key={barrier.id}
                className="barrier"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              >
                <line
                  x1={barrier.x1}
                  y1={barrier.y1}
                  x2={barrier.x2}
                  y2={barrier.y2}
                  stroke="#333"
                  strokeWidth="4"
                  opacity={barrier.timeLeft / BARRIER_DURATION}
                />
              </svg>
            ))}
            
            {/* Render current barrier being drawn */}
            {drawing && currentBarrier && (
              <svg
                className="current-barrier"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                }}
              >
                <line
                  x1={currentBarrier.x1}
                  y1={currentBarrier.y1}
                  x2={currentBarrier.x2}
                  y2={currentBarrier.y2}
                  stroke="#667eea"
                  strokeWidth="4"
                  strokeDasharray="5,5"
                />
              </svg>
            )}
          </div>
        </div>

        {isGameOver && (
          <div className="game-over-overlay">
            <div className="game-over-modal">
              <h2>🎮 Game Over!</h2>
              <p>Final Score: <strong>{score.toLocaleString()}</strong></p>
              <p>Level Reached: <strong>{level}</strong></p>
              <p>Total Matches: <strong>{matches}</strong></p>
              <p>Time Played: <strong>{Math.floor(gameTime / 1000)}s</strong></p>
              {score === bestScore && <p className="new-record">🏆 New Best Score!</p>}
              <button className="new-game-btn" onClick={startNewGame}>
                Play Again
              </button>
            </div>
          </div>
        )}

        <div className="game-controls">
          <button className="new-game-btn" onClick={startNewGame}>
            New Game
          </button>
          <button 
            className="pause-btn" 
            onClick={() => setIsPaused(!isPaused)}
            disabled={isGameOver}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <div className="instructions">
            <p>
              🎯 <strong>How to Play:</strong> Drag to draw barriers and guide falling orbs. 
              Match 3+ orbs of the same color to score! Create combos for massive points!
            </p>
            <p>
              ✨ <strong>Tips:</strong> Use barriers strategically to group orbs by color. 
              Higher levels spawn orbs faster. You can have up to 3 barriers at once.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ColorCascade;
