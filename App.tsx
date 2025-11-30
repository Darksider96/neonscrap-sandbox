import React, { useState, useCallback, useEffect, useRef } from 'react';
import { GameEngine } from './components/GameEngine';
import { NetrunnerAI } from './components/UI/NetrunnerAI';
import { BlockType, Recipe, SaveData } from './types';
import { 
  BLOCK_NAMES, 
  BLOCK_COLORS, 
  RECIPES, 
  MECH_RECIPES,
  ITEM_DESCRIPTIONS, 
  INITIAL_HEALTH, 
  MAX_POSSIBLE_HEALTH, 
  HEALTH_UPGRADE_INCREMENT,
  UPGRADE_COST,
  MAP_UPGRADE_COST,
  INITIAL_HOTBAR_SLOTS,
  MAX_HOTBAR_SLOTS,
  HOTBAR_EXPANSION_COST
} from './constants';
import { Hammer, Backpack, Cpu, Pickaxe, X, Grid, Heart, Shield, ArrowUpCircle, Map as MapIcon, Globe, Zap, Wrench, Bot, Crosshair, Play, RefreshCw, Power, Save, Download, Lock, Plus } from 'lucide-react';

// Player starts with a Pickaxe
const INITIAL_INVENTORY: Record<number, number> = {
    [BlockType.PICKAXE]: 1
};

interface CollectionNotification {
    type: BlockType;
    count: number;
    timestamp: number;
}

