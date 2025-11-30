

export enum BlockType {
  AIR = 0,
  CONCRETE = 1,
  RUSTED_METAL = 2,
  NEON_ORE_BLUE = 3,
  NEON_ORE_PINK = 4,
  CIRCUIT_SCRAP = 5,
  CYBER_WALL = 6,
  GLASS_PANE = 7,
  REACTOR_CORE = 8,
  LADDER = 9,
  SEWER_BRICK = 10,
  SLUDGE = 11,
  PIPE_RUSTY = 12,
  SKYSCRAPER_FRAME = 13,
  BG_WINDOW = 14,
  WORKBENCH = 15,
  MECH_SUIT = 16,
  AMMO_PACK = 17,
  DOOR_CLOSED = 18,
  DOOR_OPEN = 19,
  LUMINARY = 20,
  PICKAXE = 21,
  ADVANCED_PICKAXE = 22
}

export interface InventoryItem {
  blockType: BlockType;
  count: number;
}

export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  grounded: boolean;
  facingRight: boolean;
}

export interface Camera {
  x: number;
  y: number;
  vx: number;
  vy: number; // Added camera velocity for shake effects
}

export interface Recipe {
  result: BlockType;
  yield: number;
  ingredients: { type: BlockType; count: number }[];
}

export interface GameState {
  inventory: Record<number, number>; // BlockType -> count
  selectedBlock: BlockType;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export interface SaveData {
    inventory: Record<number, number>;
    health: number;
    maxHealth: number;
    playerX: number;
    playerY: number;
    hasMapUpgrade: boolean;
    isMechActive: boolean;
    godMode: boolean;
    timestamp: number;
}

export interface GameEngineProps {
  selectedBlock: BlockType;
  onInventoryUpdate: (block: BlockType, amount: number) => void;
  inventory: Record<number, number>; 
  onDamage: (amount: number) => void;
  onOpenWorkbench: () => void;
  onToggleMech: (isActive: boolean) => void;
  respawnTrigger: number;
  resetGameTrigger: number; // New trigger for full reset
  saveTrigger: number; // Trigger to extract data for saving
  onSaveDataReady: (playerX: number, playerY: number) => void; // Callback with data
  initialPlayerPos?: { x: number, y: number }; // For loading
  isMapOpen: boolean;
  hasMapUpgrade: boolean;
  godMode: boolean;
  isMechActive: boolean;
  isPaused: boolean; // Pause state
  forcedTime?: number; // 0.0 to 1.0 representing cycle progress (Optional)
}

export interface NetrunnerAIProps {
  isOpen: boolean;
  onClose: () => void;
  onCheat: (code: string) => void;
}