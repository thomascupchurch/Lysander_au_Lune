from flask import Flask

app = Flask(__name__)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///project_tree.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

from app import routes
from app import api
from app.models import project
