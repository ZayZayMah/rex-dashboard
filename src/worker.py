
from flask import Flask
from workers import wsgi

app = Flask(__name__)

@app.get("/")
def home():
    return {
        "message": "REX Dashboard Worker is running",
        "status": "setup-test"
    }

@app.get("/health")
def health():
    return {"ok": True}

Default = wsgi.entrypoint(app)
