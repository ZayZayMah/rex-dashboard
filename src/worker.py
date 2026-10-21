
from workers import wsgi
from app import app

# Use the Flask application defined in app.py.
# This keeps the existing routes instead of creating a test-only app.
Default = wsgi.entrypoint(app)
