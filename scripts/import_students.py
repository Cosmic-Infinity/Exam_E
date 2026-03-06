#!/usr/bin/env python3
"""
Bulk Import Script for Students.
"""
import csv
import psycopg2
from psycopg2 import errors
import os
import sys
import argparse

# Database Configuration from Environment Variables
DB_CONFIG = {
    "dbname": os.getenv("DATABASE_NAME", "exam_e"),
    "user": os.getenv("DATABASE_USER", "postgres"),
    "password": os.getenv("DATABASE_PASSWORD", "postgres"),
    "host": os.getenv("DATABASE_HOST", "db"),
    "port": os.getenv("DATABASE_PORT", "5432")
}

DEFAULT_PASSWORD = "password"

def connect_db():
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        print("Ensure the database container is running and port 5433 is exposed.")
        sys.exit(1)

def ensure_school(cur, school_name, school_code):
    """Ensure a school exists, return its ID."""
    # Use TRIM and ILIKE/UPPER to be more robust against data inconsistencies
    cur.execute("SELECT school_id FROM schools WHERE TRIM(name) ILIKE TRIM(%s)", (school_name,))
    res = cur.fetchone()
    if res:
        return res[0]
    
    # Generate unique code if duplicate code exists, but if name exists above, we'd have returned.
    # If the INSERT fails on NAME, we should stop trying to change CODE.
    original_name = school_name
    original_code = school_code
    suffix = 1
    while True:
        try:
            cur.execute(
                "INSERT INTO schools (name, code) VALUES (%s, %s) RETURNING school_id",
                (school_name, school_code)
            )
            return cur.fetchone()[0]
        except errors.UniqueViolation as e:
            cur.connection.rollback()
            # If the error is about the NAME, don't loop forever changing the code.
            if 'name' in str(e).lower():
                # Try fetching again to be sure
                cur.execute("SELECT school_id FROM schools WHERE TRIM(name) ILIKE TRIM(%s)", (school_name,))
                res = cur.fetchone()
                if res: return res[0]
                # If still not found, we have a real DB issue, but let's break to avoid logs flood.
                print(f"CRITICAL: Failed to insert or find school '{school_name}'")
                return None
            
            # If error is on CODE, then suffix and retry
            school_code = f"{original_code}{suffix}"
            suffix += 1
            if suffix > 100: # Safety break
                print(f"CRITICAL: Infinite loop detected for school code generation: {original_code}")
                return None

def ensure_stream(cur, stream_name, degree_type, school_id):
    """Ensure a stream exists, return its ID."""
    cur.execute(
        "SELECT stream_id FROM streams WHERE name = %s AND degree_type = %s", 
        (stream_name, degree_type)
    )
    res = cur.fetchone()
    if res:
        return res[0]
    
    cur.execute(
        "INSERT INTO streams (name, degree_type, school_id) VALUES (%s, %s, %s) RETURNING stream_id",
        (stream_name, degree_type, school_id)
    )
    return cur.fetchone()[0]

def parse_program_description(desc):
    """
    Parses 'B.Tech in Civil Engineering 2023' into parts.
    Also handles 'B.Tech Computer Science & Comm. 2023'.
    Returns: (degree, stream_name, batch)
    """
    try:
        # Check for standard "Degree in Stream Batch"
        if " in " in desc:
            degree, rest = desc.split(" in ", 1)
        else:
            # Fallback for "Degree Stream Batch"
            # Assume Degree is first word
            parts = desc.split(' ', 1)
            if len(parts) < 2:
                return None
            degree = parts[0]
            rest = parts[1]
        
        # Split rest into Stream Name and Batch
        # Assumption: Batch is the last word (year)
        parts = rest.rsplit(' ', 1)
        if len(parts) == 2:
            stream_name = parts[0]
            batch = parts[1]
        else:
            stream_name = rest
            batch = "Unknown"
            
        return degree.strip(), stream_name.strip(), batch.strip()
    except Exception:
        return None

