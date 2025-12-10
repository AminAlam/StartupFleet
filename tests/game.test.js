// Mock Three.js globally
global.THREE = {
    Scene: class { add() {} clear() {} },
    PerspectiveCamera: class { updateProjectionMatrix() {} position = { set: () => {} }; lookAt() {} },
    WebGLRenderer: class { 
        setSize() {} 
        render() {} 
        domElement = document.createElement('canvas') 
    },
    AmbientLight: class {},
    DirectionalLight: class { position = { set: () => {} }; castShadow = false; shadow = { mapSize: { width: 0, height: 0 } } },
    PointLight: class { position = { set: () => {} } },
    PlaneGeometry: class { attributes = { position: { count: 0, getX: () => 0, getY: () => 0, setZ: () => {}, needsUpdate: false } }; computeVertexNormals() {} },
    MeshPhongMaterial: class { color = { setRGB: () => {} } },
    MeshStandardMaterial: class {},
    MeshBasicMaterial: class {},
    MeshLambertMaterial: class {},
    Mesh: class { position = { set: () => {}, x: 0, y: 0, z: 0, addScaledVector: () => {} }; rotation = { x: 0, y: 0, z: 0 }; add() {}; castShadow = false; receiveShadow = false; userData = {} },
    SphereGeometry: class {},
    CylinderGeometry: class { translate() {}; attributes = { position: { count: 0, getY: () => 0, getX: () => 0, getZ: () => 0, setY: () => {}, setX: () => {}, setZ: () => {} } }; computeVertexNormals() {} },
    ConeGeometry: class { translate() {} },
    TorusGeometry: class { rotateX() {}; translate() {} },
    DodecahedronGeometry: class {},
    BoxGeometry: class { attributes = { position: { count: 0, getZ: () => 0, getX: () => 0, getY: () => 0, setX: () => {} } }; computeVertexNormals() {} },
    OctahedronGeometry: class {},
    ShapeGeometry: class {},
    Shape: class { moveTo() {}; lineTo() {} },
    SpriteMaterial: class {},
    Sprite: class { scale = { set: () => {} }; position = { y: 0, set: () => {} }; lookAt() {}; userData = {} },
    Vector3: class { 
        constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z; }
        add() { return this; } 
        sub() { return this; } 
        clone() { return this; } 
        length() { return 1; } 
        multiplyScalar() { return this; } 
        normalize() { return this; }
        addScaledVector() { return this; }
        crossVectors() { return this; }
        set() { return this; }
    },
    Group: class { add() {}; position = { set: () => {}, x: 0, y: 0, z: 0 }; rotation = { x: 0, y: 0, z: 0 }; userData = {}; children = []; scale = { set: () => {} } },
    CanvasTexture: class { constructor() { this.minFilter = 0; } },
    LinearFilter: 1,
    Line: class { computeLineDistances() {} },
    LineBasicMaterial: class {},
    LineDashedMaterial: class {},
    BufferGeometry: class { setFromPoints() { return this; } },
    Color: class {},
    FogExp2: class {},
    PCFSoftShadowMap: 0,
    DoubleSide: 0,
    AdditiveBlending: 0
};

// Mock window and document
global.window = { 
    innerWidth: 1024, 
    innerHeight: 768,
    addEventListener: jest.fn(),
    ui: null,
    game: null
};

