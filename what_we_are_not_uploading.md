---

## 🚫 The "Keep it Clean" .gitignore

Create a file named `.gitignore` in your **root folder**. This prevents 100MB+ of junk and sensitive passwords from hitting your Git repo.

```gitignore
# --- Docker Artifacts ---
# This protects your local DB data from being pushed
postgres_data/
.docker/

# --- Python / Django ---
__pycache__/
*.py[cod]
*$py.class
backend/venv/
backend/static_root/
backend/media/

# --- Node / React ---
frontend/node_modules/
frontend/build/
frontend/dist/
.eslintcache

# --- Secrets & Config ---
# NEVER push these files
.env
.env.local
*.log

# --- OS & IDE ---
.DS_Store
.vscode/
.idea/
Thumbs.db
