// --- Gantt Chart View and Main Tree Logic ---
// (Removed redundant, unclosed DOMContentLoaded handler. All logic is now inside the single handler below.)
// --- Gantt Chart View and Main Tree Logic ---
document.addEventListener('DOMContentLoaded', function() {
    // Declare all DOM elements at the top for global access
    const ganttContainer = document.getElementById('gantt-container');
    const projectTree = document.getElementById('project-tree');
    const treeHeaders = document.getElementById('tree-headers');
    const ganttBtn = document.getElementById('toggle-gantt');
    // Removed Gantt layer controls
    const projectSelect = document.getElementById('project-select');
    const uploadForm = document.getElementById('upload-form');
    const fileListDiv = document.getElementById('file-list');
    const form = document.getElementById('add-project-form');
    const fileGalleryDiv = document.getElementById('file-gallery');
    // Removed activeLayers for Gantt layer selection

    // --- Minimal Gantt Chart Renderer ---
    // --- Gantt Chart Zoom State ---
    let ganttDayWidth = 24; // px per day, default

    function renderGanttChart() {
        updateParentDates(projectTree);
        console.log('renderGanttChart called');
        if (!ganttContainer) {
            console.warn('ganttContainer not found');
            return;
        }

        // Dynamically set dayWidth to fill available width
        let containerWidth = ganttContainer.offsetWidth || window.innerWidth || 1200;

        // --- Helper functions (move outside renderGanttChart for reuse if needed) ---
        function parseDate(str) {
            if (!str) return null;
            const d = new Date(str);
            return isNaN(d) ? null : d;
        }
        function addWeekdays(date, days) {
            let d = new Date(date);
            let added = 0;
            while (added < days) {
                d.setDate(d.getDate() + 1);
                if (d.getDay() !== 0 && d.getDay() !== 6) added++;
            }
            return d;
        }
        function weekdaysBetween(a, b) {
            let count = 0;
            let d = new Date(a);
            while (d < b) {
                if (d.getDay() !== 0 && d.getDay() !== 6) count++;
                d.setDate(d.getDate() + 1);
            }
            return count;
        }
        function parseDuration(str) {
            if (!str) return 1;
            str = String(str).trim();
            if (/^\d+$/.test(str)) return parseInt(str);
            let m = str.match(/^(\d+)\s*([dwm])$/i);
            if (m) {
                const n = parseInt(m[1]);
                const u = m[2].toLowerCase();
                if (u === 'd') return n;
                if (u === 'w') return n * 7;
                if (u === 'm') return n * 30;
            }
            m = str.match(/^(\d+)\s*(day|days|week|weeks|month|months)$/i);
            if (m) {
                const n = parseInt(m[1]);
                const u = m[2].toLowerCase();
                if (u.startsWith('day')) return n;
                if (u.startsWith('week')) return n * 7;
                if (u.startsWith('month')) return n * 30;
            }
            m = str.match(/(\d+)/);
            if (m) return parseInt(m[1]);
            return 1;
        }
        function gatherTasks(ul, arr = [], parentLevel = 0) {
            ul.querySelectorAll(':scope > li').forEach(li => {
                const meta = li._meta || {};
                const level = (typeof meta.level !== 'undefined' && meta.level !== null && meta.level !== '') ? meta.level : (CLASS_LABELS[parentLevel] || 'Item');
                arr.push({
                    name: li.querySelector('.proj-name')?.textContent.trim() || '',
                    planned_start: meta.planned_start,
                    estimated_duration: meta.estimated_duration,
                    deadline: meta.deadline,
                    level,
                    status: meta.status,
                    li
                });
                const subUl = li.querySelector('ul');
                if (subUl) gatherTasks(subUl, arr, parentLevel + 1);
            });
            return arr;
        }

        // --- Compute date range (weekdays only) ---
    // Layout constants
    const barHeight = 28;
    const barGap = 12;
    const topPad = 40;
        const tasks = gatherTasks(projectTree);
        let minDate = null, maxDate = null;
        tasks.forEach(t => {
            const start = parseDate(t.planned_start);
            const dur = parseDuration(t.estimated_duration);
            const end = start ? addWeekdays(start, dur) : null;
            if (start && (!minDate || start < minDate)) minDate = start;
            if (end && (!maxDate || end > maxDate)) maxDate = end;
            const deadline = parseDate(t.deadline);
            if (deadline && (!maxDate || deadline > maxDate)) maxDate = deadline;
        });
        if (!tasks.length) {
            ganttContainer.innerHTML = '<div style="padding:2em;text-align:center;font-size:1.2em;color:#888;">No tasks to display.</div>';
            return;
        }
        if (!minDate || !maxDate) {
            ganttContainer.innerHTML = '<div style="padding:2em;text-align:center;font-size:1.2em;color:#888;">No valid dates to display.</div>';
            return;
        }
    const totalDays = weekdaysBetween(minDate, maxDate);
    const leftPad = 120;
    const rightPad = 40;
    let dayWidth = Math.max(24, (containerWidth - leftPad - rightPad) / Math.max(1, totalDays));
    // Chart dimensions
    const chartWidth = totalDays * dayWidth + leftPad + rightPad;
    const chartHeight = tasks.length * (barHeight + barGap) + topPad + 40;
        // --- End helpers and setup ---

        // Time axis labels (every 7 days)
        let axisLabels = '';
        // Draw axis labels for each Monday
        let d = new Date(minDate);
        d.setDate(d.getDate() - d.getDay() + 1); // move to next Monday
        while (d <= maxDate) {
            const x = leftPad + weekdaysBetween(minDate, d) * dayWidth;
            axisLabels += `<text x="${x}" y="${topPad - 10}" font-size="12" fill="#555">${d.toISOString().slice(0,10)}</text>`;
            axisLabels += `<line x1="${x}" y1="${topPad - 5}" x2="${x}" y2="${chartHeight - 20}" stroke="#eee" />`;
            d.setDate(d.getDate() + 7);
        }

        // Today line
        const today = new Date();
        today.setHours(0,0,0,0);
        let todayLine = '';
        if (today >= minDate && today <= maxDate) {
            const tx = leftPad + weekdaysBetween(minDate, today) * dayWidth;
            todayLine = `<line x1="${tx}" y1="${topPad - 5}" x2="${tx}" y2="${chartHeight - 20}" stroke="#00bcd4" stroke-width="2" stroke-dasharray="4,3" />`;
            axisLabels += `<text x="${tx+2}" y="${topPad - 18}" font-size="11" fill="#00bcd4">Today</text>`;
        }

        // Bars with tooltips and click-to-edit
        let bars = '';
        let rowBg = '';
        const colorMap = { 'Project':'#FF8200', 'Phase':'#1E90FF', 'Feature':'#6A4FB6', 'Item':'#4BB543' };
        tasks.forEach((t, i) => {
            // Declare once per iteration
            const start = parseDate(t.planned_start) || minDate;
            const dur = parseDuration(t.estimated_duration);
            const end = addWeekdays(start, dur);
            // Dependency overlap warning logic
            let hasOverlap = false;
            if (t.li && t.li._meta && t.li._meta.dependencies) {
                const depNames = t.li._meta.dependencies.split(',').map(s => s.trim()).filter(Boolean);
                depNames.forEach(depName => {
                    const depTask = tasks.find(other => other.name === depName);
                    if (depTask) {
                        const depStart = parseDate(depTask.planned_start) || minDate;
                        const depDur = parseDuration(depTask.estimated_duration);
                        const depEnd = addWeekdays(depStart, depDur);
                        if (start < depEnd) {
                            hasOverlap = true;
                        }
                    }
                });
            }
            const y = topPad + i * (barHeight + barGap);
            const x = leftPad + weekdaysBetween(minDate, start) * dayWidth;
            const w = Math.max(1, weekdaysBetween(start, end) * dayWidth);
            // Alternating row backgrounds
            if (i % 2 === 1) {
                rowBg += `<rect x="0" y="${y-2}" width="100%" height="${barHeight+4}" fill="#f5f5fa" />`;
            }
            // Color by level
            let fill = colorMap[t.level] || '#888';
            // Overdue highlight
            let isOverdue = false;
            if (t.deadline) {
                const deadlineDate = parseDate(t.deadline);
                if (deadlineDate && end > deadlineDate) {
                    fill = '#d32f2f';
                    isOverdue = true;
                }
            }
            // Tooltip content
            const tooltip = [
                `<b>${t.name}</b>`,
                t.level ? `Type: ${t.level}` : '',
                t.planned_start ? `Start: ${t.planned_start}` : '',
                t.estimated_duration ? `Est: ${t.estimated_duration}` : '',
                t.deadline ? `Deadline: ${t.deadline}` : '',
                t.status ? `Status: ${t.status}` : '',
                t.description ? `Desc: ${t.description}` : ''
            ].filter(Boolean).join('<br>');
            // Add icon for node-level (no extra box/label)
            let borderStyle = '';
            let icon = '';
            if (t.level === 'Phase') {
                borderStyle = 'stroke:#1E90FF;stroke-width:3;stroke-dasharray:none;';
                icon = '\u25A0'; // solid square
            } else if (t.level === 'Feature') {
                borderStyle = 'stroke:#6A4FB6;stroke-width:3;stroke-dasharray:8,4;';
                icon = '\u2605'; // star
            } else if (t.level === 'Item') {
                borderStyle = 'stroke:#4BB543;stroke-width:2;stroke-dasharray:2,2;';
                icon = '\u25CF'; // solid circle
            } else {
                borderStyle = '';
                icon = '';
            }
            // Bar with data-index for click (no extra box/label)
            bars += `<g class="gantt-bar-group" data-index="${i}">
                <rect x="${x}" y="${y}" width="${w}" height="${barHeight}" rx="8" fill="${fill}" fill-opacity="0.92" style="cursor:pointer;${borderStyle};filter:drop-shadow(0 2px 6px #0002);stroke:#222;stroke-opacity:0.12;" class="gantt-bar-rect"/>
                <text x="${x-20}" y="${y+barHeight/2+6}" font-size="15" fill="#333" font-weight="bold" text-anchor="end" style="font-family:'Segoe UI',Arial,sans-serif;">${icon}</text>
                <title>${tooltip.replace(/<br>/g,'\n')}${hasOverlap ? '\n⚠ Overlaps dependency' : ''}</title>
                <text x="${x+10}" y="${y+barHeight/2+5}" font-size="15" fill="#fff" font-weight="bold" style="font-family:'Segoe UI',Arial,sans-serif;text-shadow:0 1px 2px #0007;">${t.name}</text>
                ${hasOverlap ? `<text x="${x+w-18}" y="${y+18}" font-size="18" fill="#d32f2f" title="Overlaps dependency" style="font-weight:bold;">&#9888;</text>` : ''}
            </g>`;
        // Deadline marker
        if (t.deadline) {
            // You can add deadline marker rendering here if needed
        }
            }); // This closes the tasks.forEach((t, i) => { ... }) loop

    // SVG wrapper with event delegation for click-to-edit
    ganttContainer.innerHTML = `<div style="overflow-x:auto;position:relative;">
        <style>
        .gantt-bar-rect:hover { filter: drop-shadow(0 4px 12px #0004) brightness(1.08); stroke: #222; stroke-opacity: 0.25; }
        #gantt-container { width: 100vw !important; max-width: 100vw !important; min-width: 0 !important; margin: 0; padding: 0; }
        </style>
        <svg id="gantt-svg" width="100%" viewBox="0 0 ${chartWidth} ${chartHeight}" height="${chartHeight}" style="background:#f7f8fa;border-radius:12px;box-shadow:0 2px 12px #0002; width:100%; min-width:0;">
            <g>${rowBg}</g>
            <g>${axisLabels}</g>
            ${todayLine}
            <g>${bars}</g>
        </svg>

            if (group && group.dataset.index) {
    }
                projectTree.style.display = 'none';
        ganttContainer.style.display = 'none';
            }
            addOptions(data.tree || []);
                    fileListDiv.querySelectorAll('.delete-file-btn').forEach(btn => {
                    });
            if (!fileInput.files.length || !projectSelect.value) {
            .then(r => r.json())
                            content = document.createElement('div');
                            content.className = 'thumb';
                            content.style.justifyContent = 'center';
                            content.innerHTML = '<span style="font-size:2em;">📄</span>';
                        item.appendChild(content);
                }); // This closes the DOMContentLoaded event handler
                        label.className = 'file-label';
                        label.textContent = f;
                        item.appendChild(label);
                        fileGalleryDiv.appendChild(item);
                    });
                } else {
                    fileGalleryDiv.textContent = 'No files for this project.';
                }
            });
    }

    // Modal logic for full-size viewing
    const fileModal = document.getElementById('file-modal');
    const fileModalContent = document.getElementById('file-modal-content');
    const fileModalClose = document.getElementById('file-modal-close');
    function openFileModal(type, url, filename) {
        fileModalContent.innerHTML = '';
        if (type === 'image') {
            const img = document.createElement('img');
            img.src = url;
            img.alt = filename;
            img.style.maxWidth = '90vw';
            img.style.maxHeight = '90vh';
            fileModalContent.appendChild(img);
        } else if (type === 'pdf') {
            const embed = document.createElement('embed');
            embed.src = url;
            embed.type = 'application/pdf';
            embed.style.width = '80vw';
            embed.style.height = '80vh';
            fileModalContent.appendChild(embed);
        }
        fileModal.style.display = 'flex';
    }
    fileModalClose.onclick = function() {
        fileModal.style.display = 'none';
    };
    fileModal.onclick = function(e) {
        if (e.target === fileModal) fileModal.style.display = 'none';
    };


    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const projectName = document.getElementById('project-name').value.trim();
        if (projectName) {
            // Ensure new node has all fields for Gantt
            const li = createProjectNode(projectName, {
                description: '',
                planned_start: '',
                estimated_duration: '',
                deadline: '',
                status: 'Not Started',
                dependencies: '',
                milestones: '',
                level: 'Item',
                external: false
            });
            projectTree.appendChild(li);
            form.reset();
            setTimeout(() => autoSaveTree(true), 100);
        }
    });

    // Save and Load buttons


    // Auto-save function
    function autoSaveTree(reload = false) {
        updateParentDates(projectTree);
        const treeData = serializeTree(projectTree);
        fetch('/api/save_tree', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tree: treeData })
        }).then(r => r.json()).then(data => {
            if (reload) {
                fetch('/api/load_tree').then r => r.json()).then(data => {
                    projectTree.innerHTML = '';
                    if (data.tree) {
                        renderTree(data.tree, projectTree);
                    }
                    if (typeof populateProjectSelect === 'function') {
                        populateProjectSelect();
                    }
                });
            }
        });
    }

    // Listen for changes to the tree and auto-save

    function setupAutoSaveListeners() {
        // Only add listeners if elements exist
        if (form) {
            form.addEventListener('submit', function(e) {
                setTimeout(autoSaveTree, 100); // after DOM update
            });
        }
        if (projectTree) {
            projectTree.addEventListener('drop', function(e) {
                setTimeout(autoSaveTree, 100);
            });
        }
        // Remove: generic click handler that triggers autoSaveTree on every click
        // Only call autoSaveTree in specific handlers for add, edit, delete, drag/drop, etc.
    }

    setupAutoSaveListeners();


    document.getElementById('load-tree').onclick = function() {
        console.log('Load Tree button clicked');
        fetch('/api/load_tree')
            .then(r => {
                if (!r.ok) throw new Error('Network response was not ok: ' + r.status);
                return r.json();
            })
            .then(data => {
                console.log('Loaded tree data:', data);
                if (projectTree) {
                    projectTree.innerHTML = '';
                    if (data.tree) {
                        renderTree(data.tree, projectTree);
                    } else {
                        console.warn('No tree data found in response');
                    }
                } else {
                    console.warn('projectTree element not found, skipping render.');
                }
            })
            .catch(err => {
                console.error('Error loading tree:', err);
            });
    };



    // Classification labels by level
    const CLASS_LABELS = ['Project', 'Phase', 'Feature', 'Item'];

    function serializeTree(ul, level = 0) {
        const arr = [];
        ul.querySelectorAll(':scope > li').forEach(li => {
            // Always read latest values from DOM and _meta
            const node = {
                name: li.querySelector('.proj-name')?.textContent.trim() || '',
                description: li._meta?.description || '',
                planned_start: li._meta?.planned_start || '',
                estimated_duration: li._meta?.estimated_duration || '',
                deadline: li._meta?.deadline || '',
                status: li._meta?.status || '',
                dependencies: li._meta?.dependencies || '',
                milestones: li._meta?.milestones || '',
                level: (typeof li._meta?.level !== 'undefined' && li._meta?.level !== null && li._meta?.level !== '') ? li._meta.level : (CLASS_LABELS[level] || 'Item'),
                external: li._meta?.external === true
            };
            if (li.dataset.projectId) {
                node.id = parseInt(li.dataset.projectId);
            }
            const subUl = li.querySelector('ul');
            if (subUl) {
                node.children = serializeTree(subUl, level + 1);
            }
            arr.push(node);
        });
        // Debug: log outgoing tree data with IDs
        if (level === 0) {
            console.log('[serializeTree] Outgoing tree data:', JSON.stringify(arr, null, 2));
        }
        return arr;
    }


    function renderTree(nodes, parentUl, level = 0) {
        nodes.forEach(node => {
            // Always assign classification by hierarchy if not set or null/empty
            if (typeof node.level === 'undefined' || node.level === null || node.level === '') node.level = CLASS_LABELS[level] || 'Item';
            const li = createProjectNode(node.name, node, level);
            if (node.id) {
                li.dataset.projectId = node.id;
            }
            // Defensive: always set li.dataset.projectId if node.id exists
            if (typeof node.id !== 'undefined' && node.id !== null) {
                li.dataset.projectId = node.id;
            }
            // Add click event to show gallery
            li.addEventListener('click', function(e) {
                // Only trigger if clicking the li or proj-name, not buttons
                if (e.target === li || e.target.classList.contains('proj-name')) {
                    e.stopPropagation();
                    if (node.id) {
                        showGalleryForProject(node.id);
                    }
                }
            });
            parentUl.appendChild(li);
            if (node.children && node.children.length) {
                const subUl = document.createElement('ul');
                li.appendChild(subUl);
                renderTree(node.children, subUl, level + 1);
            }
        });
    }




    function createProjectNode(name, meta = {}, level = 0) {
        const li = document.createElement('li');
        li.style.cursor = 'pointer';
        li.draggable = true;
        // Store meta info on the element
        li._meta = {
            description: meta.description || '',
            planned_start: meta.planned_start || '',
            estimated_duration: meta.estimated_duration || '',
            deadline: meta.deadline || '',
            status: meta.status || 'Not Started',
            dependencies: meta.dependencies || '',
            milestones: meta.milestones || '',
            level: (typeof meta.level !== 'undefined' && meta.level !== null && meta.level !== '') ? meta.level : (CLASS_LABELS[level] || 'Item'),
            external: meta.external === true
        };
        if (meta.id) {
            li.dataset.projectId = meta.id;
        }

    // (Removed classification label from node display)

    // Name span
    const nameSpan = document.createElement('span');
    nameSpan.className = 'proj-name';
    nameSpan.textContent = name;
    li.appendChild(nameSpan);

        // File indicator (paperclip) if files attached
        if (meta.files && meta.files.length > 0) {
            const fileIcon = document.createElement('span');
            fileIcon.title = 'Files attached';
            fileIcon.textContent = '📎';
            fileIcon.style.marginLeft = '0.3em';
            fileIcon.style.fontSize = '1em';
            li.appendChild(fileIcon);
        }

        // Meta info display
        const metaSpan = document.createElement('span');
        metaSpan.style.fontSize = '0.9em';
        metaSpan.style.marginLeft = '0.5em';
        metaSpan.style.color = '#666';
        updateMetaSpan();
        li.appendChild(metaSpan);

        function updateMetaSpan() {
            metaSpan.textContent =
                (li._meta.description ? ' | ' + li._meta.description : '') +
                (li._meta.planned_start ? ' | Start: ' + li._meta.planned_start : '') +
                (li._meta.estimated_duration ? ' | Est: ' + li._meta.estimated_duration : '') +
                (li._meta.deadline ? ' | Due: ' + li._meta.deadline : '') +
                (li._meta.status ? ' | Status: ' + li._meta.status : '') +
                (li._meta.dependencies ? ' | Depends: ' + li._meta.dependencies : '') +
                (li._meta.milestones ? ' | Milestones: ' + li._meta.milestones : '');
        }

        // Drag-and-drop events
        li.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', null); // for Firefox
            li.classList.add('dragging');
            window._draggedNode = li;
        });
        li.addEventListener('dragend', function(e) {
            li.classList.remove('dragging');
            window._draggedNode = null;
        });
        li.addEventListener('dragover', function(e) {
            e.preventDefault();
            li.classList.add('drag-over');
        });
        li.addEventListener('dragleave', function(e) {
            li.classList.remove('drag-over');
        });

        li.addEventListener('drop', function(e) {
            e.preventDefault();
            li.classList.remove('drag-over');
            const dragged = window._draggedNode;
            if (dragged && dragged !== li) {
                // Allow drop as sibling or as child
                if (e.offsetY > li.offsetHeight / 2) {
                    // Drop as sibling below
                    li.parentNode.insertBefore(dragged, li.nextSibling);
                } else {
                    // Drop as child (make sub-project)
                    let ul = li.querySelector('ul');
                    if (!ul) {
                        ul = document.createElement('ul');
                        li.appendChild(ul);
                    }
                    ul.appendChild(dragged);
                }
            }
        });

        // Add button to add sub-project
        const addSubBtn = document.createElement('button');
        addSubBtn.textContent = '+';
        addSubBtn.title = 'Add sub-project';
        addSubBtn.style.marginLeft = '1em';
        addSubBtn.onclick = function(e) {
            e.stopPropagation();
            const subName = prompt('Sub-project name:');
            if (subName) {
                if (!li.querySelector('ul')) {
                    const ul = document.createElement('ul');
                    li.appendChild(ul);
                }
                // Determine next level string
                const parentLevelIdx = (li._meta.level ? (['Project','Phase','Feature','Item'].indexOf(li._meta.level)) : 0);
                const nextLevel = ['Project','Phase','Feature','Item'][Math.min(parentLevelIdx+1, 3)];
                const subLi = createProjectNode(subName, { level: nextLevel }, parentLevelIdx+1);
                li.querySelector('ul').appendChild(subLi);
                setTimeout(() => autoSaveTree(true), 100);
            }
        };
        li.appendChild(addSubBtn);


        // Edit meta button
        const metaBtn = document.createElement('button');
        metaBtn.textContent = '📝';
        metaBtn.title = 'Edit details';
        metaBtn.style.marginLeft = '0.5em';
        metaBtn.onclick = function(e) {
            e.stopPropagation();
            openEditNodeModal(li, nameSpan, updateMetaSpan);
        };
        li.appendChild(metaBtn);
    // --- Modal logic for editing node details ---
    const editNodeModal = document.getElementById('edit-node-modal');
    const editNodeForm = document.getElementById('edit-node-form');
    const editNodeModalClose = document.getElementById('edit-node-modal-close');
    let editNodeTargetLi = null;
    let editNodeNameSpan = null;
    let editNodeUpdateMeta = null;

    window.openEditNodeModal = function(li, nameSpan, updateMetaSpan) {
        editNodeTargetLi = li;
        editNodeNameSpan = nameSpan;
        editNodeUpdateMeta = updateMetaSpan;
        document.getElementById('edit-node-name').value = nameSpan.textContent;
        document.getElementById('edit-node-desc').value = li._meta.description || '';
        document.getElementById('edit-node-planned-start').value = li._meta.planned_start || '';
        document.getElementById('edit-node-estimated-duration').value = li._meta.estimated_duration || '';
        document.getElementById('edit-node-deadline').value = li._meta.deadline || '';
        document.getElementById('edit-node-status').value = li._meta.status || 'Not Started';
        document.getElementById('edit-node-deps').value = li._meta.dependencies || '';
        document.getElementById('edit-node-milestones').value = li._meta.milestones || '';
        document.getElementById('edit-node-level').value = li._meta.level || 'Project';
        document.getElementById('edit-node-external').checked = li._meta.external === true;
        editNodeModal.style.display = 'flex';
    };

    editNodeModalClose.onclick = function() {
        editNodeModal.style.display = 'none';
    };
    editNodeModal.onclick = function(e) {
        if (e.target === editNodeModal) editNodeModal.style.display = 'none';
    };
    if (editNodeForm) {
        editNodeForm.onsubmit = function(e) {
            e.preventDefault();
            if (!editNodeTargetLi || !editNodeNameSpan || !editNodeUpdateMeta) return;
            editNodeNameSpan.textContent = document.getElementById('edit-node-name').value;
            editNodeTargetLi._meta.description = document.getElementById('edit-node-desc').value;
            editNodeTargetLi._meta.planned_start = document.getElementById('edit-node-planned-start').value;
            editNodeTargetLi._meta.estimated_duration = document.getElementById('edit-node-estimated-duration').value;
            editNodeTargetLi._meta.deadline = document.getElementById('edit-node-deadline').value;
            editNodeTargetLi._meta.status = document.getElementById('edit-node-status').value;
            editNodeTargetLi._meta.dependencies = document.getElementById('edit-node-deps').value;
            editNodeTargetLi._meta.milestones = document.getElementById('edit-node-milestones').value;
            editNodeTargetLi._meta.level = document.getElementById('edit-node-level').value;
            editNodeTargetLi._meta.external = document.getElementById('edit-node-external').checked;
            // Update classification label if present
            const classSpan = editNodeTargetLi.querySelector('.proj-class');
            if (classSpan) classSpan.textContent = editNodeTargetLi._meta.level;
            editNodeUpdateMeta();
            editNodeModal.style.display = 'none';
            // Show 'Saved!' message
            const savedMsg = document.getElementById('edit-node-saved');
            if (savedMsg) {
                savedMsg.style.display = 'block';
                savedMsg.style.opacity = '1';
                setTimeout(() => {
                    savedMsg.style.transition = 'opacity 0.7s';
                    savedMsg.style.opacity = '0';
                    setTimeout(() => { savedMsg.style.display = 'none'; savedMsg.style.transition = ''; }, 700);
                }, 900);
            }
            console.log('[Edit Modal] Saved node, triggering autoSaveTree');
            setTimeout(() => autoSaveTree(false), 100);
        };
    }

        // Rename button
        const renameBtn = document.createElement('button');
        renameBtn.textContent = '✎';
        renameBtn.title = 'Rename';
        renameBtn.style.marginLeft = '0.5em';
        renameBtn.onclick = function(e) {
            e.stopPropagation();
            const newName = prompt('Rename project:', nameSpan.textContent.trim());
            if (newName) {
                nameSpan.textContent = newName;
                console.log('[Rename] Renamed node, triggering autoSaveTree');
                setTimeout(() => autoSaveTree(false), 100);
            }
        };
        li.appendChild(renameBtn);

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '🗑';
        deleteBtn.title = 'Delete';
        deleteBtn.style.marginLeft = '0.5em';
        deleteBtn.onclick = function(e) {
            e.stopPropagation();
            if (confirm('Delete this project and all sub-projects?')) {
                li.parentNode.removeChild(li);
            }
        };
        li.appendChild(deleteBtn);


        return li;
    }

// Ensure the main DOMContentLoaded handler is closed
}); // <-- This closes the DOMContentLoaded event handler
// Ensure all blocks are closed




