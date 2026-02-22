#!/usr/bin/env python3
"""
Create Exam Event Script
Defines an exam (Midsem/Endsem) for a specific course in a specific session.
This metadata (Total Marks, Question Structure) is used during evaluation.

Usage:
    python scripts/create_exam_event.py --session "Spring 2026" --course "CS302" --type "MIDSEM" --marks 20
"""
import psycopg2
import sys
import argparse
import json

# Database Configuration
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

def create_exam(session_label, course_code, exam_type, total_marks, schema_json):
    conn = connect_db()
    cur = conn.cursor()

    try:
        # 1. Resolve Session
        cur.execute("SELECT session_id FROM academic_sessions WHERE label = %s", (session_label,))
        res = cur.fetchone()
        if not res:
            print(f"Error: Session '{session_label}' not found.")
            return
        session_id = res[0]

        # 2. Find Allocations (Sections) for this Course + Session
        # Exams are typically common across all sections of the same course in a session.
        # We need to create an exam entry for EACH allocation (Section A, Section B, etc.) 
        # or maybe we should have linked Exams to Course+Session directly?
        # The schema links Exams to Allocation (one specific section). 
        # So we will create an Exam entry for *every* allocation of this course in this session.
        
        cur.execute("""
            SELECT allocation_id, section_name 
            FROM course_allocations 
            WHERE session_id = %s AND course_code = %s
        """, (session_id, course_code))
        
        allocations = cur.fetchall()
        if not allocations:
            print(f"Error: No allocations found for {course_code} in {session_label}.")
            return

        print(f"Found {len(allocations)} sections for {course_code}. Creating '{exam_type}' event for all...")

        created_count = 0
        for alloc_id, section_name in allocations:
            # Check if exists
            cur.execute("""
                SELECT exam_id FROM exams 
                WHERE allocation_id = %s AND exam_type = %s
            """, (alloc_id, exam_type))
            
            if cur.fetchone():
                print(f"  - Section {section_name}: {exam_type} already exists. Skipping.")
                continue

            # Insert
            cur.execute("""
                INSERT INTO exams (allocation_id, exam_type, total_marks, question_paper_schema)
                VALUES (%s, %s, %s, %s)
            """, (alloc_id, exam_type, total_marks, schema_json))
            created_count += 1
            print(f"  - Section {section_name}: Created.")

        conn.commit()
        print(f"\nExam Event Setup Complete. Created {created_count} events.")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create Exam Event")
    parser.add_argument("--session", required=True, help="Session Label (e.g., 'Spring 2026')")
    parser.add_argument("--course", required=True, help="Course Code (e.g., 'CS302')")
    parser.add_argument("--type", required=True, choices=['MIDSEM', 'ENDSEM', 'QUIZ'], help="Exam Type")
    parser.add_argument("--marks", required=True, type=int, help="Total Marks")
    parser.add_argument("--schema", help="Path to JSON file containing Q structure (optional)")
    
    args = parser.parse_args()
    
    # Default Schema (if no file provided)
    # Simple explicit structure: 5 questions of equal weight
    if args.schema:
        with open(args.schema, 'r') as f:
            schema_data = f.read() # Read as string
    else:
        # Fallback Generator: Create a simple 1-part question structure
        # E.g. 20 marks total, 5 questions -> 4 marks each
        q_count = 5
        marks_per_q = args.marks / q_count
        
        # Structure: List of Objects
        # [ { "q": 1, "parts": [4] }, { "q": 2, "parts": [4] } ... ]
        structure = []
        for i in range(1, q_count + 1):
             structure.append({
                 "q": i,
                 "parts": [marks_per_q]  # Single part worth full marks
             })
        schema_data = json.dumps(structure)

    create_exam(args.session, args.course, args.type.upper(), args.marks, schema_data)
