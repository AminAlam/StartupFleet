import { Utils } from './Utils.js';

export class ThreeEngine {
    constructor() {
        this.container = document.getElementById('world-3d');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.meshes = {}; 
        this.lines = []; 
        this.isRunning = false;
        
        this.orbit = {
            radius: 900,
            theta: Math.PI / 4, 
            phi: Math.PI / 2.5,   
            target: new THREE.Vector3(0, 0, 0),
            mouseDown: false,
            isPanning: false,  // For shift+drag or middle-mouse panning
            lastX: 0,
            lastY: 0
        };
        
        // Track pressed keys for WASD navigation
        this.keys = { w: false, a: false, s: false, d: false, q: false, e: false };
    }

    init() {
        if (this.scene) return;

        this.scene = new THREE.Scene();
        // Twilight sky background - brighter for better visibility
        this.scene.background = new THREE.Color(0x1a3a5c);
        // Lighter fog that doesn't obscure distant objects as much
        this.scene.fog = new THREE.FogExp2(0x1a3a5c, 0.0003);

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 15000);
        this.updateCameraPosition();

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // --- Lighting ---
        // Brighter ambient for better overall visibility
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        
        // Hemisphere light for sky/ground color variation
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x004d40, 0.4);
        this.scene.add(hemiLight);

        // Sunlight - brighter
        const dirLight = new THREE.DirectionalLight(0xfff0dd, 1.0);
        dirLight.position.set(200, 1000, 500);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        this.scene.add(dirLight);

        // North Star Light - much brighter and larger range
        const starLight = new THREE.PointLight(0xffffcc, 2.0, 5000);
        starLight.position.set(0, 600, -1000);
        this.scene.add(starLight);

        // --- Environment ---
        
        // Ocean - very large to cover entire visible area
        const waterGeo = new THREE.PlaneGeometry(50000, 50000, 200, 200); 
        // More realistic water material
        const waterMat = new THREE.MeshPhongMaterial({ 
            color: 0x006064, 
            emissive: 0x003333,
            specular: 0x222222,
            shininess: 80,
            flatShading: true,
            transparent: true, 
            opacity: 0.95 
        });
        this.water = new THREE.Mesh(waterGeo, waterMat); 
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -30; 
        this.water.receiveShadow = true;
        this.scene.add(this.water);

        this.createClouds();
        this.createNorthStar();

        // Events
        window.addEventListener('resize', () => this.resize());
        this.container.addEventListener('mousedown', e => this.onMouseDown(e));
        document.addEventListener('mousemove', e => this.onMouseMove(e));
        document.addEventListener('mouseup', e => this.onMouseUp(e));
        this.container.addEventListener('wheel', e => this.onWheel(e));
        
        // Keyboard controls for panning (WASD + Q/E for up/down)
        document.addEventListener('keydown', e => this.onKeyDown(e));
        document.addEventListener('keyup', e => this.onKeyUp(e));
        
        // Prevent context menu on right-click in 3D view
        this.container.addEventListener('contextmenu', e => e.preventDefault());
    }

    createNorthStar() {
        const starGroup = new THREE.Group();
        // Move closer so fog doesn't obscure it as much
        starGroup.position.set(0, 600, -1000);
        
        // Bright core - larger and fog-immune
        const starGeo = new THREE.SphereGeometry(120, 32, 32);
        const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
        const star = new THREE.Mesh(starGeo, starMat);
        starGroup.add(star);
        
        // Secondary bright core for extra glow
        const coreGeo = new THREE.SphereGeometry(150, 32, 32);
        const coreMat = new THREE.MeshBasicMaterial({ 
            color: 0xffffee, 
            transparent: true, 
            opacity: 0.7,
            fog: false,
            depthWrite: false
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        starGroup.add(core);
        
        // Inner glow (white/yellow) - fog immune, no depth write
        const innerGlowMat = new THREE.SpriteMaterial({ 
            map: new THREE.CanvasTexture(this.createGlowTexture()), 
            color: 0xffffcc, transparent: true, blending: THREE.AdditiveBlending,
            fog: false, depthWrite: false, depthTest: false
        });
        const innerGlow = new THREE.Sprite(innerGlowMat);
        innerGlow.scale.set(600, 600, 1);
        starGroup.add(innerGlow);
        
        // Middle glow (golden) - fog immune, no depth write
        const midGlowMat = new THREE.SpriteMaterial({ 
            map: new THREE.CanvasTexture(this.createGlowTexture()), 
            color: 0xffd700, transparent: true, blending: THREE.AdditiveBlending,
            fog: false, depthWrite: false, depthTest: false
        });
        const midGlow = new THREE.Sprite(midGlowMat);
        midGlow.scale.set(1200, 1200, 1);
        starGroup.add(midGlow);
        
        // Outer glow (warm white) - fog immune, no depth write
        const outerGlowMat = new THREE.SpriteMaterial({ 
            map: new THREE.CanvasTexture(this.createGlowTexture()), 
            color: 0xffeedd, transparent: true, blending: THREE.AdditiveBlending,
            fog: false, depthWrite: false, depthTest: false
        });
        const outerGlow = new THREE.Sprite(outerGlowMat);
        outerGlow.scale.set(2000, 2000, 1);
        starGroup.add(outerGlow);
        
        // Star rays (cross pattern) - fog immune, no depth write
        const rayMat = new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(this.createStarRayTexture()),
            color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending,
            fog: false, depthWrite: false, depthTest: false
        });
        const rays = new THREE.Sprite(rayMat);
        rays.scale.set(2500, 2500, 1);
        starGroup.add(rays);
        
        // "NORTH STAR" label
        const labelData = Utils.createTextTexture('★ NORTH STAR ★', '#ffd700', 48);
        const labelMat = new THREE.SpriteMaterial({ 
            map: labelData.texture, 
            fog: false, 
            depthWrite: false 
        });
        const label = new THREE.Sprite(labelMat);
        label.scale.set(labelData.aspect * 80, 80, 1);
        label.position.y = -200;
        starGroup.add(label);
        
        // Set render order to ensure star renders on top
        starGroup.renderOrder = 999;
        
        this.scene.add(starGroup);
        this.northStarGroup = starGroup;
    }
    
    createStarRayTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const cx = 128, cy = 128;
        
        // Draw 4-point star rays
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        
        // Horizontal ray
        const grad1 = ctx.createLinearGradient(0, cy, 256, cy);
        grad1.addColorStop(0, 'rgba(255,255,255,0)');
        grad1.addColorStop(0.4, 'rgba(255,255,255,0.3)');
        grad1.addColorStop(0.5, 'rgba(255,255,255,1)');
        grad1.addColorStop(0.6, 'rgba(255,255,255,0.3)');
        grad1.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad1;
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(256, cy);
        ctx.stroke();
        
        // Vertical ray
        const grad2 = ctx.createLinearGradient(cx, 0, cx, 256);
        grad2.addColorStop(0, 'rgba(255,255,255,0)');
        grad2.addColorStop(0.4, 'rgba(255,255,255,0.3)');
        grad2.addColorStop(0.5, 'rgba(255,255,255,1)');
        grad2.addColorStop(0.6, 'rgba(255,255,255,0.3)');
        grad2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = grad2;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, 256);
        ctx.stroke();
        
        return canvas;
    }

    createClouds() {
        const cloudGeo = new THREE.DodecahedronGeometry(40, 0);
        // Use MeshPhongMaterial which supports flatShading (MeshLambertMaterial doesn't)
        const cloudMat = new THREE.MeshPhongMaterial({ 
            color: 0xffffff, transparent: true, opacity: 0.8, flatShading: true 
        });
        
        this.clouds = [];
        for(let i=0; i<40; i++) {
            const group = new THREE.Group();
            const chunks = 3 + Math.floor(Math.random() * 4);
            
            for(let j=0; j<chunks; j++) {
                const puff = new THREE.Mesh(cloudGeo, cloudMat);
                puff.position.set(
                    (Math.random()-0.5)*120, 
                    (Math.random()-0.5)*40, 
                    (Math.random()-0.5)*80
                );
                const s = 0.8 + Math.random();
                puff.scale.set(s,s,s);
                group.add(puff);
            }
            
            group.position.set(
                (Math.random()-0.5) * 8000,
                600 + Math.random() * 600,
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
        grad.addColorStop(0.4, 'rgba(255,255,255,0.2)');
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
        if (!this.camera || !this.renderer) return;
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateCameraPosition() {
        const x = this.orbit.radius * Math.sin(this.orbit.phi) * Math.cos(this.orbit.theta);
        const y = this.orbit.radius * Math.cos(this.orbit.phi);
        const z = this.orbit.radius * Math.sin(this.orbit.phi) * Math.sin(this.orbit.theta);
        
        this.camera.position.set(
            this.orbit.target.x + x,
            this.orbit.target.y + y,
            this.orbit.target.z + z
        );
        this.camera.lookAt(this.orbit.target);
    }

    onMouseDown(e) {
        this.orbit.mouseDown = true;
        this.orbit.lastX = e.clientX;
        this.orbit.lastY = e.clientY;
        
        // Middle mouse button (button 1) or Shift+Left click = panning mode
        this.orbit.isPanning = (e.button === 1) || (e.button === 0 && e.shiftKey);
    }

    onMouseMove(e) {
        if (!this.orbit.mouseDown) return;
        
        const dx = e.clientX - this.orbit.lastX;
        const dy = e.clientY - this.orbit.lastY;
        
        if (this.orbit.isPanning) {
            // Panning: move the camera target
            const panSpeed = this.orbit.radius * 0.002;
            
            // Calculate right and forward vectors based on camera orientation
            const right = new THREE.Vector3();
            const forward = new THREE.Vector3();
            
            this.camera.getWorldDirection(forward);
            right.crossVectors(this.camera.up, forward).normalize();
            forward.crossVectors(right, this.camera.up).normalize();
            
            // Move target
            this.orbit.target.addScaledVector(right, -dx * panSpeed);
            this.orbit.target.addScaledVector(forward, dy * panSpeed);
        } else {
            // Rotating: orbit around target
            this.orbit.theta -= dx * 0.005;
            this.orbit.phi -= dy * 0.005;
            
            // Clamp phi to prevent flipping
            this.orbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.orbit.phi));
        }
        
        this.orbit.lastX = e.clientX;
        this.orbit.lastY = e.clientY;
        
        this.updateCameraPosition();
    }

    onMouseUp(e) {
        this.orbit.mouseDown = false;
        this.orbit.isPanning = false;
    }

    onWheel(e) {
        e.preventDefault();
        this.orbit.radius += e.deltaY * 0.5;
        this.orbit.radius = Math.max(200, Math.min(3000, this.orbit.radius));
        this.updateCameraPosition();
    }

    onKeyDown(e) {
        if (!this.isRunning) return;
        
        const key = e.key.toLowerCase();
        if (key in this.keys) {
            this.keys[key] = true;
        }
        
        // Arrow keys for panning
        if (e.key === 'ArrowUp') this.keys.w = true;
        if (e.key === 'ArrowDown') this.keys.s = true;
        if (e.key === 'ArrowLeft') this.keys.a = true;
        if (e.key === 'ArrowRight') this.keys.d = true;
    }

    onKeyUp(e) {
        const key = e.key.toLowerCase();
        if (key in this.keys) {
            this.keys[key] = false;
        }
        
        // Arrow keys
        if (e.key === 'ArrowUp') this.keys.w = false;
        if (e.key === 'ArrowDown') this.keys.s = false;
        if (e.key === 'ArrowLeft') this.keys.a = false;
        if (e.key === 'ArrowRight') this.keys.d = false;
    }

    processKeyboardInput() {
        if (!this.isRunning) return;
        
        const moveSpeed = 15;
        
        // Calculate movement vectors
        const right = new THREE.Vector3();
        const forward = new THREE.Vector3();
        
        this.camera.getWorldDirection(forward);
        right.crossVectors(this.camera.up, forward).normalize();
        forward.crossVectors(right, this.camera.up).normalize();
        
        // WASD movement
        if (this.keys.w) this.orbit.target.addScaledVector(forward, moveSpeed);
        if (this.keys.s) this.orbit.target.addScaledVector(forward, -moveSpeed);
        if (this.keys.a) this.orbit.target.addScaledVector(right, moveSpeed);
        if (this.keys.d) this.orbit.target.addScaledVector(right, -moveSpeed);
        
        // Q/E for vertical movement
        if (this.keys.q) this.orbit.target.y -= moveSpeed;
        if (this.keys.e) this.orbit.target.y += moveSpeed;
        
        // Update camera if any key is pressed
        if (Object.values(this.keys).some(v => v)) {
            this.updateCameraPosition();
        }
    }

    animate() {
        if (!this.isRunning) return;
        requestAnimationFrame(() => this.animate());
        
        // Process keyboard input for WASD navigation
        this.processKeyboardInput();
        
        const time = Date.now() * 0.001;

        // --- Wave Animation (Bigger, more dramatic waves) ---
        if (this.water) {
            const positions = this.water.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i);
                const y = positions.getY(i); 
                // Complex wave function with larger amplitudes
                const z = Math.sin(x * 0.002 + time * 0.6) * 25 +      // Primary slow wave
                          Math.sin(y * 0.0015 + time * 0.4) * 20 +     // Cross wave
                          Math.sin((x+y) * 0.004 + time * 1.0) * 12 +  // Diagonal ripple
                          Math.sin(x * 0.008 + time * 2.0) * 5 +       // Fast small ripples
                          Math.cos(y * 0.006 + time * 1.5) * 8;        // Secondary texture
                positions.setZ(i, z);
            }
            positions.needsUpdate = true;
            this.water.geometry.computeVertexNormals();
            
            // Subtle water color shift based on time (day/night feel)
            const colorShift = Math.sin(time * 0.1) * 0.1 + 0.9;
            this.water.material.color.setRGB(0 * colorShift, 0.3 * colorShift, 0.25 * colorShift);
        }

        // --- Cloud Drift with vertical bobbing ---
        if (this.clouds) {
            this.clouds.forEach((c, idx) => {
                c.position.x += 0.5 + Math.sin(idx) * 0.2;
                c.position.y += Math.sin(time * 0.3 + idx) * 0.1; // Gentle vertical bob
                if (c.position.x > 4000) c.position.x = -4000;
            });
        }

        // --- Floating Objects ---
        const getWaterHeight = (x, z) => {
            return Math.sin(x * 0.002 + time * 0.6) * 25 + 
                   Math.sin(z * 0.0015 + time * 0.4) * 20 +
                   Math.sin((x+z) * 0.004 + time * 1.0) * 12 +
                   Math.sin(x * 0.008 + time * 2.0) * 5 +
                   Math.cos(z * 0.006 + time * 1.5) * 8;
        };

        Object.values(this.meshes).forEach(mesh => {
            if (mesh.userData.type === 'ship') {
                const waterH = getWaterHeight(mesh.position.x, mesh.position.z);
                const baseY = this.water.position.y;
                mesh.position.y = baseY + waterH + 8; // Raised higher above bigger waves
                
                // More dramatic bobbing rotation for bigger waves
                mesh.rotation.x = Math.sin(time * 1.5 + mesh.position.x * 0.01) * 0.12;
                mesh.rotation.z = Math.cos(time * 1.2 + mesh.position.z * 0.01) * 0.1;
                
                // Keep text facing cam
                if(mesh.children.length > 1) {
                    mesh.children.forEach(child => {
                        if (child.type === 'Sprite') {
                            child.lookAt(this.camera.position);
                        }
                    });
                }
            } 
            else if (mesh.userData.type === 'island' || mesh.userData.type === 'goal') {
                // Subtle island sway (very gentle)
                if (mesh.userData.type === 'island') {
                    mesh.rotation.y = Math.sin(time * 0.2) * 0.01;
                }
                
                // Ensure text faces camera
                mesh.children.forEach(child => {
                    if (child.type === 'Sprite' || child.userData.isBillboard) {
                        child.lookAt(this.camera.position);
                    }
                    // KPI Satellites - gentle orbit
                    if (child.userData.isKPI) {
                        child.lookAt(this.camera.position);
                    }
                });
            }
        });

        this.renderer.render(this.scene, this.camera);
    }

    // --- Asset Generation Helpers ---

    createLowPolyIsland(color) {
        const group = new THREE.Group();
        
        // 1. Solid Rock Base (underwater part)
        const baseGeo = new THREE.ConeGeometry(90, 80, 8);
        baseGeo.translate(0, -20, 0);
        const baseMat = new THREE.MeshStandardMaterial({ 
            color: 0x5d4037, // Dark rock
            flatShading: true,
            roughness: 0.9
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);
        
        // 2. Main Island Body (sandy/earthy)
        const bodyGeo = new THREE.CylinderGeometry(70, 85, 50, 8);
        bodyGeo.translate(0, 25, 0);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0xa1887f, // Sandy brown
            flatShading: true,
            roughness: 0.8
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // 3. Beach Ring
        const beachGeo = new THREE.TorusGeometry(65, 8, 4, 8);
        beachGeo.rotateX(Math.PI / 2);
        beachGeo.translate(0, 5, 0);
        const beachMat = new THREE.MeshStandardMaterial({ 
            color: 0xffecb3, // Sand color
            flatShading: true
        });
        const beach = new THREE.Mesh(beachGeo, beachMat);
        group.add(beach);

        // 4. Green Top (grass plateau)
        const topGeo = new THREE.CylinderGeometry(55, 65, 20, 8);
        topGeo.translate(0, 55, 0);
        const topMat = new THREE.MeshStandardMaterial({ 
            color: 0x4caf50, // Lush green
            flatShading: true
        });
        const top = new THREE.Mesh(topGeo, topMat);
        top.castShadow = true;
        group.add(top);

        // 5. Central Hill
        const hillGeo = new THREE.ConeGeometry(30, 35, 6);
        hillGeo.translate(0, 80, 0);
        const hillMat = new THREE.MeshStandardMaterial({ 
            color: 0x388e3c, // Darker green
            flatShading: true
        });
        const hill = new THREE.Mesh(hillGeo, hillMat);
        hill.castShadow = true;
        group.add(hill);

        // 6. Palm Trees
        for(let i = 0; i < 4; i++) {
            const tree = new THREE.Group();
            
            // Curved trunk
            const trunkGeo = new THREE.CylinderGeometry(2, 4, 30, 5);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41 });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 15;
            trunk.rotation.z = (Math.random() - 0.5) * 0.3;
            tree.add(trunk);

            // Palm fronds (multiple cones)
            for(let j = 0; j < 5; j++) {
                const frondGeo = new THREE.ConeGeometry(12, 18, 4);
                const frondMat = new THREE.MeshStandardMaterial({ 
                    color: 0x2e7d32, 
                    flatShading: true,
                    side: THREE.DoubleSide
                });
                const frond = new THREE.Mesh(frondGeo, frondMat);
                frond.position.y = 32;
                frond.rotation.x = Math.PI / 4;
                frond.rotation.y = (j / 5) * Math.PI * 2;
                tree.add(frond);
            }

            // Position trees around the island
            const angle = (i / 4) * Math.PI * 2 + Math.random() * 0.5;
            const r = 25 + Math.random() * 20;
            tree.position.set(Math.cos(angle) * r, 55, Math.sin(angle) * r);
            const s = 0.7 + Math.random() * 0.4;
            tree.scale.set(s, s, s);
            
            group.add(tree);
        }

        // 7. Small rocks for detail
        for(let i = 0; i < 3; i++) {
            const rockGeo = new THREE.DodecahedronGeometry(5 + Math.random() * 5, 0);
            const rockMat = new THREE.MeshStandardMaterial({ 
                color: 0x78909c,
                flatShading: true,
                roughness: 1.0
            });
            const rock = new THREE.Mesh(rockGeo, rockMat);
            const angle = Math.random() * Math.PI * 2;
            const r = 50 + Math.random() * 20;
            rock.position.set(Math.cos(angle) * r, 8, Math.sin(angle) * r);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            group.add(rock);
        }

        return group;
    }

    createKPIIsland(isCompleted) {
        // Small KPI island - compact version
        const group = new THREE.Group();
        
        // Color scheme based on completion status
        const sandColor = isCompleted ? 0xc8e6c9 : 0xffe0b2; // Green-tinted or orange-tinted
        const grassColor = isCompleted ? 0x4caf50 : 0xff9800;
        const rockColor = isCompleted ? 0x81c784 : 0xffb74d;
        
        // 1. Rock Base
        const baseGeo = new THREE.ConeGeometry(25, 30, 6);
        baseGeo.translate(0, -5, 0);
        const baseMat = new THREE.MeshStandardMaterial({ 
            color: 0x6d4c41,
            flatShading: true,
            roughness: 0.9
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.castShadow = true;
        group.add(base);
        
        // 2. Island Body
        const bodyGeo = new THREE.CylinderGeometry(22, 28, 20, 6);
        bodyGeo.translate(0, 12, 0);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: sandColor,
            flatShading: true,
            roughness: 0.8
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        group.add(body);

        // 3. Green/Orange Top
        const topGeo = new THREE.CylinderGeometry(18, 22, 10, 6);
        topGeo.translate(0, 28, 0);
        const topMat = new THREE.MeshStandardMaterial({ 
            color: grassColor,
            flatShading: true
        });
        const top = new THREE.Mesh(topGeo, topMat);
        top.castShadow = true;
        group.add(top);

        // 4. Small tree or flag
        if (isCompleted) {
            // Completed: Small flag/checkmark pole
            const poleGeo = new THREE.CylinderGeometry(1, 1, 20, 4);
            const poleMat = new THREE.MeshStandardMaterial({ color: 0x4caf50 });
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.y = 40;
            group.add(pole);
            
            // Checkmark flag
            const flagGeo = new THREE.BoxGeometry(8, 6, 1);
            const flagMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32 });
            const flag = new THREE.Mesh(flagGeo, flagMat);
            flag.position.set(5, 45, 0);
            group.add(flag);
        } else {
            // Pending: Small palm tree
            const trunkGeo = new THREE.CylinderGeometry(1, 2, 12, 4);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41 });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 36;
            group.add(trunk);
            
            // Small fronds
            for(let j = 0; j < 4; j++) {
                const frondGeo = new THREE.ConeGeometry(5, 8, 3);
                const frondMat = new THREE.MeshStandardMaterial({ 
                    color: 0x558b2f,
                    flatShading: true
                });
                const frond = new THREE.Mesh(frondGeo, frondMat);
                frond.position.y = 42;
                frond.rotation.x = Math.PI / 4;
                frond.rotation.y = (j / 4) * Math.PI * 2;
                group.add(frond);
            }
        }

        // 5. Small decorative rock
        const rockGeo = new THREE.DodecahedronGeometry(3, 0);
        const rockMat = new THREE.MeshStandardMaterial({ 
            color: rockColor,
            flatShading: true
        });
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(15, 5, 8);
        group.add(rock);

        return group;
    }

    createMainGoalIsland() {
        // Main Goal Island - 2x the size of regular expedition islands
        const group = new THREE.Group();
        
        // 1. Large Rock Base (underwater part)
        const baseGeo = new THREE.ConeGeometry(180, 160, 8);
        baseGeo.translate(0, -40, 0);
        const baseMat = new THREE.MeshStandardMaterial({ 
            color: 0x4e342e, // Dark rock
            flatShading: true,
            roughness: 0.9
        });
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);
        
        // 2. Main Island Body (golden-tinted sand)
        const bodyGeo = new THREE.CylinderGeometry(140, 170, 100, 8);
        bodyGeo.translate(0, 50, 0);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0xc9a66b, // Golden sand
            flatShading: true,
            roughness: 0.7
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // 3. Golden Beach Ring
        const beachGeo = new THREE.TorusGeometry(130, 16, 4, 8);
        beachGeo.rotateX(Math.PI / 2);
        beachGeo.translate(0, 10, 0);
        const beachMat = new THREE.MeshStandardMaterial({ 
            color: 0xffe082, // Golden sand
            flatShading: true
        });
        const beach = new THREE.Mesh(beachGeo, beachMat);
        group.add(beach);

        // 4. Green Top (larger grass plateau)
        const topGeo = new THREE.CylinderGeometry(110, 130, 40, 8);
        topGeo.translate(0, 110, 0);
        const topMat = new THREE.MeshStandardMaterial({ 
            color: 0x388e3c, // Rich green
            flatShading: true
        });
        const top = new THREE.Mesh(topGeo, topMat);
        top.castShadow = true;
        group.add(top);

        // 5. Central Mountain/Hill
        const hillGeo = new THREE.ConeGeometry(60, 70, 6);
        hillGeo.translate(0, 160, 0);
        const hillMat = new THREE.MeshStandardMaterial({ 
            color: 0x2e7d32, // Darker green
            flatShading: true
        });
        const hill = new THREE.Mesh(hillGeo, hillMat);
        hill.castShadow = true;
        group.add(hill);

        // 6. Multiple Palm Trees (more than regular island)
        for(let i = 0; i < 8; i++) {
            const tree = new THREE.Group();
            
            // Curved trunk
            const trunkGeo = new THREE.CylinderGeometry(3, 6, 40, 5);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6d4c41 });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 20;
            trunk.rotation.z = (Math.random() - 0.5) * 0.3;
            tree.add(trunk);

            // Palm fronds
            for(let j = 0; j < 5; j++) {
                const frondGeo = new THREE.ConeGeometry(16, 24, 4);
                const frondMat = new THREE.MeshStandardMaterial({ 
                    color: 0x2e7d32, 
                    flatShading: true,
                    side: THREE.DoubleSide
                });
                const frond = new THREE.Mesh(frondGeo, frondMat);
                frond.position.y = 42;
                frond.rotation.x = Math.PI / 4;
                frond.rotation.y = (j / 5) * Math.PI * 2;
                tree.add(frond);
            }

            // Position trees around the island
            const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
            const r = 50 + Math.random() * 40;
            tree.position.set(Math.cos(angle) * r, 100, Math.sin(angle) * r);
            const s = 0.8 + Math.random() * 0.5;
            tree.scale.set(s, s, s);
            
            group.add(tree);
        }

        // 7. Decorative rocks
        for(let i = 0; i < 6; i++) {
            const rockGeo = new THREE.DodecahedronGeometry(8 + Math.random() * 8, 0);
            const rockMat = new THREE.MeshStandardMaterial({ 
                color: 0x90a4ae,
                flatShading: true,
                roughness: 1.0
            });
            const rock = new THREE.Mesh(rockGeo, rockMat);
            const angle = Math.random() * Math.PI * 2;
            const r = 100 + Math.random() * 40;
            rock.position.set(Math.cos(angle) * r, 15, Math.sin(angle) * r);
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            group.add(rock);
        }
        
        // 8. Golden flag pole near the center
        const poleGeo = new THREE.CylinderGeometry(2, 2, 80, 6);
        const poleMat = new THREE.MeshStandardMaterial({ 
            color: 0xffd700,
            metalness: 0.6,
            roughness: 0.3
        });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(0, 140, 0);
        group.add(pole);

        return group;
    }

    createShipModel(color) {
        const group = new THREE.Group();
        group.userData.type = 'ship_model';

        // Hull
        const hullGeo = new THREE.BoxGeometry(24, 8, 45);
        // Taper front
        const pos = hullGeo.attributes.position;
        for(let i=0; i<pos.count; i++) {
            // Local Z is length. Front is +Z usually in Three.js primitives but let's assume +Z is front for now
            if (pos.getZ(i) > 20) {
                pos.setX(i, pos.getX(i) * 0.1); // Pinch front
            }
            if (pos.getY(i) < -2) {
                pos.setX(i, pos.getX(i) * 0.6); // Taper bottom
            }
        }
        hullGeo.computeVertexNormals();
        const hullMat = new THREE.MeshStandardMaterial({ color: color, flatShading: true });
        const hull = new THREE.Mesh(hullGeo, hullMat);
        hull.position.y = 4;
        hull.castShadow = true;
        group.add(hull);

        // Deck/Cabin
        const cabinGeo = new THREE.BoxGeometry(16, 8, 12);
        const cabinMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 10, -8);
        group.add(cabin);

        // Mast
        const mastGeo = new THREE.CylinderGeometry(1, 1, 35, 4);
        const mastMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63 });
        const mast = new THREE.Mesh(mastGeo, mastMat);
        mast.position.set(0, 20, 5);
        group.add(mast);

        // Sail
        const sailShape = new THREE.Shape();
        sailShape.moveTo(0, 0);
        sailShape.lineTo(0, 25);
        sailShape.lineTo(15, 5);
        sailShape.lineTo(0, 0);
        const sailGeo = new THREE.ShapeGeometry(sailShape);
        const sailMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const sail = new THREE.Mesh(sailGeo, sailMat);
        sail.position.set(0, 10, 6);
        group.add(sail);

        return group;
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
                
                // Procedural Island Mesh
                const islandMesh = this.createLowPolyIsland();
                group.add(islandMesh);

                // Title Sprite (Billboard)
                const tData = Utils.createTextTexture(isl.title, '#01579b', 40);
                const sMat = new THREE.SpriteMaterial({ map: tData.texture, depthTest: false });
                const sprite = new THREE.Sprite(sMat);
                sprite.scale.set(tData.aspect * 60, 60, 1);
                sprite.position.y = 110;
                sprite.userData.isBillboard = true;
                group.add(sprite);

                // Icon Sprite
                const iData = Utils.createTextTexture(isl.icon, '#000', 80);
                const iMat = new THREE.SpriteMaterial({ map: iData.texture, depthTest: false });
                const iSprite = new THREE.Sprite(iMat);
                iSprite.scale.set(iData.aspect * 50, 50, 1);
                iSprite.position.y = 70;
                iSprite.userData.isBillboard = true;
                group.add(iSprite);

                // KPI Satellites as Small Islands
                if (isl.kpis && isl.kpis.length > 0) {
                    const radius = 160; // Slightly larger radius for small islands
                    const angleStep = (Math.PI * 2) / isl.kpis.length;
                    
                    isl.kpis.forEach((kpi, idx) => {
                        const angle = -Math.PI/2 + (idx * angleStep);
                        const kx = Math.cos(angle) * radius;
                        const kz = Math.sin(angle) * radius; 

                        const kGroup = new THREE.Group();
                        kGroup.position.set(kx, 0, kz);
                        kGroup.userData.isKPI = true;

                        // Create small KPI island
                        const kpiIsland = this.createKPIIsland(kpi.completed);
                        kGroup.add(kpiIsland);

                        // KPI Number Label
                        const label = kpi.id.split('_')[1] || (idx+1);
                        const lData = Utils.createTextTexture(`#${label}`, '#fff', 28);
                        const lMat = new THREE.SpriteMaterial({ map: lData.texture });
                        const lSprite = new THREE.Sprite(lMat);
                        lSprite.scale.set(lData.aspect * 22, 22, 1);
                        lSprite.position.y = 45;
                        lSprite.userData.isBillboard = true;
                        kGroup.add(lSprite);
                        
                        // KPI Description (truncated)
                        const shortDesc = kpi.desc.length > 20 ? kpi.desc.substring(0, 18) + '...' : kpi.desc;
                        const dData = Utils.createTextTexture(shortDesc, kpi.completed ? '#66bb6a' : '#ffa726', 20);
                        const dMat = new THREE.SpriteMaterial({ map: dData.texture });
                        const dSprite = new THREE.Sprite(dMat);
                        dSprite.scale.set(dData.aspect * 18, 18, 1);
                        dSprite.position.y = 60;
                        dSprite.userData.isBillboard = true;
                        kGroup.add(dSprite);

                        group.add(kGroup);

                        // Connection Line (from main island to KPI island)
                        const points = [ new THREE.Vector3(0, 40, 0), new THREE.Vector3(kx, 25, kz) ];
                        const lGeo = new THREE.BufferGeometry().setFromPoints(points);
                        const lineColor = kpi.completed ? 0x66bb6a : 0xffa726;
                        const lMatLine = new THREE.LineBasicMaterial({ color: lineColor, transparent:true, opacity:0.5 });
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
                            new THREE.Vector3(isl.x, 40, isl.y),
                            new THREE.Vector3(mg.x, 150, mg.y)
                        ];
                        const geo = new THREE.BufferGeometry().setFromPoints(points);
                        const mat = new THREE.LineDashedMaterial({ color: 0x4fc3f7, dashSize: 15, gapSize: 10, opacity: 0.6, transparent: true });
                        const line = new THREE.Line(geo, mat);
                        line.computeLineDistances();
                        this.scene.add(line);
                        this.lines.push(line);
                    }
                });
            }
        });

        // 2. Main Goals (Big Islands - 2x size of expeditions)
        state.mainGoals.forEach(mg => {
            const mesh = getMesh(mg.id, () => {
                const group = new THREE.Group();
                group.userData.type = 'goal';

                // Create a large island for main goal (scaled up version)
                const mainGoalIsland = this.createMainGoalIsland();
                group.add(mainGoalIsland);

                // Golden beacon on top
                const beaconGeo = new THREE.CylinderGeometry(5, 8, 60, 6);
                const beaconMat = new THREE.MeshStandardMaterial({ 
                    color: 0xffd700, 
                    emissive: 0xffa000,
                    emissiveIntensity: 0.3,
                    metalness: 0.8,
                    roughness: 0.2
                });
                const beacon = new THREE.Mesh(beaconGeo, beaconMat);
                beacon.position.y = 160;
                beacon.castShadow = true;
                group.add(beacon);
                
                // Beacon light/glow
                const glowMat = new THREE.SpriteMaterial({
                    map: new THREE.CanvasTexture(this.createGlowTexture()),
                    color: 0xffd700, transparent: true, blending: THREE.AdditiveBlending
                });
                const glow = new THREE.Sprite(glowMat);
                glow.scale.set(150, 150, 1);
                glow.position.y = 190;
                group.add(glow);

                // Label (larger for main goal)
                const tData = Utils.createTextTexture(mg.title, '#ffd700', 50);
                const sMat = new THREE.SpriteMaterial({ map: tData.texture });
                const sprite = new THREE.Sprite(sMat);
                sprite.scale.set(tData.aspect * 100, 100, 1);
                sprite.position.y = 230;
                sprite.userData.isBillboard = true;
                group.add(sprite);
                
                // Icon
                const iData = Utils.createTextTexture(mg.icon, '#fff', 80);
                const iMat = new THREE.SpriteMaterial({ map: iData.texture });
                const iSprite = new THREE.Sprite(iMat);
                iSprite.scale.set(iData.aspect * 60, 60, 1);
                iSprite.position.y = 140;
                iSprite.userData.isBillboard = true;
                group.add(iSprite);

                return group;
            });
            mesh.position.set(mg.x, 0, mg.y); // Place at ground level since island has height

            // Line to North Star (from top of island beacon)
            const points = [
                new THREE.Vector3(mg.x, 220, mg.y),
                new THREE.Vector3(0, 600, -1000)
            ];
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const mat = new THREE.LineBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.5 });
            const line = new THREE.Line(geo, mat);
            this.scene.add(line);
            this.lines.push(line);
        });

        // 3. Ships
        const activeShipIds = new Set();
        
        ships.forEach((s, i) => {
            const sid = `ship_${s.teamId}_${i}`; 
            activeShipIds.add(sid);
            
            const mesh = getMesh(sid, () => {
                const group = new THREE.Group();
                group.userData.type = 'ship';
                
                // New Model
                const model = this.createShipModel(s.color);
                // Rotate model to face -Z (standard forward)
                model.rotation.y = Math.PI; 
                group.add(model);

                // Label
                const tData = Utils.createTextTexture(s.teamName, '#fff', 24);
                const sMat = new THREE.SpriteMaterial({ map: tData.texture });
                const sprite = new THREE.Sprite(sMat);
                sprite.scale.set(tData.aspect * 30, 30, 1);
                sprite.position.set(0, 40, 0);
                group.add(sprite);

                return group;
            });
            
            // Only set X and Z position here - Y is handled in animate() for wave motion
            mesh.position.x = s.x;
            mesh.position.z = s.y;
            // Store ship data for wave calculations
            mesh.userData.shipData = s;
            
            // Logic rotation (facing left/right) mapped to 3D rotation
            // Ship model points -Z. 
            // If vx > 0 (right), rotate -90 deg (face +X)
            // If vx < 0 (left), rotate +90 deg (face -X)
            // Default: Docked. Let's align with movement or target.
            
            if (s.facingLeft) mesh.rotation.y = Math.PI / 2; // Face Left (World -X) ? No, World X goes right.
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
}