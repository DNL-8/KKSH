
import os
import sqlite3
import uvicorn
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse, Response
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
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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
    if not p.exists() or not p.is_file():
        return JSONResponse(status_code=404, content={"message": "File not found"})

    file_size = p.stat().st_size
    range_header = request.headers.get("range")
    media_type = mimetypes.guess_type(str(p))[0] or "application/octet-stream"

    def parse_range_header(value: str, size: int):
        if not value.startswith("bytes="):
            return None

        spec = value.replace("bytes=", "", 1).split(",", 1)[0].strip()
        if "-" not in spec:
            return None

        start_raw, end_raw = spec.split("-", 1)
        try:
            if start_raw == "":
                suffix_len = int(end_raw)
                if suffix_len <= 0:
                    return None
                start = max(size - suffix_len, 0)
                end = size - 1
            else:
                start = int(start_raw)
                end = int(end_raw) if end_raw else size - 1
        except ValueError:
            return None

        if start < 0 or end < start or start >= size:
            return None

        end = min(end, size - 1)
        return start, end

    if range_header:
        parsed = parse_range_header(range_header, file_size)
        if parsed is None:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{file_size}"})

        start, end = parsed
        length = end - start + 1

        def iterfile():
            remaining = length
            with open(p, "rb") as f:
                f.seek(start)
                while remaining > 0:
                    chunk = f.read(min(1024 * 1024, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        headers = {
            "Accept-Ranges": "bytes",
            "Content-Range": f"bytes {start}-{end}/{file_size}",
            "Content-Length": str(length),
        }
        return StreamingResponse(iterfile(), status_code=206, headers=headers, media_type=media_type)

    headers = {
        "Accept-Ranges": "bytes",
        "Content-Length": str(file_size),
    }
    return FileResponse(p, headers=headers, media_type=media_type)

@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0.0", "persistence": "sqlite"}

if __name__ == "__main__":
    print(f"Starting Local Bridge on http://localhost:8765")
    # Need to reload to pick up DB changes during dev? No, script is static.
    uvicorn.run(app, host="127.0.0.1", port=8765)
