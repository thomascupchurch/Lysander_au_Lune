
from flask import request, jsonify
from app import app
from app.models.project import db, File, ProjectNode
import os

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/api/delete_file', methods=['POST'])
def delete_file():
    data = request.json
    filename = data.get('filename')
    project_id = data.get('project_id')
    if not filename or not project_id:
        return jsonify({'error': 'filename and project_id required'}), 400
    file = File.query.filter_by(filename=filename, project_id=project_id).first()
    if not file:
        return jsonify({'error': 'File not found'}), 404
    # Remove from disk
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if os.path.exists(filepath):
        os.remove(filepath)
    db.session.delete(file)
    db.session.commit()
    return jsonify({'status': 'success'})

@app.route('/api/upload', methods=['POST'])
def upload_file():
    file = request.files.get('file')
    project_id = request.form.get('project_id')
    if not file or not project_id:
        return jsonify({'error': 'File and project_id required'}), 400
    project = ProjectNode.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
    file.save(filepath)
    db_file = File(filename=file.filename, project=project)
    db.session.add(db_file)
    db.session.commit()
    return jsonify({'status': 'success', 'filename': file.filename})

@app.route('/api/list_files/<int:project_id>', methods=['GET'])
def list_files(project_id):
    project = ProjectNode.query.get(project_id)
    if not project:
        return jsonify({'error': 'Project not found'}), 404
    return jsonify({'files': [f.filename for f in project.files]})
