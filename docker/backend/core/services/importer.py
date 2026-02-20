import csv
import io
from django.db import transaction, IntegrityError
from ..models import User, Student, Teacher, School, Stream, Course, CourseAllocation, AcademicSession, Enrollment

def _parse_csv(file_obj):
    """Parses a file-like object into a DictReader with normalized lower-case headers."""
    decoded_file = file_obj.read().decode('utf-8-sig') # Handle optional BOM
    io_string = io.StringIO(decoded_file)
    
    # Read headers manually to normalize
    reader = csv.reader(io_string)
    try:
        headers = next(reader)
    except StopIteration:
        return []

    normalized_headers = [h.strip().lower() for h in headers]
    
    # Yield rows as dictionaries using normalized headers
    for row in reader:
        # Ensure we don't crash on irregular rows, prioritize safety
        row_dict = {}
        for i, header in enumerate(normalized_headers):
            if i < len(row):
                row_dict[header] = row[i]
            else:
                row_dict[header] = ''
        yield row_dict

def _ensure_school(code, name=None):
    if not name:
        name = f"School of {code}"
    school, _ = School.objects.get_or_create(code=code, defaults={'name': name})
    return school

def _ensure_stream(name, degree_type, school):
    if not name: return None
    # Ensure stream uniqueness is based on both name and degree_type
    stream, _ = Stream.objects.get_or_create(
        name=name,
        degree_type=degree_type,
        defaults={'school': school}
    )
    return stream

def _ensure_session(label):
    if not label: return None
    session, _ = AcademicSession.objects.get_or_create(
        label=label,
        defaults={'is_active': True}
    )
    return session

def import_students(file_obj):
    """
    Expected Columns: Roll No, Name, Stream, Degree, Section, Batch, School Code
    """
    reader = _parse_csv(file_obj)
    created_count = 0
    updated_count = 0
    errors = []

    for i, row in enumerate(reader):
        try:
            with transaction.atomic():
                roll_no = row.get('roll no', '').strip()
                name = row.get('name', '').strip()
                stream_name = row.get('stream', '').strip()
                degree = row.get('degree', '').strip()
                section = row.get('section', '').strip()
                batch = row.get('batch', '').strip()
                school_code_raw = row.get('school code', '').strip()

                if not roll_no or not name:
                    continue # Skip empty rows

                # 1. User
                user, created_user = User.objects.update_or_create(
                    university_id=roll_no,
                    defaults={
                        'full_name': name,
                        'email': f"{roll_no}@kiit.ac.in",
                        'role': 'STUDENT',
                        'is_active': True
                    }
                )
                if created_user:
                    user.set_unusable_password()
                    user.save()

                # 2. Structure
                # Prioritize 'School Code' column, fallback to guessing from stream name if missing
                if school_code_raw:
                    school_code = school_code_raw.upper()
                else:
                    school_code = stream_name[:3].upper() if stream_name else 'GEN'
                
                school = _ensure_school(school_code)
                stream = _ensure_stream(stream_name, degree, school)

                # 3. Profile
                Student.objects.update_or_create(
                    user=user,
                    defaults={
                        'stream': stream,
                        'current_semester': 1,
                        'section_name': section,
                        'batch': batch
                    }
                )
                
                if created_user: created_count += 1
                else: updated_count += 1

        except Exception as e:
            errors.append(f"Row {i+1} ({row.get('Roll No', '?')}): {str(e)}")

    return {
        'message': f"Students: {created_count} Created, {updated_count} Updated.",
        'errors': errors
    }

def import_teachers(file_obj):
    """
    Expected Columns: Emp ID, Name, Email, School Code, Specialization
    """
    reader = _parse_csv(file_obj)
    created_count = 0
    updated_count = 0
    errors = []

    for i, row in enumerate(reader):
        try:
            with transaction.atomic():
                emp_id = row.get('emp id', '').strip()
                name = row.get('name', '').strip()
                email = row.get('email', '').strip()
                school_code = row.get('school code', '').strip().upper()
                spec = row.get('specialization', '').strip()

                if not emp_id or not email:
                    continue

                school = _ensure_school(school_code)

                user, created_user = User.objects.update_or_create(
                    university_id=emp_id,
                    defaults={
                        'full_name': name,
                        'email': email,
                        'role': 'TEACHER',
                        'is_active': True
                    }
                )
                if created_user:
                    user.set_unusable_password()
                    user.save()

                Teacher.objects.update_or_create(
                    user=user,
                    defaults={
                        'school': school,
                        'specialization': spec
                    }
                )

                if created_user: created_count += 1
                else: updated_count += 1

        except Exception as e:
            errors.append(f"Row {i+1} ({row.get('Emp ID', '?')}): {str(e)}")

    return {
        'message': f"Teachers: {created_count} Created, {updated_count} Updated.",
        'errors': errors
    }

