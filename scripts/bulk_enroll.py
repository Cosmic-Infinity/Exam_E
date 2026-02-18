#!/usr/bin/env python3
"""
Bulk Enroll Script
Enrolls students based on a simple CSV: Roll No, Subject Code, Section.
Handles both Core and Elective subjects identically.

Usage:
    python scripts/bulk_enroll.py --csv Data/enrollments.csv --session "Spring 2026"
"""
import psycopg2
import sys
import argparse
import csv
import os

# Database Configuration
DB_CONFIG = {
    "dbname": "exam_e",
    "user": "postgres",
    "password": "postgres",
    "host": "localhost",
    "port": "5433"
}

def connect_db():
    try:
        return psycopg2.connect(**DB_CONFIG)
    except Exception as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)

def bulk_enroll(csv_path, session_label):
    conn = connect_db()
    cur = conn.cursor()
    
    success_count = 0
    skipped_count = 0

    try:
        # 1. Resolve Session ID
        cur.execute("SELECT session_id FROM academic_sessions WHERE label = %s", (session_label,))
        res = cur.fetchone()
        if not res:
            print(f"Error: Session '{session_label}' not found. Please create it first.")
            return
        session_id = res[0]
        
        print(f"--- Enrolling for Session: {session_label} (ID: {session_id}) ---")

        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            
            # Normalize headers (remove spaces, lowercase)
            reader.fieldnames = [name.strip().lower() for name in reader.fieldnames]
            
            # Expected headers: roll no, subject code, section, [enrollment type]
            # Map potential variations
            roll_key = next((k for k in reader.fieldnames if 'roll' in k or 'university' in k), None)
            subj_key = next((k for k in reader.fieldnames if 'subject' in k or 'course' in k), None)
            sect_key = next((k for k in reader.fieldnames if 'section' in k), None)
            type_key = next((k for k in reader.fieldnames if 'type' in k or 'enrollment' in k), None)

            if not (roll_key and subj_key and sect_key):
                print(f"Error: CSV headers must contain 'Roll No', 'Subject Code', and 'Section'. Found: {reader.fieldnames}")
                return

            for row in reader:
                roll_no = row[roll_key].strip()
                course_code = row[subj_key].strip()
                section_name = row[sect_key].strip()
                
                # Default to 'REGULAR' if column missing or empty
                enroll_type = 'REGULAR'
                if type_key and row[type_key].strip():
                    enroll_type = row[type_key].strip().upper()

                if not (roll_no and course_code and section_name):
                    continue

                # 2. Find Student ID
                cur.execute("SELECT id FROM users WHERE university_id = %s", (roll_no,))
                user_res = cur.fetchone()
                if not user_res:
                    print(f"Skipping {roll_no}: Student not found.")
                    skipped_count += 1
                    continue
                student_id = user_res[0]

                # 3. Find Allocation ID
                # We need to match Course + Session + Section
                cur.execute(
                    """
                    SELECT allocation_id FROM course_allocations 
                    WHERE course_code = %s AND session_id = %s AND section_name = %s
                    """,
                    (course_code, session_id, section_name)
                )
                alloc_res = cur.fetchone()
                if not alloc_res:
                    print(f"Skipping {roll_no} -> {course_code}: Class (Sec {section_name}) not found in this session.")
                    skipped_count += 1
                    continue
                allocation_id = alloc_res[0]

                # 4. Insert Enrollment
                try:
                    cur.execute(
                        """
                        INSERT INTO enrollments (student_id, allocation_id, enrollment_type, status)
                        VALUES (%s, %s, %s, 'ACTIVE')
                        ON CONFLICT (student_id, allocation_id) DO NOTHING
                        """,
                        (student_id, allocation_id, enroll_type)
                    )
                    if cur.rowcount > 0:
                        success_count += 1
                    else:
                        # Already exists
                        skipped_count += 1
                except Exception as e:
                    print(f"Error enrolling {roll_no}: {e}")
                    skipped_count += 1

        conn.commit()
        print(f"\nEnrollment Complete.")
        print(f"  Success: {success_count}")
        print(f"  Skipped: {skipped_count}")

    except Exception as e:
        conn.rollback()
        print(f"Critical Error: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Bulk Enroll Students from CSV")
    parser.add_argument("--csv", required=True, help="Path to CSV file (cols: Roll No, Subject Code, Section)")
    parser.add_argument("--session", required=True, help="Session Label (e.g., 'Spring 2026')")
    
    args = parser.parse_args()
    
    if not os.path.exists(args.csv):
        print(f"File not found: {args.csv}")
        sys.exit(1)

    bulk_enroll(args.csv, args.session)
