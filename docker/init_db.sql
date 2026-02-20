--
-- PostgreSQL database dump
--

\restrict yV7sdg0mElOz0Xl5zfFO3BbCia66hfPW147BepCKOQM8cePfgRPxW2ecKXZLYwb

-- Dumped from database version 15.16
-- Dumped by pg_dump version 15.16

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: academic_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.academic_sessions (
    session_id integer NOT NULL,
    label character varying(20) NOT NULL,
    is_active boolean DEFAULT true
);


ALTER TABLE public.academic_sessions OWNER TO postgres;

--
-- Name: academic_sessions_session_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.academic_sessions_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.academic_sessions_session_id_seq OWNER TO postgres;

--
-- Name: academic_sessions_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.academic_sessions_session_id_seq OWNED BY public.academic_sessions.session_id;


--
-- Name: course_allocations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.course_allocations (
    allocation_id integer NOT NULL,
    course_code character varying(15),
    teacher_id integer,
    session_id integer,
    section_name character varying(10),
    semester integer NOT NULL
);


ALTER TABLE public.course_allocations OWNER TO postgres;

--
-- Name: course_allocations_allocation_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.course_allocations_allocation_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.course_allocations_allocation_id_seq OWNER TO postgres;

--
-- Name: course_allocations_allocation_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.course_allocations_allocation_id_seq OWNED BY public.course_allocations.allocation_id;


--
-- Name: courses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.courses (
    course_code character varying(15) NOT NULL,
    title character varying(100) NOT NULL,
    credits integer DEFAULT 4,
    course_type character varying(20),
    CONSTRAINT courses_course_type_check CHECK (((course_type)::text = ANY ((ARRAY['CORE'::character varying, 'PE'::character varying, 'OE'::character varying])::text[])))
);


ALTER TABLE public.courses OWNER TO postgres;

--
-- Name: enrollments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.enrollments (
    enrollment_id integer NOT NULL,
    student_id integer,
    allocation_id integer,
    enrollment_type character varying(20) DEFAULT 'REGULAR'::character varying,
    status character varying(20) DEFAULT 'ACTIVE'::character varying
);


ALTER TABLE public.enrollments OWNER TO postgres;

--
-- Name: enrollments_enrollment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.enrollments_enrollment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.enrollments_enrollment_id_seq OWNER TO postgres;

--
-- Name: enrollments_enrollment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.enrollments_enrollment_id_seq OWNED BY public.enrollments.enrollment_id;



