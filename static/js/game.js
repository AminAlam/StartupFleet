/**
 * Syntropic Fleet ENGINE v9.5
 * Features: Infinite Cam, Drag-n-Drop, File I/O, Advanced KPIs
 * Updates: Slot-Based Orbiting, Enhanced 3D View (Text, Icons, Lines)
 */

const ICONS = [
    '🚀', '🩺', '💊', '🏭', '💰', '⚖️', '💡', '🧪', '📈', '🤝', '🏗️', '🎓', '🚑', '📡', '⚓', '⭐',
    '📊', '🏛️', '💲', '📦', '🔧', '🧬', '🔬', '🏥', '🌍', '📢', '📝', '🛡️', '🎯', '🚢', '🗺️', '🕰️'
];
const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#F1948A'];

class Utils {
    static generateId(prefix = 'id') {
        return prefix + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    static showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if(!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<span style="color:#4fc3f7">ℹ</span> ${message}`;
        if (type === 'success') toast.innerHTML = `<span style="color:#66bb6a">✔</span> ${message}`;
        if (type === 'error') toast.innerHTML = `<span style="color:#ef5350">✖</span> ${message}`;
        
        container.appendChild(toast);
        setTimeout(() => { if(toast.parentNode) toast.parentNode.removeChild(toast); }, 3000);
    }

    static createTextTexture(text, color = '#333', fontSize = 40) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `bold ${fontSize}px Arial`;
        const metrics = ctx.measureText(text);
        const w = Math.ceil(metrics.width) + 20;
        const h = Math.ceil(fontSize * 1.5);
        canvas.width = w;
        canvas.height = h;
        
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(text, w/2, h/2);
        
        const tex = new THREE.CanvasTexture(canvas);
        tex.minFilter = THREE.LinearFilter;
        return { texture: tex, width: w, height: h, aspect: w/h };
    }
}

// --- 3D ENGINE (Three.js) ---
class ThreeEngine {
    constructor() {
        this.container = document.getElementById('world-3d');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.meshes = {}; 
        this.lines = []; // Store line objects to clear on sync
        this.isRunning = false;
        
        this.orbit = {
            radius: 800,
            theta: Math.PI / 4, 
            phi: Math.PI / 3,   
            target: new THREE.Vector3(0, 0, 0),
            mouseDown: false,
            lastX: 0,
            lastY: 0
        };
    }

    init() {
        if (this.scene) return;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xe0f7fa);
        this.scene.fog = new THREE.Fog(0xe0f7fa, 500, 4000);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
        this.updateCameraPosition();

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // Lights
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
        this.scene.add(hemiLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
        dirLight.position.set(500, 1000, 500);
        dirLight.castShadow = true;
        this.scene.add(dirLight);

        // Ocean - Dynamic Geometry for Waves
        const waterGeo = new THREE.PlaneGeometry(20000, 20000, 128, 128); 
        const waterMat = new THREE.MeshPhongMaterial({ 
            color: 0x006994, transparent: true, opacity: 0.75, shininess: 100, flatShading: true 
        });
        this.water = new THREE.Mesh(waterGeo, waterMat); 
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -30; // Lower water level
        this.scene.add(this.water);

        // Clouds
        this.createClouds();

        // North Star
        const starGeo = new THREE.SphereGeometry(150, 32, 32);
        const starMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
        const star = new THREE.Mesh(starGeo, starMat);
        star.position.set(0, 800, -1500);
        this.scene.add(star);
        
        // North Star Glow
        const spriteMat = new THREE.SpriteMaterial({ 
            map: new THREE.CanvasTexture(this.createGlowTexture()), 
            color: 0xffffee, transparent: true, blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Sprite(spriteMat);
        glow.scale.set(1000, 1000, 1);
        star.add(glow);

        // Events
        window.addEventListener('resize', () => this.resize());
        this.container.addEventListener('mousedown', e => this.onMouseDown(e));
        document.addEventListener('mousemove', e => this.onMouseMove(e));
        document.addEventListener('mouseup', e => this.onMouseUp(e));
        this.container.addEventListener('wheel', e => this.onWheel(e));
    }

    createClouds() {
        const cloudGeo = new THREE.SphereGeometry(60, 16, 16);
        const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
        
        this.clouds = [];
        for(let i=0; i<30; i++) {
            const group = new THREE.Group();
            
            // Random clusters
            for(let j=0; j<3+Math.random()*4; j++) {
                const puff = new THREE.Mesh(cloudGeo, cloudMat);
                puff.position.set(
                    (Math.random()-0.5)*150, 
                    (Math.random()-0.5)*50, 
                    (Math.random()-0.5)*100
                );
                const s = 0.5 + Math.random();
                puff.scale.set(s,s,s);
                group.add(puff);
            }
            
            group.position.set(
                (Math.random()-0.5) * 8000,
                800 + Math.random() * 800,
                (Math.random()-0.5) * 8000
            );
            
            this.scene.add(group);
            this.clouds.push(group);
        }
    }

    createGlowTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(64,64,0, 64,64,64);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0,128,128);
        return canvas;
    }

    start() {
        if (!this.scene) this.init();
        this.isRunning = true;
        this.animate();
        this.container.style.display = 'block';
    }

    stop() {
        this.isRunning = false;
        this.container.style.display = 'none';
    }

    resize() {
        if (!this.camera) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.animate());
        
        const time = Date.now() * 0.001;

        // Wave Calculation Function
        const getWaveHeight = (x, z) => {
            return Math.sin(x * 0.005 + time) * 15 + Math.cos(z * 0.005 + time * 0.8) * 15;
        };

        // Update Water Mesh
        if (this.water) {
            const positions = this.water.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i); // Local Y is World Z due to rotation
                const z = getWaveHeight(x, y);
                positions.setZ(i, z); // Local Z is World Y displacement
            }
            positions.needsUpdate = true;
            this.water.geometry.computeVertexNormals();
        }

        // Clouds Drift
        if (this.clouds) {
            this.clouds.forEach(c => {
                c.position.x += 0.5;
                if (c.position.x > 4000) c.position.x = -4000;
            });
        }

        // Sync Meshes
        Object.values(this.meshes).forEach(mesh => {
            if (mesh.userData.type === 'ship') {
                // Float on water
                const waterH = getWaveHeight(mesh.position.x, mesh.position.z);
                const baseY = this.water.position.y;
                mesh.position.y = baseY + waterH + 5; 
                
                // Billboard text
                if(mesh.children[1]) mesh.children[1].lookAt(this.camera.position);
            } else if (mesh.userData.type === 'goal') {
                mesh.position.y = 150 + Math.sin(time) * 10;
                mesh.rotation.y += 0.01;
                if(mesh.children[0]) mesh.children[0].lookAt(this.camera.position);
            } else if (mesh.userData.type === 'island') {
                if(mesh.children[1]) mesh.children[1].lookAt(this.camera.position); // Title
                if(mesh.children[2]) mesh.children[2].lookAt(this.camera.position); // Icon
                if(mesh.children.length > 3) {
                    mesh.children.forEach(child => {
                        if (child.userData.isKPI) {
                            child.lookAt(this.camera.position);
                        }
                    });
                }
            }
        });

        this.renderer.render(this.scene, this.camera);
    }

    sync(state, ships) {
        if (!this.scene) return;

        // Clear old lines
        this.lines.forEach(l => this.scene.remove(l));
        this.lines = [];

        // Helper to get/create mesh
        const getMesh = (id, createFn) => {
            if (!this.meshes[id]) {
                const mesh = createFn();
                mesh.userData = { id };
                this.scene.add(mesh);
                this.meshes[id] = mesh;
            }
            return this.meshes[id];
        };

        // 1. Islands
        state.islands.forEach(isl => {
            const mesh = getMesh(isl.id, () => {
                const group = new THREE.Group();
                group.userData.type = 'island';
                
                // Base - Deeper to anchor in water
                const g = new THREE.CylinderGeometry(70, 75, 80, 32);
                const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
                const base = new THREE.Mesh(g, m);
                base.position.y = 0; // Centered at 0, spans -40 to +40. Water at -30 to -10 approx.
                group.add(base);

                // Title Sprite
                const tData = Utils.createTextTexture(isl.title, '#01579b', 40);
                const sMat = new THREE.SpriteMaterial({ map: tData.texture });
                const sprite = new THREE.Sprite(sMat);
                sprite.scale.set(tData.aspect * 60, 60, 1);
                sprite.position.y = 90;
                group.add(sprite);

                // Icon Sprite
                const iData = Utils.createTextTexture(isl.icon, '#000', 80);
                const iMat = new THREE.SpriteMaterial({ map: iData.texture });
                const iSprite = new THREE.Sprite(iMat);
                iSprite.scale.set(iData.aspect * 50, 50, 1);
                iSprite.position.y = 40;
                group.add(iSprite);

                // KPI Satellites
                if (isl.kpis && isl.kpis.length > 0) {
                    const radius = 160;
                    const angleStep = (Math.PI * 2) / isl.kpis.length;
                    
                    isl.kpis.forEach((kpi, idx) => {
                        const angle = -Math.PI/2 + (idx * angleStep);
                        const kx = Math.cos(angle) * radius;
                        const kz = Math.sin(angle) * radius; // Z corresponds to Map Y

                        const kGroup = new THREE.Group();
                        kGroup.position.set(kx, 10, kz);
                        kGroup.userData.isKPI = true;

                        // Sphere
                        const kGeo = new THREE.SphereGeometry(15, 16, 16);
                        const kMat = new THREE.MeshLambertMaterial({ 
                            color: kpi.completed ? 0x66bb6a : 0xffa726 
                        });
                        const sphere = new THREE.Mesh(kGeo, kMat);
                        kGroup.add(sphere);

                        // Label
                        const label = kpi.id.split('_')[1] || (idx+1);
                        const lData = Utils.createTextTexture(`#${label}`, '#333', 24);
                        const lMat = new THREE.SpriteMaterial({ map: lData.texture });
                        const lSprite = new THREE.Sprite(lMat);
                        lSprite.scale.set(lData.aspect * 30, 30, 1);
                        lSprite.position.y = 25;
                        kGroup.add(lSprite);

                        group.add(kGroup);

                        // Connection Line to Base
                        const points = [ new THREE.Vector3(0, 10, 0), new THREE.Vector3(kx, 10, kz) ];
                        const lGeo = new THREE.BufferGeometry().setFromPoints(points);
                        const lMatLine = new THREE.LineBasicMaterial({ color: 0xcccccc, transparent:true, opacity:0.5 });
                        group.add(new THREE.Line(lGeo, lMatLine));
                    });
                }

                return group;
            });
            mesh.position.set(isl.x, 0, isl.y);

            // Draw Lines to Main Goals
            if (isl.mainGoalIds) {
                isl.mainGoalIds.forEach(mgId => {
                    const mg = state.mainGoals.find(m => m.id === mgId);
                    if (mg) {
                        const points = [
                            new THREE.Vector3(isl.x, 20, isl.y),
                            new THREE.Vector3(mg.x, 150, mg.y)
                        ];
                        const geo = new THREE.BufferGeometry().setFromPoints(points);
                        const mat = new THREE.LineDashedMaterial({ color: 0x0288d1, dashSize: 20, gapSize: 10 });
                        const line = new THREE.Line(geo, mat);
                        line.computeLineDistances();
                        this.scene.add(line);
                        this.lines.push(line);
                    }
                });
            }
        });

        // 2. Main Goals
        state.mainGoals.forEach(mg => {
            const mesh = getMesh(mg.id, () => {
                const group = new THREE.Group();
                group.userData.type = 'goal';

                const g = new THREE.OctahedronGeometry(50);
                const m = new THREE.MeshPhongMaterial({ color: 0xffd700, emissive: 0xaa4400, shininess: 100 });
                const gem = new THREE.Mesh(g, m);
                group.add(gem);

                // Label
                const tData = Utils.createTextTexture(mg.title, '#ffffff', 40);
                const sMat = new THREE.SpriteMaterial({ map: tData.texture });
                const sprite = new THREE.Sprite(sMat);
                sprite.scale.set(tData.aspect * 80, 80, 1);
                sprite.position.y = 70;
                group.add(sprite);

                return group;
            });
            mesh.position.set(mg.x, 150, mg.y);

            // Line to North Star
            const points = [
                new THREE.Vector3(mg.x, 150, mg.y),
                new THREE.Vector3(0, 800, -1500)
            ];
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.3 });
            const line = new THREE.Line(geo, mat);
            this.scene.add(line);
            this.lines.push(line);
        });

        // 3. Ships
        const activeShipIds = new Set();
        
        // Group ships by target to calculate slot positions for DOCKED state
        const dockedShipsByTarget = {};
        ships.forEach(s => {
            if (s.state === 'DOCKED') {
                const key = s.targetId + (s.targetKpiIds ? s.targetKpiIds.join('') : '');
                if (!dockedShipsByTarget[key]) dockedShipsByTarget[key] = [];
                dockedShipsByTarget[key].push(s);
            }
        });

        ships.forEach((s, i) => {
            const sid = `ship_${s.teamId}_${i}`; 
            activeShipIds.add(sid);
            
            const mesh = getMesh(sid, () => {
                const group = new THREE.Group();
                group.userData.type = 'ship';

                // Hull
                const hullGeo = new THREE.BoxGeometry(20, 10, 40);
                const hullMat = new THREE.MeshLambertMaterial({ color: s.color });
                const hull = new THREE.Mesh(hullGeo, hullMat);
                hull.position.y = 5;
                group.add(hull);

                // Cabin
                const cabinGeo = new THREE.BoxGeometry(14, 10, 15);
                const cabinMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
                const cabin = new THREE.Mesh(cabinGeo, cabinMat);
                cabin.position.set(0, 15, -5);
                group.add(cabin);

                return group;
            });
            
            mesh.position.set(s.x, 5, s.y);
            
            // Rotation
            if (s.facingLeft) mesh.rotation.y = Math.PI / 2;
            else mesh.rotation.y = -Math.PI / 2;
        });

        // Cleanup
        Object.keys(this.meshes).forEach(key => {
            if (key.startsWith('ship_') && !activeShipIds.has(key)) {
                this.scene.remove(this.meshes[key]);
                delete this.meshes[key];
            }
        });
    }

    // -- Orbit Controls --
    updateCameraPosition() {
        const x = this.orbit.radius * Math.sin(this.orbit.phi) * Math.sin(this.orbit.theta);
        const y = this.orbit.radius * Math.cos(this.orbit.phi);
        const z = this.orbit.radius * Math.sin(this.orbit.phi) * Math.cos(this.orbit.theta);
        
        this.camera.position.set(x, y, z).add(this.orbit.target);
        this.camera.lookAt(this.orbit.target);
    }

    onMouseDown(e) {
        this.orbit.mouseDown = true;
        this.orbit.lastX = e.clientX;
        this.orbit.lastY = e.clientY;
    }

    onMouseUp(e) {
        this.orbit.mouseDown = false;
    }

    onMouseMove(e) {
        if (!this.orbit.mouseDown) return;
        
        const deltaX = e.clientX - this.orbit.lastX;
        const deltaY = e.clientY - this.orbit.lastY;
        
        this.orbit.lastX = e.clientX;
        this.orbit.lastY = e.clientY;

        this.orbit.theta -= deltaX * 0.005;
        this.orbit.phi -= deltaY * 0.005;
        this.orbit.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.orbit.phi));
        
        this.updateCameraPosition();
    }

    onWheel(e) {
        e.preventDefault();
        this.orbit.radius += e.deltaY * 0.5;
        this.orbit.radius = Math.max(100, Math.min(3000, this.orbit.radius));
        this.updateCameraPosition();
    }
}

