

import { BlockType, Recipe } from './types';

export const CHUNK_SIZE = 16; 
export const WORLD_WIDTH = 10000; // 10k blocks wide
export const WORLD_HEIGHT = 5000; // 5k blocks tall
export const BLOCK_SIZE = 32;

export const GRAVITY = 0.5;
export const FRICTION = 0.8;
export const MOVE_SPEED = 0.6;
export const JUMP_FORCE = -8.5;

// Mech Stats (Updated for Giant Size)
// Player is 20x40. Mech should be roughly 3x larger (~60x120)
export const MECH_WIDTH = 70;
export const MECH_HEIGHT = 120;
export const MECH_MOVE_SPEED = 1.0; // Slower, heavier feel
export const MECH_JUMP_FORCE = -14.0; // Needs more force to lift weight
export const MECH_GRAVITY = 0.4;
export const PROJECTILE_SPEED = 20;
export const PROJECTILE_LIFE = 80; // Frames

// Health & Damage
export const FALL_DAMAGE_THRESHOLD = 12.0; 
export const FALL_DAMAGE_MULTIPLIER = 5.0;
export const INITIAL_HEALTH = 100;
export const MAX_POSSIBLE_HEALTH = 500;
export const HEALTH_UPGRADE_INCREMENT = 50;

// Day/Night Cycle (15 minutes in ms)
export const DAY_NIGHT_CYCLE_DURATION = 15 * 60 * 1000; 

// Map & Exploration
export const EXPLORATION_RADIUS = 25; // Blocks around player to reveal
export const MINIMAP_SIZE = 200; // Pixel size of minimap container
export const MINIMAP_ZOOM = 4; // Pixels per block in minimap
export const FULLMAP_ZOOM = 2; // Pixels per block in full map

// Hotbar
export const INITIAL_HOTBAR_SLOTS = 5;
export const MAX_HOTBAR_SLOTS = 9;

// Costs
export const UPGRADE_COST = {
  [BlockType.NEON_ORE_PINK]: 5,
  [BlockType.CIRCUIT_SCRAP]: 5,
};

export const HOTBAR_EXPANSION_COST = {
  [BlockType.CIRCUIT_SCRAP]: 20,
  [BlockType.NEON_ORE_BLUE]: 10,
};

export const MAP_UPGRADE_COST = {
  [BlockType.CIRCUIT_SCRAP]: 10,
  [BlockType.NEON_ORE_PINK]: 5, // CHANGED FROM BLUE TO PINK FOR EASIER ACCESS
};

// --- MINING SYSTEM ---

// Defines the minimum tool tier required to break a block
export const MINING_TIERS: Partial<Record<BlockType, number>> = {
    [BlockType.SEWER_BRICK]: 2,
    [BlockType.PIPE_RUSTY]: 2,
    [BlockType.SLUDGE]: 2,
    [BlockType.CYBER_WALL]: 99, // Indestructible
    [BlockType.MECH_SUIT]: 1,
    [BlockType.WORKBENCH]: 1,
    // Default for others is 1 (Basic Pickaxe)
};

// Defines the tier of a tool
export const TOOL_TIERS: Partial<Record<BlockType, number>> = {
    [BlockType.PICKAXE]: 1,
    [BlockType.ADVANCED_PICKAXE]: 2,
};

export const BLOCK_COLORS: Record<BlockType, string> = {
  [BlockType.AIR]: 'transparent',
  [BlockType.CONCRETE]: '#334155', // Slate 700
  [BlockType.RUSTED_METAL]: '#78350f', // Amber 900
  [BlockType.NEON_ORE_BLUE]: '#0ea5e9', // Sky 500 (glowing)
  [BlockType.NEON_ORE_PINK]: '#d946ef', // Fuchsia 500 (glowing)
  [BlockType.CIRCUIT_SCRAP]: '#22c55e', // Green 500
  [BlockType.CYBER_WALL]: '#1e293b', // Slate 800 with border
  [BlockType.GLASS_PANE]: 'rgba(148, 163, 184, 0.3)', // Slate 400 transparent
  [BlockType.REACTOR_CORE]: '#ef4444', // Red 500
  [BlockType.LADDER]: '#fbbf24', // Amber 400
  [BlockType.SEWER_BRICK]: '#3f6212', // Lime 800 (Dark Mossy)
  [BlockType.SLUDGE]: '#84cc16', // Lime 500 (Toxic Green)
  [BlockType.PIPE_RUSTY]: '#a16207', // Yellow 700 (Darker Rust)
  [BlockType.SKYSCRAPER_FRAME]: '#020617', // Slate 950 (Black structure)
  [BlockType.BG_WINDOW]: '#1e293b', // Slate 800 (Dark background windows)
  [BlockType.WORKBENCH]: '#f97316', // Orange 500 (Industrial)
  [BlockType.MECH_SUIT]: '#475569', // Slate 600 (Base Color for item)
  [BlockType.AMMO_PACK]: '#facc15', // Yellow 400
  [BlockType.DOOR_CLOSED]: '#64748b', // Slate 500
  [BlockType.DOOR_OPEN]: 'rgba(100, 116, 139, 0.2)', // Slate 500 transparent
  [BlockType.LUMINARY]: '#fef08a', // Yellow 200 (Light source)
  [BlockType.PICKAXE]: '#22d3ee', // Cyan 400 (Energy Tool)
  [BlockType.ADVANCED_PICKAXE]: '#a855f7', // Purple 500 (Advanced Tool)
};

