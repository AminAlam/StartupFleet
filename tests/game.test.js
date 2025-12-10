// Mock Three.js globally
global.THREE = {
    Scene: class { add() {} },
    PerspectiveCamera: class { updateProjectionMatrix() {} },
    WebGLRenderer: class { 
        setSize() {} 
        render() {} 
        domElement = document.createElement('canvas') 
    },
    HemisphereLight: class {},
    DirectionalLight: class { position = { set: () => {} } },
    PlaneGeometry: class { attributes = { position: { count: 0 } }; computeVertexNormals() {} },
    MeshPhongMaterial: class {},
    Mesh: class { position = { set: () => {} }; rotation = {}; add() {} },
    SphereGeometry: class {},
    MeshBasicMaterial: class {},
    SpriteMaterial: class {},
    Sprite: class { scale = { set: () => {} }; position = {} },
    Vector3: class { add() {} },
    Group: class { add() {}; position = { set: () => {} }; userData = {}; },
    CanvasTexture: class { constructor() { this.minFilter = 0; } },
    LinearFilter: 1
};

// Load the game module
const { Utils, GameEngine, Camera2D } = require('../static/js/game.js');

describe('Utils', () => {
    test('generateId creates unique strings', () => {
        const id1 = Utils.generateId('test');
        const id2 = Utils.generateId('test');
        expect(id1).toMatch(/^test_/);
        expect(id1).not.toBe(id2);
    });
});

describe('GameEngine Logic', () => {
    let game;

    beforeEach(() => {
        // Mock DOM elements
        document.body.innerHTML = `
            <canvas id="world"></canvas>
            <div id="world-3d"></div>
            <div id="toast-container"></div>
        `;
        
        // Mock fetch for init
        global.fetch = jest.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve({ teams: [], islands: [], mainGoals: [] }),
            })
        );

        game = new GameEngine();
    });

    test('Camera initialization', () => {
        expect(game.camera).toBeInstanceOf(Camera2D);
        expect(game.camera.zoom).toBe(1);
    });

    test('Deployment Target Logic (Centroid)', () => {
        const island = { x: 100, y: 100, kpis: [] };
        // Should return island center now (per latest update)
        const target = game.getDeploymentTarget(island, []);
        expect(target.x).toBe(100);
        expect(target.y).toBe(100);
    });

    test('Ship Creation', () => {
        const team = { id: 't1', name: 'Test', color: 'red', icon: 'X' };
        game.createShip(team, 'i1', [], 0, 0, 'DOCKED');
        expect(game.ships.length).toBe(1);
        expect(game.ships[0].teamName).toBe('Test');
        expect(game.ships[0].state).toBe('DOCKED');
    });
});
