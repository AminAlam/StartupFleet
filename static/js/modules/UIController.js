import { Utils, ICONS, COLORS } from './Utils.js';

export class UIController {
    constructor() {
        this.tutorialStep = 0;
        this.tutorialSteps = [
            {
                title: "Welcome aboard, Captain! ⚓",
                text: "Welcome to <b>Startup Fleet</b>. This platform visualizes your strategy as a fleet of ships navigating towards your goals. Let's get you oriented."
            },
            {
                title: "Navigation 🗺️",
                text: "<b>Right-Click + Drag</b> to pan the map.<br><b>Scroll</b> to zoom in and out.<br><b>Left-Click + Drag</b> to move Islands and Goals."
            },
            {
                title: "Deploying Your Fleet 🚀",
                text: "On the left sidebar, you see your <b>Teams</b>. Drag a team card onto any <b>Expedition (Island)</b> to deploy ships to that initiative."
            },
            {
                title: "Manage Objectives 🎯",
                text: "<b>Click</b> any Island or Main Goal to view details. <b>Double-Click</b> or use the Edit button to modify objectives and KPIs."
            },
            {
                title: "Views & Data 📊",
                text: "Use the top bar to switch between the <b>2D Map</b>, <b>3D World</b>, and the <b>Strategy Matrix</b> for different perspectives on your progress."
            }
        ];
    }

    checkTutorial() {
        const seen = localStorage.getItem('tutorial_seen');
        if (!seen) {
            this.startTutorial();
        }
    }

    startTutorial() {
        this.tutorialStep = 0;
        document.getElementById('tutorial-overlay').classList.remove('hidden');
        this.renderTutorialStep();
    }

    renderTutorialStep() {
        const step = this.tutorialSteps[this.tutorialStep];
        document.getElementById('tutorial-title').innerHTML = step.title;
        document.getElementById('tutorial-text').innerHTML = step.text;
        document.getElementById('tutorial-step-indicator').innerText = `${this.tutorialStep + 1} / ${this.tutorialSteps.length}`;
        
        const nextBtn = document.getElementById('tutorial-next-btn');
        nextBtn.innerText = (this.tutorialStep === this.tutorialSteps.length - 1) ? "Finish" : "Next";
    }

    nextTutorialStep() {
        this.tutorialStep++;
        if (this.tutorialStep >= this.tutorialSteps.length) {
            this.skipTutorial();
            return;
        }
        this.renderTutorialStep();
    }

    skipTutorial() {
        document.getElementById('tutorial-overlay').classList.add('hidden');
        localStorage.setItem('tutorial_seen', 'true');
        Utils.showToast("Tutorial completed!");
    }

    editProjectTitle() {
        const currentTitle = window.game.state.projectTitle || "Startup Fleet";
        const newTitle = prompt("Enter new project title:", currentTitle);
        if (newTitle && newTitle.trim() !== "") {
            window.game.state.projectTitle = newTitle;
            this.updateProjectTitle(newTitle);
            window.game.autoSave();
        }
    }

    updateProjectTitle(title) {
        const el = document.getElementById('app-title');
        if(el) el.innerText = title;
        document.title = `${title}: Strategy Visualization`;
    }

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
        window.game.threeEngine.stop();
        window.game.viewMode = 'map';