// --- 2D ENGINE ---
class Camera2D {
    constructor(canvas) {
        this.canvas = canvas;
        this.x = 0; 
        this.y = 0; 
        this.zoom = 1;
        this.minZoom = 0.2;
        this.maxZoom = 4.0;
    }

    toWorld(screenX, screenY) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        return {
            x: (screenX - centerX) / this.zoom + this.x,
            y: (screenY - centerY) / this.zoom + this.y
        };
    }

    apply(ctx) {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(this.zoom, this.zoom);
        ctx.translate(-this.x, -this.y);
    }

    zoomIn() { this.zoom = Math.min(this.zoom * 1.2, this.maxZoom); }
    zoomOut() { this.zoom = Math.max(this.zoom / 1.2, this.minZoom); }
    reset() { this.x = 0; this.y = 0; this.zoom = 1; }
}

class ParticleSystem {
    constructor() { this.particles = []; }
    spawn(x, y, type = 'cloud') {
        this.particles.push({
            x: x, y: y, type: type,
            vx: (Math.random() - 0.5) * 0.5, vy: (Math.random() - 0.5) * 0.2,
            life: 1.0, size: Math.random() * 20 + 10
        });
    }
    update() {
        this.particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if(p.type === 'cloud') { p.x += 0.2; if (p.x > 2000) p.x = -2000; }
        });
        this.particles = this.particles.filter(p => p.life > 0);
    }
    draw(ctx, zoom) {
        ctx.save();
        this.particles.forEach(p => {
            ctx.globalAlpha = 0.3; ctx.fillStyle = "#fff";
            if (p.type === 'cloud') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
                ctx.arc(p.x + 15, p.y - 5, p.size * 1.2, 0, Math.PI*2);
                ctx.arc(p.x + 30, p.y, p.size * 0.8, 0, Math.PI*2);
                ctx.fill();
            }
        });
        ctx.restore();
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('world');
        this.ctx = this.canvas.getContext('2d');
        
        this.state = { teams: [], islands: [], mainGoals: [] };
        
        this.camera = new Camera2D(this.canvas);
        this.particles = new ParticleSystem();
        this.threeEngine = new ThreeEngine();
        
        this.ships = []; 
        this.mouse = { x: 0, y: 0 }; 
        this.worldMouse = { x: 0, y: 0 };
        this.viewMode = 'map';

        this.placingIsland = false;
        this.placingMainGoal = false; 
        
        this.hoveredIsland = null;
        this.hoveredMainGoal = null;
        this.hoveredShip = null;
        
        this.isDraggingMap = false;
        this.draggingIsland = null; 
        this.draggingMainGoal = null; 
        
        this.dragStart = { x: 0, y: 0 }; 
        this.dragStartWorld = { x: 0, y: 0 }; 
        this.camStart = { x: 0, y: 0 };
        this.isDraggingItem = false; 
        
        this.time = 0;
        
        for(let i=0; i<30; i++) {
            this.particles.spawn((Math.random()-0.5)*3000, (Math.random()-0.5)*3000);
        }

        this.init();
    }

    async init() {
        this.resize();
        window.addEventListener('resize', () => {
            this.resize();
            this.threeEngine.resize();
        });
        
        this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', e => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', e => this.handleWheel(e));
        
        this.canvas.addEventListener('dragover', e => this.handleDragOver(e));
        this.canvas.addEventListener('drop', e => this.handleDrop(e));
        
        try {
            const res = await fetch('/api/load');
            const data = await res.json();
            this.loadState(data);
        } catch (e) {
            console.error("Failed to load initial state", e);
        }

        this.loop();
    }

    loadState(data) {
        this.state = data;
        if (!this.state.mainGoals) this.state.mainGoals = [];

        this.state.islands.forEach(i => {
            if (!Array.isArray(i.kpis)) {
                i.kpis = i.kpis ? [{ id: Utils.generateId('k'), desc: i.kpis, deadline: '', assigned: [] }] : [];
            }
            if(i.expanded === undefined) i.expanded = false;
            if (i.mainGoalId && !i.mainGoalIds) {
                i.mainGoalIds = [i.mainGoalId];
            }
            if (!i.mainGoalIds) {
                i.mainGoalIds = [];
            }
        });

        this.rebuildShips();
        if(typeof ui !== 'undefined') ui.renderTeams(); 
        Utils.showToast("Fleet Command Loaded", 'success');
    }

    rebuildShips() {
        this.ships = [];
        this.state.teams.forEach(team => {
            if(team.deployed) {
                team.deployed.forEach(deployment => {
                    let islandId, kpiIds;
                    if (typeof deployment === 'string') {
                        islandId = deployment;
                        kpiIds = [];
                    } else {
                        islandId = deployment.islandId;
                        kpiIds = deployment.kpiIds || (deployment.kpiId ? [deployment.kpiId] : []);
                    }

                    const island = this.state.islands.find(i => i.id === islandId);
                    if(island) {
                        const pos = this.getDeploymentTarget(island, kpiIds);
                        // Add slight random offset to prevent 0-distance NaN errors in physics
                        const offsetX = (Math.random() - 0.5) * 2; 
                        const offsetY = (Math.random() - 0.5) * 2;
                        this.createShip(team, island.id, kpiIds, pos.x + offsetX, pos.y + offsetY, 'DOCKED');
                    }
                });
            }
        });
    }

    getDeploymentTarget(island, kpiIds) {
        // Always anchor to the island center for orbiting
        return { x: island.x, y: island.y };
    }

    createShip(team, targetId, targetKpiIds, x, y, state) {
        this.ships.push({
            teamId: team.id,
            teamName: team.name,
            targetId: targetId, 
            targetKpiIds: targetKpiIds,
            x: x, y: y,
            vx: 0, vy: 0, // Physics velocity
            state: state, 
            color: team.color,
            icon: team.icon
        });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    loop() {
        this.time += 0.02;
        this.update();
        
        if (this.viewMode === 'map') {
            this.draw();
        } else if (this.viewMode === '3d') {
            this.threeEngine.sync(this.state, this.ships);
        }
        
        requestAnimationFrame(() => this.loop());
    }

    update() {
        this.particles.update();
        
        this.ships = this.ships.filter(ship => ship.state !== 'REMOVED');

        // Physics Constants
        const SEPARATION_DIST = 40; 
        const ISLAND_AVOID_RAD = 85; // Visual radius 70, Buffer 15
        const GOAL_AVOID_RAD = 100;
        const DAMPING = 0.94;

        this.ships.forEach(ship => {
            if (typeof ship.vx === 'undefined') { ship.vx = 0; ship.vy = 0; }

            let targetX, targetY;
            let minOrbit = 95, maxOrbit = 125; // Unified orbit band between Island(70) and KPIs(140)
            let anchor = null;

            if (ship.state === 'RETURNING') {
                targetX = this.camera.x - (this.canvas.width / 2 / this.camera.zoom) - 200;
                targetY = ship.y;
            } else {
                const island = this.state.islands.find(i => i.id === ship.targetId);
                if (island) {
                    anchor = { x: island.x, y: island.y };
                    targetX = anchor.x;
                    targetY = anchor.y;
                }
            }

            let fx = 0, fy = 0;

            if (ship.state === 'SAILING' || ship.state === 'RETURNING') {
                const dx = targetX - ship.x;
                const dy = targetY - ship.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                // Arrival at outer orbit edge
                let arrivalThreshold = minOrbit + 10; 
                if (ship.state === 'RETURNING') arrivalThreshold = 10;

                if (dist < arrivalThreshold) {
                    if (ship.state === 'RETURNING') {
                        ship.state = 'REMOVED';
                        ui.renderTeams();
                        Utils.showToast(`${ship.teamName} returned to HQ`);
                    } else {
                        ship.state = 'DOCKED';
                        Utils.showToast(`${ship.teamName} arrived at Objective`);
                        ship.vx *= 0.1; 
                        ship.vy *= 0.1;
                    }
                } else {
                    const speed = 0.15;
                    if(dist > 0.1) {
                        fx += (dx / dist) * speed;
                        fy += (dy / dist) * speed;
                    }
                }
            } 
            else if (ship.state === 'DOCKED' && anchor) {
                const dx = ship.x - anchor.x;
                const dy = ship.y - anchor.y;
                const dist = Math.sqrt(dx*dx + dy*dy);

                if (dist > 0.1) {
                    if (dist < minOrbit) {
                        const force = (minOrbit - dist) * 0.08; 
                        fx += (dx / dist) * force;
                        fy += (dy / dist) * force;
                    } else if (dist > maxOrbit) {
                        const force = (dist - maxOrbit) * 0.03; 
                        fx -= (dx / dist) * force;
                        fy -= (dy / dist) * force;
                    }

                    // Gentle Rotation (Clockwise)
                    fx += -(dy / dist) * 0.03;
                    fy += (dx / dist) * 0.03;
                } else {
                    fx += (Math.random() - 0.5);
                    fy += (Math.random() - 0.5);
                }

                // Random Wander
                fx += (Math.random() - 0.5) * 0.05;
                fy += (Math.random() - 0.5) * 0.05;
            }

            // --- Collision Avoidance ---
            
            // A. Separation
            this.ships.forEach(other => {
                if (ship === other) return;
                const dx = ship.x - other.x;
                const dy = ship.y - other.y;
                const distSq = dx*dx + dy*dy;
                
                if (distSq < SEPARATION_DIST * SEPARATION_DIST && distSq > 0.1) {
                    const dist = Math.sqrt(distSq);
                    const force = (SEPARATION_DIST - dist) * 0.15; 
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                }
            });

            // B. Avoid Islands
            this.state.islands.forEach(island => {
                // If SAILING to this island, allow approach
                if (ship.state === 'SAILING' && island.id === ship.targetId) return;

                const dx = ship.x - island.x;
                const dy = ship.y - island.y;
                const distSq = dx*dx + dy*dy;
                
                if (distSq < ISLAND_AVOID_RAD * ISLAND_AVOID_RAD) {
                    const dist = Math.sqrt(distSq);
                    const force = (ISLAND_AVOID_RAD - dist) * 0.25; 
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                }
            });

            // C. Avoid Main Goals
            this.state.mainGoals.forEach(mg => {
                const dx = ship.x - mg.x;
                const dy = ship.y - mg.y;
                const distSq = dx*dx + dy*dy;
                
                if (distSq < GOAL_AVOID_RAD * GOAL_AVOID_RAD) {
                    const dist = Math.sqrt(distSq);
                    const force = (GOAL_AVOID_RAD - dist) * 0.25;
                    fx += (dx / dist) * force;
                    fy += (dy / dist) * force;
                }
            });

            // Apply Physics
            ship.vx += fx;
            ship.vy += fy;
            
            ship.vx *= DAMPING;
            ship.vy *= DAMPING;

            // Speed Limit
            const speedSq = ship.vx*ship.vx + ship.vy*ship.vy;
            const MAX_SPEED = (ship.state === 'SAILING' || ship.state === 'RETURNING') ? 5.0 : 2.0;
            if (speedSq > MAX_SPEED * MAX_SPEED) {
                const speed = Math.sqrt(speedSq);
                ship.vx = (ship.vx / speed) * MAX_SPEED;
                ship.vy = (ship.vy / speed) * MAX_SPEED;
            }

            ship.x += ship.vx;
            ship.y += ship.vy;

            if (Math.abs(ship.vx) > 0.05) {
                ship.facingLeft = ship.vx < 0;
            }
        });
    }

    draw() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, "#e0f7fa");
        gradient.addColorStop(1, "#b2ebf2");
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        const offset = (this.time * 20) % 100;
        this.ctx.translate(0, offset);
        this.ctx.strokeStyle = "rgba(2, 119, 189, 0.05)";
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        for(let i=0; i < this.canvas.width; i+=150) {
            this.ctx.moveTo(i, -100);
            this.ctx.lineTo(i, this.canvas.height);
        }
        this.ctx.stroke();
        this.ctx.restore();

        this.camera.apply(this.ctx); 
        
        this.drawGrid();
        this.drawNorthStar();
        this.particles.draw(this.ctx, this.camera.zoom);

        this.state.mainGoals.forEach(mg => {
            this.ctx.strokeStyle = "rgba(2, 119, 189, 0.3)"; 
            this.ctx.setLineDash([15, 10]);
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(mg.x, mg.y);
            this.ctx.lineTo(0, -1200); 
            this.ctx.stroke();
        });

        this.state.islands.forEach(island => {
            const hasLinks = island.mainGoalIds && island.mainGoalIds.length > 0;
            if (hasLinks) {
                island.mainGoalIds.forEach(mgId => {
                    const mg = this.state.mainGoals.find(m => m.id === mgId);
                    if (mg) {
                        this.ctx.strokeStyle = "rgba(2, 119, 189, 0.4)";
                        this.ctx.setLineDash([8, 8]);
                        this.ctx.lineWidth = 2;
                        this.ctx.beginPath();
                        this.ctx.moveTo(island.x, island.y);
                        this.ctx.lineTo(mg.x, mg.y);
                        this.ctx.stroke();
                    }
                });
            } else {
                this.ctx.strokeStyle = "rgba(2, 119, 189, 0.15)";
                this.ctx.setLineDash([5, 5]);
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(island.x, island.y);
                this.ctx.lineTo(0, -1200);
                this.ctx.stroke();
            }
        });
        this.ctx.setLineDash([]);

        this.state.mainGoals.forEach(mg => this.drawMainGoal(mg));
        this.state.islands.forEach(island => this.drawIsland(island));

        this.ships.forEach(ship => {
            if(ship.state === 'SAILING' || ship.state === 'RETURNING') {
                this.drawShip(ship, ship.x, ship.y);
            }
        });

        if(this.placingIsland) {
            this.ctx.globalAlpha = 0.5;
            this.drawIsland({x: this.worldMouse.x, y: this.worldMouse.y, title:'New Site', icon:'📍', kpis:[]});
            this.ctx.globalAlpha = 1.0;
        }

        if(this.placingMainGoal) {
            this.ctx.globalAlpha = 0.5;
            this.drawMainGoal({x: this.worldMouse.x, y: this.worldMouse.y, title:'New Goal', icon:'🎯'});
            this.ctx.globalAlpha = 1.0;
        }

        this.ctx.restore(); 

        if(this.placingIsland) {
            this.ctx.fillStyle = "rgba(0,0,0,0.7)";
            this.ctx.font = "16px Poppins";
            this.ctx.fillText("Click to place Expedition", this.mouse.x + 20, this.mouse.y);
        }
        if(this.placingMainGoal) {
            this.ctx.fillStyle = "rgba(0,0,0,0.7)";
            this.ctx.font = "16px Poppins";
            this.ctx.fillText("Click to place Main Goal", this.mouse.x + 20, this.mouse.y);
        }
    }

    drawNorthStar() {
        const starX = 0;
        const starY = -1200; 
        const pulse = 1 + Math.sin(this.time * 2) * 0.2;
        const gradient = this.ctx.createRadialGradient(starX, starY, 10, starX, starY, 400 * pulse);
        gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradient.addColorStop(0.1, "rgba(255, 215, 0, 0.6)");
        gradient.addColorStop(1, "rgba(255, 215, 0, 0)");
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(starX, starY, 400 * pulse, 0, Math.PI*2);
        this.ctx.fill();

        this.ctx.fillStyle = "#fff";
        this.ctx.font = "120px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText("✦", starX, starY);
        
        this.ctx.font = "bold 60px Poppins";
        this.ctx.fillStyle = "rgba(2, 119, 189, 0.8)";
        this.ctx.fillText("NORTH STAR VISION", starX, starY + 100);
    }

    drawMainGoal(mg) {
        const isHovered = (this.hoveredMainGoal && this.hoveredMainGoal.id === mg.id);
        const isDragging = (this.draggingMainGoal && this.draggingMainGoal.id === mg.id);
        
        this.ctx.save();
        this.ctx.shadowColor = "rgba(0,0,0,0.1)";
        this.ctx.shadowBlur = 30;
        
        this.ctx.fillStyle = (isHovered || isDragging) ? "#fff" : "rgba(255,255,255,0.9)";
        this.ctx.beginPath();
        this.ctx.moveTo(mg.x, mg.y - 80);
        this.ctx.lineTo(mg.x + 100, mg.y);
        this.ctx.lineTo(mg.x, mg.y + 80);
        this.ctx.lineTo(mg.x - 100, mg.y);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        this.ctx.strokeStyle = "#fbc02d"; 
        this.ctx.lineWidth = 4;
        this.ctx.stroke();

        this.ctx.fillStyle = "#333";
        this.ctx.font = "60px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(mg.icon, mg.x, mg.y - 10);

        this.ctx.fillStyle = "#01579b";
        this.ctx.font = "bold 18px Poppins";
        this.ctx.fillText(mg.title, mg.x, mg.y + 45);

        if(isHovered) {
             this.ctx.fillStyle = "rgba(0,0,0,0.8)";
             this.ctx.font = "14px Poppins";
             this.ctx.fillText("MAIN GOAL (Double-click to Edit)", mg.x, mg.y - 100);
        }

        this.ctx.restore();
    }

    drawGrid() {
        const gridSize = 300;
        const left = this.camera.x - (this.canvas.width / 2 / this.camera.zoom);
        const right = this.camera.x + (this.canvas.width / 2 / this.camera.zoom);
        const top = this.camera.y - (this.canvas.height / 2 / this.camera.zoom);
        const bottom = this.camera.y + (this.canvas.height / 2 / this.camera.zoom);

        const startX = Math.floor(left / gridSize) * gridSize;
        const startY = Math.floor(top / gridSize) * gridSize;

        this.ctx.strokeStyle = "rgba(2, 119, 189, 0.1)";
        this.ctx.lineWidth = 1 / this.camera.zoom;

        this.ctx.beginPath();
        for (let x = startX; x < right; x += gridSize) {
            this.ctx.moveTo(x, top);
            this.ctx.lineTo(x, bottom);
        }
        for (let y = startY; y < bottom; y += gridSize) {
            this.ctx.moveTo(left, y);
            this.ctx.lineTo(right, y);
        }
        this.ctx.stroke();
    }

    drawIsland(island) {
        const isHovered = (this.hoveredIsland && this.hoveredIsland.id === island.id);
        const isTarget = (this.isDraggingItem && isHovered);
        const isDragging = (this.draggingIsland && this.draggingIsland.id === island.id);

        this.ctx.fillStyle = (isTarget || isDragging) ? "#e1f5fe" : "rgba(255,255,255,0.95)";
        if (isTarget || isDragging) {
            this.ctx.shadowColor = "#0288d1";
            this.ctx.shadowBlur = 40;
        } else {
            this.ctx.shadowColor = "rgba(0,0,0,0.1)";
            this.ctx.shadowBlur = 15;
        }
        
        this.ctx.beginPath();
        this.ctx.arc(island.x, island.y, 70, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        if (isHovered || isTarget || isDragging) {
            this.ctx.strokeStyle = "#0288d1";
            this.ctx.lineWidth = 4 / this.camera.zoom;
            this.ctx.stroke();
        }

        this.ctx.fillStyle = "#333";
        this.ctx.font = "50px Arial";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(island.icon, island.x, island.y - 10);

        this.ctx.fillStyle = "#37474f";
        this.ctx.font = "bold 16px Poppins";
        this.ctx.fillText(island.title, island.x, island.y + 40);

        if (island.kpis && island.kpis.length > 0) {
            const count = island.kpis.length;
            const radius = 140; 
            const angleStep = (Math.PI * 2) / Math.max(1, count);
            
            island.kpis.forEach((kpi, idx) => {
                const angle = -Math.PI/2 + (idx * angleStep);
                const kx = island.x + Math.cos(angle) * radius;
                const ky = island.y + Math.sin(angle) * radius;

                this.ctx.strokeStyle = "rgba(0,0,0,0.1)";
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(island.x, island.y);
                this.ctx.lineTo(kx, ky);
                this.ctx.stroke();

                this.ctx.fillStyle = "white";
                this.ctx.beginPath();
                this.ctx.arc(kx, ky, 25, 0, Math.PI*2);
                this.ctx.fill();
                
                this.ctx.strokeStyle = kpi.completed ? "#66bb6a" : "#ffa726";
                this.ctx.lineWidth = 2;
                this.ctx.stroke();

                this.ctx.fillStyle = "#555";
                this.ctx.font = "bold 10px monospace";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                const kpiLabel = kpi.id.split('_')[1] || (idx+1); 
                this.ctx.fillText(`#${kpiLabel}`, kx, ky);

                this.ctx.fillStyle = "#37474f";
                this.ctx.font = "10px Poppins";
                const shortDesc = kpi.desc.length > 15 ? kpi.desc.substring(0,12)+'...' : kpi.desc;
                this.ctx.fillText(shortDesc, kx, ky + 35);
            });
        }

        this.drawExpandButton(island);

        if(island.expanded) {
            this.drawDetailsPanel(island);
        }

        const dockedShips = this.ships.filter(s => s.targetId === island.id && s.state === 'DOCKED');
        if (dockedShips.length > 0) {
            dockedShips.forEach((ship) => {
                this.drawShip(ship, ship.x, ship.y, true);
            });
        }
    }

    drawExpandButton(island) {
        const btnX = island.x + 50;
        const btnY = island.y + 50;
        
        this.ctx.fillStyle = island.expanded ? "#ef5350" : "#29b6f6";
        this.ctx.beginPath();
        this.ctx.arc(btnX, btnY, 14, 0, Math.PI*2);
        this.ctx.fill();
        
        this.ctx.fillStyle = "white";
        this.ctx.font = "bold 18px monospace";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(island.expanded ? "-" : "+", btnX, btnY + 1);
    }

    drawDetailsPanel(island) {
        const width = 300;
        const x = island.x - width/2;
        const y = island.y + 80;
        
        const kpis = island.kpis || [];
        const descHeight = 40; 
        const height = 50 + descHeight + (kpis.length * 40); 

        this.ctx.save();
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        this.ctx.shadowColor = "rgba(0,0,0,0.1)";
        this.ctx.shadowBlur = 20;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, width, height, 12);
        this.ctx.fill();
        
        this.ctx.fillStyle = "#455a64";
        this.ctx.font = "bold 14px Poppins";
        this.ctx.textAlign = "left";
        this.ctx.fillText("OBJECTIVES & KPIs", x + 15, y + 25);
        
        this.ctx.beginPath();
        this.ctx.moveTo(x + 15, y + 35);
        this.ctx.lineTo(x + width - 15, y + 35);
        this.ctx.strokeStyle = "#eee";
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        let ty = y + 55;

        if(island.desc) {
            this.ctx.font = "italic 11px Poppins";
            this.ctx.fillStyle = "#78909c";
            const text = island.desc.length > 45 ? island.desc.substring(0, 45) + '...' : island.desc;
            this.ctx.fillText(text, x + 15, ty);
            ty += 20;
        }

        this.ctx.font = "13px Poppins";
        
        if (kpis.length === 0) {
            this.ctx.fillStyle = "#999";
            this.ctx.fillText("No KPIs defined yet.", x + 15, ty);
        }

        kpis.forEach(kpi => {
            this.ctx.fillStyle = kpi.completed ? "#66bb6a" : "#ffa726";
            this.ctx.beginPath();
            this.ctx.arc(x + 20, ty - 4, 4, 0, Math.PI*2);
            this.ctx.fill();

            this.ctx.fillStyle = "#333";
            const text = kpi.desc.length > 30 ? kpi.desc.substring(0, 30) + '...' : kpi.desc;
            this.ctx.fillText(text, x + 35, ty);
            
            if(kpi.deadline) {
                this.ctx.fillStyle = "#90a4ae";
                this.ctx.font = "10px Poppins";
                this.ctx.fillText(kpi.deadline, x + width - 75, ty);
                this.ctx.font = "13px Poppins"; 
            }
            ty += 35;
        });

        this.ctx.restore();
    }

    drawShip(ship, x, y, isDocked = false) {
        const bob = Math.sin(this.time + (x * 0.1)) * 3;
        const drawY = y + bob;

        const isHovered = (this.hoveredShip && this.hoveredShip === ship);
        if(isHovered && isDocked) {
             this.ctx.strokeStyle = "#ef5350";
             this.ctx.lineWidth = 2;
             this.ctx.beginPath();
             this.ctx.arc(x, drawY + 2, 45, 0, Math.PI*2);
             this.ctx.stroke();
             
             this.ctx.fillStyle = "#ef5350";
             this.ctx.beginPath();
             this.ctx.arc(x + 30, drawY - 30, 12, 0, Math.PI*2);
             this.ctx.fill();
             this.ctx.fillStyle = "white";
             this.ctx.font = "bold 14px Arial";
             this.ctx.textAlign = "center";
             this.ctx.textBaseline = "middle";
             this.ctx.fillText("×", x + 30, drawY - 30);
        }

        this.ctx.fillStyle = ship.color;
        this.ctx.beginPath();
        
        let dir = 1;
        if (ship.state === 'RETURNING') dir = -1;
        else if (ship.state === 'DOCKED' && ship.facingLeft) dir = -1;
        
        this.ctx.moveTo(x - (30 * dir), drawY - 10);
        this.ctx.lineTo(x + (30 * dir), drawY - 10); 
        this.ctx.lineTo(x + (20 * dir), drawY + 15); 
        this.ctx.lineTo(x - (20 * dir), drawY + 15); 
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.fillStyle = "rgba(255,255,255,0.4)";
        this.ctx.fillRect(x + (5*dir) - (dir===-1?20:0), drawY - 25, 20, 15);
        this.ctx.fillStyle = "#333";
        this.ctx.fillRect(x - (10*dir) - (dir===-1?8:0), drawY - 25, 8, 15);

        this.ctx.fillStyle = "#fff";
        this.ctx.font = "bold 10px Poppins";
        this.ctx.textAlign = "center";
        this.ctx.shadowColor = "rgba(0,0,0,0.8)";
        this.ctx.shadowBlur = 3;
        this.ctx.fillText(ship.teamName.substring(0, 12), x, drawY + 2);
        this.ctx.shadowBlur = 0;

        if(isDocked && ship.targetKpiIds && ship.targetKpiIds.length > 0) {
            const island = this.state.islands.find(i => i.id === ship.targetId);
            if(island && island.kpis) {
                const count = island.kpis.length;
                const radius = 140; 
                const angleStep = (Math.PI * 2) / Math.max(1, count);

                ship.targetKpiIds.forEach(kId => {
                    const idx = island.kpis.findIndex(k => k.id === kId);
                    if(idx !== -1) {
                        const angle = -Math.PI/2 + (idx * angleStep);
                        const kx = island.x + Math.cos(angle) * radius;
                        const ky = island.y + Math.sin(angle) * radius;
                        
                        this.ctx.strokeStyle = ship.color;
                        this.ctx.globalAlpha = 0.4;
                        this.ctx.lineWidth = 1;
                        this.ctx.setLineDash([4, 4]);
                        this.ctx.beginPath();
                        this.ctx.moveTo(x, drawY);
                        this.ctx.lineTo(kx, ky);
                        this.ctx.stroke();
                        this.ctx.setLineDash([]);
                        this.ctx.globalAlpha = 1.0;
                    }
                });
            }
        }
    }

    // --- INPUT ---

    handleWheel(e) {
        e.preventDefault();
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        this.camera.zoom = Math.min(Math.max(this.camera.zoom + delta, this.camera.minZoom), this.camera.maxZoom);
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
        this.worldMouse = this.camera.toWorld(this.mouse.x, this.mouse.y);

        if (this.draggingIsland) {
            this.draggingIsland.x = this.worldMouse.x - this.dragStartWorld.dx;
            this.draggingIsland.y = this.worldMouse.y - this.dragStartWorld.dy;
            return;
        }

        if (this.draggingMainGoal) {
            this.draggingMainGoal.x = this.worldMouse.x - this.dragStartWorld.dx;
            this.draggingMainGoal.y = this.worldMouse.y - this.dragStartWorld.dy;
            return;
        }

        if (this.isDraggingMap) {
            const dx = (this.mouse.x - this.dragStart.x) / this.camera.zoom;
            const dy = (this.mouse.y - this.dragStart.y) / this.camera.zoom;
            this.camera.x = this.camStart.x - dx;
            this.camera.y = this.camStart.y - dy;
            return;
        }

        this.hoveredIsland = this.state.islands.find(i => {
            const dx = this.worldMouse.x - i.x;
            const dy = this.worldMouse.y - i.y;
            return (dx*dx + dy*dy) < 70*70; 
        });

        this.hoveredMainGoal = null;
        if (!this.hoveredIsland) {
            this.hoveredMainGoal = this.state.mainGoals.find(mg => {
                const dx = this.worldMouse.x - mg.x;
                const dy = this.worldMouse.y - mg.y;
                return (dx*dx + dy*dy) < 80*80; 
            });
        }

        if(!this.hoveredIsland && !this.hoveredMainGoal) {
            this.hoveredShip = this.ships.find(s => {
                if(s.state !== 'DOCKED') return false;
                const dx = this.worldMouse.x - s.x;
                const dy = this.worldMouse.y - s.y;
                return (dx*dx + dy*dy) < 40*40;
            });
        } else {
            this.hoveredShip = null;
        }

        if (this.placingIsland || this.placingMainGoal || this.hoveredIsland || this.hoveredShip || this.hoveredMainGoal) {
            this.canvas.style.cursor = 'pointer';
        } else if (this.isDraggingMap || this.draggingIsland) {
            this.canvas.style.cursor = 'grabbing';
        } else {
            this.canvas.style.cursor = 'grab';
        }
    }

    handleMouseDown(e) {
        if (e.target !== this.canvas) return;

        if (this.placingIsland) {
            ui.openIslandModal(this.worldMouse.x, this.worldMouse.y);
            this.placingIsland = false;
            return;
        }

        if (this.placingMainGoal) {
            ui.openMainGoalModal(this.worldMouse.x, this.worldMouse.y);
            this.placingMainGoal = false;
            return;
        }

        if (this.hoveredIsland) {
            const btnX = this.hoveredIsland.x + 50;
            const btnY = this.hoveredIsland.y + 50;
            const dist = Math.sqrt(Math.pow(this.worldMouse.x - btnX, 2) + Math.pow(this.worldMouse.y - btnY, 2));
            
            if(dist < 20) {
                this.hoveredIsland.expanded = !this.hoveredIsland.expanded;
                return;
            }
            
            this.draggingIsland = this.hoveredIsland;
            this.dragStart = { x: this.mouse.x, y: this.mouse.y }; 
            this.dragStartWorld = { 
                dx: this.worldMouse.x - this.hoveredIsland.x,
                dy: this.worldMouse.y - this.hoveredIsland.y
            };
            return;
        }

        if (this.hoveredMainGoal) {
            this.draggingMainGoal = this.hoveredMainGoal;
            this.dragStart = { x: this.mouse.x, y: this.mouse.y }; 
            this.dragStartWorld = { 
                dx: this.worldMouse.x - this.hoveredMainGoal.x,
                dy: this.worldMouse.y - this.hoveredMainGoal.y
            };
            return;
        }

        if (this.hoveredShip) {
            this.recallShip(this.hoveredShip);
            return;
        }

        this.isDraggingMap = true;
        this.dragStart = { x: this.mouse.x, y: this.mouse.y };
        this.camStart = { x: this.camera.x, y: this.camera.y };
    }

    handleMouseUp(e) {
        if (this.draggingIsland) {
            const dist = Math.sqrt(Math.pow(this.mouse.x - this.dragStart.x, 2) + Math.pow(this.mouse.y - this.dragStart.y, 2));
            if (dist < 5) {
                ui.openIslandModal(null, null, this.draggingIsland);
            }
            this.draggingIsland = null;
        }
        
        if (this.draggingMainGoal) {
             const dist = Math.sqrt(Math.pow(this.mouse.x - this.dragStart.x, 2) + Math.pow(this.mouse.y - this.dragStart.y, 2));
             if (dist < 5) {
                ui.openMainGoalModal(null, null, this.draggingMainGoal);
             }
             this.draggingMainGoal = null;
        }

        this.isDraggingMap = false;
    }

    handleDragOver(e) {
        e.preventDefault();
        this.isDraggingItem = true;
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wm = this.camera.toWorld(mx, my);
        
        this.hoveredIsland = this.state.islands.find(i => {
            const dx = wm.x - i.x;
            const dy = wm.y - i.y;
            return (dx*dx + dy*dy) < 70*70;
        });
    }

    handleDrop(e) {
        e.preventDefault();
        this.isDraggingItem = false;
        
        const rect = this.canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const wm = this.camera.toWorld(mx, my);
        
        const targetIsland = this.state.islands.find(i => {
            const dx = wm.x - i.x;
            const dy = wm.y - i.y;
            return (dx*dx + dy*dy) < 70*70;
        });

        const teamId = e.dataTransfer.getData("text/plain");
        
        if (targetIsland && teamId) {
            ui.selectKpiModal(targetIsland, teamId);
        }
    }

    // --- LOGIC ---

    assignTeam(teamId, island, kpiIds) {
        const team = this.state.teams.find(t => t.id === teamId);
        if (!team) return;
        if (!team.deployed) team.deployed = [];
        if (team.deployed.length >= team.totalShips) {
            Utils.showToast("Maximum resources already deployed for this team", "error");
            return;
        }

        const kpisToStore = kpiIds || [];
        team.deployed.push({ islandId: island.id, kpiIds: kpisToStore });
        
        const startX = this.camera.x - (this.canvas.width/2 / this.camera.zoom) - 100;
        
        const pos = this.getDeploymentTarget(island, kpisToStore);
        this.createShip(team, island.id, kpisToStore, startX, island.y, 'SAILING');
        
        ui.renderTeams();
        this.autoSave();
        Utils.showToast(`Deploying ${team.name} to ${island.title}`);
    }

    recallShip(ship) {
        if(confirm(`Recall ${ship.teamName}?`)) {
            const team = this.state.teams.find(t => t.id === ship.teamId);
            if(team) {
                const idx = team.deployed.findIndex(d => {
                    if (typeof d === 'string') return d === ship.targetId;
                    
                    if (d.islandId !== ship.targetId) return false;
                    
                    const sIds = ship.targetKpiIds || [];
                    const dIds = d.kpiIds || (d.kpiId ? [d.kpiId] : []);
                    
                    if (sIds.length !== dIds.length) return false;
                    return sIds.every(id => dIds.includes(id));
                });
                
                if(idx > -1) team.deployed.splice(idx, 1);
            }
            ship.state = 'RETURNING';
            this.autoSave();
        }
    }

    addIslandMode() { 
        this.placingIsland = true; 
        this.placingMainGoal = false;
        Utils.showToast("Click map to place Expedition");
    }

    addMainGoalMode() {
        this.placingMainGoal = true;
        this.placingIsland = false;
        Utils.showToast("Click map to place Main Goal");
    }

    async autoSave() {
        try {
            await fetch('/api/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.state)
            });
        } catch (e) {
            console.error("Autosave failed", e);
        }
    }

    saveToFile() {
        this.autoSave();
        const dataStr = JSON.stringify(this.state, null, 2);
        const blob = new Blob([dataStr], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `fleet_config_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        Utils.showToast("Configuration Saved", 'success');
    }

    loadFromFile(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.loadState(data);
                this.autoSave();
                // Clear input to allow reloading same file
                input.value = '';
            } catch (err) {
                console.error(err);
                Utils.showToast("Error parsing JSON file", 'error');
                input.value = '';
            }
        };
        reader.readAsText(file);
    }
}

class UIController {
    constructor() {}

    switchView(view) {
        document.getElementById('btn-view-map').classList.remove('active-view');
        document.getElementById('btn-view-matrix').classList.remove('active-view');
        document.getElementById('btn-view-3d').classList.remove('active-view');
        document.getElementById('dashboard-view').classList.add('hidden');
        
        const canvas = document.getElementById('world');
        const threeContainer = document.getElementById('world-3d');
        
        // Reset Visibilities
        canvas.style.display = 'block';
        threeContainer.style.display = 'none';
        game.threeEngine.stop();
        game.viewMode = 'map';

        if (view === 'map') {
            document.getElementById('btn-view-map').classList.add('active-view');
        } else if (view === '3d') {
            document.getElementById('btn-view-3d').classList.add('active-view');
            game.viewMode = '3d';
            canvas.style.display = 'none';
            game.threeEngine.start();
        } else {
            document.getElementById('btn-view-matrix').classList.add('active-view');
            document.getElementById('dashboard-view').classList.remove('hidden');
            this.renderDashboard();
        }
    }

    renderDashboard() {
        const metrics = this.calculateMetrics();
        const dashboard = document.querySelector('.dashboard-content');
        dashboard.innerHTML = '<h1>Strategy Matrix & Resource Load</h1>';

        // 1. Goal Health Section
        const goalSection = document.createElement('div');
        goalSection.className = 'dashboard-section';
        goalSection.innerHTML = '<h2>Strategic Goals Health & Progress</h2><div id="goal-health-grid" class="goals-grid"></div>';
        dashboard.appendChild(goalSection);
        this.renderGoalHealth(metrics);

        // 2. Team Load Section
        const teamSection = document.createElement('div');
        teamSection.className = 'dashboard-section';
        teamSection.innerHTML = '<h2>Team Utilization & Focus</h2><div id="utilization-charts" class="charts-grid"></div>';
        dashboard.appendChild(teamSection);
        this.renderTeamCharts(metrics);

        // 3. Matrix Table
        const matrixSection = document.createElement('div');
        matrixSection.className = 'dashboard-section';
        matrixSection.innerHTML = '<h2>Allocation Matrix (Teams vs Expeditions)</h2><div class="table-wrapper"><table id="matrix-table"></table></div>';
        dashboard.appendChild(matrixSection);
        this.renderMatrixTable();

        // 4. Enhanced Timeline
        const timelineSection = document.createElement('div');
        timelineSection.className = 'dashboard-section';
        timelineSection.innerHTML = '<h2>Strategic Roadmap (Quarterly Goals)</h2><div id="timeline-container"></div>';
        dashboard.appendChild(timelineSection);
        this.renderEnhancedTimeline(metrics);
    }

    calculateMetrics() {
        // Map: kpiId -> Array of Team Objects assigned
        const kpiAssignments = {};
        const teamFocus = {}; // teamId -> { goalId: count }

        game.state.teams.forEach(t => {
            if(!teamFocus[t.id]) teamFocus[t.id] = {};
            if(t.deployed) {
                t.deployed.forEach(d => {
                    const kpiIds = d.kpiIds || [];
                    const islId = d.islandId || d; // Handle legacy string
                    
                    // Count focus based on Main Goal of the island
                    const island = game.state.islands.find(i => i.id === islId);
                    if(island && island.mainGoalIds) {
                        island.mainGoalIds.forEach(mgId => {
                            teamFocus[t.id][mgId] = (teamFocus[t.id][mgId] || 0) + 1;
                        });
                    }

                    kpiIds.forEach(kid => {
                        if(!kpiAssignments[kid]) kpiAssignments[kid] = [];
                        kpiAssignments[kid].push(t);
                    });
                });
            }
        });

        return { kpiAssignments, teamFocus };
    }

    renderGoalHealth(metrics) {
        const container = document.getElementById('goal-health-grid');
        
        game.state.mainGoals.forEach(mg => {
            let totalKpis = 0;
            let completedKpis = 0;
            let totalShips = 0;

            // Aggregate data from child islands
            game.state.islands.forEach(isl => {
                if(isl.mainGoalIds && isl.mainGoalIds.includes(mg.id)) {
                    if(isl.kpis) {
                        totalKpis += isl.kpis.length;
                        completedKpis += isl.kpis.filter(k => k.completed).length;
                    }
                    // Count ships on this island
                    game.state.teams.forEach(t => {
                        if(t.deployed) {
                            t.deployed.forEach(d => {
                                if((d.islandId === isl.id) || (d === isl.id)) totalShips++;
                            });
                        }
                    });
                }
            });

            const progress = totalKpis > 0 ? Math.round((completedKpis / totalKpis) * 100) : 0;
            const isRisk = totalShips === 0 && totalKpis > 0 && progress < 100;

            const card = document.createElement('div');
            card.className = 'goal-health-card';
            card.innerHTML = `
                <div class="goal-header">
                    <div class="goal-title">${mg.icon} ${mg.title}</div>
                    <div class="goal-status ${isRisk ? 'status-risk' : 'status-good'}">
                        ${isRisk ? 'Risk: Unstaffed' : 'Active'}
                    </div>
                </div>
                <div style="font-size:12px; color:#666">${mg.desc || 'No description'}</div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${progress}%; background:${isRisk ? '#ef5350' : '#66bb6a'}"></div>
                </div>
                <div class="goal-metrics">
                    <span>${completedKpis}/${totalKpis} KPIs Done</span>
                    <span>${totalShips} Ships Deployed</span>
                </div>
            `;
            container.appendChild(card);
        });
    }

    renderTeamCharts(metrics) {
        const container = document.getElementById('utilization-charts');
        game.state.teams.forEach(t => {
            const deployed = t.deployed ? t.deployed.length : 0;
            const pct = (deployed / t.totalShips) * 100;
            
            // Determine Primary Focus
            let topGoalId = null;
            let maxCount = 0;
            const focusMap = metrics.teamFocus[t.id] || {};
            for(const [gid, count] of Object.entries(focusMap)) {
                if(count > maxCount) { maxCount = count; topGoalId = gid; }
            }
            const topGoal = topGoalId ? game.state.mainGoals.find(g => g.id === topGoalId) : null;
            const focusText = topGoal ? `Focus: ${topGoal.title}` : 'No specific focus';

            const card = document.createElement('div');
            card.className = 'chart-card';
            card.innerHTML = `
                <div class="team-header">
                    <span>${t.icon} ${t.name}</span>
                    <span>${Math.round(pct)}% Utilized</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width:${pct}%; background:${t.color}"></div>
                </div>
                <div style="margin-top:8px; font-size:11px; color:#546e7a; display:flex; justify-content:space-between;">
                    <span>${deployed}/${t.totalShips} Ships</span>
                    <span style="font-weight:600">${focusText}</span>
                </div>
            `;
            container.appendChild(card);
        });
    }

    renderMatrixTable() {
        const table = document.getElementById('matrix-table');
        const islands = game.state.islands;
        
        let html = `<thead><tr><th style="width:200px; background:#fff; position:sticky; left:0; z-index:10;">Team / Expedition</th>`;
        islands.forEach(isl => {
             html += `<th style="min-width:120px; vertical-align:bottom; padding-bottom:10px;">
                <div style="text-align:center; font-size:24px; margin-bottom:5px;">${isl.icon}</div>
                <div style="text-align:center; font-size:12px; font-weight:600; line-height:1.2;">${isl.title}</div>
             </th>`;
        });
        html += `</tr></thead><tbody>`;

        game.state.teams.forEach(t => {
             html += `<tr><td style="background:#fff; position:sticky; left:0;"><span style="color:${t.color}">●</span> <b>${t.name}</b></td>`;
             islands.forEach(isl => {
                 const count = t.deployed ? t.deployed.filter(d => {
                     const iId = (typeof d === 'string') ? d : d.islandId;
                     return iId === isl.id;
                 }).length : 0;
                 
                 if (count > 0) {
                     html += `<td class="cell-number" style="background:#e8f5e9;"><span class="matrix-check">✓</span> <span style="font-size:11px; color:#555">(${count})</span></td>`;
                 } else {
                     html += `<td></td>`;
                 }
             });
             html += `</tr>`;
        });
        html += `</tbody>`;
        table.innerHTML = html;
    }

    renderEnhancedTimeline(metrics) {
        const container = document.getElementById('timeline-container');
        if(!container) return;
        container.innerHTML = '';

        let allKpis = [];
        game.state.islands.forEach(isl => {
            if(isl.kpis) {
                isl.kpis.forEach(k => {
                    if(k.deadline) {
                        allKpis.push({
                            ...k,
                            islandTitle: isl.title,
                            islandIcon: isl.icon,
                            assignedTeams: metrics.kpiAssignments[k.id] || []
                        });
                    }
                });
            }
        });

        allKpis.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

        if (allKpis.length === 0) {
            container.innerHTML = '<p style="color:#999; text-align:center; padding:20px;">No deadlines set for any KPIs.</p>';
            return;
        }

        // Group by Quarter
        let currentQuarter = '';
        let groupDiv = null;

        allKpis.forEach(k => {
            const date = new Date(k.deadline);
            const q = Math.floor((date.getMonth() + 3) / 3);
            const y = date.getFullYear();
            const qLabel = `Q${q} ${y}`;

            if(qLabel !== currentQuarter) {
                currentQuarter = qLabel;
                // Close prev group if exists
                groupDiv = document.createElement('div');
                groupDiv.className = 'quarter-group';
                groupDiv.innerHTML = `<div class="quarter-header">${qLabel}</div>`;
                container.appendChild(groupDiv);
            }

            const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const isDone = k.completed;
            const statusColor = isDone ? '#66bb6a' : '#ffa726';
            
            // Build Team Badges
            const teamsHtml = k.assignedTeams.map(t => 
                `<div class="team-badge" style="border-left:3px solid ${t.color}">${t.icon} ${t.name}</div>`
            ).join('');

            const row = document.createElement('div');
            row.className = 'timeline-item';
            row.style.borderLeft = `4px solid ${statusColor}`;
            
            row.innerHTML = `
                <div class="timeline-date">${dateStr}</div>
                <div class="timeline-content">
                    <div class="timeline-title">${k.desc}</div>
                    <div class="timeline-sub">${k.islandIcon} ${k.islandTitle}</div>
                    <div class="timeline-teams">
                        ${teamsHtml || '<span style="font-size:10px; color:#ccc; font-style:italic">Unassigned</span>'}
                    </div>
                </div>
                <div style="font-size:11px; font-weight:bold; color:${statusColor}; border:1px solid ${statusColor}; padding:2px 8px; border-radius:12px; white-space:nowrap;">
                    ${isDone ? 'DONE' : 'PENDING'}
                </div>
            `;
            groupDiv.appendChild(row);
        });
    }

    renderTeams() {
        const container = document.getElementById('team-list');
        if(!container) return;
        container.innerHTML = '';
        
        game.state.teams.forEach(team => {
            const deployedCount = team.deployed ? team.deployed.length : 0;
            const available = team.totalShips - deployedCount;
            
            const div = document.createElement('div');
            div.className = 'team-card';
            div.style.borderLeftColor = team.color;
            div.draggable = available > 0;
            if (available === 0) div.style.opacity = '0.6';

            div.innerHTML = `
                <div class="team-header">
                    <span>${team.icon} ${team.name}</span>
                    <span>${available}/${team.totalShips}</span>
                </div>
                <div class="team-stats">
                    ${available > 0 ? 'Ready to deploy' : 'Fully committed'}
                </div>
                <div class="team-actions">
                    <button class="tiny-btn" onclick="ui.openTeamModal('${team.id}')">Edit</button>
                    <button class="tiny-btn" style="color:red" onclick="ui.deleteTeam('${team.id}')">Del</button>
                </div>
            `;
            
            div.addEventListener('dragstart', (e) => {
                if(available <= 0) { e.preventDefault(); return; }
                e.dataTransfer.setData("text/plain", team.id);
                e.dataTransfer.effectAllowed = "copy";
            });

            container.appendChild(div);
        });
    }

    selectKpiModal(island, teamId) {
        if (!island.kpis || island.kpis.length === 0) {
            game.assignTeam(teamId, island, []);
            return;
        }

        let html = `<div style="margin-bottom:15px; font-size:14px;">Deploying to <b>${island.title}</b>. Select Objectives:</div>`;
        
        island.kpis.forEach((kpi, idx) => {
             html += `
                <label class="kpi-item" style="display:flex; gap:10px; cursor:pointer; border:1px solid #ddd; padding:10px; margin-bottom:5px; align-items:center;">
                    <input type="checkbox" class="kpi-select-cb" value="${kpi.id}">
                    <div style="flex-grow:1">
                        <div style="font-weight:bold;">${kpi.id.split('_')[1] || idx+1}: ${kpi.desc}</div>
                        <div style="font-size:11px; color:${kpi.completed?'green':'orange'};">${kpi.completed?'Completed':'Pending'} • Due: ${kpi.deadline||'No Date'}</div>
                    </div>
                </label>
            `;
        });

        html += `<button class="btn primary" style="width:100%; margin-top:10px" onclick="ui.confirmKpiSelection('${teamId}', '${island.id}')">Deploy Team</button>`;

        this.showModal("Select Deployment Target(s)", html, () => {});
        document.getElementById('modal-save-btn').style.display = 'none';
    }

    confirmKpiSelection(teamId, islandId) {
        const checkedBoxes = document.querySelectorAll('.kpi-select-cb:checked');
        const kpiIds = Array.from(checkedBoxes).map(cb => cb.value);
        const island = game.state.islands.find(i => i.id === islandId);
        game.assignTeam(teamId, island, kpiIds);
        this.closeModal();
        document.getElementById('modal-save-btn').style.display = 'block';
    }

    openTeamModal(teamId = null) {
        document.getElementById('modal-save-btn').style.display = 'block';
        const team = teamId ? game.state.teams.find(t => t.id === teamId) : { name: '', totalShips: 3, color: COLORS[0], icon: '🚀' };
        
        const html = `
            <div class="form-group">
                <label>Team Name</label>
                <input id="inp-name" value="${team.name}" placeholder="e.g. Clinical Ops">
            </div>
            <div class="form-group">
                <label>Total Ships</label>
                <input id="inp-ships" type="number" value="${team.totalShips}">
            </div>
            <div class="form-group">
                <label>Color Code</label>
                <div class="icon-grid">
                    ${COLORS.map(c => `<div class="icon-opt ${c === team.color ? 'selected':''}" style="background:${c}; width:20px; height:20px;" onclick="ui.selectColor(this, '${c}')"></div>`).join('')}
                </div>
                <input type="hidden" id="inp-color" value="${team.color}">
            </div>
            <div class="form-group">
                <label>Icon</label>
                <div class="icon-grid">
                    ${ICONS.map(i => `<div class="icon-opt ${i === team.icon ? 'selected':''}" onclick="ui.selectIcon(this, '${i}')">${i}</div>`).join('')}
                </div>
                <input type="hidden" id="inp-icon" value="${team.icon}">
            </div>
        `;

        this.showModal(teamId ? 'Edit Team' : 'New Team', html, () => {
            const newTeam = {
                id: teamId || Utils.generateId('t'),
                name: document.getElementById('inp-name').value,
                totalShips: parseInt(document.getElementById('inp-ships').value),
                color: document.getElementById('inp-color').value,
                icon: document.getElementById('inp-icon').value,
                deployed: team.deployed || []
            };

            if(teamId) {
                const idx = game.state.teams.findIndex(t => t.id === teamId);
                game.state.teams[idx] = newTeam;
            } else {
                game.state.teams.push(newTeam);
            }
            this.renderTeams();
        });
    }

    openMainGoalModal(x, y, existingGoal = null) {
        document.getElementById('modal-save-btn').style.display = 'block';
        const goal = existingGoal || { title: '', icon: '🎯', x: x, y: y, desc: '' };

        const html = `
            <div class="form-group">
                <label>Main Goal Title</label>
                <input id="inp-title" value="${goal.title}">
            </div>
             <div class="form-group">
                <label>Description</label>
                <textarea id="inp-desc" rows="3">${goal.desc || ''}</textarea>
            </div>
            <div class="form-group">
                <label>Icon</label>
                <div class="icon-grid">
                    ${ICONS.map(i => `<div class="icon-opt ${i === goal.icon ? 'selected':''}" onclick="ui.selectIcon(this, '${i}')">${i}</div>`).join('')}
                </div>
                <input type="hidden" id="inp-icon" value="${goal.icon}">
            </div>
            ${existingGoal ? `<button class="btn secondary" style="width:100%; color:red; border-color:red" onclick="ui.deleteMainGoal('${goal.id}')">Delete Main Goal</button>` : ''}
        `;

        this.showModal(existingGoal ? 'Edit Main Goal' : 'New Main Goal', html, () => {
             const data = {
                id: existingGoal ? existingGoal.id : Utils.generateId('mg'),
                title: document.getElementById('inp-title').value,
                desc: document.getElementById('inp-desc').value,
                icon: document.getElementById('inp-icon').value,
                x: goal.x,
                y: goal.y
            };

            if(existingGoal) {
                const idx = game.state.mainGoals.findIndex(g => g.id === data.id);
                game.state.mainGoals[idx] = data;
            } else {
                game.state.mainGoals.push(data);
            }
        });
    }

    openIslandModal(x, y, existingIsland = null) {
        document.getElementById('modal-save-btn').style.display = 'block';
        const island = existingIsland || { title: '', icon: '🏝️', x: x, y: y, kpis: [], desc: '', mainGoalIds: [] };
        
        const kpiHtml = island.kpis.map((k, idx) => `
            <div class="kpi-item" id="kpi-row-${idx}">
                <div style="flex-grow:1">
                    <input class="kpi-desc" value="${k.desc}" placeholder="KPI Description" style="margin-bottom:5px">
                    <div style="display:flex; gap:5px;">
                        <input type="date" class="kpi-date" value="${k.deadline}" style="width:130px">
                        <label style="display:flex; align-items:center; gap:5px; margin:0; font-size:11px; cursor:pointer">
                            <input type="checkbox" class="kpi-done" ${k.completed ? 'checked' : ''}> Completed
                        </label>
                    </div>
                </div>
                <button class="tiny-btn" style="color:red; margin-left:10px" onclick="document.getElementById('kpi-row-${idx}').remove()">×</button>
            </div>
        `).join('');

        const mainGoalOptions = game.state.mainGoals.map(mg => `
            <label style="display:block; padding:5px; border-bottom:1px solid #eee;">
                <input type="checkbox" class="mg-checkbox" value="${mg.id}" ${island.mainGoalIds.includes(mg.id) ? 'checked' : ''}>
                ${mg.icon} ${mg.title}
            </label>
        `).join('');

        const html = `
            <div class="form-group">
                <label>Expedition Title</label>
                <input id="inp-title" value="${island.title}">
            </div>

            <div class="form-group">
                <label>Parent Goal(s)</label>
                <div style="max-height:100px; overflow-y:auto; border:1px solid #ddd; padding:5px; border-radius:8px;">
                    ${mainGoalOptions || '<span style="color:#999; font-size:12px">No Main Goals defined yet.</span>'}
                </div>
            </div>
            
             <div class="form-group">
                <label>Description</label>
                <textarea id="inp-desc" rows="2">${island.desc || ''}</textarea>
            </div>

            <div class="form-group">
                <label>Strategic KPIs</label>
                <div id="kpi-container" class="kpi-list-container">
                    ${kpiHtml}
                </div>
                <button class="tiny-btn" style="width:100%; margin-top:5px" onclick="ui.addKpiRow()">+ Add KPI</button>
            </div>

            <div class="form-group">
                <label>Icon</label>
                <div class="icon-grid">
                    ${ICONS.map(i => `<div class="icon-opt ${i === island.icon ? 'selected':''}" onclick="ui.selectIcon(this, '${i}')">${i}</div>`).join('')}
                </div>
                <input type="hidden" id="inp-icon" value="${island.icon}">
            </div>
            ${existingIsland ? `<button class="btn secondary" style="width:100%; color:red; border-color:red" onclick="ui.deleteIsland('${island.id}')">Delete Expedition</button>` : ''}
        `;

        this.showModal(existingIsland ? 'Edit Expedition' : 'New Expedition', html, () => {
            const kpiRows = document.querySelectorAll('.kpi-item');
            const newKpis = Array.from(kpiRows).map(row => ({
                id: Utils.generateId('k'),
                desc: row.querySelector('.kpi-desc').value,
                deadline: row.querySelector('.kpi-date').value,
                completed: row.querySelector('.kpi-done').checked,
                assigned: []
            })).filter(k => k.desc.trim() !== '');

            const selectedMgIds = Array.from(document.querySelectorAll('.mg-checkbox:checked')).map(cb => cb.value);

            const data = {
                id: existingIsland ? existingIsland.id : Utils.generateId('e'),
                title: document.getElementById('inp-title').value,
                desc: document.getElementById('inp-desc').value,
                mainGoalIds: selectedMgIds,
                kpis: newKpis,
                icon: document.getElementById('inp-icon').value,
                x: island.x,
                y: island.y,
                expanded: existingIsland ? existingIsland.expanded : false 
            };

            if(existingIsland) {
                const idx = game.state.islands.findIndex(i => i.id === data.id);
                game.state.islands[idx] = data;
            } else {
                game.state.islands.push(data);
            }
        });
    }

    addKpiRow() {
        const container = document.getElementById('kpi-container');
        const idx = container.children.length;
        const div = document.createElement('div');
        div.className = 'kpi-item';
        div.id = `kpi-row-${idx}`;
        div.innerHTML = `
            <div style="flex-grow:1">
                <input class="kpi-desc" placeholder="New Goal / KPI" style="margin-bottom:5px">
                <div style="display:flex; gap:5px;">
                    <input type="date" class="kpi-date" style="width:130px">
                    <label style="display:flex; align-items:center; gap:5px; margin:0; font-size:11px; cursor:pointer">
                        <input type="checkbox" class="kpi-done"> Completed
                    </label>
                </div>
            </div>
            <button class="tiny-btn" style="color:red; margin-left:10px" onclick="document.getElementById('kpi-row-${idx}').remove()">×</button>
        `;
        container.appendChild(div);
    }

    showModal(title, content, onSave) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML = content;
        document.getElementById('modal-overlay').classList.remove('hidden');
        
        const saveBtn = document.getElementById('modal-save-btn');
        const newBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newBtn, saveBtn);
        
        newBtn.addEventListener('click', () => {
            onSave();
            this.closeModal();
        });
    }

    closeModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    }

    selectIcon(el, icon) {
        document.getElementById('inp-icon').value = icon;
        document.querySelectorAll('.icon-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
    }
    
    selectColor(el, color) {
        document.getElementById('inp-color').value = color;
        document.querySelectorAll('.icon-opt').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
    }

    deleteTeam(id) {
        if(confirm("Delete this team?")) {
            game.state.teams = game.state.teams.filter(t => t.id !== id);
            game.ships = game.ships.filter(s => s.teamId !== id);
            this.renderTeams();
        }
    }

    deleteIsland(id) {
        if(confirm("Delete expedition? Ships will return.")) {
            game.state.islands = game.state.islands.filter(i => i.id !== id);
            game.ships.forEach(s => {
                if(s.targetId === id) game.recallShip(s);
            });
            game.state.teams.forEach(t => {
                if(t.deployed) t.deployed = t.deployed.filter(d_id => d_id !== id);
            });
            this.renderTeams();
            this.closeModal();
        }
    }

    deleteMainGoal(id) {
        if(confirm("Delete this Main Goal? Linked Expeditions will be unlinked.")) {
            game.state.mainGoals = game.state.mainGoals.filter(m => m.id !== id);
            game.state.islands.forEach(i => {
                if(i.mainGoalIds) {
                    i.mainGoalIds = i.mainGoalIds.filter(mid => mid !== id);
                }
            });
            this.closeModal();
        }
    }
}

// --- INITIALIZATION ---
// Only initialize if running in browser with required elements
if (typeof window !== 'undefined' && document.getElementById('world')) {
    window.ui = new UIController();
    window.game = new GameEngine();
}

// Export for Unit Testing (Node.js/Jest)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Utils, GameEngine, UIController, ThreeEngine, Camera2D, ParticleSystem };
}