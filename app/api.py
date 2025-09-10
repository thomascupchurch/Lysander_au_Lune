from flask import request, jsonify
from app import app
from app.models.project import db, ProjectNode

def clear_db():
    ProjectNode.query.delete()
    db.session.commit()

def build_tree(nodes, parent=None):
    for node in nodes:
        proj = ProjectNode(
            name=node.get('name'),
            description=node.get('description'),
            deadline=node.get('deadline'),
            status=node.get('status'),
            dependencies=node.get('dependencies'),
            milestones=node.get('milestones'),
            parent=parent
        )
        db.session.add(proj)
        db.session.flush()
        if node.get('children'):
            build_tree(node['children'], proj)

@app.route('/api/save_tree', methods=['POST'])
def save_tree():
    clear_db()
    tree = request.json.get('tree', [])
    build_tree(tree)
    db.session.commit()
    return jsonify({'status': 'success'})

def get_root_nodes():
    return ProjectNode.query.filter_by(parent_id=None).all()

@app.route('/api/load_tree', methods=['GET'])
def load_tree():
    roots = get_root_nodes()
    return jsonify({'tree': [r.to_dict() for r in roots]})
