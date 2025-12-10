import { GameEngine } from './GameEngine.js';
import { UIController } from './UIController.js';

// --- INITIALIZATION ---
// Only initialize if running in browser with required elements
if (typeof window !== 'undefined' && document.getElementById('world')) {
    window.ui = new UIController();
    window.game = new GameEngine();
    
    // Global Access for Debugging
    window.Utils = (await import('./Utils.js')).Utils;
}
