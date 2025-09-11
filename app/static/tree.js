// --- Gantt Chart View and Main Tree Logic ---
// (Removed redundant, unclosed DOMContentLoaded handler. All logic is now inside the single handler below.)
// --- Gantt Chart View and Main Tree Logic ---
document.addEventListener('DOMContentLoaded', function() {
    // Declare all DOM elements at the top for global access
    const ganttContainer = document.getElementById('gantt-container');
    const projectTree = document.getElementById('project-tree');
    const treeHeaders = document.getElementById('tree-headers');
    const ganttBtn = document.getElementById('toggle-gantt');
    const ganttLayerControls = document.getElementById('gantt-layer-controls');
    const projectSelect = document.getElementById('project-select');
    const uploadForm = document.getElementById('upload-form');
    const fileListDiv = document.getElementById('file-list');
    const form = document.getElementById('add-project-form');
    const fileGalleryDiv = document.getElementById('file-gallery');
    let activeLayers = { 'Item': true, 'Feature': false, 'Phase': false, 'Project': false };

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

        // Add zoom controls if not present
        let zoomControls = document.getElementById('gantt-zoom-controls');
        if (!zoomControls) {
            zoomControls = document.createElement('div');
            zoomControls.id = 'gantt-zoom-controls';
            zoomControls.style.display = 'flex';
            zoomControls.style.justifyContent = 'flex-end';
            zoomControls.style.alignItems = 'center';
            zoomControls.style.gap = '0.5em';
            zoomControls.style.margin = '0 0 0.5em 0';
            zoomControls.innerHTML = `
                <button id="gantt-zoom-out" title="Zoom Out" style="font-size:1.3em;padding:0.2em 0.7em;">-</button>
                <span style="font-size:1em;">Zoom</span>
                <button id="gantt-zoom-in" title="Zoom In" style="font-size:1.3em;padding:0.2em 0.7em;">+</button>
            `;
            ganttContainer.parentNode.insertBefore(zoomControls, ganttContainer);
            document.getElementById('gantt-zoom-in').onclick = function() {
                ganttDayWidth = Math.min(96, ganttDayWidth * 1.25);
                renderGanttChart();
            };
            document.getElementById('gantt-zoom-out').onclick = function() {
                ganttDayWidth = Math.max(4, ganttDayWidth / 1.25);
                renderGanttChart();
            };
        } else {
            zoomControls.style.display = ganttContainer.style.display === 'none' ? 'none' : 'flex';
        }

        // Helper: parse date string (YYYY-MM-DD)
        function parseDate(str) {
            if (!str) return null;
            const d = new Date(str);
            return isNaN(d) ? null : d;
        }

        // Helper: add days to a date
        function addDays(date, days) {
            const d = new Date(date);
            d.setDate(d.getDate() + days);
            return d;
        }

        // Helper: get days between two dates
        function daysBetween(a, b) {
            return Math.round((b - a) / (1000 * 60 * 60 * 24));
        }

        // Helper: parse estimated_duration (e.g. '5 days', '2 weeks')
        function parseDuration(str) {
            if (!str) return 1;
            const m = str.match(/(\d+)\s*(day|week|month)s?/i);
            if (!m) return 1;
            const n = parseInt(m[1]);
            if (/week/i.test(m[2])) return n * 7;
            if (/month/i.test(m[2])) return n * 30;
            return n;
        }

        // 1. Gather visible tasks from the tree
        function gatherTasks(ul, arr = [], parentLevel = 0) {
            ul.querySelectorAll(':scope > li').forEach(li => {
                const meta = li._meta || {};
                const level = meta.level || (CLASS_LABELS[parentLevel] || 'Item');
                if (activeLayers[level]) {
                    arr.push({
                        name: li.querySelector('.proj-name')?.textContent.trim() || '',
                        planned_start: meta.planned_start,
                        estimated_duration: meta.estimated_duration,
                        deadline: meta.deadline,
                        level,
                        status: meta.status,
                        li
                    });
                }
                const subUl = li.querySelector('ul');
                if (subUl) gatherTasks(subUl, arr, parentLevel + 1);
            });
            return arr;
        }

        const tasks = gatherTasks(projectTree);
        if (!tasks.length) {
            ganttContainer.innerHTML = '<div style="padding:2em;text-align:center;font-size:1.2em;color:#888;">No tasks to display.</div>';
            return;
        }

        // 2. Compute date range
        let minDate = null, maxDate = null;
        tasks.forEach(t => {
            const start = parseDate(t.planned_start);
            const dur = parseDuration(t.estimated_duration);
            const end = start ? addDays(start, dur) : null;
            if (start && (!minDate || start < minDate)) minDate = start;
            if (end && (!maxDate || end > maxDate)) maxDate = end;
            const deadline = parseDate(t.deadline);
            if (deadline && (!maxDate || deadline > maxDate)) maxDate = deadline;
        });
        if (!minDate || !maxDate) {
            ganttContainer.innerHTML = '<div style="padding:2em;text-align:center;font-size:1.2em;color:#888;">No valid dates to display.</div>';
            return;
        }

        // 3. Render SVG Gantt chart
    const dayWidth = ganttDayWidth;
        const barHeight = 28;
        const barGap = 12;
        const leftPad = 180;
        const topPad = 40;
        const chartWidth = daysBetween(minDate, maxDate) * dayWidth + leftPad + 40;
        const chartHeight = tasks.length * (barHeight + barGap) + topPad + 40;

        // Time axis labels (every 7 days)
        let axisLabels = '';
        for (let d = new Date(minDate), i = 0; d <= maxDate; d = addDays(d, 7), i++) {
            const x = leftPad + daysBetween(minDate, d) * dayWidth;
            axisLabels += `<text x="${x}" y="${topPad - 10}" font-size="12" fill="#555">${d.toISOString().slice(0,10)}</text>`;
            axisLabels += `<line x1="${x}" y1="${topPad - 5}" x2="${x}" y2="${chartHeight - 20}" stroke="#eee" />`;
        }

        // Bars
        let bars = '';
        tasks.forEach((t, i) => {
            const start = parseDate(t.planned_start) || minDate;
            const dur = parseDuration(t.estimated_duration);
            const end = addDays(start, dur);
            const y = topPad + i * (barHeight + barGap);
            const x = leftPad + daysBetween(minDate, start) * dayWidth;
            const w = Math.max(1, daysBetween(start, end) * dayWidth);
            // Color by level
            const colorMap = { 'Project':'#FF8200', 'Phase':'#1E90FF', 'Feature':'#6A4FB6', 'Item':'#4BB543' };
            const fill = colorMap[t.level] || '#888';
            bars += `<rect x="${x}" y="${y}" width="${w}" height="${barHeight}" rx="6" fill="${fill}" fill-opacity="0.85" />`;
            bars += `<text x="${x+8}" y="${y+barHeight/2+5}" font-size="15" fill="#fff">${t.name}</text>`;
            // Deadline marker
            if (t.deadline) {
                const dx = leftPad + daysBetween(minDate, parseDate(t.deadline)) * dayWidth;
                bars += `<line x1="${dx}" y1="${y}" x2="${dx}" y2="${y+barHeight}" stroke="#d00" stroke-width="2" />`;
            }
        });

        // SVG wrapper
        ganttContainer.innerHTML = `<div style="overflow-x:auto;"><svg width="${chartWidth}" height="${chartHeight}" style="background:#faf9f6;border-radius:10px;box-shadow:0 2px 8px #0001;">
            <g>${axisLabels}</g>
            <g>${bars}</g>
        </svg></div>`;
    }

    // --- Gantt Chart View Toggle ---
    if (ganttBtn && ganttContainer && projectTree && treeHeaders && ganttLayerControls) {
        ganttBtn.addEventListener('click', function() {
            const isGanttVisible = ganttContainer.style.display !== 'none';
            if (!isGanttVisible) {
                // Show Gantt, hide tree
                ganttContainer.style.display = 'block';
                ganttLayerControls.style.display = 'flex';
                projectTree.style.display = 'none';
                treeHeaders.style.display = 'none';
                renderGanttLayerControls();
                renderGanttChart();
                ganttBtn.textContent = 'Tree View';
            } else {
                // Show tree, hide Gantt
                ganttContainer.style.display = 'none';
                ganttLayerControls.style.display = 'none';
                projectTree.style.display = 'block';
                treeHeaders.style.display = 'flex';
                ganttBtn.textContent = 'Gantt Chart View';
            }
        });
        // Ensure initial state is tree view
        ganttContainer.style.display = 'none';
        ganttLayerControls.style.display = 'none';
        projectTree.style.display = 'block';
        treeHeaders.style.display = 'flex';
    }


    function renderGanttLayerControls() {
        if (!ganttLayerControls) return;
        ganttLayerControls.innerHTML = '';
        ganttLayerControls.style.display = 'flex';
        ganttLayerControls.style.gap = '1.5em';
        ganttLayerControls.style.alignItems = 'center';
        ganttLayerControls.style.justifyContent = 'center';
        ganttLayerControls.style.fontSize = '1.1em';
        ganttLayerControls.style.fontWeight = 'bold';
        ganttLayerControls.style.background = '#f7f7f7';
        ganttLayerControls.style.borderRadius = '8px';
        ganttLayerControls.style.padding = '0.7em 1.5em';
        ganttLayerControls.innerHTML = '<span style="margin-right:1em;">Show Layers:</span>';
        CLASS_LABELS.forEach(label => {
            const btn = document.createElement('button');
            btn.textContent = label;
            btn.style.margin = '0 0.2em';
            btn.style.padding = '0.4em 1.2em';
            btn.style.border = 'none';
            btn.style.borderRadius = '5px';
            btn.style.background = activeLayers[label] ? '#FF8200' : '#e0e0e0';
            btn.style.color = activeLayers[label] ? '#fff' : '#333';
            btn.style.fontWeight = 'bold';
            btn.style.cursor = 'pointer';
            btn.onclick = function() {
                activeLayers[label] = !activeLayers[label];
                // If none selected, always keep at least one (default to Item)
                if (!Object.values(activeLayers).some(v => v)) {
                    activeLayers['Item'] = true;
                }
                renderGanttChart();
            };
            ganttLayerControls.appendChild(btn);
        });
    }

    // --- All remaining code moved inside DOMContentLoaded ---

    function flattenProjects(ul, arr = []) {
        ul.querySelectorAll(':scope > li').forEach(li => {
            const name = li.querySelector('.proj-name')?.textContent.trim();
            if (name) {
                arr.push({
                    id: li.dataset.projectId,
                    name
                });
            }
            const subUl = li.querySelector('ul');
            if (subUl) flattenProjects(subUl, arr);
        });
        return arr;
    }

    function populateProjectSelect() {
        if (!projectSelect) return;
        // Fetch project tree from server to get IDs
        fetch('/api/load_tree').then(r => r.json()).then(data => {
            projectSelect.innerHTML = '';
            function addOptions(nodes) {
                nodes.forEach(node => {
                    const opt = document.createElement('option');
                    opt.value = node.id;
                    opt.textContent = node.name;
                    projectSelect.appendChild(opt);
                    if (node.children) addOptions(node.children);
                });
            }
            addOptions(data.tree || []);
            if (projectSelect.options.length) {
                projectSelect.selectedIndex = 0;
                listFilesForSelected();
            }
        });
    }

    function listFilesForSelected() {
        if (!projectSelect || !fileListDiv) return;
        const pid = projectSelect.value;
        if (!pid) {
            fileListDiv.textContent = '';
            return;
        }
        fetch('/api/list_files/' + pid)
            .then(r => r.json())
            .then(data => {
                if (data.files && data.files.length) {
                    fileListDiv.innerHTML = '<b>Files:</b> ' + data.files.map(f =>
                        `<span style="margin-right:0.5em;">${f} <button data-fname="${f}" class="delete-file-btn" title="Delete">🗑</button></span>`
                    ).join('');
                    // Add event listeners for delete buttons
                    fileListDiv.querySelectorAll('.delete-file-btn').forEach(btn => {
                        btn.onclick = function() {
                            if (confirm('Delete file ' + btn.dataset.fname + '?')) {
                                fetch('/api/delete_file', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ filename: btn.dataset.fname, project_id: pid })
                                })
                                .then(r => r.json())
                                .then(data => {
                                    if (data.status === 'success') {
                                        listFilesForSelected();
                                    } else {
                                        alert('Delete failed: ' + (data.error || 'Unknown error'));
                                    }
                                });
                            }
                        };
                    });
                } else {
                    fileListDiv.textContent = 'No files uploaded for this project.';
                }
            });
    }

    if (projectSelect) {
        projectSelect.addEventListener('change', listFilesForSelected);
        populateProjectSelect();
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const fileInput = document.getElementById('file-input');
            const statusDiv = document.getElementById('upload-status');
            if (!fileInput.files.length || !projectSelect.value) {
                statusDiv.textContent = 'Select a project and file.';
                return;
            }
            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            formData.append('project_id', projectSelect.value);
            fetch('/api/upload', {
                method: 'POST',
                body: formData
            })
            .then(r => r.json())
            .then(data => {
                if (data.status === 'success') {
                    statusDiv.textContent = 'File uploaded: ' + data.filename;
                    listFilesForSelected();
                } else {
                    statusDiv.textContent = 'Upload failed: ' + (data.error || 'Unknown error');
                }
            })
            .catch(() => {
                statusDiv.textContent = 'Upload failed.';
            });
        });
    }

    // Helper: check if file is image
    function isImageFile(filename) {
        return /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(filename);
    }
    function isPdfFile(filename) {
        return /\.(pdf)$/i.test(filename);
    }

    // Show gallery for a project id
    function showGalleryForProject(pid) {
// (removed duplicate DOMContentLoaded and duplicate declarations)
        if (!fileGalleryDiv) return;
        fileGalleryDiv.innerHTML = '';
        if (!pid) return;
        fetch('/api/list_files/' + pid)
            .then(r => r.json())
            .then(data => {
                if (data.files && data.files.length) {
                    data.files.forEach(f => {
                        const item = document.createElement('div');
                        item.className = 'file-item';
                        let content;
                        const fileUrl = '/uploads/' + encodeURIComponent(f);
                        if (isImageFile(f)) {
                            content = document.createElement('img');
                            content.src = fileUrl;
                            content.className = 'thumb';
                            content.alt = f;
                            content.style.cursor = 'pointer';
                            content.onclick = function() { openFileModal('image', fileUrl, f); };
                        } else if (isPdfFile(f)) {
                            content = document.createElement('div');
                            content.className = 'thumb';
                            content.style.display = 'flex';
                            content.style.alignItems = 'center';
                            content.style.justifyContent = 'center';
                            content.style.background = '#f3f3f3';
                            content.style.cursor = 'pointer';
                            content.innerHTML = '<span style="font-size:2em;">📄</span>';
                            content.onclick = function() { openFileModal('pdf', fileUrl, f); };
                        } else {
                            content = document.createElement('a');
                            content.href = fileUrl;
                            content.target = '_blank';
                            content.className = 'thumb';
                            content.style.display = 'flex';
                            content.style.alignItems = 'center';
                            content.style.justifyContent = 'center';
                            content.style.background = '#f3f3f3';
                            content.innerHTML = '<span style="font-size:2em;">📄</span>';
                        }
                        item.appendChild(content);
                        const label = document.createElement('div');
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
        }
    });

    // Save and Load buttons


    // Auto-save function
    function autoSaveTree() {
        updateParentDates(projectTree);
        const treeData = serializeTree(projectTree);
        fetch('/api/save_tree', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tree: treeData })
        }).then(r => r.json()).then(data => {
            // Optionally, show a subtle saved indicator
            // console.log('Tree auto-saved');
            // Optionally reload tree from backend for correct IDs
            fetch('/api/load_tree').then(r => r.json()).then(data => {
                projectTree.innerHTML = '';
                if (data.tree) {
                    renderTree(data.tree, projectTree);
                }
                if (typeof populateProjectSelect === 'function') {
                    populateProjectSelect();
                }
            });
        });
    }

    // Listen for changes to the tree and auto-save
    function setupAutoSaveListeners() {
        // Add project
        form.addEventListener('submit', function(e) {
            setTimeout(autoSaveTree, 100); // after DOM update
        });
        // Drag and drop
        projectTree.addEventListener('drop', function(e) {
            setTimeout(autoSaveTree, 100);
        });
        // Rename, delete, edit meta, add sub-project
        projectTree.addEventListener('click', function(e) {
            if (
                e.target.matches('button') ||
                e.target.classList.contains('proj-name')
            ) {
                setTimeout(autoSaveTree, 100);
            }
        });
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
                projectTree.innerHTML = '';
                if (data.tree) {
                    renderTree(data.tree, projectTree);
                } else {
                    console.warn('No tree data found in response');
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
                level: li._meta?.level || (CLASS_LABELS[level] || 'Item'),
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
        return arr;
    }


    function renderTree(nodes, parentUl, level = 0) {
        nodes.forEach(node => {
            // Only assign default classification if not set
            if (!node.level) node.level = CLASS_LABELS[level] || 'Item';
            const li = createProjectNode(node.name, node, level);
            if (node.id) {
                li.dataset.projectId = node.id;
            }
            // Add click event to show gallery
            li.addEventListener('click', function(e) {
                // Only trigger if clicking the li or proj-name, not buttons
                if (e.target === li || e.target.classList.contains('proj-name')) {
                    showGalleryForProject(node.id);
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
            level: meta.level || (CLASS_LABELS[level] || 'Item'),
            external: meta.external === true
        };

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
                const subLi = createProjectNode(subName, {}, (li._meta.level ? (['Project','Phase','Feature','Item'].indexOf(li._meta.level)+1) : 1));
                li.querySelector('ul').appendChild(subLi);
                setTimeout(autoSaveTree, 100);
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

function openEditNodeModal(li, nameSpan, updateMetaSpan) {
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
}

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
    setTimeout(autoSaveTree, 100);
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
                setTimeout(autoSaveTree, 100);
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


    // --- Update parent dates based on children ---
function updateParentDates(ul) {
    // Helper: parse date string (YYYY-MM-DD)
    function parseDate(str) {
        if (!str) return null;
        const d = new Date(str);
        return isNaN(d) ? null : d;
    }
    // Helper: add days to a date
    function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    }
    // Helper: parse estimated_duration (e.g. '5 days', '2 weeks')
    function parseDuration(str) {
        if (!str) return 1;
        const m = str.match(/(\d+)\s*(day|week|month)s?/i);
        if (!m) return 1;
        const n = parseInt(m[1]);
        if (/week/i.test(m[2])) return n * 7;
        if (/month/i.test(m[2])) return n * 30;
        return n;
    }
    ul.querySelectorAll(':scope > li').forEach(li => {
        const subUl = li.querySelector('ul');
        if (subUl) {
            updateParentDates(subUl);
            // Gather children's start and end dates
            let minStart = null, maxEnd = null;
            subUl.querySelectorAll(':scope > li').forEach(childLi => {
                const meta = childLi._meta || {};
                const start = parseDate(meta.planned_start);
                const dur = parseDuration(meta.estimated_duration);
                const end = start ? addDays(start, dur) : null;
                if (start && (!minStart || start < minStart)) minStart = start;
                if (end && (!maxEnd || end > maxEnd)) maxEnd = end;
            });
            if (minStart) li._meta.planned_start = minStart.toISOString().slice(0,10);
            if (maxEnd) {
                // Set estimated_duration so that end = planned_start + estimated_duration
                const parentStart = parseDate(li._meta.planned_start);
                if (parentStart) {
                    const days = Math.max(1, Math.round((maxEnd - parentStart) / (1000*60*60*24)));
                    li._meta.estimated_duration = days + ' days';
                }
            }
        }
    });
}

    // Optionally: show gallery for selected project in dropdown on load

    if (projectSelect) {
        projectSelect.addEventListener('change', function() {
            listFilesForSelected();
            showGalleryForProject(projectSelect.value);
        });
        // Show for initial selection
        showGalleryForProject(projectSelect.value);
    }

}); // <-- Properly close DOMContentLoaded handler



