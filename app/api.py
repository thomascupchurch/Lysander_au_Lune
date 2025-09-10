from flask import request, jsonify
from app import app

# In-memory storage for demonstration (replace with DB in production)
project_tree = {}

@app.route('/api/save_tree', methods=['POST'])
def save_tree():
    global project_tree
    project_tree = request.json.get('tree', {})
    return jsonify({'status': 'success'})

@app.route('/api/load_tree', methods=['GET'])
def load_tree():
    return jsonify({'tree': project_tree})