// Simplified colors for map rendering (faster)
export const MAP_COLORS: Record<BlockType, string> = {
  [BlockType.AIR]: '#000000',
  [BlockType.CONCRETE]: '#475569',
  [BlockType.RUSTED_METAL]: '#451a03',
  [BlockType.NEON_ORE_BLUE]: '#0ea5e9',
  [BlockType.NEON_ORE_PINK]: '#d946ef',
  [BlockType.CIRCUIT_SCRAP]: '#22c55e',
  [BlockType.CYBER_WALL]: '#0f172a',
  [BlockType.GLASS_PANE]: '#94a3b8',
  [BlockType.REACTOR_CORE]: '#ef4444',
  [BlockType.LADDER]: '#fbbf24',
  [BlockType.SEWER_BRICK]: '#1a2e05',
  [BlockType.SLUDGE]: '#65a30d',
  [BlockType.PIPE_RUSTY]: '#854d0e',
  [BlockType.SKYSCRAPER_FRAME]: '#020617',
  [BlockType.BG_WINDOW]: '#1e293b',
  [BlockType.WORKBENCH]: '#f97316',
  [BlockType.MECH_SUIT]: '#64748b',
  [BlockType.AMMO_PACK]: '#facc15',
  [BlockType.DOOR_CLOSED]: '#94a3b8',
  [BlockType.DOOR_OPEN]: '#1e293b',
  [BlockType.LUMINARY]: '#fef08a',
  [BlockType.PICKAXE]: '#22d3ee',
  [BlockType.ADVANCED_PICKAXE]: '#a855f7',
};

export const BLOCK_NAMES: Record<BlockType, string> = {
  [BlockType.AIR]: 'Mão Vazia',
  [BlockType.CONCRETE]: 'Laje de Concreto',
  [BlockType.RUSTED_METAL]: 'Metal Ferrugento',
  [BlockType.NEON_ORE_BLUE]: 'Neon Ciano',
  [BlockType.NEON_ORE_PINK]: 'Neon Magenta',
  [BlockType.CIRCUIT_SCRAP]: 'Sucata de Circuitos',
  [BlockType.CYBER_WALL]: 'Parede Reforçada',
  [BlockType.GLASS_PANE]: 'Polividro',
  [BlockType.REACTOR_CORE]: 'Núcleo de Reator',
  [BlockType.LADDER]: 'Escada Mag',
  [BlockType.SEWER_BRICK]: 'Tijolo de Esgoto',
  [BlockType.SLUDGE]: 'Lodo Tóxico',
  [BlockType.PIPE_RUSTY]: 'Tubulação Enferrujada',
  [BlockType.SKYSCRAPER_FRAME]: 'Viga de Aço',
  [BlockType.BG_WINDOW]: 'Fundo: Janelas',
  [BlockType.WORKBENCH]: 'Workbench Pesada',
  [BlockType.MECH_SUIT]: 'Unidade M.E.C.H. (Colocável)',
  [BlockType.AMMO_PACK]: 'Célula de Energia (Munição)',
  [BlockType.DOOR_CLOSED]: 'Porta Reforçada (Fechada)',
  [BlockType.DOOR_OPEN]: 'Porta Reforçada (Aberta)',
  [BlockType.LUMINARY]: 'Luminária Industrial',
  [BlockType.PICKAXE]: 'Picareta Laser (Tier 1)',
  [BlockType.ADVANCED_PICKAXE]: 'Picareta de Plasma (Tier 2)',
};

