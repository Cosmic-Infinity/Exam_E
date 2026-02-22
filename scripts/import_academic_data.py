#!/usr/bin/env python3
"""
Import Academic Data Script
Imports Teachers, Courses, and Allocations from CSV files.

Usage:
    python scripts/import_academic_data.py --teachers Data/teachers.csv --courses Data/courses.csv --allocations Data/allocations.csv
"""
import csv
import psycopg2
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

def connect_db():
    try:
        return psycopg2.connect(**DB_CONFIG)
    except Exception as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)

def ensure_school(cur, school_code):
    """Ensure a school exists by code. Returns school_id."""
    cur.execute("SELECT school_id FROM schools WHERE code = %s", (school_code,))
    res = cur.fetchone()
    if res:
        return res[0]
    
    # Create if not exists (Name it generically)
    school_name = f"School of {school_code}"
    print(f"Creating School: {school_name} ({school_code})")
    cur.execute(
        "INSERT INTO schools (name, code) VALUES (%s, %s) RETURNING school_id",
        (school_name, school_code)
    )
    return cur.fetchone()[0]

def import_teachers(conn, filepath):
    if not filepath: return
    print(f"\n--- Importing Teachers from {filepath} ---")
    cur = conn.cursor()
    count = 0
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                emp_id = row['Emp ID'].strip()
                name = row['Name'].strip()
                email = row['Email'].strip()
                school_code = row['School Code'].strip()
                spec = row['Specialization'].strip()

                # 1. Ensure School
                school_id = ensure_school(cur, school_code)

                # 2. Create User
                # Password hash placeholder. 
                # Teacher is NOT is_staff. Use Django Admin only for System Admins.
                cur.execute(
                    """
                    INSERT INTO users (university_id, full_name, email, role, is_staff, is_active)
                    VALUES (%s, %s, %s, 'TEACHER', FALSE, TRUE)
                    ON CONFLICT (university_id) DO UPDATE 
                    SET full_name = EXCLUDED.full_name
                    RETURNING id
                    """,
                    (emp_id, name, email)
                )
                user_id = cur.fetchone()[0]

                # 3. Create/Update Teacher Profile
                cur.execute(
                    """
                    INSERT INTO teachers (user_id, school_id, specialization)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE 
                    SET school_id = EXCLUDED.school_id, specialization = EXCLUDED.specialization
                    """,
                    (user_id, school_id, spec)
                )
                count += 1
        conn.commit()
        print(f"Imported {count} teachers.")
    except Exception as e:
        conn.rollback()
        print(f"Error importing teachers: {e}")
    finally:
        cur.close()

def import_courses(conn, filepath):
    if not filepath: return
    print(f"\n--- Importing Courses from {filepath} ---")
    cur = conn.cursor()
    count = 0
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                code = row['Course Code'].strip()
                title = row['Title'].strip()
                credits = int(row['Credits'].strip())
                c_type = row['Type'].strip()

                cur.execute(
                    """
                    INSERT INTO courses (course_code, title, credits, course_type)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (course_code) DO UPDATE 
                    SET title = EXCLUDED.title, credits = EXCLUDED.credits, course_type = EXCLUDED.course_type
                    """,
                    (code, title, credits, c_type)
                )
                count += 1
        conn.commit()
        print(f"Imported {count} courses.")
    except Exception as e:
        conn.rollback()
        print(f"Error importing courses: {e}")
    finally:
        cur.close()

def ensure_session(cur, session_label):
    """Ensure session exists. Returns session_id."""
    cur.execute("SELECT session_id FROM academic_sessions WHERE label = %s", (session_label,))
    res = cur.fetchone()
    if res:
        return res[0]
    
    print(f"Creating Session: {session_label}")
    cur.execute(
        "INSERT INTO academic_sessions (label, is_active) VALUES (%s, true) RETURNING session_id",
        (session_label,)
    )
    return cur.fetchone()[0]

def import_allocations(conn, filepath):
    if not filepath: return
    print(f"\n--- Importing Allocations from {filepath} ---")
    cur = conn.cursor()
    count = 0
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                course_code = row['Course Code'].strip()
                teacher_emp_id = row['Teacher ID'].strip()
                session_label = row['Session'].strip()
                section = row['Section'].strip()
                semester = int(row['Semester'].strip())

                # 1. Get Session ID
                session_id = ensure_session(cur, session_label)

                # 2. Get Teacher User ID
                cur.execute("SELECT id FROM users WHERE university_id = %s", (teacher_emp_id,))
                t_res = cur.fetchone()
                if not t_res:
                    print(f"Skipping allocation: Teacher {teacher_emp_id} not found.")
                    continue
                teacher_id = t_res[0]

                # 3. Create Allocation
                # Check duplication based on course + section + session
                cur.execute(
                    """
                    SELECT allocation_id FROM course_allocations 
                    WHERE course_code = %s AND session_id = %s AND section_name = %s
                    """,
                    (course_code, session_id, section)
                )
                if cur.fetchone():
                    print(f"Skipping duplicate allocation: {course_code} - {section}")
                    continue

                cur.execute(
                    """
                    INSERT INTO course_allocations (course_code, teacher_id, session_id, section_name, semester)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (course_code, teacher_id, session_id, section, semester)
                )
                count += 1
        conn.commit()
        print(f"Imported {count} allocations.")
    except Exception as e:
        conn.rollback()
        print(f"Error importing allocations: {e}")
    finally:
        cur.close()

def import_schools_streams(conn, filepath):
    if not filepath: return
    print(f"\n--- Importing Schools and Streams from {filepath} ---")
    cur = conn.cursor()
    count_schools = 0
    count_streams = 0
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                school_name = row['School Name'].strip()
                school_code = row['School Code'].strip()
                stream_name = row['Stream Name'].strip()
                degree_type = row['Degree Type'].strip()

                # 1. Ensure School
                cur.execute("SELECT school_id FROM schools WHERE code = %s", (school_code,))
                res = cur.fetchone()
                if res:
                    school_id = res[0]
                else:
                    print(f"Creating School: {school_name} ({school_code})")
                    cur.execute(
                        "INSERT INTO schools (name, code) VALUES (%s, %s) RETURNING school_id",
                        (school_name, school_code)
                    )
                    school_id = cur.fetchone()[0]
                    count_schools += 1

                # 2. Ensure Stream
                cur.execute(
                    "SELECT stream_id FROM streams WHERE name = %s AND degree_type = %s", 
                    (stream_name, degree_type)
                )
                if not cur.fetchone():
                    print(f"Creating Stream: {degree_type} in {stream_name}")
                    cur.execute(
                        "INSERT INTO streams (name, degree_type, school_id) VALUES (%s, %s, %s)",
                        (stream_name, degree_type, school_id)
                    )
                    count_streams += 1
                    
        conn.commit()
        print(f"Imported {count_schools} new schools and {count_streams} new streams.")
    except Exception as e:
        conn.rollback()
        print(f"Error importing schools/streams: {e}")
    finally:
        cur.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import Academic Data")
    parser.add_argument("--founders", help="Path to schools_streams.csv (Foundational Data)")
    parser.add_argument("--teachers", help="Path to teachers.csv")
    parser.add_argument("--courses", help="Path to courses.csv")
    parser.add_argument("--allocations", help="Path to allocations.csv")
    
    args = parser.parse_args()

    conn = connect_db()

    if args.founders:
        import_schools_streams(conn, args.founders)
    
    if args.teachers:
        import_teachers(conn, args.teachers)
    
    if args.courses:
        import_courses(conn, args.courses)
        
    if args.allocations:
        import_allocations(conn, args.allocations)
        
    conn.close()
