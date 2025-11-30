import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  BLOCK_SIZE, 
  BLOCK_COLORS, 
  MAP_COLORS,
  WORLD_WIDTH, 
  WORLD_HEIGHT, 
  GRAVITY, 
  FRICTION, 
  MOVE_SPEED, 
  JUMP_FORCE, 
  MECH_MOVE_SPEED, 
  MECH_JUMP_FORCE, 
  MECH_GRAVITY,
  MECH_WIDTH, 
  MECH_HEIGHT,
  PROJECTILE_SPEED,
  PROJECTILE_LIFE,
  FALL_DAMAGE_THRESHOLD, 
  FALL_DAMAGE_MULTIPLIER,
  EXPLORATION_RADIUS,
  MINIMAP_SIZE,
  MINIMAP_ZOOM,
  FULLMAP_ZOOM,
  DAY_NIGHT_CYCLE_DURATION,
  MINING_TIERS,
  TOOL_TIERS
} from '../constants';
import { BlockType, Player, Camera, Particle, Projectile, GameEngineProps } from '../types';

// Asset registry
const BLOCK_TEXTURES: Partial<Record<BlockType, string>> = {
  // FUTURE ASSETS
};

export const GameEngine: React.FC<GameEngineProps> = ({ 
    selectedBlock, 
    onInventoryUpdate, 
    inventory, 
    onDamage, 
    onOpenWorkbench,
    onToggleMech,
    respawnTrigger, 
    resetGameTrigger,
    saveTrigger,
    onSaveDataReady,
    initialPlayerPos,
    isMapOpen, 
    hasMapUpgrade, 
    godMode, 
    isMechActive,
    isPaused,
    forcedTime 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const mapCanvasRef = useRef<HTMLCanvasElement>(null);
  // Lighting Canvas (Offscreen) to prevent 'destination-out' from erasing the world
  const lightingCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const animationRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastShotTimeRef = useRef<number>(0); // Track shot time for muzzle flash

  // Mining State
  const miningStateRef = useRef<{ x: number, y: number, startTime: number }>({ x: -1, y: -1, startTime: 0 });

  // Animation State for Mech transition
  const mechAnimRef = useRef<{ active: boolean, type: 'ENTER' | 'EXIT', progress: number }>({
      active: false,
      type: 'ENTER',
      progress: 0
  });

  // Game State Refs (Mutable for loop performance)
  const worldRef = useRef<Uint8Array>(new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT)); 
  const backgroundRef = useRef<Uint8Array>(new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT));
  const visitedRef = useRef<Uint8Array>(new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT));
  
  const playerRef = useRef<Player>({ 
    x: WORLD_WIDTH * BLOCK_SIZE / 2, 
    y: 0, 
    vx: 0, 
    vy: 0, 
    width: 24, // Increased from 20 to 24 for better sprite detail
    height: 40,
    grounded: false,
    facingRight: true
  });
  const cameraRef = useRef<Camera>({ x: 0, y: 0, vx: 0, vy: 0 });
  const keysRef = useRef<Record<string, boolean>>({});
  const particlesRef = useRef<Particle[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const mouseRef = useRef<{x: number, y: number, down: boolean, button: number}>({x: 0, y: 0, down: false, button: 0});
  
  const textureRefs = useRef<Partial<Record<BlockType, HTMLImageElement>>>({});
  const lastPlayerBlockPos = useRef<{x: number, y: number}>({x: -1, y: -1});

  // Load Textures
  useEffect(() => {
    Object.entries(BLOCK_TEXTURES).forEach(([typeStr, src]) => {
      const type = parseInt(typeStr) as BlockType;
      const img = new Image();
      img.src = src;
      textureRefs.current[type] = img;
    });
    
    // Init lighting canvas
    if (!lightingCanvasRef.current) {
        lightingCanvasRef.current = document.createElement('canvas');
    }
  }, []);

  // Save Data Extractor
  useEffect(() => {
      if (saveTrigger > 0) {
          onSaveDataReady(playerRef.current.x, playerRef.current.y);
      }
  }, [saveTrigger, onSaveDataReady]);

  // Initialization: Generate World
  useEffect(() => {
    // Reset World Data
    worldRef.current = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
    backgroundRef.current = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
    visitedRef.current = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT);
    particlesRef.current = [];
    projectilesRef.current = [];

    const world = worldRef.current;
    const background = backgroundRef.current;
    
    // Procedural Generation
    const surfaceBaseY = Math.floor(WORLD_HEIGHT / 3);

    // Config for Sewer Biome
    const SEWER_START_Y = 1700;
    const SEWER_END_Y = 1900;

    // Config for City Biome
    const CITY_FREQUENCY = 800; // Average blocks between cities
    const SKYSCRAPER_WIDTH = 30;

    // Track where to place skyscrapers (X coords)
    const skyscraperLocations: number[] = [];
    for (let x = 0; x < WORLD_WIDTH; x += CITY_FREQUENCY) {
        if (Math.random() > 0.3) { // 70% chance of city
             const numBuildings = 3 + Math.floor(Math.random() * 3);
             for(let b=0; b<numBuildings; b++) {
                 skyscraperLocations.push(x + (b * (SKYSCRAPER_WIDTH + 10)) + Math.floor(Math.random() * 50));
             }
        }
    }

    for (let x = 0; x < WORLD_WIDTH; x++) {
      const noise = Math.sin(x * 0.1) * 3 + Math.cos(x * 0.05) * 5;
      const groundLevel = surfaceBaseY + Math.floor(noise);

      // --- CITY BIOME LOGIC ---
      let isBuilding = false;
      let buildingHeight = 0;
      
      for (const bx of skyscraperLocations) {
          if (x >= bx && x < bx + SKYSCRAPER_WIDTH) {
              isBuilding = true;
              const hHash = Math.sin(bx) * 10000;
              buildingHeight = 80 + Math.floor((hHash - Math.floor(hHash)) * 100); 
              break;
          }
      }

      if (isBuilding) {
           const topY = groundLevel - buildingHeight;
           
           for (let y = topY; y < groundLevel; y++) {
                if (y < 0) continue;
                const idx = y * WORLD_WIDTH + x;
                
                const isLeftWall = skyscraperLocations.includes(x);
                const isRightWall = skyscraperLocations.includes(x - SKYSCRAPER_WIDTH + 1);
                const isFloor = (groundLevel - y) % 6 === 0;

                if (isLeftWall || isRightWall || isFloor) {
                    world[idx] = BlockType.SKYSCRAPER_FRAME;
                } else {
                    background[idx] = BlockType.BG_WINDOW;
                }
           }
      }

      // Fill from ground down
      for (let y = groundLevel; y < WORLD_HEIGHT; y++) {
        const idx = y * WORLD_WIDTH + x;
        
        // --- SEWER BIOME LOGIC (Y 1700 - 1900) ---
        if (y >= SEWER_START_Y && y <= SEWER_END_Y) {
            const pipe1Y = 1750 + Math.sin(x * 0.03) * 15;
            const pipe2Y = 1800 + Math.cos(x * 0.025) * 20;
            const pipe3Y = 1850 + Math.sin(x * 0.04) * 12;

            const isPipe1 = Math.abs(y - pipe1Y) < 10;
            const isPipe2 = Math.abs(y - pipe2Y) < 12;
            const isPipe3 = Math.abs(y - pipe3Y) < 9;

            if (isPipe1 || isPipe2 || isPipe3) {
                 const pipeCenter = isPipe1 ? pipe1Y : (isPipe2 ? pipe2Y : pipe3Y);
                 const pipeRadius = isPipe1 ? 10 : (isPipe2 ? 12 : 9);
                 if (y > pipeCenter + (pipeRadius * 0.4)) {
                    world[idx] = BlockType.SLUDGE;
                 } else {
                    world[idx] = BlockType.AIR;
                 }
            } else {
                 if (Math.random() > 0.98) {
                    world[idx] = BlockType.PIPE_RUSTY;
                 } else {
                    world[idx] = BlockType.SEWER_BRICK;
                 }
            }
            continue; 
        }
        // -----------------------------------------

        if (world[idx] === BlockType.AIR) { 
            if (y === groundLevel) {
                world[idx] = BlockType.CONCRETE; 
            } else if (y > groundLevel && y < groundLevel + 10) {
                world[idx] = Math.random() > 0.9 ? BlockType.RUSTED_METAL : BlockType.CONCRETE;
            } else {
                if (Math.random() > 0.96) {
                    world[idx] = Math.random() > 0.5 ? BlockType.NEON_ORE_BLUE : BlockType.NEON_ORE_PINK;
                } else if (Math.random() > 0.97) {
                    world[idx] = BlockType.CIRCUIT_SCRAP;
                } else {
                    world[idx] = BlockType.RUSTED_METAL;
                }
            }
        }
        
        // Bedrock
        if (y === WORLD_HEIGHT - 1) {
          world[idx] = BlockType.CYBER_WALL; 
        }
      }
    }

    resetPlayerPosition();
  }, [resetGameTrigger]); // Re-run when resetGameTrigger changes

  const resetPlayerPosition = () => {
      // If we have an initial pos passed (Loaded Game), use it.
      if (initialPlayerPos && initialPlayerPos.x !== -1) {
          playerRef.current.x = initialPlayerPos.x;
          playerRef.current.y = initialPlayerPos.y;
      } else {
          const surfaceY = Math.floor(WORLD_HEIGHT / 3);
          playerRef.current.x = WORLD_WIDTH * BLOCK_SIZE / 2;
          playerRef.current.y = (surfaceY - 15) * BLOCK_SIZE; 
      }
      
      playerRef.current.vx = 0;
      playerRef.current.vy = 0;
      cameraRef.current.x = playerRef.current.x - window.innerWidth/2;
      cameraRef.current.y = playerRef.current.y - window.innerHeight/2;
  };

  useEffect(() => {
    if (respawnTrigger > 0) {
        // Respawn at surface, not at save point (classic punitive mechanic)
        const surfaceY = Math.floor(WORLD_HEIGHT / 3);
        playerRef.current.x = WORLD_WIDTH * BLOCK_SIZE / 2;
        playerRef.current.y = (surfaceY - 15) * BLOCK_SIZE; 
        playerRef.current.vx = 0;
        playerRef.current.vy = 0;
    }
  }, [respawnTrigger]);

  const getBlock = (x: number, y: number) => {
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return BlockType.CYBER_WALL; // Border
    return worldRef.current[Math.floor(y) * WORLD_WIDTH + Math.floor(x)];
  };

  const setBlock = (x: number, y: number, type: BlockType) => {
    if (x < 0 || x >= WORLD_WIDTH || y < 0 || y >= WORLD_HEIGHT) return;
    worldRef.current[Math.floor(y) * WORLD_WIDTH + Math.floor(x)] = type;
  };

  const spawnParticles = (x: number, y: number, color: string, count: number, speed = 4) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        life: 1.0,
        color
      });
    }
  };

  // Helper for color interpolation
  const interpolateColor = (color1: number[], color2: number[], factor: number) => {
      const result = color1.slice();
      for (let i = 0; i < 3; i++) {
          result[i] = Math.round(result[i] + factor * (color2[i] - color1[i]));
      }
      return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
  };

  // --- PROCEDURAL HUMAN RENDERER (Updated to match reference) ---
  const drawHumanSprite = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    facingRight: boolean,
    isMoving: boolean,
    isAction: boolean,
    heldItem: BlockType,
    timestamp: number
  ) => {
    ctx.save();
    
    // Pixel Art Grid approximation: 6x10 grid (4px per unit if w=24)
    const unit = w / 6; 
    
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    ctx.translate(centerX, centerY);
    if (!facingRight) ctx.scale(-1, 1);
    ctx.translate(-w / 2, -h / 2);

    // Reference Colors
    const cSkin = '#e0a171'; // Tanned skin
    const cHair = '#581c87'; // Deep Purple (Mullet)
    const cShirt = '#ec4899'; // Pink-500 (Shirt)
    const cPants = '#0e7490'; // Cyan-700 (Jeans)
    const cShoes = '#171717'; // Neutral-900

    const t = timestamp * 0.01;
    const breathe = Math.sin(t * 0.5) * 1; 
    const walkPhase = isMoving ? Math.sin(t * 0.8) : 0;
    
    // -- DRAW BODY PARTS --

    // 1. Back Arm (Behind)
    ctx.fillStyle = cSkin;
    ctx.fillRect(unit * 1.5, h * 0.4, unit * 1.5, h * 0.25);

    // 2. Back Leg
    ctx.fillStyle = cPants;
    const backLegOffset = isMoving ? -walkPhase * unit * 2 : 0;
    ctx.fillRect(unit * 1, h * 0.6, unit * 2, h * 0.3); // Upper leg
    // Lower leg with animation
    ctx.save();
    ctx.translate(unit * 2, h * 0.6);
    ctx.rotate(isMoving ? -walkPhase * 0.5 : 0);
    ctx.fillRect(-unit, 0, unit * 2, h * 0.4); 
    // Shoe
    ctx.fillStyle = cShoes;
    ctx.fillRect(-unit, h * 0.35, unit * 2.2, h * 0.05);
    ctx.restore();

    // 3. Torso (Shirt)
    ctx.fillStyle = cShirt;
    ctx.fillRect(unit * 1.5, h * 0.3 + breathe, unit * 3, h * 0.3); // Main body
    // Collar/Detail
    ctx.fillStyle = '#be185d'; // Darker pink shadow
    ctx.fillRect(unit * 1.5, h * 0.5 + breathe, unit * 3, unit); // Bottom hem

    // 4. Pants (Pelvis)
    ctx.fillStyle = cPants;
    ctx.fillRect(unit * 1.5, h * 0.6 + breathe, unit * 3, h * 0.1);

    // 5. Head
    const headY = h * 0.05 + breathe;
    // Neck
    ctx.fillStyle = cSkin;
    ctx.fillRect(unit * 2.5, headY + h * 0.2, unit, h * 0.05);
    // Face
    ctx.fillRect(unit * 2, headY, unit * 2.5, h * 0.2);
    // Hair (Mullet)
    ctx.fillStyle = cHair;
    ctx.fillRect(unit * 1.5, headY - unit, unit * 3.5, unit * 1.5); // Top
    ctx.fillRect(unit * 1, headY, unit, h * 0.22); // Back (Mullet)
    ctx.fillRect(unit * 4, headY, unit * 0.5, unit * 1.5); // Sideburn

    // 6. Front Leg
    ctx.fillStyle = cPants;
    ctx.save();
    ctx.translate(unit * 3, h * 0.6);
    ctx.rotate(isMoving ? walkPhase * 0.5 : 0);
    ctx.fillRect(-unit, 0, unit * 2, h * 0.4); 
    // Shoe
    ctx.fillStyle = cShoes;
    ctx.fillRect(-unit, h * 0.35, unit * 2.2, h * 0.05);
    ctx.restore();

    // 7. Front Arm
    ctx.save();
    ctx.translate(unit * 3, h * 0.35 + breathe);
    const armRot = isAction ? (Math.sin(t * 15) * 1.0 - 1.0) : (isMoving ? walkPhase * 0.8 : -0.1);
    ctx.rotate(armRot);
    
    // Sleeve
    ctx.fillStyle = cShirt;
    ctx.fillRect(-unit, -unit, unit * 2.5, unit * 2);
    // Arm
    ctx.fillStyle = cSkin;
    ctx.fillRect(0, unit, unit * 1.5, h * 0.25);
    // Hand
    ctx.fillStyle = cSkin;
    ctx.fillRect(-1, h * 0.25, unit * 2, unit * 1.5);
    
    // Tool (Pickaxe/Gun)
    if (heldItem === BlockType.PICKAXE || heldItem === BlockType.ADVANCED_PICKAXE) {
       const isAdvanced = heldItem === BlockType.ADVANCED_PICKAXE;
       ctx.translate(0, h * 0.25);
       ctx.rotate(1.5);
       ctx.fillStyle = isAdvanced ? '#581c87' : '#64748b'; // Handle (Darker for advanced)
       ctx.fillRect(0, -10, 4, 20); 
       ctx.fillStyle = isAdvanced ? '#a855f7' : '#22d3ee'; // Tip (Cyan vs Purple)
       // Draw Pickaxe Head
       ctx.fillRect(-4, -12, 12, 4);
       ctx.fillStyle = isAdvanced ? '#d8b4fe' : '#0891b2';
       ctx.fillRect(-6, -12, 2, 6); // Pointy bit 1
       ctx.fillRect(8, -12, 2, 6); // Pointy bit 2
    }
    
    ctx.restore();

    ctx.restore();
  };

  // --- PROCEDURAL MECH RENDERER ---
  const drawMechSprite = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    facingRight: boolean,
    isMoving: boolean,
    isShooting: boolean,
    timestamp: number
  ) => {
    ctx.save();
    
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    ctx.translate(centerX, centerY);
    if (!facingRight) ctx.scale(-1, 1);
    ctx.translate(-w / 2, -h / 2);

    const cBase = '#64748b';    // Slate 500
    const cDark = '#334155';    // Slate 700
    const cBlack = '#0f172a';   // Slate 900
    const cNeon = '#22c55e';    // Green 500
    const cGun = '#1e293b';     // Slate 800
    
    const time = timestamp * 0.01;
    const walkOffset = isMoving ? Math.sin(time * 0.8) : 0;
    const bob = isMoving ? Math.abs(Math.sin(time * 0.8)) * 3 : 0;

    // Legs
    const legW = w * 0.22;
    const legH = h * 0.45;
    const legY = h * 0.55;
    
    ctx.fillStyle = '#1e293b'; 
    ctx.fillRect(w * 0.4 + (walkOffset * 10), legY, legW, legH);
    ctx.fillRect(w * 0.35 + (walkOffset * 10), legY + legH - 5, legW + 10, 5);

    const bodyY = bob; 

    // Backpack
    ctx.fillStyle = cBlack;
    ctx.fillRect(w * 0.05, bodyY + h * 0.1, w * 0.25, h * 0.35);
    ctx.fillStyle = cNeon;
    ctx.fillRect(w * 0.05, bodyY + h * 0.15, w * 0.05, h * 0.2);

    // Front Leg
    ctx.fillStyle = cBase;
    ctx.fillRect(w * 0.4 - (walkOffset * 10), legY, legW, legH);
    ctx.fillStyle = cDark;
    ctx.fillRect(w * 0.42 - (walkOffset * 10), legY + legH * 0.3, legW * 0.6, legH * 0.2);
    ctx.fillStyle = cBase;
    ctx.fillRect(w * 0.35 - (walkOffset * 10), legY + legH - 5, legW + 10, 5);
    ctx.fillStyle = cNeon;
    ctx.fillRect(w * 0.35 - (walkOffset * 10), legY + legH - 5, 5, 2);

    // Torso
    const torsoX = w * 0.25;
    const torsoY = bodyY + h * 0.15;
    const torsoW = w * 0.45;
    const torsoH = h * 0.4;

    ctx.fillStyle = cBase;
    ctx.fillRect(torsoX, torsoY, torsoW, torsoH); 
    ctx.fillStyle = cDark;
    ctx.fillRect(torsoX + 5, torsoY + 10, torsoW - 5, torsoH * 0.6);
    
    // Core (No ShadowBlur to prevent clearing glitches in some browsers)
    ctx.fillStyle = cNeon;
    ctx.fillRect(torsoX + torsoW * 0.4, torsoY + torsoH * 0.3, 8, 8);

    // Head
    const headW = w * 0.25;
    const headH = h * 0.18;
    const headX = w * 0.35;
    const headY = torsoY - headH + 2;

    ctx.fillStyle = cDark;
    ctx.fillRect(headX, headY, headW, headH);
    ctx.fillStyle = cNeon;
    ctx.fillRect(headX + headW * 0.4, headY + headH * 0.3, headW * 0.5, 4);

    // Gun
    const gunX = w * 0.3;
    const gunY = torsoY + torsoH * 0.4;
    
    ctx.fillStyle = cGun;
    ctx.fillRect(gunX - 10, gunY, w * 0.8, 15);
    ctx.fillRect(gunX, gunY + 15, w * 0.3, 10);
    ctx.fillStyle = cNeon;
    ctx.fillRect(gunX, gunY + 4, w * 0.6, 2);

    if (isShooting) {
        if (Math.floor(timestamp / 50) % 2 === 0) {
            ctx.fillStyle = '#fef08a'; 
            ctx.beginPath();
            const tipX = gunX + w * 0.8;
            const tipY = gunY + 7;
            ctx.moveTo(tipX, tipY);
            ctx.lineTo(tipX + 30, tipY - 10);
            ctx.lineTo(tipX + 20, tipY);
            ctx.lineTo(tipX + 30, tipY + 10);
            ctx.lineTo(tipX, tipY);
            ctx.fill();
        }
    }

    ctx.fillStyle = cBase;
    ctx.beginPath();
    ctx.arc(torsoX + torsoW * 0.5, torsoY + torsoH * 0.2, 12, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
  };

  // Main Game Loop
  const update = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const dt = Math.min((timestamp - lastTimeRef.current) / 16.67, 2); 
    lastTimeRef.current = timestamp;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- GAMEPAD POLLING ---
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = gamepads[0];
    
    if (gp) {
        const deadzone = 0.15;
        
        // Left Stick (Axes 0, 1): Movement
        const lx = gp.axes[0];
        const ly = gp.axes[1];
        
        if (Math.abs(lx) > deadzone) {
            if (lx < 0) {
                 keysRef.current['KeyA'] = true;
                 keysRef.current['KeyD'] = false;
            } else {
                 keysRef.current['KeyD'] = true;
                 keysRef.current['KeyA'] = false;
            }
        } else {
            // Only reset if keyboard isn't being used
            // keysRef.current['KeyA'] = false;
            // keysRef.current['KeyD'] = false;
        }

        // Jump (Button 0 or 1 depending on layout)
        if (gp.buttons[0].pressed || gp.buttons[1].pressed) keysRef.current['Space'] = true;
        
        // Interact/Mine (KeyX) mapped to Button 2 (X/Y)
        if (gp.buttons[2].pressed) keysRef.current['KeyX'] = true;
        
        // Toggle Mech (KeyF) mapped to Button 3 (Y/X)
        if (gp.buttons[3].pressed) keysRef.current['KeyF'] = true;

        // Right Stick: Virtual Mouse
        const rx = gp.axes[2];
        const ry = gp.axes[3];
        if (Math.abs(rx) > deadzone || Math.abs(ry) > deadzone) {
             mouseRef.current.x += rx * 15;
             mouseRef.current.y += ry * 15;
             mouseRef.current.x = Math.max(0, Math.min(mouseRef.current.x, canvas.width));
             mouseRef.current.y = Math.max(0, Math.min(mouseRef.current.y, canvas.height));
        }

        // Triggers for Mouse Clicks
        // R Trigger / RB -> Left Click
        if (gp.buttons[7].pressed || gp.buttons[5].pressed) {
             mouseRef.current.down = true;
             mouseRef.current.button = 0;
        } 
        
        // L Trigger / LB -> Right Click
        if (gp.buttons[6].pressed || gp.buttons[4].pressed) {
             mouseRef.current.down = true;
             mouseRef.current.button = 2;
        }
    }

    // --- PAUSE LOGIC ---
    if (isPaused) {
        let progress = 0;
        if (forcedTime !== undefined) {
            progress = forcedTime;
        } else {
            const cycleTime = timestamp % DAY_NIGHT_CYCLE_DURATION;
            progress = cycleTime / DAY_NIGHT_CYCLE_DURATION; 
        }
        const daylightIntensity = (Math.sin(2 * Math.PI * progress - Math.PI / 2) + 1) / 2;
        const nightColor = [15, 23, 42]; 
        const dayColor = [51, 92, 129]; 
        const skyColor = interpolateColor(nightColor, dayColor, daylightIntensity);
        const darknessAlpha = 0.6 * (1 - daylightIntensity); 

        drawGame(ctx, canvas, timestamp, false, skyColor, darknessAlpha);
        animationRef.current = requestAnimationFrame(update);
        return;
    }

    const player = playerRef.current;

    // --- ANIMATION STATE HANDLING ---
    if (mechAnimRef.current.active) {
        mechAnimRef.current.progress += 0.05 * dt;
        
        cameraRef.current.vx = (Math.random() - 0.5) * 10;
        cameraRef.current.vy = (Math.random() - 0.5) * 10;
        
        if (mechAnimRef.current.progress >= 1.0) {
            mechAnimRef.current.active = false;
            cameraRef.current.vx = 0;
            cameraRef.current.vy = 0;
            
            if (mechAnimRef.current.type === 'ENTER') {
                onToggleMech(true);
                player.y -= (MECH_HEIGHT - 40);
                spawnParticles(player.x + player.width/2, player.y + player.height/2, '#0ea5e9', 50, 10);
            } else {
                onToggleMech(false);
                const bx = Math.floor((player.x + MECH_WIDTH/2) / BLOCK_SIZE);
                const by = Math.floor((player.y + MECH_HEIGHT) / BLOCK_SIZE) - 1; 
                setBlock(bx, by, BlockType.MECH_SUIT);
                
                player.y += (MECH_HEIGHT - 40);
                spawnParticles(player.x + player.width/2, player.y + player.height/2, '#94a3b8', 50, 10);
            }
        }
        
        drawGame(ctx, canvas, timestamp); 
        animationRef.current = requestAnimationFrame(update);
        return;
    }

    // --- PLAYER SIZE UPDATE ---
    if (isMechActive) {
        player.width = MECH_WIDTH;
        player.height = MECH_HEIGHT;
    } else {
        player.width = 24; // Updated Width
        player.height = 40;
    }

    // --- DAY/NIGHT CYCLE LOGIC ---
    let progress = 0;
    if (forcedTime !== undefined) {
        progress = forcedTime;
    } else {
        const cycleTime = timestamp % DAY_NIGHT_CYCLE_DURATION;
        progress = cycleTime / DAY_NIGHT_CYCLE_DURATION; 
    }
    const daylightIntensity = (Math.sin(2 * Math.PI * progress - Math.PI / 2) + 1) / 2;
    const nightColor = [15, 23, 42]; 
    const dayColor = [51, 92, 129]; 
    const skyColor = interpolateColor(nightColor, dayColor, daylightIntensity);
    const darknessAlpha = 0.6 * (1 - daylightIntensity); 

    // --- PHYSICS ---
    const prevVy = player.vy;
    const isShiftDown = keysRef.current['ShiftLeft'] || keysRef.current['ShiftRight'];
    
    if (isMechActive && keysRef.current['KeyF'] && !mechAnimRef.current.active) {
        mechAnimRef.current = { active: true, type: 'EXIT', progress: 0 };
    }

    let speedMultiplier = 1;
    if (godMode) {
        speedMultiplier = isShiftDown ? 250 : 50;
    } else if (isMechActive) {
        speedMultiplier = MECH_MOVE_SPEED / MOVE_SPEED; 
    }
    const currentMoveSpeed = MOVE_SPEED * speedMultiplier;
    const currentJumpForce = isMechActive ? MECH_JUMP_FORCE : JUMP_FORCE;
    const currentGravity = isMechActive ? MECH_GRAVITY : GRAVITY;

    let isMoving = false;
    if (keysRef.current['KeyA'] || keysRef.current['ArrowLeft']) {
      player.vx -= currentMoveSpeed * dt;
      player.facingRight = false;
      isMoving = true;
    }
    if (keysRef.current['KeyD'] || keysRef.current['ArrowRight']) {
      player.vx += currentMoveSpeed * dt;
      player.facingRight = true;
      isMoving = true;
    }
    player.vx *= FRICTION;
    if (Math.abs(player.vx) < 0.1) isMoving = false;

    if (godMode) {
        if (keysRef.current['KeyW'] || keysRef.current['ArrowUp']) player.vy -= currentMoveSpeed * dt;
        if (keysRef.current['KeyS'] || keysRef.current['ArrowDown']) player.vy += currentMoveSpeed * dt;
        if (keysRef.current['Space']) player.vy -= currentMoveSpeed * dt;
        player.vy *= FRICTION; 
    } else {
        player.vy += currentGravity * dt;
        if ((keysRef.current['Space'] || keysRef.current['ArrowUp']) && player.grounded) {
            player.vy = currentJumpForce;
            player.grounded = false;
            if (isMechActive) spawnParticles(player.x + player.width/2, player.y + player.height, '#64748b', 10);
        }
    }

    player.x += player.vx * dt;
    checkCollisionX(player);
    player.y += player.vy * dt;
    checkCollisionY(player, prevVy);

    if (player.x < 0) player.x = 0;
    if (player.x > WORLD_WIDTH * BLOCK_SIZE - player.width) player.x = WORLD_WIDTH * BLOCK_SIZE - player.width;
    if (player.y > WORLD_HEIGHT * BLOCK_SIZE + 200) { 
        if (!godMode) {
            onDamage(9999); 
            player.y = WORLD_HEIGHT * BLOCK_SIZE + 200; 
            player.vy = 0;
        } else if (player.vy > 100) player.vy = 100;
    }

    if (isMechActive && mouseRef.current.down && mouseRef.current.button === 0) {
        if (timestamp - lastShotTimeRef.current > 150) {
             if ((inventory[BlockType.AMMO_PACK] || 0) > 0 || godMode) {
                 if (!godMode) onInventoryUpdate(BlockType.AMMO_PACK, -1);
                 
                 lastShotTimeRef.current = timestamp;
                 const gunX = player.facingRight ? player.x + player.width + 10 : player.x - 10;
                 const gunY = player.y + player.height * 0.45;
                 
                 const mx = mouseRef.current.x + cameraRef.current.x;
                 const my = mouseRef.current.y + cameraRef.current.y;
                 const angle = Math.atan2(my - gunY, mx - gunX);
                 
                 projectilesRef.current.push({
                     x: gunX,
                     y: gunY,
                     vx: Math.cos(angle) * PROJECTILE_SPEED,
                     vy: Math.sin(angle) * PROJECTILE_SPEED,
                     life: PROJECTILE_LIFE,
                     color: '#facc15'
                 });
                 
                 if (!player.grounded) {
                    player.vx -= Math.cos(angle) * 2;
                 }
             }
        }
    }

    for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const p = projectilesRef.current[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const bx = Math.floor(p.x / BLOCK_SIZE);
        const by = Math.floor(p.y / BLOCK_SIZE);
        const block = getBlock(bx, by);

        if ((block !== BlockType.AIR && block !== BlockType.DOOR_OPEN && block !== BlockType.LUMINARY) || p.life <= 0) {
            if (block !== BlockType.AIR && block !== BlockType.DOOR_OPEN && block !== BlockType.LUMINARY) {
                spawnParticles(p.x, p.y, '#facc15', 3);
            }
            projectilesRef.current.splice(i, 1);
        }
    }

    const bx = Math.floor((player.x + player.width/2) / BLOCK_SIZE);
    const by = Math.floor((player.y + player.height/2) / BLOCK_SIZE);

    if (bx !== lastPlayerBlockPos.current.x || by !== lastPlayerBlockPos.current.y) {
        lastPlayerBlockPos.current = { x: bx, y: by };
        const r = EXPLORATION_RADIUS;
        const startX = Math.max(0, bx - r);
        const endX = Math.min(WORLD_WIDTH, bx + r);
        const startY = Math.max(0, by - r);
        const endY = Math.min(WORLD_HEIGHT, by + r);

        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                if ((x-bx)*(x-bx) + (y-by)*(y-by) <= r*r) {
                    visitedRef.current[y * WORLD_WIDTH + x] = 1;
                }
            }
        }
    }

    // --- INTERACTION & MINING LOGIC ---
    // Combined "Action" trigger: Mouse Down OR 'X' key held
    const isActionTriggered = (mouseRef.current.down && mouseRef.current.button === 0) || keysRef.current['KeyX'];

    if (isActionTriggered && !isMapOpen && !mechAnimRef.current.active) { 
       const mx = mouseRef.current.x + cameraRef.current.x;
       const my = mouseRef.current.y + cameraRef.current.y;
       const mBx = Math.floor(mx / BLOCK_SIZE);
       const mBy = Math.floor(my / BLOCK_SIZE);
       
       if (!isMechActive) {
           const dist = Math.sqrt(Math.pow(player.x + player.width/2 - mx, 2) + Math.pow(player.y + player.height/2 - my, 2));
           if (dist < 200) {
                const currentBlock = getBlock(mBx, mBy);
                // Mining: Only if PICKAXE or ADVANCED_PICKAXE is selected
                if (currentBlock !== BlockType.AIR && (selectedBlock === BlockType.PICKAXE || selectedBlock === BlockType.ADVANCED_PICKAXE)) {
                    
                    // CHECK MINING TIER
                    const blockTier = MINING_TIERS[currentBlock] || 1; // Default to Tier 1
                    const toolTier = TOOL_TIERS[selectedBlock] || 0; // Default to Tier 0 if not tool

                    if (toolTier < blockTier && !godMode) {
                        // Tool too weak effect (Metal Clank)
                        spawnParticles(mx, my, '#94a3b8', 2, 8); // Gray sparks
                        miningStateRef.current = { x: -1, y: -1, startTime: 0 };
                    } else {
                        // START OR CONTINUE MINING
                        let requiredTime = 0;
                        if (!godMode) {
                            if (selectedBlock === BlockType.ADVANCED_PICKAXE) requiredTime = 1000; // 1 second for Advanced
                            else requiredTime = 2000; // 2 seconds for Normal
                        }

                        // If switching block or just starting
                        if (miningStateRef.current.x !== mBx || miningStateRef.current.y !== mBy) {
                            miningStateRef.current = { x: mBx, y: mBy, startTime: timestamp };
                        }

                        const elapsedTime = timestamp - miningStateRef.current.startTime;

                        if (elapsedTime >= requiredTime) {
                            // BREAK BLOCK LOGIC
                            // Special handling for Door (Break both parts)
                            if (currentBlock === BlockType.DOOR_CLOSED || currentBlock === BlockType.DOOR_OPEN) {
                                onInventoryUpdate(BlockType.DOOR_CLOSED, 1); // Only give back 1
                                setBlock(mBx, mBy, BlockType.AIR);
                                spawnParticles(mx, my, BLOCK_COLORS[currentBlock], 5);
                                
                                // Check Above
                                const above = getBlock(mBx, mBy - 1);
                                if (above === BlockType.DOOR_CLOSED || above === BlockType.DOOR_OPEN) {
                                    setBlock(mBx, mBy - 1, BlockType.AIR);
                                    spawnParticles(mx, my - BLOCK_SIZE, BLOCK_COLORS[above], 5);
                                }
                                // Check Below
                                const below = getBlock(mBx, mBy + 1);
                                if (below === BlockType.DOOR_CLOSED || below === BlockType.DOOR_OPEN) {
                                    setBlock(mBx, mBy + 1, BlockType.AIR);
                                    spawnParticles(mx, my + BLOCK_SIZE, BLOCK_COLORS[below], 5);
                                }

                            } else {
                                onInventoryUpdate(currentBlock, 1);
                                setBlock(mBx, mBy, BlockType.AIR);
                                
                                // EXPLOSION PARTICLES
                                if (selectedBlock === BlockType.ADVANCED_PICKAXE) {
                                     // Special Purple Neon Effect
                                     spawnParticles(mx, my, '#a855f7', 8, 6); // Purple Burst
                                     spawnParticles(mx, my, '#d8b4fe', 4, 4); // Light Purple
                                } else {
                                     spawnParticles(mx, my, BLOCK_COLORS[currentBlock], 5);
                                }
                            }
                            // Reset Mining State after break
                            miningStateRef.current = { x: -1, y: -1, startTime: 0 };
                        } else {
                            // MINING IN PROGRESS (Feedback)
                            // Chance to spawn particle while drilling
                            if (Math.random() > 0.8) {
                                spawnParticles(mx, my, '#ffffff', 1, 2);
                            }
                        }
                    }
                } 
                // Placing: Only if not picking axe and not empty hand (implicit)
                // Also prevent placing Pickaxes as blocks
                else if (currentBlock === BlockType.AIR && 
                         selectedBlock !== BlockType.AIR && 
                         selectedBlock !== BlockType.PICKAXE && 
                         selectedBlock !== BlockType.ADVANCED_PICKAXE) {
                    
                    if ((inventory[selectedBlock] || 0) > 0) {
                        const pRect = { l: player.x, r: player.x + player.width, t: player.y, b: player.y + player.height };
                        const bRect = { l: mBx * BLOCK_SIZE, r: (mBx + 1) * BLOCK_SIZE, t: mBy * BLOCK_SIZE, b: (mBy + 1) * BLOCK_SIZE };
                        
                        const intersect = pRect.l < bRect.r && pRect.r > bRect.l && pRect.t < bRect.b && pRect.b > bRect.t;
                        
                        if (!intersect) {
                            if (selectedBlock === BlockType.DOOR_CLOSED) {
                                // Door requires 2 blocks height
                                const aboveBlock = getBlock(mBx, mBy - 1);
                                // Check if above is free and not intersecting player
                                const bRectAbove = { l: mBx * BLOCK_SIZE, r: (mBx + 1) * BLOCK_SIZE, t: (mBy - 1) * BLOCK_SIZE, b: mBy * BLOCK_SIZE };
                                const intersectAbove = pRect.l < bRectAbove.r && pRect.r > bRectAbove.l && pRect.t < bRectAbove.b && pRect.b > bRectAbove.t;

                                if (aboveBlock === BlockType.AIR && !intersectAbove) {
                                    setBlock(mBx, mBy, selectedBlock);
                                    setBlock(mBx, mBy - 1, selectedBlock); // Place top part
                                    onInventoryUpdate(selectedBlock, -1);
                                    spawnParticles(mx, my, BLOCK_COLORS[selectedBlock], 3);
                                    mouseRef.current.down = false; // Debounce
                                }
                            } else if (selectedBlock === BlockType.LUMINARY) {
                                // Must be placed ON BOTTOM of a solid block (Ceiling)
                                const aboveBlock = getBlock(mBx, mBy - 1);
                                const isAboveSolid = aboveBlock !== BlockType.AIR && aboveBlock !== BlockType.DOOR_OPEN && aboveBlock !== BlockType.LUMINARY && aboveBlock !== BlockType.MECH_SUIT;
                                
                                if (isAboveSolid) {
                                    setBlock(mBx, mBy, selectedBlock);
                                    onInventoryUpdate(selectedBlock, -1);
                                    spawnParticles(mx, my, BLOCK_COLORS[selectedBlock], 3);
                                }
                            } else {
                                setBlock(mBx, mBy, selectedBlock);
                                onInventoryUpdate(selectedBlock, -1);
                                spawnParticles(mx, my, BLOCK_COLORS[selectedBlock], 3);
                            }
                        }
                    }
                }
           }
       }
    } else {
        // Reset mining progress if action key/mouse is released
        miningStateRef.current = { x: -1, y: -1, startTime: 0 };
    }
       
    // Right click interactions (independent of 'X')
    if (mouseRef.current.down && mouseRef.current.button === 2 && !isMapOpen && !mechAnimRef.current.active) {
       const mx = mouseRef.current.x + cameraRef.current.x;
       const my = mouseRef.current.y + cameraRef.current.y;
       const mBx = Math.floor(mx / BLOCK_SIZE);
       const mBy = Math.floor(my / BLOCK_SIZE);
       const dist = Math.sqrt(Math.pow(player.x + player.width/2 - mx, 2) + Math.pow(player.y + player.height/2 - my, 2));
       
       if (dist < 200) {
           const currentBlock = getBlock(mBx, mBy);
           mouseRef.current.down = false; // Debounce click

           if (currentBlock === BlockType.WORKBENCH) {
               onOpenWorkbench();
           } else if (currentBlock === BlockType.MECH_SUIT && !isMechActive) {
                mechAnimRef.current = { active: true, type: 'ENTER', progress: 0 };
                setBlock(mBx, mBy, BlockType.AIR);
                player.x = mBx * BLOCK_SIZE - (MECH_WIDTH/2) + (BLOCK_SIZE/2);
                player.y = (mBy + 1) * BLOCK_SIZE - MECH_HEIGHT;
           } else if (currentBlock === BlockType.DOOR_CLOSED || currentBlock === BlockType.DOOR_OPEN) {
               // TOGGLE DOOR PAIR
               const targetType = currentBlock === BlockType.DOOR_CLOSED ? BlockType.DOOR_OPEN : BlockType.DOOR_CLOSED;
               
               // Toggle current
               setBlock(mBx, mBy, targetType);
               
               // Toggle Pair (Check Above)
               const above = getBlock(mBx, mBy - 1);
               if (above === currentBlock) setBlock(mBx, mBy - 1, targetType);
               
               // Toggle Pair (Check Below)
               const below = getBlock(mBx, mBy + 1);
               if (below === currentBlock) setBlock(mBx, mBy + 1, targetType);
           } 
       }
    }

    cameraRef.current.x += (player.x - canvas.width / 2 - cameraRef.current.x) * 0.1;
    cameraRef.current.y += (player.y - canvas.height / 2 - cameraRef.current.y) * 0.1;
    
    cameraRef.current.x += cameraRef.current.vx;
    cameraRef.current.y += cameraRef.current.vy;
    cameraRef.current.vx *= 0.9;
    cameraRef.current.vy *= 0.9;

    cameraRef.current.x = Math.max(0, Math.min(cameraRef.current.x, WORLD_WIDTH * BLOCK_SIZE - canvas.width));
    cameraRef.current.y = Math.max(0, Math.min(cameraRef.current.y, WORLD_HEIGHT * BLOCK_SIZE - canvas.height));

    drawGame(ctx, canvas, timestamp, isMoving, skyColor, darknessAlpha);
    
    animationRef.current = requestAnimationFrame(update);
  }, [selectedBlock, inventory, onInventoryUpdate, onDamage, isMapOpen, hasMapUpgrade, godMode, forcedTime, onOpenWorkbench, isMechActive, onToggleMech, isPaused]);

  const checkCollisionX = (player: Player) => {
      const startX = Math.floor(player.x / BLOCK_SIZE);
      const endX = Math.floor((player.x + player.width) / BLOCK_SIZE);
      const startY = Math.floor(player.y / BLOCK_SIZE);
      const endY = Math.floor((player.y + player.height) / BLOCK_SIZE);

      if (player.vx > 0) {
         for (let y = startY; y <= endY; y++) {
             const block = getBlock(endX, y);
             if (block !== BlockType.AIR && block !== BlockType.MECH_SUIT && block !== BlockType.DOOR_OPEN && block !== BlockType.LUMINARY) {
                 player.x = endX * BLOCK_SIZE - player.width - 0.01;
                 player.vx = 0;
                 return;
             }
         }
      } else if (player.vx < 0) {
         for (let y = startY; y <= endY; y++) {
             const block = getBlock(startX, y);
             if (block !== BlockType.AIR && block !== BlockType.MECH_SUIT && block !== BlockType.DOOR_OPEN && block !== BlockType.LUMINARY) {
                 player.x = (startX + 1) * BLOCK_SIZE;
                 player.vx = 0;
                 return;
             }
         }
      }
  };

  const checkCollisionY = (player: Player, prevVy: number) => {
      const startX = Math.floor(player.x / BLOCK_SIZE);
      const endX = Math.floor((player.x + player.width) / BLOCK_SIZE);
      const startY = Math.floor(player.y / BLOCK_SIZE);
      const endY = Math.floor((player.y + player.height) / BLOCK_SIZE);

      player.grounded = false;

      if (player.vy > 0) {
         for (let x = startX; x <= endX; x++) {
             const block = getBlock(x, endY);
             if (block !== BlockType.AIR && block !== BlockType.MECH_SUIT && block !== BlockType.DOOR_OPEN && block !== BlockType.LUMINARY) {
                 player.y = endY * BLOCK_SIZE - player.height - 0.01;
                 player.vy = 0;
                 player.grounded = true;
                 
                 if (!godMode && !isMechActive && prevVy > FALL_DAMAGE_THRESHOLD) {
                     const damage = Math.floor((prevVy - FALL_DAMAGE_THRESHOLD) * FALL_DAMAGE_MULTIPLIER);
                     if (damage > 0) {
                         onDamage(damage);
                         spawnParticles(player.x + player.width/2, player.y + player.height, '#ef4444', 10); 
                     }
                 } else if (isMechActive && prevVy > 5 && player.grounded) {
                     spawnParticles(player.x + player.width/2, player.y + player.height, '#94a3b8', 5);
                     cameraRef.current.vy = 5; 
                 }
                 return;
             }
         }
      } else if (player.vy < 0) {
         for (let x = startX; x <= endX; x++) {
             const block = getBlock(x, startY);
             if (block !== BlockType.AIR && block !== BlockType.MECH_SUIT && block !== BlockType.DOOR_OPEN && block !== BlockType.LUMINARY) {
                 player.y = (startY + 1) * BLOCK_SIZE;
                 player.vy = 0;
                 return;
             }
         }
      }
  };

  // -- RENDER FUNCTION --
  const drawGame = (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, timestamp: number, isMoving: boolean = false, skyColor?: string, darknessAlpha?: number) => {
      if (skyColor) {
        ctx.fillStyle = skyColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const cx = cameraRef.current.x;
      const cy = cameraRef.current.y;
      const startCol = Math.max(0, Math.floor(cx / BLOCK_SIZE));
      const endCol = Math.min(WORLD_WIDTH, startCol + (canvas.width / BLOCK_SIZE) + 1);
      const startRow = Math.max(0, Math.floor(cy / BLOCK_SIZE));
      const endRow = Math.min(WORLD_HEIGHT, startRow + (canvas.height / BLOCK_SIZE) + 1);

      // Render Map
      for (let x = startCol; x <= endCol; x++) {
        for (let y = startRow; y <= endRow; y++) {
            const idx = y * WORLD_WIDTH + x;
            const type = worldRef.current[idx];
            const bgType = backgroundRef.current[idx];
            const xPos = Math.floor(x * BLOCK_SIZE - cx);
            const yPos = Math.floor(y * BLOCK_SIZE - cy);

            if (bgType !== BlockType.AIR && type === BlockType.AIR) {
                ctx.fillStyle = BLOCK_COLORS[bgType];
                ctx.globalAlpha = 0.6; 
                ctx.fillRect(xPos, yPos, BLOCK_SIZE, BLOCK_SIZE);
                ctx.globalAlpha = 1.0;
            }

            if (type !== BlockType.AIR) {
                if (type === BlockType.MECH_SUIT) {
                    drawMechSprite(ctx, xPos + BLOCK_SIZE/2 - MECH_WIDTH/2, yPos + BLOCK_SIZE - MECH_HEIGHT, MECH_WIDTH, MECH_HEIGHT, true, false, false, timestamp);
                } else if (type === BlockType.DOOR_CLOSED) {
                    // Check if Top or Bottom part
                    const isTop = worldRef.current[(y + 1) * WORLD_WIDTH + x] === BlockType.DOOR_CLOSED;
                    
                    ctx.fillStyle = '#475569'; // Frame
                    ctx.fillRect(xPos, yPos, BLOCK_SIZE, BLOCK_SIZE);
                    ctx.fillStyle = '#1e293b'; // Inner
                    // Top part window, Bottom part solid
                    if (isTop) {
                         ctx.fillRect(xPos + 4, yPos + 4, BLOCK_SIZE - 8, BLOCK_SIZE - 4); // Full frame top
                         ctx.fillStyle = '#334155'; // Window Glass
                         ctx.fillRect(xPos + 8, yPos + 8, BLOCK_SIZE - 16, BLOCK_SIZE - 16);
                    } else {
                         ctx.fillRect(xPos + 4, yPos, BLOCK_SIZE - 8, BLOCK_SIZE - 4);
                         // Handle
                         ctx.fillStyle = '#94a3b8';
                         ctx.fillRect(xPos + BLOCK_SIZE - 8, yPos + 10, 4, 8);
                         ctx.fillStyle = '#ef4444'; // Lock light
                         ctx.fillRect(xPos + BLOCK_SIZE - 8, yPos + 12, 2, 2);
                    }

                } else if (type === BlockType.DOOR_OPEN) {
                    const isTop = worldRef.current[(y + 1) * WORLD_WIDTH + x] === BlockType.DOOR_OPEN;
                    
                    ctx.fillStyle = '#475569';
                    ctx.fillRect(xPos, yPos, 6, BLOCK_SIZE);
                    
                    if (!isTop) {
                        ctx.fillStyle = '#22c55e'; // Open light
                        ctx.fillRect(xPos + 1, yPos + 12, 4, 4);
                    }
                } else if (type === BlockType.LUMINARY) {
                    // Draw Ceiling Light Fixture
                    ctx.fillStyle = '#475569'; // Base Gray
                    ctx.fillRect(xPos + 10, yPos, 12, 8); // Mount
                    ctx.fillStyle = '#fef08a'; // Bulb
                    ctx.fillRect(xPos + 12, yPos + 8, 8, 4);
                    
                    // Simple glow effect (visual only, actual lighting is in darkness overlay)
                    ctx.fillStyle = 'rgba(254, 240, 138, 0.2)';
                    ctx.fillRect(xPos + 8, yPos + 8, 16, 16);
                } else {
                    if (textureRefs.current[type] && textureRefs.current[type]?.complete) {
                        ctx.drawImage(textureRefs.current[type]!, xPos, yPos, BLOCK_SIZE, BLOCK_SIZE);
                    } else {
                        ctx.fillStyle = BLOCK_COLORS[type];
                        ctx.fillRect(xPos, yPos, BLOCK_SIZE, BLOCK_SIZE);
                    }

                    if (type === BlockType.NEON_ORE_BLUE || type === BlockType.NEON_ORE_PINK) {
                         ctx.fillStyle = 'rgba(255,255,255,0.2)';
                         ctx.fillRect(xPos + 8, yPos + 8, 4, 4);
                    }
                }
            }
            
            const mx = mouseRef.current.x + cx;
            const my = mouseRef.current.y + cy;
            const mBx = Math.floor(mx / BLOCK_SIZE);
            const mBy = Math.floor(my / BLOCK_SIZE);
            if (x === mBx && y === mBy && !isPaused && !isMapOpen) {
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.strokeRect(xPos, yPos, BLOCK_SIZE, BLOCK_SIZE);
            }
        }
      }

      // PLAYER RENDER
      if (mechAnimRef.current.active) {
          const p = playerRef.current;
          const screenX = Math.floor(p.x - cx);
          const screenY = Math.floor(p.y - cy);
          const progress = mechAnimRef.current.progress;
          
          ctx.save();
          ctx.fillStyle = '#0ea5e9';
          ctx.globalAlpha = 1 - progress;
          ctx.beginPath();
          ctx.arc(screenX + p.width/2, screenY + p.height/2, 20 + (progress * 50), 0, Math.PI * 2);
          ctx.fill();
          
          if (Math.random() > 0.5) {
              ctx.fillStyle = 'white';
              ctx.globalAlpha = 0.5;
              ctx.fillRect(screenX, screenY, p.width, p.height);
          }
          ctx.restore();
      } else {
           const p = playerRef.current;
           const screenX = Math.floor(p.x - cx);
           const screenY = Math.floor(p.y - cy);

           if (isMechActive) {
                const isShooting = mouseRef.current.down && mouseRef.current.button === 0;
                drawMechSprite(ctx, screenX, screenY, p.width, p.height, p.facingRight, isMoving, isShooting, timestamp);
           } else {
                const isAction = (mouseRef.current.down && mouseRef.current.button === 0) || keysRef.current['KeyX'];
                drawHumanSprite(ctx, screenX, screenY, p.width, p.height, p.facingRight, isMoving, isAction, selectedBlock, timestamp);
           }
      }

      // Projectiles
      for (const proj of projectilesRef.current) {
          ctx.fillStyle = proj.color;
          ctx.beginPath();
          ctx.arc(proj.x - cx, proj.y - cy, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(250, 204, 21, 0.3)';
          ctx.beginPath();
          ctx.arc(proj.x - cx - proj.vx*2, proj.y - cy - proj.vy*2, 2, 0, Math.PI * 2);
          ctx.fill();
      }

      // Particles
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.life -= 0.05;
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
        } else {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.fillRect(p.x - cx, p.y - cy, 4, 4);
          ctx.globalAlpha = 1.0;
        }
      }

      // Darkness Overlay (FIX: Using offscreen canvas to prevent erasing game world)
      if (darknessAlpha !== undefined && lightingCanvasRef.current) {
         const lCanvas = lightingCanvasRef.current;
         const lCtx = lCanvas.getContext('2d');
         
         if (lCtx) {
             lCanvas.width = canvas.width;
             lCanvas.height = canvas.height;
             
             // 1. Fill darkness
             lCtx.fillStyle = `rgba(0, 0, 5, ${darknessAlpha})`;
             lCtx.fillRect(0, 0, lCanvas.width, lCanvas.height);
             
             // Setup for "cutting out" lights
             lCtx.globalCompositeOperation = 'destination-out';
             
             // 2. Cut hole for player
             const px = playerRef.current.x + playerRef.current.width/2 - cx;
             const py = playerRef.current.y + playerRef.current.height/2 - cy;
             const radius = isMechActive ? 300 : 150;
             
             const gradient = lCtx.createRadialGradient(px, py, 20, px, py, radius);
             gradient.addColorStop(0, 'rgba(0,0,0,1)');
             gradient.addColorStop(1, 'rgba(0,0,0,0)');
             
             lCtx.fillStyle = gradient;
             lCtx.beginPath();
             lCtx.arc(px, py, radius, 0, Math.PI*2);
             lCtx.fill();

             // 3. Cut holes for Luminaries (Light Sources)
             // Iterate only through visible blocks to be efficient
             const range = 15; // Extra padding
             for (let x = startCol - range; x <= endCol + range; x++) {
                 for (let y = startRow - range; y <= endRow + range; y++) {
                     if (x >= 0 && x < WORLD_WIDTH && y >= 0 && y < WORLD_HEIGHT) {
                         const idx = y * WORLD_WIDTH + x;
                         if (worldRef.current[idx] === BlockType.LUMINARY) {
                             const lx = x * BLOCK_SIZE + BLOCK_SIZE/2 - cx;
                             const ly = y * BLOCK_SIZE + BLOCK_SIZE/2 - cy;
                             const lightRadius = 150;

                             const lGrad = lCtx.createRadialGradient(lx, ly, 10, lx, ly, lightRadius);
                             lGrad.addColorStop(0, 'rgba(0,0,0,0.9)');
                             lGrad.addColorStop(1, 'rgba(0,0,0,0)');
                             
                             lCtx.fillStyle = lGrad;
                             lCtx.beginPath();
                             lCtx.arc(lx, ly, lightRadius, 0, Math.PI*2);
                             lCtx.fill();
                         }
                     }
                 }
             }
             
             // Reset comp op
             lCtx.globalCompositeOperation = 'source-over';
             
             // 3. Draw lighting canvas on top of main canvas
             ctx.drawImage(lCanvas, 0, 0);
         }
      }
      
      drawMinimap(canvas);
  };
  
  const drawMinimap = (mainCanvas: HTMLCanvasElement) => {
      const minimap = minimapCanvasRef.current;
      const fullmap = mapCanvasRef.current;
      
      if (!hasMapUpgrade) return;
      
      const p = playerRef.current;

      if (minimap) {
        const mCtx = minimap.getContext('2d');
        if (mCtx) {
            mCtx.fillStyle = '#0f172a';
            mCtx.fillRect(0, 0, minimap.width, minimap.height);
            
            const rangeX = (minimap.width / MINIMAP_ZOOM) / 2;
            const rangeY = (minimap.height / MINIMAP_ZOOM) / 2;
            
            const pBx = Math.floor(p.x / BLOCK_SIZE);
            const pBy = Math.floor(p.y / BLOCK_SIZE);
            
            for(let y = pBy - rangeY; y < pBy + rangeY; y++) {
                for(let x = pBx - rangeX; x < pBx + rangeX; x++) {
                    if(x >=0 && x < WORLD_WIDTH && y >= 0 && y < WORLD_HEIGHT) {
                        const idx = Math.floor(y) * WORLD_WIDTH + Math.floor(x);
                        if(visitedRef.current[idx]) {
                             const type = worldRef.current[idx];
                             if (type !== BlockType.AIR) {
                                 mCtx.fillStyle = MAP_COLORS[type] || '#fff';
                                 mCtx.fillRect((x - (pBx - rangeX)) * MINIMAP_ZOOM, (y - (pBy - rangeY)) * MINIMAP_ZOOM, MINIMAP_ZOOM, MINIMAP_ZOOM);
                             }
                        }
                    }
                }
            }
            mCtx.fillStyle = '#ef4444';
            mCtx.fillRect(minimap.width/2 - 2, minimap.height/2 - 2, 4, 4);
        }
      }

      if (isMapOpen && fullmap) {
          const fCtx = fullmap.getContext('2d');
          if (fCtx) {
            fCtx.fillStyle = '#020617';
            fCtx.fillRect(0, 0, fullmap.width, fullmap.height);
            
            const scale = FULLMAP_ZOOM;
            const mapW = fullmap.width / scale;
            const mapH = fullmap.height / scale;
            
            const startX = Math.floor(p.x / BLOCK_SIZE - mapW/2);
            const startY = Math.floor(p.y / BLOCK_SIZE - mapH/2);
            
            for(let y = 0; y < mapH; y++) {
                for(let x = 0; x < mapW; x++) {
                     const worldX = startX + x;
                     const worldY = startY + y;
                     
                     if (worldX >= 0 && worldX < WORLD_WIDTH && worldY >=0 && worldY < WORLD_HEIGHT) {
                         const idx = worldY * WORLD_WIDTH + worldX;
                         if (visitedRef.current[idx]) {
                             const type = worldRef.current[idx];
                             if (type !== BlockType.AIR) {
                                 fCtx.fillStyle = MAP_COLORS[type];
                                 fCtx.fillRect(x * scale, y * scale, scale, scale);
                             }
                         } else {
                             fCtx.fillStyle = '#000';
                             fCtx.fillRect(x * scale, y * scale, scale, scale);
                         }
                     }
                }
            }
            
            fCtx.fillStyle = '#ef4444';
            fCtx.beginPath();
            fCtx.arc(fullmap.width/2, fullmap.height/2, 4, 0, Math.PI*2);
            fCtx.fill();
            
            fCtx.strokeStyle = 'rgba(34, 211, 238, 0.1)';
            fCtx.lineWidth = 1;
            fCtx.beginPath();
            for(let i=0; i<fullmap.width; i+=100) { fCtx.moveTo(i,0); fCtx.lineTo(i, fullmap.height); }
            for(let i=0; i<fullmap.height; i+=100) { fCtx.moveTo(0,i); fCtx.lineTo(fullmap.width, i); }
            fCtx.stroke();
          }
      }
  };

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
      if (mapCanvasRef.current) {
        mapCanvasRef.current.width = window.innerWidth - 100;
        mapCanvasRef.current.height = window.innerHeight - 100;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    animationRef.current = requestAnimationFrame(update);

    const handleMouseDown = (e: MouseEvent) => {
        mouseRef.current.down = true;
        mouseRef.current.button = e.button;
        mouseRef.current.x = e.clientX;
        mouseRef.current.y = e.clientY;
    };
    const handleMouseUp = () => {
        mouseRef.current.down = false;
    };
    const handleMouseMove = (e: MouseEvent) => {
        mouseRef.current.x = e.clientX;
        mouseRef.current.y = e.clientY;
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
        keysRef.current[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        keysRef.current[e.code] = false;
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationRef.current);
    };
  }, [update]);

  return (
    <>
      <canvas ref={canvasRef} className="block" />
      
      {/* HUD Minimap */}
      {hasMapUpgrade && !isMapOpen && (
          <div className="absolute top-4 right-4 border-2 border-slate-700 bg-black shadow-lg rounded-lg overflow-hidden opacity-90 z-20">
              <canvas ref={minimapCanvasRef} width={MINIMAP_SIZE} height={MINIMAP_SIZE} />
              <div className="absolute bottom-1 right-1 text-[10px] text-slate-500 font-mono">GPS: {Math.floor(playerRef.current.x / BLOCK_SIZE)}, {Math.floor(playerRef.current.y / BLOCK_SIZE)}</div>
          </div>
      )}

      {/* Full Map Modal */}
      {isMapOpen && hasMapUpgrade && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-10 animate-in fade-in duration-200">
              <div className="relative border border-cyan-500/30 rounded-lg shadow-[0_0_50px_rgba(6,182,212,0.1)] overflow-hidden bg-slate-950">
                   <div className="absolute top-4 left-4 text-cyan-500 font-bold tracking-widest text-xl flex items-center gap-2">
                       <div className="w-3 h-3 bg-red-500 animate-pulse rounded-full"></div>
                       SISTEMA DE MAPEAMENTO GLOBAL
                   </div>
                   <canvas ref={mapCanvasRef} />
              </div>
          </div>
      )}
    </>
  );
};