export const ITEM_DESCRIPTIONS: Record<BlockType, string> = {
  [BlockType.AIR]: 'Selecione para interagir sem colocar blocos.',
  [BlockType.CONCRETE]: 'Material básico de construção das favelas verticais.',
  [BlockType.RUSTED_METAL]: 'Corroído pela chuva ácida, mas ainda resistente.',
  [BlockType.NEON_ORE_BLUE]: 'Isótopos instáveis que brilham em ciano.',
  [BlockType.NEON_ORE_PINK]: 'Gás ionizado cristalizado. Alta voltagem.',
  [BlockType.CIRCUIT_SCRAP]: 'Restos de andróides e terminais antigos.',
  [BlockType.CYBER_WALL]: 'Placas de blindagem militar roubadas. Indestrutível.',
  [BlockType.GLASS_PANE]: 'Vidro temperado sintético.',
  [BlockType.REACTOR_CORE]: 'Fonte de energia instável. Manuseie com cuidado.',
  [BlockType.LADDER]: 'Escada com fixadores magnéticos.',
  [BlockType.SEWER_BRICK]: 'Tijolos úmidos e densos. Requer Picareta Tier 2.',
  [BlockType.SLUDGE]: 'Resíduo industrial tóxico. Requer Picareta Tier 2.',
  [BlockType.PIPE_RUSTY]: 'Liga metálica antiga e dura. Requer Picareta Tier 2.',
  [BlockType.SKYSCRAPER_FRAME]: 'Vigas reforçadas de mega-edifícios.',
  [BlockType.BG_WINDOW]: 'Janelas de fundo de um arranha-céu.',
  [BlockType.WORKBENCH]: 'Estação de trabalho para engenharia pesada e robótica.',
  [BlockType.MECH_SUIT]: 'Chassi de combate pesado. Coloque no chão para pilotar.',
  [BlockType.AMMO_PACK]: 'Bateria de plasma condensado para armamento pesado.',
  [BlockType.DOOR_CLOSED]: 'Bloqueio de segurança. Ocupa 2 blocos de altura.',
  [BlockType.DOOR_OPEN]: 'Passagem liberada.',
  [BlockType.LUMINARY]: 'Emite luz artificial. Deve ser fixada no teto.',
  [BlockType.PICKAXE]: 'Minera recursos básicos (Concreto, Metal, Neon).',
  [BlockType.ADVANCED_PICKAXE]: 'Feixe concentrado. Minera materiais densos do esgoto (Tijolos, Tubos).',
};

export const RECIPES: Recipe[] = [
  {
    result: BlockType.ADVANCED_PICKAXE,
    yield: 1,
    ingredients: [
      { type: BlockType.PICKAXE, count: 1 },
      { type: BlockType.NEON_ORE_PINK, count: 10 },
      { type: BlockType.CIRCUIT_SCRAP, count: 5 },
      { type: BlockType.RUSTED_METAL, count: 20 },
    ]
  },
  {
    result: BlockType.WORKBENCH,
    yield: 1,
    ingredients: [
      { type: BlockType.RUSTED_METAL, count: 10 },
      { type: BlockType.CIRCUIT_SCRAP, count: 5 },
      { type: BlockType.CONCRETE, count: 5 },
    ]
  },
  {
    result: BlockType.DOOR_CLOSED,
    yield: 1,
    ingredients: [
      { type: BlockType.RUSTED_METAL, count: 4 },
      { type: BlockType.CIRCUIT_SCRAP, count: 1 },
    ]
  },
  {
    result: BlockType.LUMINARY,
    yield: 2,
    ingredients: [
      { type: BlockType.GLASS_PANE, count: 1 },
      { type: BlockType.CIRCUIT_SCRAP, count: 1 },
      { type: BlockType.NEON_ORE_BLUE, count: 1 },
    ]
  },
  {
    result: BlockType.AMMO_PACK,
    yield: 20,
    ingredients: [
      { type: BlockType.RUSTED_METAL, count: 2 },
      { type: BlockType.NEON_ORE_BLUE, count: 1 },
    ]
  },
  {
    result: BlockType.CYBER_WALL,
    yield: 4,
    ingredients: [
      { type: BlockType.CONCRETE, count: 2 },
      { type: BlockType.RUSTED_METAL, count: 1 },
    ],
  },
  {
    result: BlockType.GLASS_PANE,
    yield: 2,
    ingredients: [
      { type: BlockType.NEON_ORE_BLUE, count: 1 },
    ],
  },
  {
    result: BlockType.REACTOR_CORE,
    yield: 1,
    ingredients: [
      { type: BlockType.RUSTED_METAL, count: 5 },
      { type: BlockType.CIRCUIT_SCRAP, count: 2 },
      { type: BlockType.NEON_ORE_PINK, count: 2 },
    ],
  },
  {
    result: BlockType.LADDER,
    yield: 3,
    ingredients: [
      { type: BlockType.RUSTED_METAL, count: 2 },
    ],
  },
  {
    result: BlockType.PIPE_RUSTY,
    yield: 2,
    ingredients: [
      { type: BlockType.RUSTED_METAL, count: 2 },
    ],
  },
  {
    result: BlockType.SKYSCRAPER_FRAME,
    yield: 10,
    ingredients: [
      { type: BlockType.CONCRETE, count: 5 },
      { type: BlockType.RUSTED_METAL, count: 5 },
    ],
  },
];

export const MECH_RECIPES: Recipe[] = [
  {
    result: BlockType.MECH_SUIT,
    yield: 1,
    ingredients: [
      { type: BlockType.SKYSCRAPER_FRAME, count: 20 },
      { type: BlockType.CYBER_WALL, count: 10 },
      { type: BlockType.REACTOR_CORE, count: 1 },
      { type: BlockType.CIRCUIT_SCRAP, count: 20 },
      { type: BlockType.NEON_ORE_BLUE, count: 10 },
    ]
  },
  {
    result: BlockType.REACTOR_CORE,
    yield: 1,
    ingredients: [
        { type: BlockType.NEON_ORE_PINK, count: 5 },
        { type: BlockType.CIRCUIT_SCRAP, count: 5 },
        { type: BlockType.RUSTED_METAL, count: 10 }
    ]
  }
];