        if (view === 'map') {
            document.getElementById('btn-view-map').classList.add('active-view');
        } else if (view === '3d') {
            document.getElementById('btn-view-3d').classList.add('active-view');
            window.game.viewMode = '3d';
            canvas.style.display = 'none';
            window.game.threeEngine.start();
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

        window.game.state.teams.forEach(t => {
            if(!teamFocus[t.id]) teamFocus[t.id] = {};
            if(t.deployed) {
                t.deployed.forEach(d => {
                    const kpiIds = d.kpiIds || [];
                    const islId = d.islandId || d; // Handle legacy string
                    
                    // Count focus based on Main Goal of the island
                    const island = window.game.state.islands.find(i => i.id === islId);
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
        
        window.game.state.mainGoals.forEach(mg => {
            let totalKpis = 0;
            let completedKpis = 0;
            let totalShips = 0;

            // Aggregate data from child islands
            window.game.state.islands.forEach(isl => {
                if(isl.mainGoalIds && isl.mainGoalIds.includes(mg.id)) {
                    if(isl.kpis) {
                        totalKpis += isl.kpis.length;
                        completedKpis += isl.kpis.filter(k => k.completed).length;
                    }
                    // Count ships on this island
                    window.game.state.teams.forEach(t => {
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
        window.game.state.teams.forEach(t => {
            const deployed = t.deployed ? t.deployed.length : 0;
            const pct = (deployed / t.totalShips) * 100;
            
            // Determine Primary Focus
            let topGoalId = null;
            let maxCount = 0;
            const focusMap = metrics.teamFocus[t.id] || {};
            for(const [gid, count] of Object.entries(focusMap)) {
                if(count > maxCount) { maxCount = count; topGoalId = gid; }
            }
            const topGoal = topGoalId ? window.game.state.mainGoals.find(g => g.id === topGoalId) : null;
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
        const islands = window.game.state.islands;
        
        let html = `<thead><tr><th style="width:200px; background:#fff; position:sticky; left:0; z-index:10;">Team / Expedition</th>`;
        islands.forEach(isl => {
             html += `<th style="min-width:120px; vertical-align:bottom; padding-bottom:10px;">
                <div style="text-align:center; font-size:24px; margin-bottom:5px;">${isl.icon}</div>
                <div style="text-align:center; font-size:12px; font-weight:600; line-height:1.2;">${isl.title}</div>
             </th>`;
        });
        html += `</tr></thead><tbody>`;

        window.game.state.teams.forEach(t => {
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
        window.game.state.islands.forEach(isl => {
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
        
        window.game.state.teams.forEach(team => {
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
            window.game.assignTeam(teamId, island, []);
            return;
        }

        let html = `<div style="margin-bottom:15px; font-size:14px;">Deploying to <b>${island.title}</b>. Select Objectives:</div>`;
        
        island.kpis.forEach((kpi, idx) => {
             html += `
                <label class="kpi-item" style="display:flex; gap:12px; cursor:pointer; border:1px solid #eee; padding:8px 12px; margin-bottom:6px; align-items:flex-start; border-radius:6px; background:#fafafa;">
                    <input type="checkbox" class="kpi-select-cb" value="${kpi.id}" style="margin-top:4px; width:16px; height:16px; flex-shrink:0;">
                    <div style="flex-grow:1; min-width:0;">
                        <div style="font-weight:600; font-size:13px; color:#333; margin-bottom:2px; line-height:1.3;">${kpi.desc}</div>
                        <div style="font-size:11px; color:${kpi.completed?'#2e7d32':'#ef6c00'}; display:flex; align-items:center; gap:6px;">
                            <span>${kpi.completed?'✓ Completed':'○ Pending'}</span>
                            <span style="color:#bbb">•</span>
                            <span style="color:#78909c">Due: ${kpi.deadline||'No Date'}</span>
                        </div>
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
        const island = window.game.state.islands.find(i => i.id === islandId);
        window.game.assignTeam(teamId, island, kpiIds);
        this.closeModal();
        document.getElementById('modal-save-btn').style.display = 'block';
    }

    openTeamModal(teamId = null) {
        document.getElementById('modal-save-btn').style.display = 'block';
        const team = teamId ? window.game.state.teams.find(t => t.id === teamId) : { name: '', totalShips: 3, color: COLORS[0], icon: '🚀' };
        
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
                const idx = window.game.state.teams.findIndex(t => t.id === teamId);
                window.game.state.teams[idx] = newTeam;
            } else {
                window.game.state.teams.push(newTeam);
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
                const idx = window.game.state.mainGoals.findIndex(g => g.id === data.id);
                window.game.state.mainGoals[idx] = data;
            } else {
                window.game.state.mainGoals.push(data);
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

        const mainGoalOptions = window.game.state.mainGoals.map(mg => `
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
                const idx = window.game.state.islands.findIndex(i => i.id === data.id);
                window.game.state.islands[idx] = data;
            } else {
                window.game.state.islands.push(data);
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
            window.game.state.teams = window.game.state.teams.filter(t => t.id !== id);
            window.game.ships = window.game.ships.filter(s => s.teamId !== id);
            this.renderTeams();
        }
    }

    deleteIsland(id) {
        if(confirm("Delete expedition? Ships will return.")) {
            window.game.state.islands = window.game.state.islands.filter(i => i.id !== id);
            window.game.ships.forEach(s => {
                if(s.targetId === id) window.game.recallShip(s);
            });
            window.game.state.teams.forEach(t => {
                if(t.deployed) t.deployed = t.deployed.filter(d_id => d_id !== id);
            });
            this.renderTeams();
            this.closeModal();
        }
    }

    deleteMainGoal(id) {
        if(confirm("Delete this Main Goal? Linked Expeditions will be unlinked.")) {
            window.game.state.mainGoals = window.game.state.mainGoals.filter(m => m.id !== id);
            window.game.state.islands.forEach(i => {
                if(i.mainGoalIds) {
                    i.mainGoalIds = i.mainGoalIds.filter(mid => mid !== id);
                }
            });
            this.closeModal();
        }
    }
}
