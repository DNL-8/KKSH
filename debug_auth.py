import requests

BASE_URL = "http://localhost:8000/api/v1"

def debug():
    s = requests.Session()
    
    # 0. Initial request to get CSRF cookie
    print("Fetching CSRF token...")
    # We can hit any endpoint. /me is a good candidate even if unauth.
    r = s.get(f"{BASE_URL}/me")
    csrf_token = s.cookies.get("csrf_token")
    if not csrf_token:
        print("Could not find csrf_token cookie.")
        print(f"Cookies: {s.cookies.get_dict()}")
        print(f"Headers: {r.headers}")
    
    if csrf_token:
        print(f"Got CSRF token: {csrf_token[:10]}...")
        s.headers.update({"X-CSRF-Token": csrf_token})

    # 1. Signup
    email = "test_debug_user@example.com"
    password = "password123"
    
    print("Attempting Signup...")
    r = s.post(f"{BASE_URL}/auth/signup", json={"email": email, "password": password})
    if r.status_code == 409:
        print("User exists, logging in...")
    elif r.status_code != 200:
        print(f"Signup failed: {r.status_code} {r.text}")
        return

    # 2. Login
    print("Attempting Login...")
    r = s.post(f"{BASE_URL}/auth/login", data={"username": email, "password": password})
    if r.status_code != 200:
        print(f"Login failed: {r.status_code} {r.text}")
        return
    
    print("Login successful. Cookies:", s.cookies)

    # 3. Get Me
    print("Requesting GET /me ...")
    r = s.get(f"{BASE_URL}/me")
    print(f"Status: {r.status_code}")
    print(f"Body: {r.text}")

if __name__ == "__main__":
    debug()
