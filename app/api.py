from flask import request, jsonify
from app import app
from app.models.project import db, ProjectNode

def clear_db():
    ProjectNode.query.delete()
    db.session.commit()

def build_tree(nodes, parent=None):
    for node in nodes:
        proj = None
        if node.get('id'):
            proj = ProjectNode.query.get(node['id'])
            if proj:
                proj.name = node.get('name')
                proj.description = node.get('description')
                proj.deadline = node.get('deadline')
                proj.status = node.get('status')
                proj.dependencies = node.get('dependencies')
                proj.milestones = node.get('milestones')
                proj.level = node.get('level')
                proj.estimated_duration = node.get('estimated_duration')
                proj.planned_start = node.get('planned_start')
                proj.external = node.get('external', False)
                proj.parent = parent
            else:
                proj = ProjectNode(
                    name=node.get('name'),
                    description=node.get('description'),
                    deadline=node.get('deadline'),
                    status=node.get('status'),
                    dependencies=node.get('dependencies'),
                    milestones=node.get('milestones'),
                    level=node.get('level'),
                    estimated_duration=node.get('estimated_duration'),
                    planned_start=node.get('planned_start'),
                    external=node.get('external', False),
                    parent=parent
                )
                db.session.add(proj)
                db.session.flush()
        else:
            proj = ProjectNode(
                name=node.get('name'),
                description=node.get('description'),
                deadline=node.get('deadline'),
                status=node.get('status'),
                dependencies=node.get('dependencies'),
                milestones=node.get('milestones'),
                level=node.get('level'),
                estimated_duration=node.get('estimated_duration'),
                planned_start=node.get('planned_start'),
                external=node.get('external', False),
                parent=parent
            )
            db.session.add(proj)
            db.session.flush()
        if node.get('children'):
            build_tree(node['children'], proj)

@app.route('/api/save_tree', methods=['POST'])
def save_tree():
    tree = request.json.get('tree', [])
    if not tree:
        clear_db()
    build_tree(tree)
    db.session.commit()
    return jsonify({'status': 'success'})

def get_root_nodes():
    return ProjectNode.query.filter_by(parent_id=None).all()

@app.route('/api/load_tree', methods=['GET'])
def load_tree():
    roots = get_root_nodes()
    return jsonify({'tree': [r.to_dict() for r in roots]})