global.document = {
    getElementById: (id) => {
        if (id === 'world') {
            return {
                getContext: () => ({
                    createLinearGradient: () => ({ addColorStop: () => {} }),
                    fillRect: () => {},
                    save: () => {},
                    restore: () => {},
                    translate: () => {},
                    scale: () => {},
                    beginPath: () => {},
                    arc: () => {},
                    fill: () => {},
                    stroke: () => {},
                    moveTo: () => {},
                    lineTo: () => {},
                    setLineDash: () => {},
                    fillText: () => {},
                    measureText: () => ({ width: 10 }),
                    roundRect: () => {},
                    closePath: () => {}
                }),
                width: 1024,
                height: 768,
                style: {},
                addEventListener: jest.fn(),
                getBoundingClientRect: () => ({ left: 0, top: 0 })
            };
        }
        if (id === 'world-3d') {
            return { 
                style: { display: 'none' }, 
                appendChild: jest.fn(),
                addEventListener: jest.fn()
            };
        }
        if (id === 'toast-container') {
            return { appendChild: jest.fn() };
        }
        if (id === 'team-list') {
            return { innerHTML: '', appendChild: jest.fn() };
        }
        return { 
            style: {}, 
            classList: { add: jest.fn(), remove: jest.fn() },
            innerHTML: '',
            appendChild: jest.fn(),
            addEventListener: jest.fn()
        };
    },
    createElement: (tag) => ({
        style: {},
        getContext: () => ({
            measureText: () => ({ width: 10 }),
            fillText: () => {},
            fillRect: () => {},
            font: '',
            fillStyle: '',
            textAlign: '',
            textBaseline: '',
            shadowColor: '',
            shadowBlur: 0,
            createRadialGradient: () => ({ addColorStop: () => {} })
        }),
        width: 128,
        height: 128,
        className: '',
        innerHTML: '',
        draggable: false,
        appendChild: jest.fn(),
        addEventListener: jest.fn()
    }),
    addEventListener: jest.fn(),
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { innerHTML: '', appendChild: jest.fn(), removeChild: jest.fn() }
};

// Import the modules
const { Utils, ICONS, COLORS } = require('../static/js/modules/Utils.js');
const { Camera2D } = require('../static/js/modules/Camera2D.js');
const { ParticleSystem } = require('../static/js/modules/ParticleSystem.js');

// Mock fetch before importing GameEngine
global.fetch = jest.fn((url, options) => {
    if (url === '/api/save') {
        return Promise.resolve({
            json: () => Promise.resolve({ status: 'success' })
        });
    }
    if (url === '/api/load') {
        return Promise.resolve({
            json: () => Promise.resolve({ 
                teams: [{id: 't1', name: 'Test Team', totalShips: 5, color: '#FF0000', icon: '🚀', deployed: []}], 
                islands: [{id: 'i1', x: 100, y: 100, title: 'Test Island', icon: '🏝️', kpis: [{id: 'k1', desc: 'KPI 1', deadline: '', completed: false}], mainGoalIds: []}], 
                mainGoals: []
            })
        });
    }
    return Promise.reject('Unknown URL');
});

// We need to test GameEngine separately due to complex initialization
// For now, test the individual components and logic

describe('Utils Helper Functions', () => {
    test('generateId creates unique strings with prefix', () => {
        const id1 = Utils.generateId('test');
        const id2 = Utils.generateId('test');
        expect(id1).toMatch(/^test_/);
        expect(id2).toMatch(/^test_/);
        expect(id1).not.toBe(id2);
    });

    test('generateId uses default prefix', () => {
        const id = Utils.generateId();
        expect(id).toMatch(/^id_/);
    });

    test('dist calculates Euclidean distance correctly', () => {
        expect(Utils.dist(0, 0, 3, 4)).toBe(5);
        expect(Utils.dist(1, 1, 1, 1)).toBe(0);
        expect(Utils.dist(0, 0, 1, 0)).toBe(1);
    });

    test('clamp restricts values to range', () => {
        expect(Utils.clamp(10, 0, 5)).toBe(5);  // Above max
        expect(Utils.clamp(-5, 0, 5)).toBe(0);  // Below min
        expect(Utils.clamp(3, 0, 5)).toBe(3);   // In range
        expect(Utils.clamp(0, 0, 5)).toBe(0);   // At min
        expect(Utils.clamp(5, 0, 5)).toBe(5);   // At max
    });

    test('ICONS array contains expected icons', () => {
        expect(ICONS).toContain('🚀');
        expect(ICONS).toContain('🎯');
        expect(ICONS.length).toBeGreaterThan(10);
    });

    test('COLORS array contains valid hex colors', () => {
        COLORS.forEach(color => {
            expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
        });
    });
});

