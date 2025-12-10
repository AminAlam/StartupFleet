// Mock Three.js globally
global.THREE = {
    Scene: class { add() {} clear() {} },
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
    Vector3: class { add() {} sub() {} clone() { return this; } length() { return 1; } multiplyScalar() {} normalize() {} },
    Group: class { add() {}; position = { set: () => {} }; userData = {}; children = []; },
    CanvasTexture: class { constructor() { this.minFilter = 0; } },
    LinearFilter: 1,
    Line: class {},
    LineBasicMaterial: class {},
    LineDashedMaterial: class {},
    BufferGeometry: class { setFromPoints() {} },
    BoxGeometry: class {},
    CylinderGeometry: class {},
    OctahedronGeometry: class {}
};

// Mock global UI and Game for GameEngine initialization if needed
global.window = { innerWidth: 1024, innerHeight: 768 };
global.document = {
    getElementById: () => document.createElement('div'),
    createElement: (tag) => {
        const el = { 
            style: {}, 
            getContext: () => ({
                measureText: () => ({ width: 10 }),
                fillText: () => {},
                fillRect: () => {},
                clearRect: () => {},
                beginPath: () => {},
                arc: () => {},
                fill: () => {},
                stroke: () => {}
            }),
            width: 0,
            height: 0
        };
        return el;
    }
};

const { Utils, GameEngine, Camera2D, UIController } = require('../static/js/game.js');

describe('Utils Helper Functions', () => {
    test('generateId creates unique strings', () => {
        const id1 = Utils.generateId('test');
        const id2 = Utils.generateId('test');
        expect(id1).toMatch(/^test_/);
        expect(id1).not.toBe(id2);
    });

    test('dist calculates distance correctly', () => {
        const d = Utils.dist(0, 0, 3, 4);
        expect(d).toBe(5);
    });

    test('clamp restricts values', () => {
        expect(Utils.clamp(10, 0, 5)).toBe(5);
        expect(Utils.clamp(-5, 0, 5)).toBe(0);
        expect(Utils.clamp(3, 0, 5)).toBe(3);
    });
});

describe('GameEngine Core Logic', () => {
    let game;
    let mockFetch;

    beforeEach(() => {
        // Mock DOM elements
        document.body.innerHTML = `
            <canvas id="world"></canvas>
            <div id="world-3d"></div>
            <div id="toast-container"></div>
            <div id="file-upload"></div>
        `;
        
        // Mock UI Controller
        const mockUI = new UIController();
        mockUI.renderTeams = jest.fn();
        mockUI.renderDashboard = jest.fn();
        mockUI.updateStats = jest.fn();
        mockUI.populateSelects = jest.fn();
        global.ui = mockUI; // Inject global UI

        // Mock fetch
        mockFetch = jest.fn((url, options) => {
            if (url === '/api/save') {
                return Promise.resolve({
                    json: () => Promise.resolve({ status: 'success' })
                });
            }
            if (url === '/api/load') {
                return Promise.resolve({
                    json: () => Promise.resolve({ 
                        teams: [{id: 't1', name: 'T1'}], 
                        islands: [{id: 'i1', x: 0, y: 0, kpis: []}], 
                        mainGoals: [],
                        ships: []
                    })
                });
            }
            return Promise.reject('Unknown URL');
        });
        global.fetch = mockFetch;

        game = new GameEngine();
        // Manually trigger init since constructor is guarded in test env
        game.init();
    });

    test('Initial Load calls API and sets state', async () => {
        // Wait for async init
        await new Promise(process.nextTick);
        
        expect(mockFetch).toHaveBeenCalledWith('/api/load');
        expect(game.state.teams).toHaveLength(1);
        expect(game.state.teams[0].id).toBe('t1');
    });

    test('AutoSave calls API with correct data', async () => {
        game.state.teams.push({id: 't2', name: 'New Team'});
        await game.autoSave();

        expect(mockFetch).toHaveBeenCalledWith('/api/save', expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: expect.stringContaining('"id":"t2"')
        }));
    });

    test('Ship Deployment Logic', () => {
        // Setup initial state
        const team = { id: 't1', name: 'Test Team', color: '#fff', icon: 'X' };
        const island = { id: 'i1', x: 100, y: 100, kpis: [{id: 'k1'}] };
        game.state.islands = [island];
        game.state.teams = [team];

        // Deploy ship
        game.createShip(team, 'i1', ['k1'], 0, 0, 'DOCKED');

        expect(game.ships).toHaveLength(1);
        const ship = game.ships[0];
        expect(ship.teamId).toBe('t1');
        expect(ship.targetId).toBe('i1');
        expect(ship.targetKpiIds).toContain('k1');
        expect(ship.state).toBe('DOCKED');
    });

    test('JSON File Load Logic', async () => {
        const fileContent = JSON.stringify({
            teams: [{id: 'fileTeam', name: 'File Team'}],
            islands: [],
            mainGoals: [],
            ships: []
        });
        
        const file = new File([fileContent], "config.json", { type: "application/json" });
        const input = { files: [file], value: 'fake/path' };

        // Mock FileReader
        const mockReader = {
            readAsText: jest.fn(function() {
                this.onload({ target: { result: fileContent } });
            }),
        };
        global.FileReader = jest.fn(() => mockReader);

        await game.loadFromFile(input);

        expect(game.state.teams[0].id).toBe('fileTeam');
        // Should trigger autosave after load
        expect(mockFetch).toHaveBeenCalledWith('/api/save', expect.any(Object));
    });

    test('Physics Update (Movement)', () => {
        // Create a ship far from target
        const team = { id: 't1', name: 'T1' };
        const ship = {
            x: 0, y: 0,
            vx: 0, vy: 0,
            targetId: 'i1', // Must match island ID for update logic to find target
            state: 'SAILING',
            teamName: 'T1',
            targetKpiIds: []
        };
        game.ships = [ship];
        game.state.islands = [{ id: 'i1', x: 100, y: 100, kpis: [], mainGoalIds: [] }];
        game.state.mainGoals = [];

        // Run one update frame
        game.update();

        // Ship should have moved or accelerated
        // Since we use forces, check if velocity changed
        const hasMoved = (ship.x !== 0 || ship.y !== 0 || ship.vx !== 0 || ship.vy !== 0);
        expect(hasMoved).toBe(true);
    });
});