--
-- Name: exams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exams (
    exam_id integer NOT NULL,
    allocation_id integer,
    exam_type character varying(20) NOT NULL CHECK (exam_type IN ('MIDSEM', 'ENDSEM', 'QUIZ')),
    total_marks integer NOT NULL,
    passing_marks integer,
    question_paper_schema jsonb, -- Stores structure like: [{"q_no": 1, "parts": [1, 1, 1, 1, 1]}, {"q_no": 2, "parts": [2, 3]}]
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.exams OWNER TO postgres;

--
-- Name: exams_exam_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exams_exam_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.exams_exam_id_seq OWNER TO postgres;

--
-- Name: exams_exam_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exams_exam_id_seq OWNED BY public.exams.exam_id;


--
-- Name: exam_papers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_papers (
    paper_id integer NOT NULL,
    enrollment_id integer,
    exam_id integer,
    file_path text NOT NULL,
    marks_json jsonb,
    total_score numeric(5,2),
    evaluation_status character varying(20) DEFAULT 'PENDING'::character varying,
    CONSTRAINT check_eval_status CHECK (((evaluation_status)::text = ANY ((ARRAY['PENDING'::character varying, 'IN_PROGRESS'::character varying, 'COMPLETED'::character varying, 'REVALUATION'::character varying])::text[]))),
    CONSTRAINT check_marks_range CHECK (((total_score >= (0)::numeric) AND (total_score <= (100)::numeric)))
);


ALTER TABLE public.exam_papers OWNER TO postgres;

--
-- Name: exam_papers_paper_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exam_papers_paper_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.exam_papers_paper_id_seq OWNER TO postgres;

--
-- Name: exam_papers_paper_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exam_papers_paper_id_seq OWNED BY public.exam_papers.paper_id;


--
-- Name: grievances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.grievances (
    id integer NOT NULL,
    paper_id integer,
    student_comment text,
    assigned_coordinator integer,
    status character varying(20) DEFAULT 'OPEN'::character varying
);


ALTER TABLE public.grievances OWNER TO postgres;

--
-- Name: grievances_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.grievances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.grievances_id_seq OWNER TO postgres;

--
-- Name: grievances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.grievances_id_seq OWNED BY public.grievances.id;


--
-- Name: schools; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schools (
    school_id integer NOT NULL,
    name character varying(100) NOT NULL,
    code character varying(10) NOT NULL
);


ALTER TABLE public.schools OWNER TO postgres;

--
-- Name: schools_school_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.schools_school_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.schools_school_id_seq OWNER TO postgres;

--
-- Name: schools_school_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.schools_school_id_seq OWNED BY public.schools.school_id;


--
-- Name: streams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.streams (
    stream_id integer NOT NULL,
    school_id integer,
    name character varying(100) NOT NULL,
    degree_type character varying(20)
);


ALTER TABLE public.streams OWNER TO postgres;

--
-- Name: streams_stream_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.streams_stream_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.streams_stream_id_seq OWNER TO postgres;

--
-- Name: streams_stream_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.streams_stream_id_seq OWNED BY public.streams.stream_id;


--
-- Name: students; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.students (
    user_id integer NOT NULL,
    stream_id integer,
    current_semester integer DEFAULT 1,
    section_name character varying(10),
    batch character varying(10)
);


ALTER TABLE public.students OWNER TO postgres;

--
-- Name: teachers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.teachers (
    user_id integer NOT NULL,
    school_id integer,
    specialization character varying(100),
    is_coordinator boolean DEFAULT false
);


ALTER TABLE public.teachers OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    university_id character varying(30) NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash text NOT NULL,
    role character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['STUDENT'::character varying, 'TEACHER'::character varying, 'COORDINATOR'::character varying, 'ADMIN'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

-- ── Django auth columns (added for AbstractBaseUser compatibility) ────────────
-- These are idempotent: safe to re-run on an existing DB.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password          VARCHAR(128)             NOT NULL DEFAULT '!invalid';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login        TIMESTAMP WITH TIME ZONE          DEFAULT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_superuser      BOOLEAN                  NOT NULL DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_active         BOOLEAN                  NOT NULL DEFAULT TRUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_staff          BOOLEAN                  NOT NULL DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_verified       BOOLEAN                  NOT NULL DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS date_joined       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();
-- Set is_staff/is_superuser from legacy role column for existing rows
UPDATE public.users SET is_superuser = TRUE, is_staff = TRUE WHERE role = 'ADMIN';
UPDATE public.users SET is_staff = TRUE WHERE role = 'COORDINATOR';
-- ─────────────────────────────────────────────────────────────────────────────

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.users_id_seq OWNER TO postgres;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: view_section_details; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.view_section_details AS
 SELECT ca.allocation_id,
    c.course_code,
    c.title AS course_name,
    u.university_id AS teacher_emp_id,
    u.email AS teacher_email,
    ca.section_name,
    ca.semester
   FROM ((public.course_allocations ca
     JOIN public.courses c ON (((ca.course_code)::text = (c.course_code)::text)))
     JOIN public.users u ON ((ca.teacher_id = u.id)));


ALTER TABLE public.view_section_details OWNER TO postgres;

--
-- Name: academic_sessions session_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academic_sessions ALTER COLUMN session_id SET DEFAULT nextval('public.academic_sessions_session_id_seq'::regclass);


--
-- Name: course_allocations allocation_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_allocations ALTER COLUMN allocation_id SET DEFAULT nextval('public.course_allocations_allocation_id_seq'::regclass);


--
-- Name: enrollments enrollment_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollments ALTER COLUMN enrollment_id SET DEFAULT nextval('public.enrollments_enrollment_id_seq'::regclass);


--
-- Name: exam_papers paper_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_papers ALTER COLUMN paper_id SET DEFAULT nextval('public.exam_papers_paper_id_seq'::regclass);


--
-- Name: grievances id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grievances ALTER COLUMN id SET DEFAULT nextval('public.grievances_id_seq'::regclass);


--
-- Name: schools school_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schools ALTER COLUMN school_id SET DEFAULT nextval('public.schools_school_id_seq'::regclass);


--
-- Name: streams stream_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.streams ALTER COLUMN stream_id SET DEFAULT nextval('public.streams_stream_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: academic_sessions academic_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academic_sessions
    ADD CONSTRAINT academic_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: course_allocations course_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_allocations
    ADD CONSTRAINT course_allocations_pkey PRIMARY KEY (allocation_id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (course_code);


--
-- Name: enrollments enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_pkey PRIMARY KEY (enrollment_id);


--
-- Name: exam_papers exam_papers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_papers
    ADD CONSTRAINT exam_papers_pkey PRIMARY KEY (paper_id);


--
-- Name: grievances grievances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grievances
    ADD CONSTRAINT grievances_pkey PRIMARY KEY (id);


--
-- Name: schools schools_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_code_key UNIQUE (code);


--
-- Name: schools schools_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_name_key UNIQUE (name);


--
-- Name: schools schools_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schools
    ADD CONSTRAINT schools_pkey PRIMARY KEY (school_id);


--
-- Name: streams streams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.streams
    ADD CONSTRAINT streams_pkey PRIMARY KEY (stream_id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (user_id);


--
-- Name: teachers teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_pkey PRIMARY KEY (user_id);


--
-- Name: enrollments unique_student_course_session; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT unique_student_course_session UNIQUE (student_id, allocation_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_university_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_university_id_key UNIQUE (university_id);


--
-- Name: idx_allocation_teacher_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_allocation_teacher_section ON public.course_allocations USING btree (teacher_id, section_name);


--
-- Name: idx_paper_enrollment; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_paper_enrollment ON public.exam_papers USING btree (enrollment_id);


--
-- Name: idx_student_section; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_student_section ON public.students USING btree (section_name);


--
-- Name: idx_user_university_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_university_id ON public.users USING btree (university_id);


--
-- Name: course_allocations course_allocations_course_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_allocations
    ADD CONSTRAINT course_allocations_course_code_fkey FOREIGN KEY (course_code) REFERENCES public.courses(course_code);


--
-- Name: course_allocations course_allocations_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_allocations
    ADD CONSTRAINT course_allocations_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.academic_sessions(session_id);


--
-- Name: course_allocations course_allocations_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.course_allocations
    ADD CONSTRAINT course_allocations_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- Name: enrollments enrollments_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.course_allocations(allocation_id);


--
-- Name: enrollments enrollments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.enrollments
    ADD CONSTRAINT enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id);


--
-- Name: exam_papers exam_papers_enrollment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_papers
    ADD CONSTRAINT exam_papers_enrollment_id_fkey FOREIGN KEY (enrollment_id) REFERENCES public.enrollments(enrollment_id);


--
-- Name: exams exams_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.course_allocations(allocation_id);


--
-- Name: exam_papers exam_papers_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_papers
    ADD CONSTRAINT exam_papers_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id);


--
-- Name: grievances grievances_assigned_coordinator_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grievances
    ADD CONSTRAINT grievances_assigned_coordinator_fkey FOREIGN KEY (assigned_coordinator) REFERENCES public.users(id);


--
-- Name: grievances grievances_paper_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.grievances
    ADD CONSTRAINT grievances_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES public.exam_papers(paper_id);


--
-- Name: streams streams_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.streams
    ADD CONSTRAINT streams_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(school_id);


--
-- Name: students students_stream_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_stream_id_fkey FOREIGN KEY (stream_id) REFERENCES public.streams(stream_id);


--
-- Name: students students_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: teachers teachers_school_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(school_id);


--
-- Name: teachers teachers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.teachers
    ADD CONSTRAINT teachers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--

\unrestrict yV7sdg0mElOz0Xl5zfFO3BbCia66hfPW147BepCKOQM8cePfgRPxW2ecKXZLYwb