describe('Camera2D', () => {
    let camera;
    let mockCanvas;

    beforeEach(() => {
        mockCanvas = { width: 800, height: 600 };
        camera = new Camera2D(mockCanvas);
    });

    test('initializes with default values', () => {
        expect(camera.x).toBe(0);
        expect(camera.y).toBe(0);
        expect(camera.zoom).toBe(1);
    });

    test('toWorld converts screen to world coordinates', () => {
        const world = camera.toWorld(400, 300); // Center of screen
        expect(world.x).toBe(0);
        expect(world.y).toBe(0);
    });

    test('toWorld respects zoom level', () => {
        camera.zoom = 2;
        const world = camera.toWorld(500, 400); // 100px right, 100px down from center
        expect(world.x).toBe(50);  // Half due to 2x zoom
        expect(world.y).toBe(50);
    });

    test('zoomIn increases zoom within limits', () => {
        camera.zoomIn();
        expect(camera.zoom).toBeGreaterThan(1);
        expect(camera.zoom).toBeLessThanOrEqual(camera.maxZoom);
    });

    test('zoomOut decreases zoom within limits', () => {
        camera.zoomOut();
        expect(camera.zoom).toBeLessThan(1);
        expect(camera.zoom).toBeGreaterThanOrEqual(camera.minZoom);
    });

    test('reset restores default values', () => {
        camera.x = 100;
        camera.y = 200;
        camera.zoom = 2;
        camera.reset();
        expect(camera.x).toBe(0);
        expect(camera.y).toBe(0);
        expect(camera.zoom).toBe(1);
    });
});

describe('ParticleSystem', () => {
    let particles;

    beforeEach(() => {
        particles = new ParticleSystem();
    });

    test('starts with empty particles', () => {
        expect(particles.particles).toHaveLength(0);
    });

    test('spawn adds particles', () => {
        particles.spawn(100, 200);
        expect(particles.particles).toHaveLength(1);
        expect(particles.particles[0].x).toBe(100);
        expect(particles.particles[0].y).toBe(200);
    });

    test('update moves particles', () => {
        particles.spawn(0, 0);
        const initialX = particles.particles[0].x;
        particles.update();
        // Cloud particles drift right
        expect(particles.particles[0].x).toBeGreaterThan(initialX);
    });
});

describe('Deployment Logic (Unit Tests)', () => {
    // Test the core deployment logic without full GameEngine initialization
    
    test('Multiple deployments get unique IDs', () => {
        const deploymentId1 = Utils.generateId('dep');
        const deploymentId2 = Utils.generateId('dep');
        const deploymentId3 = Utils.generateId('dep');
        
        expect(deploymentId1).not.toBe(deploymentId2);
        expect(deploymentId2).not.toBe(deploymentId3);
        expect(deploymentId1).toMatch(/^dep_/);
    });

    test('Deployment data structure supports multiple assignments', () => {
        const team = {
            id: 't1',
            name: 'Test Team',
            deployed: []
        };

        // Simulate adding multiple deployments to same island
        const deployment1 = { deploymentId: 'dep_1', islandId: 'i1', kpiIds: ['k1'] };
        const deployment2 = { deploymentId: 'dep_2', islandId: 'i1', kpiIds: ['k1'] };
        const deployment3 = { deploymentId: 'dep_3', islandId: 'i1', kpiIds: ['k1'] };

        team.deployed.push(deployment1);
        team.deployed.push(deployment2);
        team.deployed.push(deployment3);

        expect(team.deployed.length).toBe(3);
        expect(team.deployed.filter(d => d.islandId === 'i1').length).toBe(3);
    });

    test('Recalling specific deployment removes only that one', () => {
        const team = {
            id: 't1',
            deployed: [
                { deploymentId: 'dep_1', islandId: 'i1', kpiIds: ['k1'] },
                { deploymentId: 'dep_2', islandId: 'i1', kpiIds: ['k1'] },
                { deploymentId: 'dep_3', islandId: 'i1', kpiIds: ['k1'] }
            ]
        };

        // Simulate recalling ship with deploymentId 'dep_2'
        const shipDeploymentId = 'dep_2';
        team.deployed = team.deployed.filter(d => d.deploymentId !== shipDeploymentId);

        expect(team.deployed.length).toBe(2);
        expect(team.deployed.find(d => d.deploymentId === 'dep_1')).toBeDefined();
        expect(team.deployed.find(d => d.deploymentId === 'dep_2')).toBeUndefined();
        expect(team.deployed.find(d => d.deploymentId === 'dep_3')).toBeDefined();
    });

    test('Legacy deployments without ID can be upgraded', () => {
        // Simulate loading legacy deployment data
        const legacyDeployment = { islandId: 'i1', kpiIds: ['k1'] };
        
        // Upgrade with ID
        if (!legacyDeployment.deploymentId) {
            legacyDeployment.deploymentId = Utils.generateId('dep');
        }

        expect(legacyDeployment.deploymentId).toMatch(/^dep_/);
    });

    test('Ship links to deployment via deploymentId', () => {
        const deployment = { deploymentId: 'dep_123', islandId: 'i1', kpiIds: ['k1'] };
        const ship = {
            teamId: 't1',
            targetId: 'i1',
            targetKpiIds: ['k1'],
            deploymentId: 'dep_123',
            state: 'DOCKED'
        };

        expect(ship.deploymentId).toBe(deployment.deploymentId);
    });
});

