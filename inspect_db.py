import sqlite3

def inspect():
    conn = sqlite3.connect('study_leveling.db')
    cursor = conn.cursor()
    
    print("--- User Table Schema ---")
    try:
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        for col in columns:
            print(col)
    except Exception as e:
        print(f"Error getting schema: {e}")

    print("\n--- User Data (First 5 Rows) ---")
    try:
        # Assuming username is the last column or one of them
        # Let's select specifics if possible, but * is fine for inspection
        cursor.execute("SELECT * FROM users LIMIT 5")
        rows = cursor.fetchall()
        for row in rows:
            print(row)
    except Exception as e:
        print(f"Error getting data: {e}")

    conn.close()

if __name__ == "__main__":
    inspect()
