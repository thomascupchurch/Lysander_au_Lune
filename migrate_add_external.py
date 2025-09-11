"""
Database migration script to add 'external' boolean column to ProjectNode.
"""
from app import app
from app.models.project import db
from sqlalchemy import text

with app.app_context():
    try:
        db.session.execute(text("ALTER TABLE project_node ADD COLUMN external BOOLEAN NOT NULL DEFAULT 0"))
        db.session.commit()
        print("Added 'external' column to project_node table.")
    except Exception as e:
        print("Migration skipped or failed:", e)
