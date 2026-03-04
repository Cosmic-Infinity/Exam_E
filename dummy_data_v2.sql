DO $$
DECLARE
    -- IDs
    coord_user_id INT := 2000;
    course_code_val TEXT := 'STAT888';
    -- Existing valid IDs from DB check
    existing_session_id INT := 1;
    existing_school_id INT := 1;
    existing_stream_id INT := 5;
    
    -- Loop vars
    i INT;
    j INT;
    curr_alloc_id INT;
    curr_exam_id INT;
    curr_stud_id INT;
    curr_enroll_id INT;
    curr_paper_id INT;
    curr_score NUMERIC;
    
    -- Data arrays
    section_names TEXT[] := ARRAY['A', 'B', 'C', 'D'];
    
BEGIN
    -- 1. Create Coordinator User (password hash copied from admin)
    INSERT INTO users (id, university_id, email, password, role, full_name, is_superuser, is_staff, is_active, is_verified, date_joined, created_at)
    VALUES (coord_user_id, 'STAT_COORD', 'coord@stat.edu', 'pbkdf2_sha256$1000000$rx5EkXwb7EgrdW1TSnw0l8$FfXveDoLomZpTAqp1+lPkYDS/6wgSRMVd/ch4WnkA20=', 'TEACHER', 'Prof. Statistician', false, false, true, true, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email; -- Ensure email matches if ID exists

    -- 2. Create Teacher Profile
    INSERT INTO teachers (user_id, school_id, specialization, is_coordinator)
    VALUES (coord_user_id, existing_school_id, 'Statistics', true)
    ON CONFLICT (user_id) DO NOTHING;

    -- 3. Create Course
    INSERT INTO courses (course_code, title, credits, course_type, coordinator_id)
    VALUES (course_code_val, 'Advanced Statistics', 4, 'CORE', coord_user_id)
    ON CONFLICT (course_code) DO NOTHING;

    -- Loop for 4 Sections
    FOR i IN 1..4 LOOP
        curr_alloc_id := 2000 + i;
        curr_exam_id := 2000 + i;

        -- 4. Create Allocation
        INSERT INTO course_allocations (allocation_id, course_code, teacher_id, session_id, section_name, semester)
        VALUES (curr_alloc_id, course_code_val, coord_user_id, existing_session_id, section_names[i], 6)
        ON CONFLICT (allocation_id) DO NOTHING;

        -- 5. Create Exam
        INSERT INTO exams (exam_id, allocation_id, exam_type, total_marks, passing_marks, is_active, created_at)
        VALUES (curr_exam_id, curr_alloc_id, 'ENDSEM', 100, 30, true, NOW())
        ON CONFLICT (exam_id) DO NOTHING;

        -- Create Students per Section
        -- Section A: 20 students (Strong performance)
        -- Section B: 20 students (Average)
        -- Section C: 20 students (Weak)
        -- Section D: 20 students (Mixed)
        FOR j IN 1..20 LOOP
            curr_stud_id := 3000 + (i * 100) + j;
            curr_enroll_id := 5000 + (i * 100) + j;
            curr_paper_id := 5000 + (i * 100) + j;

            -- 6. Create Student User
            INSERT INTO users (id, university_id, email, password, role, full_name, is_superuser, is_staff, is_active, is_verified, date_joined, created_at)
            VALUES (curr_stud_id, 'STU_' || course_code_val || '_' || section_names[i] || '_' || j, 'student_' || curr_stud_id || '@univ.edu', 'pbkdf2_sha256$1000000$rx5EkXwb7EgrdW1TSnw0l8$FfXveDoLomZpTAqp1+lPkYDS/6wgSRMVd/ch4WnkA20=', 'STUDENT', 'Student ' || section_names[i] || ' ' || j, false, false, true, true, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING;

            -- 7. Create Student Profile
            INSERT INTO students (user_id, stream_id, current_semester, section_name, batch)
            VALUES (curr_stud_id, existing_stream_id, 6, section_names[i], '2023')
            ON CONFLICT (user_id) DO NOTHING;

            -- 8. Create Enrollment
            INSERT INTO enrollments (enrollment_id, student_id, allocation_id, enrollment_type, status)
            VALUES (curr_enroll_id, curr_stud_id, curr_alloc_id, 'REGULAR', 'ACTIVE')
            ON CONFLICT (enrollment_id) DO NOTHING;

            -- Generate Score
            -- Section specific bias
            IF i = 1 THEN curr_score := LEAST(100, GREATEST(0, (85 + (random() * 20 - 10))::INT)); -- A: 75-95
            ELSIF i = 2 THEN curr_score := LEAST(100, GREATEST(0, (70 + (random() * 25 - 12))::INT)); -- B: 58-82
            ELSIF i = 3 THEN curr_score := LEAST(100, GREATEST(0, (55 + (random() * 30 - 15))::INT)); -- C: 40-70
            ELSE curr_score := LEAST(100, GREATEST(0, (65 + (random() * 40 - 20))::INT)); -- D: 45-85
            END IF;

            -- 9. Create Exam Paper
            INSERT INTO exam_papers (paper_id, enrollment_id, exam_id, file_path, total_score, evaluation_status, marks_json)
            VALUES (curr_paper_id, curr_enroll_id, curr_exam_id, '/dummy/path/' || curr_paper_id || '.pdf', curr_score, 'COMPLETED', '{}')
            ON CONFLICT (paper_id) DO NOTHING;

        END LOOP;
    END LOOP;
END $$;