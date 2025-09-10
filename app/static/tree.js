document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('add-project-form');
    const projectTree = document.getElementById('project-tree');


    form.addEventListener('submit', function(e) {
        e.preventDefault();
        const projectName = document.getElementById('project-name').value.trim();
        if (projectName) {
            const li = createProjectNode(projectName);
            projectTree.appendChild(li);
            form.reset();
        }
    });

    // Save and Load buttons
    document.getElementById('save-tree').onclick = function() {
        const treeData = serializeTree(projectTree);
        fetch('/api/save_tree', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tree: treeData })
        }).then(r => r.json()).then(data => {
            alert('Project tree saved!');
        });
    };

    document.getElementById('load-tree').onclick = function() {
        fetch('/api/load_tree').then(r => r.json()).then(data => {
            projectTree.innerHTML = '';
            if (data.tree) {
                renderTree(data.tree, projectTree);
            }
        });
    };



    function serializeTree(ul) {
        const arr = [];
        ul.querySelectorAll(':scope > li').forEach(li => {
            const node = {
                name: li.querySelector('.proj-name')?.textContent.trim() || '',
                description: li._meta?.description || '',
                deadline: li._meta?.deadline || '',
                status: li._meta?.status || '',
                dependencies: li._meta?.dependencies || '',
                milestones: li._meta?.milestones || ''
            };
            const subUl = li.querySelector('ul');
            if (subUl) {
                node.children = serializeTree(subUl);
            }
            arr.push(node);
        });
        return arr;
    }


    function renderTree(nodes, parentUl) {
        nodes.forEach(node => {
            const li = createProjectNode(node.name, node);
            parentUl.appendChild(li);
            if (node.children && node.children.length) {
                const subUl = document.createElement('ul');
                li.appendChild(subUl);
                renderTree(node.children, subUl);
            }
        });
    }



    function createProjectNode(name, meta = {}) {
        const li = document.createElement('li');
        li.style.cursor = 'pointer';
        li.draggable = true;
        // Store meta info on the element
        li._meta = {
            description: meta.description || '',
            deadline: meta.deadline || '',
            status: meta.status || 'Not Started',
            dependencies: meta.dependencies || '',
            milestones: meta.milestones || ''
        };

        // Name span
        const nameSpan = document.createElement('span');
        nameSpan.className = 'proj-name';
        nameSpan.textContent = name;
        li.appendChild(nameSpan);

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
                const subLi = createProjectNode(subName);
                li.querySelector('ul').appendChild(subLi);
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
            const desc = prompt('Description:', li._meta.description);
            if (desc !== null) li._meta.description = desc;
            const deadline = prompt('Deadline (YYYY-MM-DD):', li._meta.deadline);
            if (deadline !== null) li._meta.deadline = deadline;
            const status = prompt('Status (Not Started/In Progress/Done):', li._meta.status);
            if (status !== null) li._meta.status = status;
            const dependencies = prompt('Dependencies (comma-separated project names):', li._meta.dependencies);
            if (dependencies !== null) li._meta.dependencies = dependencies;
            const milestones = prompt('Milestones (comma-separated):', li._meta.milestones);
            if (milestones !== null) li._meta.milestones = milestones;
            updateMetaSpan();
        };
        li.appendChild(metaBtn);

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
});
