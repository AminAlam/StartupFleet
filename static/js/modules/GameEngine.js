import { Utils } from './Utils.js';
import { Camera2D } from './Camera2D.js';
import { ParticleSystem } from './ParticleSystem.js';
import { ThreeEngine } from './ThreeEngine.js';

export class GameEngine {
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
        window.addEventListener('mouseup', e => this.handleMouseUp(e)); // Window listener fixes stuck drag
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
        if(typeof window.ui !== 'undefined') window.ui.renderTeams(); 
        Utils.showToast("Fleet Command Loaded", 'success');
    }

    rebuildShips() {
        this.ships = [];
        this.state.teams.forEach(team => {
            if(team.deployed) {
                team.deployed.forEach(deployment => {
                    let islandId, kpiIds, deploymentId;
                    if (typeof deployment === 'string') {
                        // Legacy format: just island ID
                        islandId = deployment;
                        kpiIds = [];
                        deploymentId = Utils.generateId('dep'); // Generate ID for legacy
                    } else {
                        islandId = deployment.islandId;
                        kpiIds = deployment.kpiIds || (deployment.kpiId ? [deployment.kpiId] : []);
                        deploymentId = deployment.deploymentId || Utils.generateId('dep');
                        // Update deployment with ID if missing
                        if (!deployment.deploymentId) {
                            deployment.deploymentId = deploymentId;
                        }
                    }

                    const island = this.state.islands.find(i => i.id === islandId);
                    if(island) {
                        const pos = this.getDeploymentTarget(island, kpiIds);
                        // Add slight random offset to prevent 0-distance NaN errors in physics
                        const offsetX = (Math.random() - 0.5) * 2; 
                        const offsetY = (Math.random() - 0.5) * 2;
                        this.createShipWithDeployment(team, island.id, kpiIds, deploymentId, pos.x + offsetX, pos.y + offsetY, 'DOCKED');
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
        // Legacy wrapper - creates ship with auto-generated deployment ID
        this.createShipWithDeployment(team, targetId, targetKpiIds, null, x, y, state);
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
                        window.ui.renderTeams();
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
        // Clean sea gradient background (no grid lines)
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, "#e0f7fa");
        gradient.addColorStop(1, "#b2ebf2");
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.camera.apply(this.ctx); 
        
        // this.drawGrid(); // Removed per user request
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

    // Helper to wrap text within a max width
    wrapText(text, maxWidth, font) {
        this.ctx.font = font;
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const metrics = this.ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        return lines;
    }

    drawDetailsPanel(island) {
        const width = 350; // Wider panel for full text
        const x = island.x - width/2;
        const baseY = island.y + 80;
        const padding = 15;
        const textWidth = width - (padding * 2) - 25; // Account for bullet point
        
        const kpis = island.kpis || [];
        
        // Calculate dynamic height based on wrapped text
        this.ctx.font = "12px Poppins";
        let totalHeight = 60; // Header + separator
        
        // Island description height
        if (island.desc) {
            const descLines = this.wrapText(island.desc, textWidth + 10, "italic 11px Poppins");
            totalHeight += descLines.length * 14 + 10;
        }
        
        // KPI heights
        kpis.forEach(kpi => {
            const kpiLines = this.wrapText(kpi.desc, textWidth, "12px Poppins");
            totalHeight += kpiLines.length * 14 + 25; // Line height + spacing for deadline
        });
        
        if (kpis.length === 0) {
            totalHeight += 20;
        }
        
        totalHeight += 15; // Bottom padding
        
        // Draw panel background
        this.ctx.save();
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.97)";
        this.ctx.shadowColor = "rgba(0,0,0,0.15)";
        this.ctx.shadowBlur = 25;
        this.ctx.beginPath();
        this.ctx.roundRect(x, baseY, width, totalHeight, 12);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        
        // Header
        this.ctx.fillStyle = "#37474f";
        this.ctx.font = "bold 14px Poppins";
        this.ctx.textAlign = "left";
        this.ctx.fillText("OBJECTIVES & KPIs", x + padding, baseY + 25);
        
        // Separator line
        this.ctx.beginPath();
        this.ctx.moveTo(x + padding, baseY + 38);
        this.ctx.lineTo(x + width - padding, baseY + 38);
        this.ctx.strokeStyle = "#e0e0e0";
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        let ty = baseY + 55;

        // Island description (wrapped)
        if(island.desc) {
            this.ctx.font = "italic 11px Poppins";
            this.ctx.fillStyle = "#607d8b";
            const descLines = this.wrapText(island.desc, textWidth + 10, "italic 11px Poppins");
            descLines.forEach(line => {
                this.ctx.fillText(line, x + padding, ty);
                ty += 14;
            });
            ty += 8;
        }

        // KPIs
        if (kpis.length === 0) {
            this.ctx.font = "12px Poppins";
            this.ctx.fillStyle = "#9e9e9e";
            this.ctx.fillText("No KPIs defined yet.", x + padding, ty);
        }

        kpis.forEach(kpi => {
            // Status bullet
            this.ctx.fillStyle = kpi.completed ? "#4caf50" : "#ff9800";
            this.ctx.beginPath();
            this.ctx.arc(x + padding + 6, ty - 4, 5, 0, Math.PI*2);
            this.ctx.fill();

            // KPI description (wrapped)
            this.ctx.font = "12px Poppins";
            this.ctx.fillStyle = "#333";
            const kpiLines = this.wrapText(kpi.desc, textWidth, "12px Poppins");
            kpiLines.forEach((line, idx) => {
                this.ctx.fillText(line, x + padding + 20, ty + (idx * 14));
            });
            ty += kpiLines.length * 14 + 4;
            
            // Deadline and status
            this.ctx.font = "10px Poppins";
            const status = kpi.completed ? "✓ Completed" : "○ Pending";
            const statusColor = kpi.completed ? "#4caf50" : "#ff9800";
            
            this.ctx.fillStyle = statusColor;
            this.ctx.fillText(status, x + padding + 20, ty);
            
            if(kpi.deadline) {
                this.ctx.fillStyle = "#90a4ae";
                this.ctx.fillText("Due: " + kpi.deadline, x + padding + 100, ty);
            }
            
            ty += 20;
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
            window.ui.openIslandModal(this.worldMouse.x, this.worldMouse.y);
            this.placingIsland = false;
            return;
        }

        if (this.placingMainGoal) {
            window.ui.openMainGoalModal(this.worldMouse.x, this.worldMouse.y);
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
                window.ui.openIslandModal(null, null, this.draggingIsland);
            } else {
                // Dragged significantly -> Save new location
                this.autoSave();
            }
            this.draggingIsland = null;
        }
        
        if (this.draggingMainGoal) {
             const dist = Math.sqrt(Math.pow(this.mouse.x - this.dragStart.x, 2) + Math.pow(this.mouse.y - this.dragStart.y, 2));
             if (dist < 5) {
                window.ui.openMainGoalModal(null, null, this.draggingMainGoal);
             } else {
                 // Dragged significantly -> Save new location
                 this.autoSave();
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
            window.ui.selectKpiModal(targetIsland, teamId);
        }
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

    recallShip(ship) {
        ship.state = 'RETURNING';
        Utils.showToast(`${ship.teamName} is returning to HQ`);
        
        // Remove only ONE matching deployment from state (by deploymentId if available)
        const team = this.state.teams.find(t => t.id === ship.teamId);
        if (team && team.deployed) {
            if (ship.deploymentId) {
                // Remove by unique deployment ID
                team.deployed = team.deployed.filter(d => d.deploymentId !== ship.deploymentId);
            } else {
                // Legacy: find first matching deployment and remove only that one
                let foundIndex = -1;
                for (let i = 0; i < team.deployed.length; i++) {
                    const d = team.deployed[i];
                    if (typeof d === 'string') {
                        if (d === ship.targetId) { foundIndex = i; break; }
                    } else {
                        if (d.islandId === ship.targetId) {
                            const dKpis = d.kpiIds || [];
                            const sKpis = ship.targetKpiIds || [];
                            if (dKpis.length === sKpis.length && dKpis.every(k => sKpis.includes(k))) {
                                foundIndex = i;
                                break;
                            }
                        }
                    }
                }
                if (foundIndex !== -1) {
                    team.deployed.splice(foundIndex, 1); // Remove only one
                }
            }
        }
        
        this.autoSave();
    }

    assignTeam(teamId, islandOrId, kpiIds) {
        const team = this.state.teams.find(t => t.id === teamId);
        // Handle both island object or island ID string
        const islandId = (typeof islandOrId === 'object') ? islandOrId.id : islandOrId;
        const island = (typeof islandOrId === 'object') ? islandOrId : this.state.islands.find(i => i.id === islandId);
        
        if (!team || !island) return;
        
        if (!team.deployed) team.deployed = [];
        
        // Always add a new deployment (allow multiple assignments to same island/KPIs)
        const deploymentId = Utils.generateId('dep');
        team.deployed.push({ 
            deploymentId: deploymentId,
            islandId: islandId, 
            kpiIds: kpiIds || [] 
        });
        
        // Create ship with reference to this specific deployment
        const pos = this.getDeploymentTarget(island, kpiIds);
        // Start from left side of screen
        const startX = this.camera.x - (this.canvas.width / 2 / this.camera.zoom) - 100;
        const startY = pos.y + (Math.random() - 0.5) * 100;
        
        this.createShipWithDeployment(team, islandId, kpiIds, deploymentId, startX, startY, 'SAILING');
        
        Utils.showToast(`${team.name} deployed to ${island.title}`);
        window.ui.renderTeams();
        this.autoSave();
    }

    createShipWithDeployment(team, targetId, targetKpiIds, deploymentId, x, y, state) {
        this.ships.push({
            teamId: team.id,
            teamName: team.name,
            targetId: targetId, 
            targetKpiIds: targetKpiIds,
            deploymentId: deploymentId, // Link to specific deployment
            x: x, y: y,
            vx: 0, vy: 0,
            state: state, 
            color: team.color,
            icon: team.icon
        });
    }

    addIslandMode() {
        this.placingIsland = true;
        this.placingMainGoal = false;
    }

    addMainGoalMode() {
        this.placingMainGoal = true;
        this.placingIsland = false;
    }
}