def import_students(csv_file_path):
    print(f"--- Starting Student Import from {csv_file_path} ---")
    print(f"Default user password set to: '{DEFAULT_PASSWORD}'")
    
    conn = connect_db()
    cur = conn.cursor()
    
    count_created = 0
    count_updated = 0
    count_skipped = 0
    
    try:
        with open(csv_file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # 1. Normalize Header Handling
                # Support "Roll No" (test data), "College Roll No", "Institute Roll No" (standard)
                roll_no = (row.get('Roll No') or row.get('Institute Roll No') or row.get('College Roll No') or '').strip()
                full_name = (row.get('Name') or row.get('Student Name') or '').strip()
                
                if not roll_no or not full_name:
                    print(f"Skipping row: Missing Roll No or Name ({row})")
                    count_skipped += 1
                    continue

                # 2. Get Program Data (From distinct columns OR description)
                program_desc = row.get('Program Description', '').strip()
                if program_desc:
                    parsed = parse_program_description(program_desc)
                    if not parsed:
                        print(f"Skipping row {roll_no}: Could not parse Program Description '{program_desc}'")
                        count_skipped += 1
                        continue
                    degree, stream_name, batch = parsed
                else:
                    # Use direct columns: "Stream", "Degree", "Batch"
                    degree = row.get('Degree', 'B.Tech').strip()
                    stream_name = row.get('Stream', '').strip()
                    batch = row.get('Batch', '2021-2025').strip() # Realistic fallback
                
                # Check School Code (new column in test data?)
                school_code = row.get('School Code', 'GENERIC').strip()
                if school_code == 'GENERIC':
                    # Fallback — try to guess school code from stream
                    school_code = stream_name[:3].upper() if stream_name else "GEN"
                    
                school_name = f"School of {school_code}" # Generic/Heuristic name
                section_name = row.get('Section', 'A').strip()
                
                # 3. Setup Academic Structure
                school_id = ensure_school(cur, school_name, school_code)
                stream_id = ensure_stream(cur, stream_name, degree, school_id)
                
                # User Creation
                cur.execute("SELECT id FROM users WHERE university_id = %s", (roll_no,))
                user_res = cur.fetchone()
                
                if user_res:
                    user_id = user_res[0]
                else:
                    email = f"{roll_no}@kiit.ac.in"
                    
                    try:
                        cur.execute(
                            """
                            INSERT INTO users (university_id, full_name, email, role, password, is_staff, is_active, is_superuser, date_joined)
                            VALUES (%s, %s, %s, 'STUDENT', %s, FALSE, TRUE, FALSE, NOW())
                            RETURNING id
                            """,
                            (roll_no, full_name, email, 'pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=')
                        )
                        user_id = cur.fetchone()[0]
                    except psycopg2.errors.UniqueViolation:
                        cur.connection.rollback()
                        print(f"Skipping {roll_no}: Email conflict or duplicate ID.")
                        count_skipped += 1
                        continue

                # Student Profile Creation
                # If section_name was provided in CSV, use it; otherwise fallback to 'A'.
                if not section_name:
                    section_name = 'A'
                
                cur.execute(
                    """
                    INSERT INTO students (user_id, stream_id, current_semester, section_name, batch)
                    VALUES (%s, %s, 1, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE 
                    SET stream_id = EXCLUDED.stream_id, 
                        section_name = EXCLUDED.section_name,
                        batch = EXCLUDED.batch
                    """,
                    (user_id, stream_id, section_name, batch)
                )
                count_created += 1

        conn.commit()
        print(f"Import Summary: Created {count_created}, Updated {count_updated}, Skipped {count_skipped}.")
    except Exception as e:
        print(f"FATAL: Error reading CSV file: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_file")
    args = parser.parse_args()
    
    if not os.path.exists(args.csv_file):
        print(f"Error: File not found: {args.csv_file}")
        sys.exit(1)

    import_students(args.csv_file)
