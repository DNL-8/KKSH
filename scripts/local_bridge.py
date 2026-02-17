
import os
import sqlite3
import uvicorn
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from typing import List, Optional
from pydantic import BaseModel
import mimetypes
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("local_bridge")

app = FastAPI(title="Local Bridge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow any origin for local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database Setup
DB_PATH = Path("videos.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS videos (
            id TEXT PRIMARY KEY,
            name TEXT,
            path TEXT UNIQUE,
            size INTEGER,
            duration REAL,
            last_modified REAL,
            created_at REAL,
            completed INTEGER DEFAULT 0,
            progress REAL DEFAULT 0,
            tags TEXT
        )
    ''')
    conn.commit()
    conn.close()

init_db()

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# Models
class VideoUpdate(BaseModel):
    completed: Optional[bool] = None
    progress: Optional[float] = None
    tags: Optional[str] = None

class ScanRequest(BaseModel):
    path: str

# Helper Functions
def scan_folder_recursive(path: Path):
    logger.info(f"Scanning {path}")
    conn = get_db_connection()
    cursor = conn.cursor()
    
    count = 0
    try:
        for root, _, files in os.walk(path):
            for file in files:
                if file.lower().endswith(('.mp4', '.mkv', '.webm', '.avi', '.mov')):
                    full_path = Path(root) / file
                    try:
                        stat = full_path.stat()
                        # Use path as ID for simplicity in this bridge
                        video_id = str(full_path.resolve())
                        
                        cursor.execute('''
                            INSERT INTO videos (id, name, path, size, last_modified, created_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON CONFLICT(id) DO UPDATE SET
                                size=excluded.size,
                                last_modified=excluded.last_modified
                        ''', (
                            video_id,
                            file,
                            str(full_path),
                            stat.st_size,
                            stat.st_mtime,
                            stat.st_ctime
                        ))
                        count += 1
                    except Exception as e:
                        logger.error(f"Error processing {file}: {e}")
        conn.commit()
    except Exception as e:
         logger.error(f"Scan failed: {e}")
    finally:
        conn.close()
    logger.info(f"Scanned {count} videos")

# Endpoints
@app.post("/library/scan")
def scan_library(request: ScanRequest, background_tasks: BackgroundTasks):
    p = Path(request.path)
    if not p.exists() or not p.is_dir():
         raise HTTPException(status_code=400, detail="Invalid directory")
    
    background_tasks.add_task(scan_folder_recursive, p)
    return {"status": "scanning_started", "path": str(p)}

@app.get("/library/videos")
def get_library_videos():
    conn = get_db_connection()
    videos = conn.execute("SELECT * FROM videos ORDER BY name").fetchall()
    conn.close()
    return {"videos": [dict(v) for v in videos]}

@app.patch("/library/videos/{video_id}")
def update_video(video_id: str, update: VideoUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    fields = []
    values = []
    if update.completed is not None:
        fields.append("completed = ?")
        values.append(1 if update.completed else 0)
    if update.progress is not None:
         fields.append("progress = ?")
         values.append(update.progress)
    
    if not fields:
        conn.close()
        return {"status": "no_changes"}
    
    values.append(video_id)
    query = f"UPDATE videos SET {', '.join(fields)} WHERE id = ?"
    
    cursor.execute(query, values)
    conn.commit()
    conn.close()
    return {"status": "updated"}

@app.get("/drives")
def list_drives():
    drives = []
    if os.name == 'nt':
        import string
        from ctypes import windll
        bitmask = windll.kernel32.GetLogicalDrives()
        for letter in string.ascii_uppercase:
            if bitmask & 1:
                drives.append(f"{letter}:\\")
            bitmask >>= 1
    else:
        drives.append("/")
    return {"drives": drives}

@app.get("/list")
def list_files(path: str):
    p = Path(path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    
    if not p.is_dir():
         raise HTTPException(status_code=400, detail="Path is not a directory")

    items = []
    try:
        for entry in os.scandir(p):
            try:
                stat = entry.stat()
                items.append({
                    "name": entry.name,
                    "path": entry.path,
                    "is_dir": entry.is_dir(),
                    "size": stat.st_size,
                    "mtime": stat.st_mtime
                })
            except OSError:
                continue # Permission denied or other error
    except PermissionError:
         raise HTTPException(status_code=403, detail="Permission denied")

    return {"path": str(p), "items": sorted(items, key=lambda x: (not x['is_dir'], x['name']))}


@app.get("/stream")
def stream_file(path: str, request: Request):
    p = Path(path)
    if not p.exists():
        return JSONResponse(status_code=404, content={"message": "File not found"})

    file_size = p.stat().st_size
    range_header = request.headers.get("range")

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Type": mimetypes.guess_type(p)[0] or "application/octet-stream",
    }

    if range_header:
        byte1, byte2 = 0, None
        match = range_header.replace("bytes=", "").split("-")
        try:
            byte1 = int(match[0])
            if match[1]:
                byte2 = int(match[1])
        except ValueError:
            pass

        if byte2 is None:
            byte2 = file_size - 1

        length = byte2 - byte1 + 1
        
        def iterfile():
            with open(p, "rb") as f:
                f.seek(byte1)
                yield from f.read(length)

        headers["Content-Range"] = f"bytes {byte1}-{byte2}/{file_size}"
        headers["Content-Length"] = str(length)
        return StreamingResponse(iterfile(), status_code=206, headers=headers)

    headers["Content-Length"] = str(file_size)
    return FileResponse(p, headers=headers)

@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0", "persistence": "sqlite"}

if __name__ == "__main__":
    print(f"Starting Local Bridge on http://localhost:8765")
    # Need to reload to pick up DB changes during dev? No, script is static.
    uvicorn.run(app, host="127.0.0.1", port=8765)
