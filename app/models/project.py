from flask_sqlalchemy import SQLAlchemy
from app import app

db = SQLAlchemy(app)


class File(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(256), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('project_node.id'))
    project = db.relationship('ProjectNode', back_populates='files')


class ProjectNode(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text)
    deadline = db.Column(db.String(32))
    status = db.Column(db.String(32))
    dependencies = db.Column(db.Text)
    milestones = db.Column(db.Text)
    parent_id = db.Column(db.Integer, db.ForeignKey('project_node.id'))
    children = db.relationship('ProjectNode', backref=db.backref('parent', remote_side=[id]), lazy=True)
    files = db.relationship('File', back_populates='project', lazy=True)
    # New: level/classification (Project, Phase, Feature, Item)
    level = db.Column(db.String(16), nullable=False, default='Project')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'deadline': self.deadline,
            'status': self.status,
            'dependencies': self.dependencies,
            'milestones': self.milestones,
            'level': self.level,
            'children': [child.to_dict() for child in self.children],
            'files': [f.filename for f in self.files]
        }
