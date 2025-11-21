import os
import subprocess
import sys

PORT = os.getenv("PORT", "8000")
subprocess.run([
    sys.executable, "-m", "uvicorn",
    "backend.main:app",
    "--host", "0.0.0.0",
    "--port", PORT
])
