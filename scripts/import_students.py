#!/usr/bin/env python3
"""
Bulk Import Script for Students.
"""
import csv
import psycopg2
import os
import sys
import argparse

# Database Configuration (Default to Docker setup)
DB_CONFIG = {
    "dbname": "exam_e",
    "user": "postgres",
    "password": "postgres",
    "host": "localhost",
    "port": "5433"  # Default port mapped in docker-compose
}

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
    cur.execute("SELECT school_id FROM schools WHERE name = %s", (school_name,))
    res = cur.fetchone()
    if res:
        return res[0]
    
    # Generate unique code if duplicate
    original_code = school_code
    suffix = 1
    while True:
        try:
            cur.execute(
                "INSERT INTO schools (name, code) VALUES (%s, %s) RETURNING school_id",
                (school_name, school_code)
            )
            return cur.fetchone()[0]
        except psycopg2.errors.UniqueViolation:
            cur.connection.rollback()
            school_code = f"{original_code}{suffix}"
            suffix += 1

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
    conn = connect_db()
    cur = conn.cursor()
    
    count_success = 0
    count_skipped = 0

    try:
        print(f"Starting import from {csv_file_path}...")
        with open(csv_file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            for row in reader:
                roll_no = row.get('Institute Roll No', '').strip()
                full_name = row.get('Name', '').strip()
                program_desc = row.get('Program Description', '').strip()
                
                if not roll_no or not full_name:
                    print(f"Skipping row: Missing Roll No or Name ({row})")
                    count_skipped += 1
                    continue

                parsed = parse_program_description(program_desc)
                if not parsed:
                    print(f"Skipping row {roll_no}: Could not parse Program Description '{program_desc}'")
                    count_skipped += 1
                    continue
                
                degree, stream_name, batch = parsed
                
                # Setup Academic Structure
                school_name = f"School of {stream_name}"
                school_code = stream_name[:3].upper()
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
                            INSERT INTO users (university_id, full_name, email, role)
                            VALUES (%s, %s, %s, 'STUDENT')
                            RETURNING id
                            """,
                            (roll_no, full_name, email)
                        )
                        user_id = cur.fetchone()[0]
                    except psycopg2.errors.UniqueViolation:
                        cur.connection.rollback()
                        print(f"Skipping {roll_no}: Email conflict or duplicate ID.")
                        count_skipped += 1
                        continue

                # Student Profile Creation
                section = 'A' 
                
                cur.execute(
                    """
                    INSERT INTO students (user_id, stream_id, current_semester, section_name, batch)
                    VALUES (%s, %s, 1, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE 
                    SET stream_id = EXCLUDED.stream_id, 
                        batch = EXCLUDED.batch
                    """,
                    (user_id, stream_id, section, batch)
                )
                count_success += 1

        conn.commit()
        print(f"Import Summary: Success={count_success}, Skipped={count_skipped}")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
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
