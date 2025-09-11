"""
Database migration script to add 'level' column to ProjectNode.
"""
from app import app
from app.models.project import db
from sqlalchemy import text

with app.app_context():
    # Add 'level' column if it doesn't exist
    try:
        db.session.execute(text("ALTER TABLE project_node ADD COLUMN level VARCHAR(16) NOT NULL DEFAULT 'Project'"))
        db.session.commit()
        print("Added 'level' column to project_node table.")
    except Exception as e:
        print("Migration skipped or failed:", e)