export default function App() {
  const [inventory, setInventory] = useState<Record<number, number>>(INITIAL_INVENTORY);
  
  // Hotbar State
  const [hotbar, setHotbar] = useState<(BlockType | null)[]>(new Array(MAX_HOTBAR_SLOTS).fill(null));
  const [activeSlot, setActiveSlot] = useState(0);
  const [unlockedSlots, setUnlockedSlots] = useState(INITIAL_HOTBAR_SLOTS);
  
  // Game Stats
  const [health, setHealth] = useState(INITIAL_HEALTH);
  const [maxHealth, setMaxHealth] = useState(INITIAL_HEALTH);
  const [respawnTrigger, setRespawnTrigger] = useState(0);
  const [resetGameTrigger, setResetGameTrigger] = useState(0); // Triggers world regeneration
  const [hasMapUpgrade, setHasMapUpgrade] = useState(false);
  const [godMode, setGodMode] = useState(false);
  const [isMechActive, setIsMechActive] = useState(false);
  
  const [forcedTime, setForcedTime] = useState<number | undefined>(undefined);

  // Save/Load Logic
  const [saveTrigger, setSaveTrigger] = useState(0); // Trigger GameEngine to export data
  const [initialPlayerPos, setInitialPlayerPos] = useState<{x: number, y: number} | undefined>(undefined);
  const [saveNotification, setSaveNotification] = useState(false);

  // Collection Notifications
  const [collectionNotifications, setCollectionNotifications] = useState<CollectionNotification[]>([]);

  // UI States
  const [isMenuOpen, setIsMenuOpen] = useState(true); // START IN MENU
  const [gameStarted, setGameStarted] = useState(false); // Has the player started a game yet?

  const [isCraftingOpen, setIsCraftingOpen] = useState(false);
  const [isWorkbenchOpen, setIsWorkbenchOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Item Holding (Assignment Mode) - Kept for fallback click interactions
  const [heldItemType, setHeldItemType] = useState<BlockType | null>(null);

  // Derived selected block from hotbar
  const selectedBlock = hotbar[activeSlot] || BlockType.AIR;

  // Cleanup Notifications
  useEffect(() => {
    const interval = setInterval(() => {
        const now = Date.now();
        setCollectionNotifications(prev => prev.filter(n => now - n.timestamp < 3000));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((document.activeElement as HTMLElement)?.tagName === 'INPUT') return;

      // Hotbar Numbers 1-9
      if (e.code.startsWith('Digit') && !isMenuOpen) {
          const slot = parseInt(e.key) - 1;
          if (slot >= 0 && slot < unlockedSlots) {
              setActiveSlot(slot);
          }
      }

      switch(e.code) {
        case 'KeyE':
          if (!isMechActive && !isMenuOpen) {
            setIsCraftingOpen(prev => !prev);
            setIsInventoryOpen(false); 
            setIsMapOpen(false);
            setIsWorkbenchOpen(false);
          }
          break;
        case 'KeyI':
          if (!isMenuOpen) {
            setIsInventoryOpen(prev => !prev);
            setIsCraftingOpen(false);
            setIsMapOpen(false);
            setIsWorkbenchOpen(false);
            setHeldItemType(null); // Reset held item when toggling
          }
          break;
        case 'KeyM':
          if (hasMapUpgrade && !isMenuOpen) {
              setIsMapOpen(prev => !prev);
              setIsInventoryOpen(false);
              setIsCraftingOpen(false);
              setIsWorkbenchOpen(false);
          }
          break;
        case 'Escape':
          // Toggle Menu
          if (gameStarted) {
             setIsMenuOpen(prev => !prev);
             // Close other windows if opening menu
             if (!isMenuOpen) {
                setIsCraftingOpen(false);
                setIsInventoryOpen(false);
                setIsAiOpen(false);
                setIsMapOpen(false);
                setIsWorkbenchOpen(false);
                setHeldItemType(null);
             }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasMapUpgrade, isMechActive, isMenuOpen, gameStarted, unlockedSlots]); 

  // --- MENU HANDLERS ---
  const handleNewGame = () => {
      setInventory(INITIAL_INVENTORY);
      setHotbar(new Array(MAX_HOTBAR_SLOTS).fill(null));
      setUnlockedSlots(INITIAL_HOTBAR_SLOTS);
      setActiveSlot(0);
      setHealth(INITIAL_HEALTH);
      setMaxHealth(INITIAL_HEALTH);
      setHasMapUpgrade(false);
      setGodMode(false);
      setIsMechActive(false);
      setGameStarted(true);
      setIsMenuOpen(false);
      setInitialPlayerPos(undefined);
      setResetGameTrigger(prev => prev + 1); // Regenerate world
  };

  const handleContinue = () => {
      if (gameStarted) {
          setIsMenuOpen(false);
      }
  };

  // Trigger save process
  const handleSaveGame = () => {
    if (gameStarted) {
        setSaveTrigger(prev => prev + 1);
    }
  };

  // Receive Data from Engine and Persist
  const onSaveDataReady = (playerX: number, playerY: number) => {
      const saveData: SaveData = {
          inventory,
          health,
          maxHealth,
          playerX,
          playerY,
          hasMapUpgrade,
          isMechActive,
          godMode,
          timestamp: Date.now()
      };
      
      try {
          localStorage.setItem('neonscrap_save', JSON.stringify(saveData));
          setSaveNotification(true);
          setTimeout(() => setSaveNotification(false), 3000);
      } catch (e) {
          console.error("Save failed", e);
      }
  };

  const handleLoadGame = () => {
      try {
          const raw = localStorage.getItem('neonscrap_save');
          if (!raw) return;
          
          const data: SaveData = JSON.parse(raw);
          
          // Hydrate State
          setInventory(data.inventory);
          setHealth(data.health);
          setMaxHealth(data.maxHealth);
          setHasMapUpgrade(data.hasMapUpgrade);
          setIsMechActive(data.isMechActive);
          setGodMode(data.godMode);
          
          // Reset Hotbar on load (since we didn't save it in interface yet, or keep defaults)
          setHotbar(new Array(MAX_HOTBAR_SLOTS).fill(null));
          setUnlockedSlots(INITIAL_HOTBAR_SLOTS);

          // Set Initial Pos for Engine
          setInitialPlayerPos({ x: data.playerX, y: data.playerY });
          
          setGameStarted(true);
          setIsMenuOpen(false);
          setResetGameTrigger(prev => prev + 1); // Triggers re-render/reset with new initialPos
          
      } catch (e) {
          console.error("Load failed", e);
      }
  };

  const handleExit = () => {
      window.location.reload(); // Simple reload to "Exit"
  };

  const handleInventoryUpdate = useCallback((block: BlockType, amount: number) => {
    // Inventory Logic
    setInventory(prev => {
      const newCount = (prev[block] || 0) + amount;
      if (newCount <= 0) {
        const { [block]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [block]: newCount };
    });

    // Notification Logic (Only for additions)
    if (amount > 0) {
        setCollectionNotifications(prev => {
            const existingIndex = prev.findIndex(n => n.type === block);
            if (existingIndex >= 0) {
                // Stack existing
                const newArr = [...prev];
                newArr[existingIndex] = {
                    ...newArr[existingIndex],
                    count: newArr[existingIndex].count + amount,
                    timestamp: Date.now()
                };
                return newArr;
            } else {
                // Add new
                return [...prev, { type: block, count: amount, timestamp: Date.now() }];
            }
        });
    }
  }, []);

  const handleDamage = useCallback((amount: number) => {
      if (godMode) return; 

      setHealth(prev => {
          const newHealth = prev - amount;
          if (newHealth <= 0) {
              setRespawnTrigger(t => t + 1);
              setIsMechActive(false); 
              return maxHealth; 
          }
          return newHealth;
      });
  }, [maxHealth, godMode]);

  const handleCheat = useCallback((code: string) => {
      if (code === 'nane') {
          setGodMode(true);
          setHealth(maxHealth); 
      }
      if (code === 'normal') {
          setGodMode(false);
      }
      if (code === 'day') setForcedTime(0.5); 
      if (code === 'night') setForcedTime(0.0); 
  }, [maxHealth]);

  const handleUpgradeHealth = () => {
    if (maxHealth >= MAX_POSSIBLE_HEALTH) return;
    const neonCost = UPGRADE_COST[BlockType.NEON_ORE_PINK];
    const circuitCost = UPGRADE_COST[BlockType.CIRCUIT_SCRAP];
    const hasNeon = (inventory[BlockType.NEON_ORE_PINK] || 0) >= neonCost;
    const hasCircuits = (inventory[BlockType.CIRCUIT_SCRAP] || 0) >= circuitCost;

    if (hasNeon && hasCircuits) {
        handleInventoryUpdate(BlockType.NEON_ORE_PINK, -neonCost);
        handleInventoryUpdate(BlockType.CIRCUIT_SCRAP, -circuitCost);
        setMaxHealth(prev => Math.min(prev + HEALTH_UPGRADE_INCREMENT, MAX_POSSIBLE_HEALTH));
        setHealth(prev => Math.min(prev + HEALTH_UPGRADE_INCREMENT, MAX_POSSIBLE_HEALTH)); 
    }
  };

  const handleBuyMap = () => {
      if (hasMapUpgrade) return;
      const circuitCost = MAP_UPGRADE_COST[BlockType.CIRCUIT_SCRAP];
      const neonPinkCost = MAP_UPGRADE_COST[BlockType.NEON_ORE_PINK];
      const hasCircuits = (inventory[BlockType.CIRCUIT_SCRAP] || 0) >= circuitCost;
      const hasNeonPink = (inventory[BlockType.NEON_ORE_PINK] || 0) >= neonPinkCost;

      if (hasCircuits && hasNeonPink) {
          handleInventoryUpdate(BlockType.CIRCUIT_SCRAP, -circuitCost);
          handleInventoryUpdate(BlockType.NEON_ORE_PINK, -neonPinkCost);
          setHasMapUpgrade(true);
      }
  }

  const handleExpandHotbar = () => {
      if (unlockedSlots >= MAX_HOTBAR_SLOTS) return;
      
      const circuitCost = HOTBAR_EXPANSION_COST[BlockType.CIRCUIT_SCRAP];
      const neonBlueCost = HOTBAR_EXPANSION_COST[BlockType.NEON_ORE_BLUE];
      const hasCircuits = (inventory[BlockType.CIRCUIT_SCRAP] || 0) >= circuitCost;
      const hasNeonBlue = (inventory[BlockType.NEON_ORE_BLUE] || 0) >= neonBlueCost;

      if (hasCircuits && hasNeonBlue) {
          handleInventoryUpdate(BlockType.CIRCUIT_SCRAP, -circuitCost);
          handleInventoryUpdate(BlockType.NEON_ORE_BLUE, -neonBlueCost);
          setUnlockedSlots(prev => prev + 1);
      }
  };

  const updateHotbarSlot = (index: number, type: BlockType | null) => {
    const newHotbar = [...hotbar];
    newHotbar[index] = type;
    setHotbar(newHotbar);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, type: BlockType) => {
      e.dataTransfer.setData('blockType', type.toString());
      e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Necessary to allow dropping
      e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
      e.preventDefault();
      const typeStr = e.dataTransfer.getData('blockType');
      if (typeStr) {
          const type = parseInt(typeStr) as BlockType;
          if (!isNaN(type)) {
               updateHotbarSlot(index, type);
          }
      }
  };

  // Click-based assignment (Legacy support)
  const assignToHotbar = (slotIndex: number) => {
      if (heldItemType) {
          updateHotbarSlot(slotIndex, heldItemType);
          setHeldItemType(null); // Clear cursor
      } else {
          // Clear slot if nothing held
          if (isInventoryOpen) {
            updateHotbarSlot(slotIndex, null);
          } else {
              // Just select it if closed
              if (slotIndex < unlockedSlots) setActiveSlot(slotIndex);
          }
      }
  };

  const craftItem = (recipe: Recipe) => {
    const hasIngredients = recipe.ingredients.every(ing => (inventory[ing.type] || 0) >= ing.count);
    if (hasIngredients || godMode) {
      if (!godMode) {
        recipe.ingredients.forEach(ing => {
            handleInventoryUpdate(ing.type, -ing.count);
        });
      }
      handleInventoryUpdate(recipe.result, recipe.yield);
    }
  };

  const neonCost = UPGRADE_COST[BlockType.NEON_ORE_PINK];
  const circuitCost = UPGRADE_COST[BlockType.CIRCUIT_SCRAP];
  const canUpgradeHealth = maxHealth < MAX_POSSIBLE_HEALTH && 
                     (inventory[BlockType.NEON_ORE_PINK] || 0) >= neonCost &&
                     (inventory[BlockType.CIRCUIT_SCRAP] || 0) >= circuitCost;

  const mapCircuitCost = MAP_UPGRADE_COST[BlockType.CIRCUIT_SCRAP];
  const mapNeonCost = MAP_UPGRADE_COST[BlockType.NEON_ORE_PINK];
  const canBuyMap = !hasMapUpgrade && 
                    (inventory[BlockType.CIRCUIT_SCRAP] || 0) >= mapCircuitCost &&
                    (inventory[BlockType.NEON_ORE_PINK] || 0) >= mapNeonCost;

  const hotbarCircuitCost = HOTBAR_EXPANSION_COST[BlockType.CIRCUIT_SCRAP];
  const hotbarNeonCost = HOTBAR_EXPANSION_COST[BlockType.NEON_ORE_BLUE];
  const canExpandHotbar = unlockedSlots < MAX_HOTBAR_SLOTS &&
                          (inventory[BlockType.CIRCUIT_SCRAP] || 0) >= hotbarCircuitCost &&
                          (inventory[BlockType.NEON_ORE_BLUE] || 0) >= hotbarNeonCost;

  // Check if save exists
  const hasSaveGame = !!localStorage.getItem('neonscrap_save');

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden select-none font-sans">
      <GameEngine 
        selectedBlock={selectedBlock} 
        onInventoryUpdate={handleInventoryUpdate}
        inventory={inventory}
        onDamage={handleDamage}
        onOpenWorkbench={() => {
            setIsWorkbenchOpen(true);
            setIsInventoryOpen(false);
            setIsCraftingOpen(false);
            setIsMapOpen(false);
        }}
        onToggleMech={setIsMechActive}
        respawnTrigger={respawnTrigger}
        resetGameTrigger={resetGameTrigger}
        saveTrigger={saveTrigger}
        onSaveDataReady={onSaveDataReady}
        initialPlayerPos={initialPlayerPos}
        isMapOpen={isMapOpen}
        hasMapUpgrade={hasMapUpgrade}
        godMode={godMode}
        isMechActive={isMechActive}
        isPaused={isMenuOpen}
        forcedTime={forcedTime}
      />

      {/* --- HUD --- */}
      {!isMenuOpen && (
        <>
            {saveNotification && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-green-900/80 border border-green-500 text-green-100 px-4 py-2 rounded shadow-lg animate-in fade-in slide-in-from-top-4 duration-300 z-50 flex items-center gap-2">
                    <Save size={16} />
                    <span className="text-sm font-bold tracking-widest">PROGRESSO SALVO</span>
                </div>
            )}

            {/* Collection Notifications (Bottom Left) */}
            <div className="absolute bottom-8 left-4 flex flex-col-reverse gap-2 z-20 pointer-events-none">
                {collectionNotifications.map((n) => (
                    <div key={n.type} className="bg-slate-900/90 border border-slate-700 backdrop-blur-sm p-2 rounded shadow-lg flex items-center gap-3 animate-in slide-in-from-left-10 fade-in duration-300 w-64">
                        <div 
                            className="w-8 h-8 rounded border border-white/10 shadow-inner flex-shrink-0"
                            style={{ backgroundColor: BLOCK_COLORS[n.type] }}
                        />
                        <div className="flex-1 overflow-hidden">
                             <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">COLETADO</div>
                             <div className="text-xs text-white font-bold truncate whitespace-nowrap">{BLOCK_NAMES[n.type]}</div>
                        </div>
                        <div className="text-green-400 font-bold text-sm bg-green-900/20 px-2 py-0.5 rounded whitespace-nowrap">+{n.count}</div>
                    </div>
                ))}
            </div>

            {/* Health & Status */}
            <div className="absolute top-4 left-4 flex flex-col gap-4 z-10 max-w-xs animate-in fade-in duration-500">
                <div className="bg-black/70 border border-slate-700 p-2 rounded backdrop-blur-sm w-64 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                    <div className="flex justify-between items-center text-xs mb-1">
                        <span className={`font-bold flex items-center gap-1 ${godMode ? 'text-yellow-400' : isMechActive ? 'text-blue-400' : 'text-red-400'}`}>
                            {godMode ? <Zap size={12} fill="currentColor"/> : isMechActive ? <Bot size={12}/> : <Heart size={12} fill="currentColor"/>}
                            {godMode ? 'MODO DEUS' : isMechActive ? 'MECH ONLINE' : 'INTEGRIDADE'}
                        </span>
                        <span className="text-slate-400">{godMode ? '∞' : Math.ceil(health)} / {maxHealth}</span>
                    </div>
                    <div className="w-full h-3 bg-slate-900 rounded overflow-hidden border border-slate-800 relative">
                        <div 
                            className={`h-full transition-all duration-300 ease-out relative ${godMode ? 'bg-yellow-500' : isMechActive ? 'bg-blue-600' : 'bg-red-600'}`}
                            style={{ width: godMode ? '100%' : `${(health / maxHealth) * 100}%` }}
                        >
                            <div className="absolute inset-0 bg-white opacity-20 animate-pulse"></div>
                        </div>
                    </div>
                    {isMechActive && (
                        <div className="flex justify-between items-center text-xs mt-1 border-t border-slate-700 pt-1">
                            <span className="text-yellow-400 font-bold flex items-center gap-1"><Crosshair size={10}/> MUNIÇÃO</span>
                            <span className={(inventory[BlockType.AMMO_PACK] || 0) > 0 ? "text-white" : "text-red-500 animate-pulse"}>
                                {godMode ? '∞' : (inventory[BlockType.AMMO_PACK] || 0)}
                            </span>
                        </div>
                    )}
                </div>

                {showControls && (
                    <div className="bg-black/70 border border-slate-700 p-4 rounded text-xs text-slate-300 backdrop-blur-sm relative">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-cyan-400">PROTOCOLOS</h3>
                            <button onClick={() => setShowControls(false)}><X size={14}/></button>
                        </div>
                        <ul className="space-y-1">
                            <li><span className="text-white font-bold">W, A, S, D</span> - Mover</li>
                            <li><span className="text-white font-bold">1-9</span> - Selecionar Hotbar</li>
                            <li><span className="text-white font-bold">E</span> - Fabricar / <span className="text-white font-bold">I</span> - Mochila</li>
                            <li><span className="text-white font-bold">Mouse Esq.</span> - {isMechActive ? 'Atirar' : 'Ação'}</li>
                            <li><span className="text-white font-bold">Mouse Dir.</span> - Usar/Entrar Mech</li>
                            <li><span className="text-cyan-400 font-bold">X</span> - Usar Picareta (Segurar)</li>
                            {isMechActive && <li><span className="text-yellow-400 font-bold">F</span> - Sair do Mech</li>}
                            <li><span className="text-white font-bold">ESC</span> - Menu/Pausa</li>
                        </ul>
                    </div>
                )}
            </div>

            <div className={`absolute top-4 right-4 flex gap-2 z-10 transition-all duration-300 ${hasMapUpgrade ? 'translate-y-[220px]' : ''}`}> 
                <button 
                onClick={() => setIsAiOpen(prev => !prev)}
                className="bg-cyan-900/80 hover:bg-cyan-800 text-cyan-100 p-3 rounded-full border border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all"
                title="Consultar IA Netrunner"
                >
                <Cpu size={24} />
                </button>
            </div>

            {/* --- HOTBAR (Main Game HUD) --- */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 animate-in slide-in-from-bottom-10 duration-500 flex flex-col items-center gap-2">
                <div className="flex gap-1 bg-black/80 p-2 rounded-lg border border-slate-700 backdrop-blur-md shadow-2xl">
                    {hotbar.map((blockType, idx) => {
                        const isLocked = idx >= unlockedSlots;
                        const isSelected = activeSlot === idx;
                        const itemCount = blockType !== null ? (inventory[blockType] || 0) : 0;
                        
                        return (
                            <button
                                key={idx}
                                onClick={() => {
                                    if (!isLocked && !isInventoryOpen) {
                                        setActiveSlot(idx);
                                    }
                                }}
                                disabled={isLocked}
                                className={`
                                    relative w-12 h-12 border-2 rounded transition-all flex items-center justify-center overflow-hidden
                                    ${isLocked ? 'bg-slate-950/50 border-slate-800 cursor-not-allowed opacity-50' : 'bg-slate-900/80'}
                                    ${isSelected && !isLocked ? 'border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)] scale-110 z-10' : 'border-slate-600'}
                                `}
                            >
                                <span className="absolute top-0.5 left-1 text-[8px] text-slate-500 font-mono">{idx + 1}</span>
                                {isLocked ? (
                                    <Lock size={14} className="text-slate-700" />
                                ) : (
                                    <>
                                        {blockType !== null ? (
                                            <>
                                                {(blockType === BlockType.PICKAXE || blockType === BlockType.ADVANCED_PICKAXE) ? (
                                                     <Pickaxe size={24} className={blockType === BlockType.ADVANCED_PICKAXE ? "text-purple-400 drop-shadow-[0_0_5px_rgba(192,132,252,0.8)]" : "text-cyan-400 drop-shadow-md"} />
                                                ) : (
                                                    <div 
                                                        className={`w-6 h-6 border border-white/20 shadow-sm ${itemCount === 0 ? 'opacity-30 grayscale' : ''}`} 
                                                        style={{ backgroundColor: BLOCK_COLORS[blockType] }}
                                                    />
                                                )}
                                                
                                                {(blockType !== BlockType.PICKAXE && blockType !== BlockType.ADVANCED_PICKAXE) && (
                                                    <span className={`absolute bottom-0 right-1 text-[10px] font-bold drop-shadow-md ${itemCount > 0 ? 'text-white' : 'text-red-500'}`}>
                                                        {itemCount}
                                                    </span>
                                                )}
                                            </>
                                        ) : (
                                           <span className="w-2 h-2 rounded-full bg-slate-800"></span> 
                                        )}
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Main Action Buttons */}
                <div className="flex gap-2">
                    <button
                    onClick={() => { setIsInventoryOpen(!isInventoryOpen); setIsCraftingOpen(false); setIsMapOpen(false); setIsWorkbenchOpen(false); }}
                    className={`w-10 h-10 border rounded flex flex-col items-center justify-center transition-all bg-slate-900/90 ${isInventoryOpen ? 'border-green-500 text-green-400' : 'border-slate-600 text-slate-400'}`}
                    >
                    <Backpack size={16} />
                    <span className="text-[8px] font-bold mt-[-2px]">I</span>
                    </button>

                    <button
                    onClick={() => { setIsCraftingOpen(!isCraftingOpen); setIsInventoryOpen(false); setIsMapOpen(false); setIsWorkbenchOpen(false); }}
                    className={`w-10 h-10 border rounded flex flex-col items-center justify-center transition-all bg-slate-900/90 ${isCraftingOpen ? 'border-purple-500 text-purple-400' : 'border-slate-600 text-slate-400'}`}
                    >
                    <Hammer size={16} />
                    <span className="text-[8px] font-bold mt-[-2px]">E</span>
                    </button>

                    <button
                    onClick={() => { 
                        if (hasMapUpgrade) {
                            setIsMapOpen(!isMapOpen); setIsInventoryOpen(false); setIsCraftingOpen(false); setIsWorkbenchOpen(false);
                        }
                    }}
                    className={`w-10 h-10 border rounded flex flex-col items-center justify-center transition-all bg-slate-900/90 ${isMapOpen ? 'border-amber-500 text-amber-400' : 'border-slate-600 text-slate-400'} ${!hasMapUpgrade ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                    <MapIcon size={16} />
                    <span className="text-[8px] font-bold mt-[-2px]">M</span>
                    </button>
                </div>
            </div>
        </>
      )}

      {/* --- INVENTORY MENU --- */}
      {isInventoryOpen && !isMenuOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200 cursor-default">
             <div className="w-[850px] h-[600px] bg-slate-950 border border-green-500/50 rounded-lg shadow-[0_0_30px_rgba(34,197,94,0.15)] flex overflow-hidden">
                <div className="flex-1 flex flex-col border-r border-green-900/30">
                    <div className="flex justify-between items-center p-4 border-b border-green-900/50 bg-slate-900/50">
                        <h2 className="text-xl font-bold text-green-400 flex items-center gap-2 tracking-widest">
                        <Backpack size={20} /> MOCHILA NEURAL
                        </h2>
                        {heldItemType && (
                             <div className="text-xs text-green-300 animate-pulse bg-green-900/40 px-3 py-1 rounded border border-green-700">
                                 SELECIONE UM SLOT NA HOTBAR ABAIXO
                             </div>
                        )}
                        <div className="text-[10px] text-slate-500">Arraste para a Hotbar</div>
                    </div>

                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar relative">
                        <div className="grid grid-cols-5 gap-4">
                            {Object.entries(inventory).map(([typeStr, count]) => {
                                const type = parseInt(typeStr) as BlockType;
                                const isHeld = heldItemType === type;
                                const isPickaxe = type === BlockType.PICKAXE || type === BlockType.ADVANCED_PICKAXE;
                                
                                return (
                                <button 
                                    key={type}
                                    draggable={true}
                                    onDragStart={(e) => handleDragStart(e, type)}
                                    onClick={() => setHeldItemType(type)}
                                    className={`group flex flex-col items-center gap-2 p-3 rounded border bg-slate-900/50 transition-all hover:bg-slate-800 cursor-grab active:cursor-grabbing ${isHeld ? 'border-green-400 ring-2 ring-green-400/50 bg-green-900/20' : 'border-slate-800 hover:border-green-700'}`}
                                >
                                    {isPickaxe ? (
                                        <Pickaxe size={48} className={`drop-shadow-md p-2 border border-white/10 rounded ${type === BlockType.ADVANCED_PICKAXE ? "text-purple-400" : "text-cyan-400"}`} />
                                    ) : (
                                        <div 
                                            className="w-12 h-12 border-2 border-white/10 shadow-lg pointer-events-none" 
                                            style={{ backgroundColor: BLOCK_COLORS[type] }}
                                        />
                                    )}
                                    <div className="w-full text-center pointer-events-none">
                                        <div className="text-xs font-bold text-slate-200 truncate w-full">{BLOCK_NAMES[type]}</div>
                                        {!isPickaxe && <div className="text-[10px] text-green-500 font-mono">Qtd: {count}</div>}
                                    </div>
                                    <div className="absolute opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bg-black border border-green-500/30 text-xs text-slate-300 p-2 rounded w-48 bottom-4 left-1/2 -translate-x-1/2 z-50 shadow-xl">
                                        {ITEM_DESCRIPTIONS[type]}
                                    </div>
                                </button>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* INTERNAL HOTBAR FOR DRAG AND DROP */}
                    <div className="p-4 bg-slate-900/80 border-t border-green-900/50 flex flex-col items-center gap-2">
                        <div className="text-[10px] text-green-600 font-bold uppercase tracking-wider mb-1">BARRA DE ATALHOS (HOTBAR)</div>
                        <div className="flex gap-2">
                            {hotbar.map((blockType, idx) => {
                                const isLocked = idx >= unlockedSlots;
                                const itemCount = blockType !== null ? (inventory[blockType] || 0) : 0;
                                
                                return (
                                    <div
                                        key={idx}
                                        onDragOver={!isLocked ? handleDragOver : undefined}
                                        onDrop={!isLocked ? (e) => handleDrop(e, idx) : undefined}
                                        onClick={() => !isLocked && assignToHotbar(idx)}
                                        className={`
                                            relative w-14 h-14 border-2 rounded transition-all flex items-center justify-center
                                            ${isLocked ? 'bg-slate-950/50 border-slate-900 cursor-not-allowed' : 'bg-black/50 border-slate-700 hover:border-green-500 cursor-pointer'}
                                            ${activeSlot === idx && !isLocked ? 'border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.3)]' : ''}
                                        `}
                                    >
                                        <span className="absolute top-0.5 left-1 text-[8px] text-slate-600 font-mono">{idx + 1}</span>
                                        {isLocked ? (
                                            <Lock size={16} className="text-slate-800" />
                                        ) : (
                                            <>
                                                {blockType !== null ? (
                                                    <>
                                                        {(blockType === BlockType.PICKAXE || blockType === BlockType.ADVANCED_PICKAXE) ? (
                                                            <Pickaxe size={24} className={blockType === BlockType.ADVANCED_PICKAXE ? "text-purple-400 drop-shadow-[0_0_5px_rgba(192,132,252,0.8)]" : "text-cyan-400 drop-shadow-md"} />
                                                        ) : (
                                                            <div 
                                                                className={`w-8 h-8 border border-white/20 shadow-sm ${itemCount === 0 ? 'opacity-30 grayscale' : ''}`} 
                                                                style={{ backgroundColor: BLOCK_COLORS[blockType] }}
                                                            />
                                                        )}
                                                        
                                                        {(blockType !== BlockType.PICKAXE && blockType !== BlockType.ADVANCED_PICKAXE) && (
                                                            <span className={`absolute bottom-0 right-1 text-[10px] font-bold drop-shadow-md ${itemCount > 0 ? 'text-white' : 'text-red-500'}`}>
                                                                {itemCount}
                                                            </span>
                                                        )}
                                                        
                                                        {/* Clear Button */}
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); updateHotbarSlot(idx, null); }}
                                                            className="absolute -top-1 -right-1 bg-red-900 text-red-200 rounded-full w-4 h-4 flex items-center justify-center text-[8px] hover:bg-red-700"
                                                        >
                                                            X
                                                        </button>
                                                    </>
                                                ) : (
                                                <span className="w-2 h-2 rounded-full bg-slate-800"></span> 
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="w-72 bg-slate-900/30 flex flex-col overflow-y-auto custom-scrollbar">
                    <div className="flex justify-between items-center p-4 border-b border-green-900/50 bg-slate-900/50 sticky top-0 backdrop-blur-md z-10">
                        <h2 className="text-sm font-bold text-green-400 flex items-center gap-2 tracking-widest">
                            <Shield size={16} /> EXOTRAJE
                        </h2>
                        <button onClick={() => { setIsInventoryOpen(false); setHeldItemType(null); }} className="text-slate-500 hover:text-white transition-colors"><X size={16}/></button>
                    </div>
                    
                    <div className="p-4 space-y-6">
                        
                        {/* HEALTH UPGRADE */}
                        <div className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg space-y-3">
                             <div className="flex items-center gap-2 text-white text-sm font-bold">
                                 <ArrowUpCircle size={16} className="text-cyan-400"/>
                                 UPGRADE CHASSI
                             </div>
                             <p className="text-[10px] text-slate-400 leading-tight">
                                 Reforça a blindagem com ligas de Neon e Circuitos auxiliares. +50 HP.
                             </p>
                             
                             <div className="flex flex-col gap-1.5 text-xs text-slate-300">
                                 <div className="flex justify-between">
                                     <span>{BLOCK_NAMES[BlockType.NEON_ORE_PINK]}</span>
                                     <span className={(inventory[BlockType.NEON_ORE_PINK] || 0) >= neonCost ? 'text-green-400' : 'text-red-400'}>
                                        {(inventory[BlockType.NEON_ORE_PINK] || 0)} / {neonCost}
                                     </span>
                                 </div>
                                 <div className="flex justify-between">
                                     <span>{BLOCK_NAMES[BlockType.CIRCUIT_SCRAP]}</span>
                                     <span className={(inventory[BlockType.CIRCUIT_SCRAP] || 0) >= circuitCost ? 'text-green-400' : 'text-red-400'}>
                                        {(inventory[BlockType.CIRCUIT_SCRAP] || 0)} / {circuitCost}
                                     </span>
                                 </div>
                             </div>

                             <button 
                                onClick={handleUpgradeHealth}
                                disabled={!canUpgradeHealth}
                                className={`w-full py-2 rounded font-bold text-xs uppercase tracking-wider transition-all ${canUpgradeHealth ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                             >
                                 {maxHealth >= MAX_POSSIBLE_HEALTH ? 'MÁXIMO ATINGIDO' : 'INSTALAR UPGRADE'}
                             </button>
                        </div>

                        {/* HOTBAR UPGRADE */}
                        <div className="p-3 bg-slate-900/80 border border-slate-700 rounded-lg space-y-3">
                             <div className="flex items-center gap-2 text-white text-sm font-bold">
                                 <Grid size={16} className="text-purple-400"/>
                                 EXPANSÃO DE MEMÓRIA
                             </div>
                             <p className="text-[10px] text-slate-400 leading-tight">
                                 Adiciona +1 slot à barra de atalhos neural.
                             </p>
                             
                             <div className="flex flex-col gap-1.5 text-xs text-slate-300">
                                 <div className="flex justify-between">
                                     <span>{BLOCK_NAMES[BlockType.CIRCUIT_SCRAP]}</span>
                                     <span className={(inventory[BlockType.CIRCUIT_SCRAP] || 0) >= hotbarCircuitCost ? 'text-green-400' : 'text-red-400'}>
                                        {(inventory[BlockType.CIRCUIT_SCRAP] || 0)} / {hotbarCircuitCost}
                                     </span>
                                 </div>
                                 <div className="flex justify-between">
                                     <span>{BLOCK_NAMES[BlockType.NEON_ORE_BLUE]}</span>
                                     <span className={(inventory[BlockType.NEON_ORE_BLUE] || 0) >= hotbarNeonCost ? 'text-green-400' : 'text-red-400'}>
                                        {(inventory[BlockType.NEON_ORE_BLUE] || 0)} / {hotbarNeonCost}
                                     </span>
                                 </div>
                             </div>

                             <button 
                                onClick={handleExpandHotbar}
                                disabled={!canExpandHotbar || unlockedSlots >= MAX_HOTBAR_SLOTS}
                                className={`w-full py-2 rounded font-bold text-xs uppercase tracking-wider transition-all ${
                                    unlockedSlots >= MAX_HOTBAR_SLOTS 
                                    ? 'bg-purple-900/30 text-purple-500 border border-purple-500/30' 
                                    : canExpandHotbar
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)]' 
                                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                }`}
                             >
                                 {unlockedSlots >= MAX_HOTBAR_SLOTS ? 'MÁXIMO ATINGIDO' : 'EXPANDIR SLOT'}
                             </button>
                        </div>

                        {/* MAP UPGRADE */}
                        <div className={`p-3 bg-slate-900/80 border rounded-lg space-y-3 ${hasMapUpgrade ? 'border-amber-500/50' : 'border-slate-700'}`}>
                             <div className="flex items-center gap-2 text-white text-sm font-bold">
                                 <Globe size={16} className={hasMapUpgrade ? "text-amber-400" : "text-slate-400"}/>
                                 {hasMapUpgrade ? 'SISTEMA DE NAVEGAÇÃO' : 'MÓDULO GPS NEURAL'}
                             </div>
                             <p className="text-[10px] text-slate-400 leading-tight">
                                 Ativa o minimapa HUD e o sistema de mapeamento global (Tecla M).
                             </p>
                             
                             {!hasMapUpgrade && (
                                 <div className="flex flex-col gap-1.5 text-xs text-slate-300">
                                     <div className="flex justify-between">
                                         <span>{BLOCK_NAMES[BlockType.NEON_ORE_PINK]}</span>
                                         <span className={(inventory[BlockType.NEON_ORE_PINK] || 0) >= mapNeonCost ? 'text-green-400' : 'text-red-400'}>
                                            {(inventory[BlockType.NEON_ORE_PINK] || 0)} / {mapNeonCost}
                                         </span>
                                     </div>
                                     <div className="flex justify-between">
                                         <span>{BLOCK_NAMES[BlockType.CIRCUIT_SCRAP]}</span>
                                         <span className={(inventory[BlockType.CIRCUIT_SCRAP] || 0) >= mapCircuitCost ? 'text-green-400' : 'text-red-400'}>
                                            {(inventory[BlockType.CIRCUIT_SCRAP] || 0)} / {mapCircuitCost}
                                         </span>
                                     </div>
                                 </div>
                             )}

                             <button 
                                onClick={handleBuyMap}
                                disabled={!canBuyMap || hasMapUpgrade}
                                className={`w-full py-2 rounded font-bold text-xs uppercase tracking-wider transition-all ${
                                    hasMapUpgrade 
                                    ? 'bg-amber-900/30 text-amber-500 border border-amber-500/30' 
                                    : canBuyMap 
                                        ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-[0_0_10px_rgba(217,119,6,0.4)]' 
                                        : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                }`}
                             >
                                 {hasMapUpgrade ? 'INSTALADO' : 'COMPRAR MÓDULO'}
                             </button>
                        </div>

                    </div>
                </div>
             </div>
        </div>
      )}

      {/* --- CRAFTING MENU --- */}
      {isCraftingOpen && !isMenuOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200">
             <div className="w-[500px] h-[600px] bg-slate-950 border border-purple-500/50 rounded-lg shadow-[0_0_30px_rgba(168,85,247,0.15)] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-purple-900/50 bg-slate-900/50">
                    <h2 className="text-xl font-bold text-purple-400 flex items-center gap-2 tracking-widest">
                    <Hammer size={20} /> NANOFABRICADOR
                    </h2>
                    <button onClick={() => setIsCraftingOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {RECIPES.map((recipe, idx) => {
                    const hasIngredients = recipe.ingredients.every(ing => (inventory[ing.type] || 0) >= ing.count);
                    const canCraft = godMode || hasIngredients;
                    return (
                        <div key={idx} className={`p-4 border rounded-lg flex justify-between items-center transition-all ${canCraft ? 'border-slate-700 bg-slate-900/40 hover:bg-slate-800' : 'border-slate-800 bg-black/40 opacity-50'}`}>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-12 h-12 rounded border border-white/20 flex items-center justify-center shadow-inner" style={{ backgroundColor: BLOCK_COLORS[recipe.result] }}>
                                    {recipe.result === BlockType.AMMO_PACK && <div className="text-[10px] font-bold text-black/50">AMMO</div>}
                                    {recipe.result === BlockType.ADVANCED_PICKAXE && <Pickaxe className="text-purple-400 drop-shadow-md" size={32}/>}
                                </div>
                                <span className="absolute -bottom-2 -right-2 bg-slate-800 text-white text-[10px] font-bold px-1.5 rounded border border-slate-600">{recipe.yield}x</span>
                            </div>
                            <div>
                                <div className="font-bold text-slate-200 text-sm">{BLOCK_NAMES[recipe.result]}</div>
                                <div className="flex flex-col gap-1 mt-1">
                                {recipe.ingredients.map((ing, i) => {
                                    const has = inventory[ing.type] || 0;
                                    return (
                                        <div key={i} className="text-xs flex items-center gap-1">
                                            <span className={has >= ing.count || godMode ? 'text-slate-400' : 'text-red-400'}>
                                                {has}/{ing.count}
                                            </span>
                                            <span className="text-slate-600">{BLOCK_NAMES[ing.type]}</span>
                                        </div>
                                    );
                                })}
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => craftItem(recipe)}
                            disabled={!canCraft}
                            className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all active:scale-95 ${canCraft ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_10px_rgba(147,51,234,0.3)]' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                        >
                            {godMode ? 'CRIAR (GOD)' : 'CRIAR'}
                        </button>
                        </div>
                    )
                    })}
                </div>
             </div>
        </div>
      )}

      {/* --- WORKBENCH MENU --- */}
      {isWorkbenchOpen && !isMenuOpen && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200">
             <div className="w-[600px] h-[650px] bg-slate-950 border border-orange-500/50 rounded-lg shadow-[0_0_40px_rgba(249,115,22,0.2)] flex flex-col overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-orange-900/50 bg-slate-900/50">
                    <h2 className="text-xl font-bold text-orange-500 flex items-center gap-2 tracking-widest">
                    <Wrench size={24} /> WORKBENCH PESADA
                    </h2>
                    <button onClick={() => setIsWorkbenchOpen(false)} className="text-slate-500 hover:text-white transition-colors"><X /></button>
                </div>
                
                <div className="p-4 bg-orange-900/10 border-b border-orange-900/20">
                    <p className="text-orange-200/60 text-xs font-mono">
                        &gt;&gt; SISTEMA DE ENGENHARIA AVANÇADA ONLINE.<br/>
                        &gt;&gt; PERMITE A CRIAÇÃO DE ESTRUTURAS COMPLEXAS E VEÍCULOS MECANIZADOS.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {MECH_RECIPES.map((recipe, idx) => {
                    const hasIngredients = recipe.ingredients.every(ing => (inventory[ing.type] || 0) >= ing.count);
                    const canCraft = godMode || hasIngredients;
                    return (
                        <div key={idx} className={`p-4 border rounded-lg flex justify-between items-center transition-all ${canCraft ? 'border-orange-900/60 bg-slate-900/60 hover:bg-slate-800' : 'border-slate-800 bg-black/40 opacity-50'}`}>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded border border-white/20 flex items-center justify-center shadow-inner" style={{ backgroundColor: BLOCK_COLORS[recipe.result] }}>
                                    {recipe.result === BlockType.MECH_SUIT && <Bot className="text-white/50" size={32}/>}
                                </div>
                                <span className="absolute -bottom-2 -right-2 bg-slate-800 text-white text-[10px] font-bold px-1.5 rounded border border-slate-600">{recipe.yield}x</span>
                            </div>
                            <div>
                                <div className="font-bold text-orange-100 text-base">{BLOCK_NAMES[recipe.result]}</div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                                {recipe.ingredients.map((ing, i) => {
                                    const has = inventory[ing.type] || 0;
                                    return (
                                        <div key={i} className="text-xs flex items-center gap-1">
                                            <span className={has >= ing.count || godMode ? 'text-slate-400' : 'text-red-400 font-bold'}>
                                                {has}/{ing.count}
                                            </span>
                                            <span className="text-slate-500">{BLOCK_NAMES[ing.type]}</span>
                                        </div>
                                    );
                                })}
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => craftItem(recipe)}
                            disabled={!canCraft}
                            className={`px-6 py-3 rounded text-xs font-bold uppercase tracking-wider transition-all active:scale-95 flex flex-col items-center gap-1 ${canCraft ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.3)]' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}`}
                        >
                            <span>{godMode ? 'CONSTRUIR (GOD)' : 'CONSTRUIR'}</span>
                        </button>
                        </div>
                    )
                    })}
                </div>
             </div>
        </div>
      )}

      {/* --- MAIN MENU --- */}
      {isMenuOpen && (
          <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
              <div className="mb-8 text-center animate-pulse">
                  <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 drop-shadow-[0_0_15px_rgba(6,182,212,0.8)] tracking-tighter" style={{ fontFamily: 'Share Tech Mono' }}>
                      NEONSCRAP
                  </h1>
                  <p className="text-cyan-600 tracking-[0.5em] text-sm mt-2 font-bold">SURVIVAL SANDBOX v0.95</p>
              </div>

              <div className="flex flex-col gap-4 w-80">
                  
                  {/* RETOMAR - Só aparece se o jogo já começou na sessão atual */}
                  <button 
                    onClick={handleContinue}
                    disabled={!gameStarted}
                    className={`group relative bg-slate-900/20 border-2 py-3 px-6 text-lg font-bold uppercase tracking-widest transition-all ${
                        gameStarted 
                        ? 'border-green-500/50 hover:border-green-400 text-green-400 hover:text-white hover:bg-green-500/20 hover:scale-105 hover:shadow-[0_0_20px_rgba(34,197,94,0.4)]' 
                        : 'border-slate-800 text-slate-700 cursor-not-allowed opacity-50 hidden'
                    }`}
                  >
                      <div className="flex items-center justify-center gap-3">
                        <Play size={18} fill="currentColor"/>
                        RETOMAR
                      </div>
                  </button>

                   {/* NOVO JOGO */}
                   <button 
                    onClick={handleNewGame}
                    className="group relative bg-cyan-900/20 border-2 border-cyan-500/50 hover:border-cyan-400 text-cyan-400 hover:text-white py-3 px-6 text-lg font-bold uppercase tracking-widest transition-all hover:bg-cyan-500/20 hover:scale-105 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                  >
                      <div className="flex items-center justify-center gap-3">
                        <RefreshCw size={18} />
                        NOVO JOGO
                      </div>
                  </button>

                  {/* CARREGAR JOGO - Só se tiver save */}
                  <button 
                    onClick={handleLoadGame}
                    disabled={!hasSaveGame}
                    className={`group relative bg-slate-900/20 border-2 py-3 px-6 text-lg font-bold uppercase tracking-widest transition-all ${
                        hasSaveGame
                        ? 'border-blue-500/50 hover:border-blue-400 text-blue-400 hover:text-white hover:bg-blue-500/20 hover:scale-105 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                        : 'border-slate-800 text-slate-700 cursor-not-allowed opacity-30'
                    }`}
                  >
                      <div className="flex items-center justify-center gap-3">
                        <Download size={18} />
                        CARREGAR
                      </div>
                  </button>

                  {/* SALVAR JOGO - Só se jogo iniciado */}
                  <button 
                    onClick={handleSaveGame}
                    disabled={!gameStarted}
                    className={`group relative bg-slate-900/20 border-2 py-3 px-6 text-lg font-bold uppercase tracking-widest transition-all ${
                        gameStarted
                        ? 'border-purple-500/50 hover:border-purple-400 text-purple-400 hover:text-white hover:bg-purple-500/20 hover:scale-105 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]'
                        : 'border-slate-800 text-slate-700 cursor-not-allowed opacity-30'
                    }`}
                  >
                      <div className="flex items-center justify-center gap-3">
                        <Save size={18} />
                        SALVAR
                      </div>
                  </button>

                  {/* SAIR */}
                  <button 
                    onClick={handleExit}
                    className="group relative bg-red-900/20 border-2 border-red-500/50 hover:border-red-400 text-red-400 hover:text-white py-3 px-6 text-lg font-bold uppercase tracking-widest transition-all hover:bg-red-500/20 hover:scale-105 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                  >
                      <div className="flex items-center justify-center gap-3">
                        <Power size={18} />
                        SAIR
                      </div>
                  </button>
              </div>

              <div className="absolute bottom-8 text-slate-500 text-xs font-mono text-center">
                  PRESSIONE 'ESC' PARA PAUSAR<br/>
                  <span className="text-[10px] opacity-50">*O Terreno modificado não é salvo devido a restrições de memória. Apenas itens e status.*</span>
              </div>
          </div>
      )}

      <NetrunnerAI isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} onCheat={handleCheat} />

    </div>
  );
}