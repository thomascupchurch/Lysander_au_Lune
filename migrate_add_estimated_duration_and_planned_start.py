"""
Database migration script to add 'estimated_duration' and 'planned_start' columns to ProjectNode.
"""
from app import app
from app.models.project import db
from sqlalchemy import text

with app.app_context():
    try:
        db.session.execute(text("ALTER TABLE project_node ADD COLUMN estimated_duration VARCHAR(32)"))
        db.session.execute(text("ALTER TABLE project_node ADD COLUMN planned_start VARCHAR(32)"))
        db.session.commit()
        print("Added 'estimated_duration' and 'planned_start' columns to project_node table.")
    except Exception as e:
        print("Migration skipped or failed:", e)