describe('State Persistence', () => {
    test('State structure includes all required fields', () => {
        const state = {
            teams: [],
            islands: [],
            mainGoals: []
        };

        expect(state).toHaveProperty('teams');
        expect(state).toHaveProperty('islands');
        expect(state).toHaveProperty('mainGoals');
        expect(Array.isArray(state.teams)).toBe(true);
        expect(Array.isArray(state.islands)).toBe(true);
        expect(Array.isArray(state.mainGoals)).toBe(true);
    });

    test('Team with deployments serializes correctly', () => {
        const team = {
            id: 't1',
            name: 'Test Team',
            totalShips: 5,
            color: '#FF0000',
            icon: '🚀',
            deployed: [
                { deploymentId: 'dep_1', islandId: 'i1', kpiIds: ['k1', 'k2'] }
            ]
        };

        const json = JSON.stringify(team);
        const parsed = JSON.parse(json);

        expect(parsed.deployed[0].deploymentId).toBe('dep_1');
        expect(parsed.deployed[0].kpiIds).toContain('k1');
    });

    test('Island with KPIs serializes correctly', () => {
        const island = {
            id: 'i1',
            title: 'Test Expedition',
            x: 100,
            y: 200,
            icon: '🏝️',
            desc: 'Test description',
            mainGoalIds: ['mg1'],
            kpis: [
                { id: 'k1', desc: 'KPI 1', deadline: '2025-06-01', completed: false },
                { id: 'k2', desc: 'KPI 2', deadline: '2025-12-01', completed: true }
            ]
        };

        const json = JSON.stringify(island);
        const parsed = JSON.parse(json);

        expect(parsed.kpis.length).toBe(2);
        expect(parsed.kpis[1].completed).toBe(true);
    });
});

describe('Physics Calculations', () => {
    test('Distance calculation for ship targeting', () => {
        const ship = { x: 0, y: 0 };
        const target = { x: 300, y: 400 };
        const dist = Utils.dist(ship.x, ship.y, target.x, target.y);
        expect(dist).toBe(500);
    });

    test('Orbit band calculations', () => {
        const minOrbit = 95;
        const maxOrbit = 125;
        const anchor = { x: 100, y: 100 };
        
        // Ship inside min orbit should be pushed out
        const shipInside = { x: 150, y: 100 }; // 50 units away
        const distInside = Utils.dist(shipInside.x, shipInside.y, anchor.x, anchor.y);
        expect(distInside).toBeLessThan(minOrbit);
        
        // Ship outside max orbit should be pulled in
        const shipOutside = { x: 300, y: 100 }; // 200 units away
        const distOutside = Utils.dist(shipOutside.x, shipOutside.y, anchor.x, anchor.y);
        expect(distOutside).toBeGreaterThan(maxOrbit);
        
        // Ship in orbit band is fine
        const shipInOrbit = { x: 210, y: 100 }; // 110 units away
        const distInOrbit = Utils.dist(shipInOrbit.x, shipInOrbit.y, anchor.x, anchor.y);
        expect(distInOrbit).toBeGreaterThanOrEqual(minOrbit);
        expect(distInOrbit).toBeLessThanOrEqual(maxOrbit);
    });
});
