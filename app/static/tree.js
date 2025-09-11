// --- Gantt Chart View and Main Tree Logic ---
document.addEventListener('DOMContentLoaded', function() {
    // Declare all DOM elements at the top for global access
    const ganttBtn = document.getElementById('toggle-gantt');
    const ganttContainer = document.getElementById('gantt-container');
    const projectTree = document.getElementById('project-tree');
    const treeHeaders = document.getElementById('tree-headers');
    const form = document.getElementById('add-project-form');
    const fileGalleryDiv = document.getElementById('file-gallery');
    const uploadForm = document.getElementById('upload-form');
    const projectSelect = document.getElementById('project-select');
    const fileListDiv = document.getElementById('file-list');

    const ganttLayerControls = document.getElementById('gantt-layer-controls');
    // ...existing code...
    let activeLayers = { 'Item': true, 'Feature': false, 'Phase': false, 'Project': false };

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
                renderGanttLayerControls();
                renderGanttChart();
            };
            ganttLayerControls.appendChild(btn);
        });
    }

    if (ganttBtn && ganttContainer && projectTree) {
        ganttBtn.onclick = function() {
            if (ganttContainer.style.display === 'none') {
                ganttContainer.style.display = 'block';
                ganttLayerControls.style.display = 'flex';
                projectTree.style.display = 'none';
                if (treeHeaders) treeHeaders.style.visibility = 'hidden';
                renderGanttLayerControls();
                renderGanttChart();
                ganttBtn.textContent = 'Tree View';
            } else {
                ganttContainer.style.display = 'none';
                ganttLayerControls.style.display = 'none';
                projectTree.style.display = '';
                if (treeHeaders) treeHeaders.style.visibility = 'visible';
                ganttBtn.textContent = 'Gantt Chart View';
            }
        };
    }

    function flattenTreeForGantt(nodes, arr = [], parentName = '', level = 0) {
        nodes.forEach(node => {
            arr.push({
                name: node.name,
                start: node.planned_start || '',
                end: node.deadline || '',
                status: node.status || '',
                parent: parentName,
                level: node.level || CLASS_LABELS[level] || 'Item',
                estimated_duration: node.estimated_duration || '',
                external: node.external === true
            });
            if (node.children && node.children.length) {
                flattenTreeForGantt(node.children, arr, node.name, level + 1);
            }
        });
        return arr;
    }

    function renderGanttChart() {
        ganttContainer.innerHTML = '';
        fetch('/api/load_tree').then(r => r.json()).then(data => {
            const flat = flattenTreeForGantt(data.tree || []);
            if (!flat.length) {
                ganttContainer.textContent = 'No data for Gantt chart.';
                return;
            }
            // Visual Gantt: Layered bar chart
            // Group by level
            const grouped = {};
            CLASS_LABELS.forEach(l => grouped[l] = []);
            flat.forEach(row => {
                if (grouped[row.level]) grouped[row.level].push(row);
            });
            // Find min/max dates for scaling
            const allDates = flat.map(r => r.start).concat(flat.map(r => r.end)).filter(Boolean);
            const minDate = allDates.length ? new Date(Math.min(...allDates.map(d => new Date(d).getTime()))) : new Date();
            const maxDate = allDates.length ? new Date(Math.max(...allDates.map(d => new Date(d).getTime()))) : new Date();
            const dayMs = 24*60*60*1000;
            const totalDays = Math.max(1, Math.round((maxDate - minDate) / dayMs));

            // Chart container
            const chart = document.createElement('div');
            chart.style.position = 'relative';
            chart.style.width = '100%';
            chart.style.minHeight = '400px';
            chart.style.background = '#fff';
            chart.style.borderRadius = '10px';
            chart.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)';
            chart.style.padding = '2em 1em 2em 1em';
            chart.style.overflowX = 'auto';

            // Layered bars
            CLASS_LABELS.forEach((level, i) => {
                const layer = document.createElement('div');
                layer.style.position = 'relative';
                layer.style.height = '48px';
                layer.style.marginBottom = '0.5em';
                layer.style.opacity = activeLayers[level] ? '1' : '0.25';
                layer.style.transition = 'opacity 0.3s';
                grouped[level].forEach(row => {
                    let bar = document.createElement('div');
                    if (row.start && row.end) {
                        const start = new Date(row.start);
                        const end = new Date(row.end);
                        const left = ((start - minDate) / (dayMs * totalDays)) * 100;
                        const width = Math.max(2, ((end - start) / (dayMs * totalDays)) * 100);
                        bar.style.position = 'absolute';
                        bar.style.left = left + '%';
                        bar.style.width = width + '%';
                        bar.style.background = '#FF8200';
                        bar.title = `${row.name}\n${level}\n${row.external ? 'External' : 'Internal'}\n${row.status ? 'Status: ' + row.status + '\n' : ''}${row.estimated_duration ? 'Est: ' + row.estimated_duration + '\n' : ''}${row.start ? 'Start: ' + row.start + '\n' : ''}${row.end ? 'End: ' + row.end : ''}`;
                    } else {
                        // Missing date(s): show warning bar at left
                        bar.style.position = 'absolute';
                        bar.style.left = '0';
                        bar.style.width = '5%';
                        bar.style.background = '#FFD700'; // gold/yellow for warning
                        bar.title = `${row.name}\n${level}\n(Missing start or deadline)`;
                    }
                    bar.style.height = '38px';
                    bar.style.top = '5px';
                    bar.style.borderRadius = '6px';
                    bar.style.boxShadow = activeLayers[level] ? '0 2px 8px rgba(0,0,0,0.10)' : 'none';
                    bar.style.display = 'flex';
                    bar.style.alignItems = 'center';
                    bar.style.justifyContent = 'center';
                    bar.style.color = '#fff';
                    bar.style.fontWeight = 'bold';
                    bar.style.fontSize = '1em';
                    bar.style.cursor = 'pointer';
                    bar.textContent = row.name;
                    layer.appendChild(bar);
                });
                // Layer label
                const label = document.createElement('span');
                label.textContent = level;
                label.style.position = 'absolute';
                label.style.left = '0';
                label.style.top = '-1.5em';
                label.style.fontWeight = 'bold';
                label.style.color = '#333';
                label.style.fontSize = '1em';
                chart.appendChild(label);
                chart.appendChild(layer);
            });

            // Date axis
            const axis = document.createElement('div');
            axis.style.position = 'relative';
            axis.style.height = '2em';
            axis.style.marginTop = '1em';
            axis.style.borderTop = '1px solid #ccc';
            for (let d = 0; d <= totalDays; d += Math.ceil(totalDays/10)) {
                const tick = document.createElement('div');
                tick.style.position = 'absolute';
                tick.style.left = ((d/totalDays)*100) + '%';
                tick.style.top = '0';
                tick.style.width = '1px';
                tick.style.height = '12px';
                tick.style.background = '#aaa';
                axis.appendChild(tick);
                const dateLabel = document.createElement('span');
                dateLabel.style.position = 'absolute';
                dateLabel.style.left = ((d/totalDays)*100) + '%';
                dateLabel.style.top = '14px';
                dateLabel.style.transform = 'translateX(-50%)';
                dateLabel.style.fontSize = '0.9em';
                dateLabel.style.color = '#333';
                const date = new Date(minDate.getTime() + d*dayMs);
                dateLabel.textContent = date.toISOString().slice(0,10);
                axis.appendChild(dateLabel);
            }
            chart.appendChild(axis);
            ganttContainer.appendChild(chart);
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
        fetch('/api/load_tree').then(r => r.json()).then(data => {
            projectTree.innerHTML = '';
            if (data.tree) {
                renderTree(data.tree, projectTree);
            }
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


    // Optionally: show gallery for selected project in dropdown on load
    if (projectSelect) {
        projectSelect.addEventListener('change', function() {
            listFilesForSelected();
            showGalleryForProject(projectSelect.value);
        });
        // Show for initial selection
        showGalleryForProject(projectSelect.value);
    }
});



