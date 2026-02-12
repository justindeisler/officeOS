"""Test file with intentional security vulnerabilities"""

import os
import pickle

# SECURITY ISSUE 1: Hardcoded API key (Gitleaks should catch this)
GITHUB_TOKEN = "ghp_1234567890abcdefghijklmnopqrstuvwxyz12"
AWS_SECRET_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"

# SECURITY ISSUE 2: SQL Injection vulnerability (Semgrep should catch this)
def get_user(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"  # SQL injection
    return query

# SECURITY ISSUE 3: Unsafe deserialization (Semgrep should catch this)
def load_data(filename):
    with open(filename, 'rb') as f:
        data = pickle.load(f)  # Unsafe pickle
    return data

# SECURITY ISSUE 4: Command injection (Semgrep should catch this)
def run_command(user_input):
    os.system(f"echo {user_input}")  # Command injection

# SECURITY ISSUE 5: Weak cryptography
import hashlib
def hash_password(password):
    return hashlib.md5(password.encode()).hexdigest()  # Weak MD5

if __name__ == "__main__":
    print("Test file loaded")