def import_courses(file_obj):
    """
    Expected Columns: Course Code, Title, Credits, Type
    """
    reader = _parse_csv(file_obj)
    created_count = 0
    updated_count = 0
    errors = []

    for i, row in enumerate(reader):
        try:
            with transaction.atomic():
                code = row.get('course code', '').strip()
                title = row.get('title', '').strip()
                credits_str = row.get('credits', '3').strip()
                c_type = row.get('type', 'THEORY').strip()

                if not code: continue

                course, created = Course.objects.update_or_create(
                    course_code=code,
                    defaults={
                        'title': title,
                        'credits': int(credits_str) if credits_str.isdigit() else 3,
                        'course_type': c_type
                    }
                )
                if created: created_count += 1
                else: updated_count += 1

        except Exception as e:
            errors.append(f"Row {i+1} ({row.get('course code', '?')}): {str(e)}")

    return {
        'message': f"Courses: {created_count} Created, {updated_count} Updated.",
        'errors': errors
    }

def import_allocations(file_obj):
    """
    Expected Columns: Course Code, Teacher ID, Session, Section, Semester
    """
    reader = _parse_csv(file_obj)
    created_count = 0
    errors = []

    for i, row in enumerate(reader):
        try:
            with transaction.atomic():
                course_code = row.get('course code', '').strip()
                teacher_id = row.get('teacher id', '').strip()
                session_label = row.get('session', '').strip()
                section = row.get('section', '').strip()
                semester_str = row.get('semester', '1').strip()

                if not course_code or not teacher_id: continue

                course = Course.objects.filter(course_code=course_code).first()
                if not course:
                    raise ValueError(f"Course {course_code} not found")

                teacher_user = User.objects.filter(university_id=teacher_id, role='TEACHER').first()
                if not teacher_user:
                    raise ValueError(f"Teacher {teacher_id} not found")

                session = _ensure_session(session_label)

                allocation, created = CourseAllocation.objects.get_or_create(
                    course=course,
                    teacher=teacher_user,
                    session=session,
                    section_name=section,
                    defaults={
                        'semester': int(semester_str) if semester_str.isdigit() else 1
                    }
                )
                if created: created_count += 1

        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    return {
        'message': f"Allocations: {created_count} Created.",
        'errors': errors
    }

def import_enrollments(file_obj):
    """
    Expected Columns: Roll No, Course Code, Session, Section, Type
    """
    reader = _parse_csv(file_obj)
    created_count = 0
    errors = []

    for i, row in enumerate(reader):
        try:
            with transaction.atomic():
                roll_no = row.get('roll no', '').strip()
                course_code = row.get('course code', '').strip()
                session_label = row.get('session', '').strip()
                section = row.get('section', '').strip()
                enroll_type = row.get('type', 'REGULAR').strip().upper()

                if not roll_no or not course_code:
                    continue

                student_user = User.objects.filter(university_id=roll_no, role='STUDENT').first()
                if not student_user:
                     # Silent skip or log? For bulk imports, logging errors is better.
                     errors.append(f"Row {i+1}: Student {roll_no} not found")
                     continue

                allocation = CourseAllocation.objects.filter(
                    course__course_code=course_code,
                    session__label=session_label,
                    section_name=section
                ).first()

                if not allocation:
                    errors.append(f"Row {i+1}: Class {course_code} Sec '{section}' ({session_label}) not found")
                    continue

                _, created = Enrollment.objects.get_or_create(
                    student=student_user,
                    allocation=allocation,
                    defaults={'enrollment_type': enroll_type}
                )
                if created: created_count += 1
        
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    return {
        'message': f"Enrollments: {created_count} Created.",
        'errors': errors
    }

def import_schools_streams(file_obj):
    """
    Expected Columns: School Name, School Code, Stream Name, Degree Type
    """
    reader = _parse_csv(file_obj)
    created_count = 0
    updated_count = 0
    errors = []

    for i, row in enumerate(reader):
        try:
            with transaction.atomic():
                school_name = row.get('school name', '').strip()
                school_code = row.get('school code', '').strip().upper()
                stream_name = row.get('stream name', '').strip()
                degree_type = row.get('degree type', '').strip()

                if not school_code or not stream_name:
                    continue

                # 1. Update/Create School
                school, _ = School.objects.update_or_create(
                    code=school_code,
                    defaults={'name': school_name}
                )

                # 2. Update/Create Stream linked to that School
                stream, created = Stream.objects.update_or_create(
                    name=stream_name,
                    degree_type=degree_type,
                    defaults={'school': school}
                )
                
                if created: created_count += 1
                else: updated_count += 1
        
        except Exception as e:
            errors.append(f"Row {i+1}: {str(e)}")

    return {
        'message': f"Structure: {created_count} Streams Created, {updated_count} Updated.",
        'errors': errors
    }
