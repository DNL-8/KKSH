import sqlite3

def add_column():
    conn = sqlite3.connect('../study_leveling.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE users ADD COLUMN username TEXT")
        print("Column 'username' added.")
    except sqlite3.OperationalError as e:
        print(f"Error adding column: {e}")
        
    try:
        cursor.execute("CREATE UNIQUE INDEX ix_users_username ON users (username)")
        print("Index 'ix_users_username' created.")
    except sqlite3.OperationalError as e:
        print(f"Error creating index: {e}")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    add_column()
