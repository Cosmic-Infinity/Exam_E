DO $$
DECLARE
    curr_sess_id INT;
    t_uid INT;
    alloc_a_id INT;
    alloc_b_id INT;
    exam_a_id INT;
    exam_b_id INT;
    stud_uid INT;
    enr_id INT;
    pap_id INT;
    i INT;
    score INT;
BEGIN
    SELECT session_id INTO curr_sess_id FROM academic_sessions WHERE is_active = TRUE LIMIT 1;
    IF curr_sess_id IS NULL THEN curr_sess_id := 1; END IF;

    -- Course
    INSERT INTO courses (course_code, title, credits, course_type)
    VALUES ('STAT501', 'Applied Statistics for Controllers', 4, 'CORE')
    ON CONFLICT (course_code) DO NOTHING;

    -- Teacher
    SELECT id INTO t_uid FROM users WHERE university_id = 'T88888';
    IF t_uid IS NULL THEN
        INSERT INTO users (university_id, email, password, full_name, role, is_active, is_staff, is_superuser, is_verified, date_joined)
        VALUES ('T88888', 'prof.stats@kiit.ac.in', '!invalid', 'Prof. Statistics', 'TEACHER', true, false, false, true, NOW())
        RETURNING id INTO t_uid;
        INSERT INTO teachers (user_id, school_id, specialization, is_coordinator)
        VALUES (t_uid, 1, 'Data Science', true);
    END IF;

    -- Allocations
    INSERT INTO course_allocations (course_code, teacher_id, session_id, section_name, semester)
    VALUES ('STAT501', t_uid, curr_sess_id, 'Section A', 6)
    RETURNING allocation_id INTO alloc_a_id;

    INSERT INTO course_allocations (course_code, teacher_id, session_id, section_name, semester)
    VALUES ('STAT501', t_uid, curr_sess_id, 'Section B', 6)
    RETURNING allocation_id INTO alloc_b_id;

    -- Exams
    INSERT INTO exams (allocation_id, exam_type, total_marks, is_active)
    VALUES (alloc_a_id, 'ENDSEM', 100, true)
    RETURNING exam_id INTO exam_a_id;

    INSERT INTO exams (allocation_id, exam_type, total_marks, is_active)
    VALUES (alloc_b_id, 'ENDSEM', 100, true)
    RETURNING exam_id INTO exam_b_id;

    -- Students A (30)
    FOR i IN 1..30 LOOP
        SELECT id INTO stud_uid FROM users WHERE university_id = '23055' || lpad(i::text, 2, '0');
        IF stud_uid IS NULL THEN
            INSERT INTO users (university_id, email, password, full_name, role, is_active, is_staff, is_superuser, is_verified, date_joined)
            VALUES ('23055' || lpad(i::text, 2, '0'), 'studentA' || i || '@kiit.ac.in', '!invalid', 'Student A' || i, 'STUDENT', true, false, false, true, NOW())
            RETURNING id INTO stud_uid;
            INSERT INTO students (user_id, stream_id, current_semester, section_name, batch)
            VALUES (stud_uid, 15, 6, 'Section A', '2023');
        END IF;

        INSERT INTO enrollments (student_id, allocation_id, enrollment_type, status)
        VALUES (stud_uid, alloc_a_id, 'REGULAR', 'ACTIVE')
        RETURNING enrollment_id INTO enr_id;

        score := floor(random() * 41 + 50); -- 50-90
        
        -- Mixed status
        IF i < 25 THEN
            INSERT INTO exam_papers (enrollment_id, exam_id, total_score, evaluation_status, file_path)
            VALUES (enr_id, exam_a_id, score, 'COMPLETED', 'dummy.pdf')
            RETURNING paper_id INTO pap_id;
            
            -- Grievance
            IF i = 5 THEN
                INSERT INTO grievances (paper_id, student_comment, assigned_coordinator, status)
                VALUES (pap_id, 'Please check Q3', t_uid, 'OPEN');
            END IF;
        ELSE
            INSERT INTO exam_papers (enrollment_id, exam_id, total_score, evaluation_status, file_path)
            VALUES (enr_id, exam_a_id, NULL, 'PENDING', 'dummy.pdf');
        END IF;
    END LOOP;

    -- Students B (20) - Low scores
    FOR i IN 1..20 LOOP
        SELECT id INTO stud_uid FROM users WHERE university_id = '23056' || lpad(i::text, 2, '0');
        IF stud_uid IS NULL THEN
            INSERT INTO users (university_id, email, password, full_name, role, is_active, is_staff, is_superuser, is_verified, date_joined)
            VALUES ('23056' || lpad(i::text, 2, '0'), 'studentB' || i || '@kiit.ac.in', '!invalid', 'Student B' || i, 'STUDENT', true, false, false, true, NOW())
            RETURNING id INTO stud_uid;
            INSERT INTO students (user_id, stream_id, current_semester, section_name, batch)
            VALUES (stud_uid, 15, 6, 'Section B', '2023');
        END IF;

        INSERT INTO enrollments (student_id, allocation_id, enrollment_type, status)
        VALUES (stud_uid, alloc_b_id, 'REGULAR', 'ACTIVE')
        RETURNING enrollment_id INTO enr_id;

        score := floor(random() * 41 + 20); -- 20-60
        INSERT INTO exam_papers (enrollment_id, exam_id, total_score, evaluation_status, file_path)
        VALUES (enr_id, exam_b_id, score, 'COMPLETED', 'dummy.pdf');
    END LOOP;
END $$;
