--
-- PostgreSQL database dump
--

\restrict 1T6fuNLgDHLCbe2Esdt1zHty55bfvlhj4788CUGXRIY07LgUYMCjgWAID8WRyOx

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

ALTER TABLE IF EXISTS ONLY public.token_blacklist_outstandingtoken DROP CONSTRAINT IF EXISTS token_blacklist_outstandingtoken_user_id_83bc629a_fk_users_id;
ALTER TABLE IF EXISTS ONLY public.token_blacklist_blacklistedtoken DROP CONSTRAINT IF EXISTS token_blacklist_blacklistedtoken_token_id_3cc7fe56_fk;
ALTER TABLE IF EXISTS ONLY public.teachers DROP CONSTRAINT IF EXISTS teachers_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.teachers DROP CONSTRAINT IF EXISTS teachers_school_id_fkey;
ALTER TABLE IF EXISTS ONLY public.students DROP CONSTRAINT IF EXISTS students_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.students DROP CONSTRAINT IF EXISTS students_stream_id_fkey;
ALTER TABLE IF EXISTS ONLY public.streams DROP CONSTRAINT IF EXISTS streams_school_id_fkey;
ALTER TABLE IF EXISTS ONLY public.grievances DROP CONSTRAINT IF EXISTS grievances_paper_id_fkey;
ALTER TABLE IF EXISTS ONLY public.grievances DROP CONSTRAINT IF EXISTS grievances_assigned_coordinator_fkey;
ALTER TABLE IF EXISTS ONLY public.exams DROP CONSTRAINT IF EXISTS exams_allocation_id_fkey;
ALTER TABLE IF EXISTS ONLY public.exam_papers DROP CONSTRAINT IF EXISTS exam_papers_exam_id_fkey;
ALTER TABLE IF EXISTS ONLY public.exam_papers DROP CONSTRAINT IF EXISTS exam_papers_enrollment_id_fkey;
ALTER TABLE IF EXISTS ONLY public.enrollments DROP CONSTRAINT IF EXISTS enrollments_student_id_fkey;
ALTER TABLE IF EXISTS ONLY public.enrollments DROP CONSTRAINT IF EXISTS enrollments_allocation_id_fkey;
ALTER TABLE IF EXISTS ONLY public.django_admin_log DROP CONSTRAINT IF EXISTS django_admin_log_user_id_c564eba6_fk_users_id;
ALTER TABLE IF EXISTS ONLY public.django_admin_log DROP CONSTRAINT IF EXISTS django_admin_log_content_type_id_c4bce8eb_fk_django_co;
ALTER TABLE IF EXISTS ONLY public.course_allocations DROP CONSTRAINT IF EXISTS course_allocations_teacher_id_fkey;
ALTER TABLE IF EXISTS ONLY public.course_allocations DROP CONSTRAINT IF EXISTS course_allocations_session_id_fkey;
ALTER TABLE IF EXISTS ONLY public.course_allocations DROP CONSTRAINT IF EXISTS course_allocations_course_code_fkey;
ALTER TABLE IF EXISTS ONLY public.auth_permission DROP CONSTRAINT IF EXISTS auth_permission_content_type_id_2f476e4b_fk_django_co;
ALTER TABLE IF EXISTS ONLY public.auth_group_permissions DROP CONSTRAINT IF EXISTS auth_group_permissions_group_id_b120cbf9_fk_auth_group_id;
ALTER TABLE IF EXISTS ONLY public.auth_group_permissions DROP CONSTRAINT IF EXISTS auth_group_permissio_permission_id_84c5c92e_fk_auth_perm;
DROP INDEX IF EXISTS public.token_blacklist_outstandingtoken_user_id_83bc629a;
DROP INDEX IF EXISTS public.token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_like;
DROP INDEX IF EXISTS public.idx_user_university_id;
DROP INDEX IF EXISTS public.idx_student_section;
DROP INDEX IF EXISTS public.idx_paper_enrollment;
DROP INDEX IF EXISTS public.idx_allocation_teacher_section;
DROP INDEX IF EXISTS public.django_session_session_key_c0390e0f_like;
DROP INDEX IF EXISTS public.django_session_expire_date_a5c62663;
DROP INDEX IF EXISTS public.django_admin_log_user_id_c564eba6;
DROP INDEX IF EXISTS public.django_admin_log_content_type_id_c4bce8eb;
DROP INDEX IF EXISTS public.auth_permission_content_type_id_2f476e4b;
DROP INDEX IF EXISTS public.auth_group_permissions_permission_id_84c5c92e;
DROP INDEX IF EXISTS public.auth_group_permissions_group_id_b120cbf9;
DROP INDEX IF EXISTS public.auth_group_name_a6ea08ec_like;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_university_id_key;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.enrollments DROP CONSTRAINT IF EXISTS unique_student_course_session;
ALTER TABLE IF EXISTS ONLY public.token_blacklist_outstandingtoken DROP CONSTRAINT IF EXISTS token_blacklist_outstandingtoken_pkey;
ALTER TABLE IF EXISTS ONLY public.token_blacklist_outstandingtoken DROP CONSTRAINT IF EXISTS token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_uniq;
ALTER TABLE IF EXISTS ONLY public.token_blacklist_blacklistedtoken DROP CONSTRAINT IF EXISTS token_blacklist_blacklistedtoken_token_id_key;
ALTER TABLE IF EXISTS ONLY public.token_blacklist_blacklistedtoken DROP CONSTRAINT IF EXISTS token_blacklist_blacklistedtoken_pkey;
ALTER TABLE IF EXISTS ONLY public.teachers DROP CONSTRAINT IF EXISTS teachers_pkey;
ALTER TABLE IF EXISTS ONLY public.students DROP CONSTRAINT IF EXISTS students_pkey;
ALTER TABLE IF EXISTS ONLY public.streams DROP CONSTRAINT IF EXISTS streams_pkey;
ALTER TABLE IF EXISTS ONLY public.schools DROP CONSTRAINT IF EXISTS schools_pkey;
ALTER TABLE IF EXISTS ONLY public.schools DROP CONSTRAINT IF EXISTS schools_name_key;
ALTER TABLE IF EXISTS ONLY public.schools DROP CONSTRAINT IF EXISTS schools_code_key;
ALTER TABLE IF EXISTS ONLY public.grievances DROP CONSTRAINT IF EXISTS grievances_pkey;
ALTER TABLE IF EXISTS ONLY public.exams DROP CONSTRAINT IF EXISTS exams_pkey;
ALTER TABLE IF EXISTS ONLY public.exam_papers DROP CONSTRAINT IF EXISTS exam_papers_pkey;
ALTER TABLE IF EXISTS ONLY public.enrollments DROP CONSTRAINT IF EXISTS enrollments_pkey;
ALTER TABLE IF EXISTS ONLY public.django_session DROP CONSTRAINT IF EXISTS django_session_pkey;
ALTER TABLE IF EXISTS ONLY public.django_migrations DROP CONSTRAINT IF EXISTS django_migrations_pkey;
ALTER TABLE IF EXISTS ONLY public.django_content_type DROP CONSTRAINT IF EXISTS django_content_type_pkey;
ALTER TABLE IF EXISTS ONLY public.django_content_type DROP CONSTRAINT IF EXISTS django_content_type_app_label_model_76bd3d3b_uniq;
ALTER TABLE IF EXISTS ONLY public.django_admin_log DROP CONSTRAINT IF EXISTS django_admin_log_pkey;
ALTER TABLE IF EXISTS ONLY public.courses DROP CONSTRAINT IF EXISTS courses_pkey;
ALTER TABLE IF EXISTS ONLY public.course_allocations DROP CONSTRAINT IF EXISTS course_allocations_pkey;
ALTER TABLE IF EXISTS ONLY public.auth_permission DROP CONSTRAINT IF EXISTS auth_permission_pkey;
ALTER TABLE IF EXISTS ONLY public.auth_permission DROP CONSTRAINT IF EXISTS auth_permission_content_type_id_codename_01ab375a_uniq;
ALTER TABLE IF EXISTS ONLY public.auth_group DROP CONSTRAINT IF EXISTS auth_group_pkey;
ALTER TABLE IF EXISTS ONLY public.auth_group_permissions DROP CONSTRAINT IF EXISTS auth_group_permissions_pkey;
ALTER TABLE IF EXISTS ONLY public.auth_group_permissions DROP CONSTRAINT IF EXISTS auth_group_permissions_group_id_permission_id_0cd325b0_uniq;
ALTER TABLE IF EXISTS ONLY public.auth_group DROP CONSTRAINT IF EXISTS auth_group_name_key;
ALTER TABLE IF EXISTS ONLY public.academic_sessions DROP CONSTRAINT IF EXISTS academic_sessions_pkey;
ALTER TABLE IF EXISTS public.users ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.streams ALTER COLUMN stream_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.schools ALTER COLUMN school_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.grievances ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.exams ALTER COLUMN exam_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.exam_papers ALTER COLUMN paper_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.enrollments ALTER COLUMN enrollment_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.course_allocations ALTER COLUMN allocation_id DROP DEFAULT;
ALTER TABLE IF EXISTS public.academic_sessions ALTER COLUMN session_id DROP DEFAULT;
DROP VIEW IF EXISTS public.view_section_details;
DROP SEQUENCE IF EXISTS public.users_id_seq;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.token_blacklist_outstandingtoken;
DROP TABLE IF EXISTS public.token_blacklist_blacklistedtoken;
DROP TABLE IF EXISTS public.teachers;
DROP TABLE IF EXISTS public.students;
DROP SEQUENCE IF EXISTS public.streams_stream_id_seq;
DROP TABLE IF EXISTS public.streams;
DROP SEQUENCE IF EXISTS public.schools_school_id_seq;
DROP TABLE IF EXISTS public.schools;
DROP SEQUENCE IF EXISTS public.grievances_id_seq;
DROP TABLE IF EXISTS public.grievances;
DROP SEQUENCE IF EXISTS public.exams_exam_id_seq;
DROP TABLE IF EXISTS public.exams;
DROP SEQUENCE IF EXISTS public.exam_papers_paper_id_seq;
DROP TABLE IF EXISTS public.exam_papers;
DROP SEQUENCE IF EXISTS public.enrollments_enrollment_id_seq;
DROP TABLE IF EXISTS public.enrollments;
DROP TABLE IF EXISTS public.django_session;
DROP TABLE IF EXISTS public.django_migrations;
DROP TABLE IF EXISTS public.django_content_type;
DROP TABLE IF EXISTS public.django_admin_log;
DROP TABLE IF EXISTS public.courses;
DROP SEQUENCE IF EXISTS public.course_allocations_allocation_id_seq;
DROP TABLE IF EXISTS public.course_allocations;
DROP TABLE IF EXISTS public.auth_permission;
DROP TABLE IF EXISTS public.auth_group_permissions;
DROP TABLE IF EXISTS public.auth_group;
DROP SEQUENCE IF EXISTS public.academic_sessions_session_id_seq;
DROP TABLE IF EXISTS public.academic_sessions;
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
-- Name: auth_group; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_group (
    id integer NOT NULL,
    name character varying(150) NOT NULL
);


ALTER TABLE public.auth_group OWNER TO postgres;

--
-- Name: auth_group_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auth_group ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_group_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_group_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_group_permissions (
    id bigint NOT NULL,
    group_id integer NOT NULL,
    permission_id integer NOT NULL
);


ALTER TABLE public.auth_group_permissions OWNER TO postgres;

--
-- Name: auth_group_permissions_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auth_group_permissions ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_group_permissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_permission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_permission (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    content_type_id integer NOT NULL,
    codename character varying(100) NOT NULL
);


ALTER TABLE public.auth_permission OWNER TO postgres;

--
-- Name: auth_permission_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.auth_permission ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.auth_permission_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


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
    coordinator_id integer,
    CONSTRAINT courses_course_type_check CHECK (((course_type)::text = ANY (ARRAY[('CORE'::character varying)::text, ('PE'::character varying)::text, ('OE'::character varying)::text])))
);


ALTER TABLE public.courses OWNER TO postgres;

--
-- Name: django_admin_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.django_admin_log (
    id integer NOT NULL,
    action_time timestamp with time zone NOT NULL,
    object_id text,
    object_repr character varying(200) NOT NULL,
    action_flag smallint NOT NULL,
    change_message text NOT NULL,
    content_type_id integer,
    user_id integer NOT NULL,
    CONSTRAINT django_admin_log_action_flag_check CHECK ((action_flag >= 0))
);


ALTER TABLE public.django_admin_log OWNER TO postgres;

--
-- Name: django_admin_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.django_admin_log ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_admin_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_content_type; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.django_content_type (
    id integer NOT NULL,
    app_label character varying(100) NOT NULL,
    model character varying(100) NOT NULL
);


ALTER TABLE public.django_content_type OWNER TO postgres;

--
-- Name: django_content_type_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.django_content_type ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_content_type_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.django_migrations (
    id bigint NOT NULL,
    app character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    applied timestamp with time zone NOT NULL
);


ALTER TABLE public.django_migrations OWNER TO postgres;

--
-- Name: django_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.django_migrations ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.django_migrations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: django_session; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.django_session (
    session_key character varying(40) NOT NULL,
    session_data text NOT NULL,
    expire_date timestamp with time zone NOT NULL
);


ALTER TABLE public.django_session OWNER TO postgres;

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
-- Name: exam_papers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_papers (
    paper_id integer NOT NULL,
    enrollment_id integer,
    exam_id integer,
    pages jsonb,
    marks_json jsonb,
    total_score numeric(5,2),
    evaluation_status character varying(20) DEFAULT 'PENDING'::character varying,
    CONSTRAINT check_eval_status CHECK (((evaluation_status)::text = ANY (ARRAY[('PENDING'::character varying)::text, ('IN_PROGRESS'::character varying)::text, ('COMPLETED'::character varying)::text, ('REVALUATION'::character varying)::text]))),
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
-- Name: exams; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exams (
    exam_id integer NOT NULL,
    allocation_id integer,
    exam_type character varying(20) NOT NULL,
    total_marks integer NOT NULL,
    passing_marks integer,
    question_paper_schema jsonb,
    question_paper_path text,
    answer_key_path text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT exams_exam_type_check CHECK (((exam_type)::text = ANY ((ARRAY['MIDSEM'::character varying, 'ENDSEM'::character varying, 'QUIZ'::character varying])::text[])))
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
    specialization character varying(100)
);


ALTER TABLE public.teachers OWNER TO postgres;

--
-- Name: token_blacklist_blacklistedtoken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.token_blacklist_blacklistedtoken (
    id bigint NOT NULL,
    blacklisted_at timestamp with time zone NOT NULL,
    token_id bigint NOT NULL
);


ALTER TABLE public.token_blacklist_blacklistedtoken OWNER TO postgres;

--
-- Name: token_blacklist_blacklistedtoken_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.token_blacklist_blacklistedtoken ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.token_blacklist_blacklistedtoken_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: token_blacklist_outstandingtoken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.token_blacklist_outstandingtoken (
    id bigint NOT NULL,
    token text NOT NULL,
    created_at timestamp with time zone,
    expires_at timestamp with time zone NOT NULL,
    user_id integer,
    jti character varying(255) NOT NULL
);


ALTER TABLE public.token_blacklist_outstandingtoken OWNER TO postgres;

--
-- Name: token_blacklist_outstandingtoken_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.token_blacklist_outstandingtoken ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.token_blacklist_outstandingtoken_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    university_id character varying(30) NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    role character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    password character varying(128) DEFAULT '!invalid'::character varying NOT NULL,
    last_login timestamp with time zone,
    is_superuser boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_staff boolean DEFAULT false NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    date_joined timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY (ARRAY[('STUDENT'::character varying)::text, ('TEACHER'::character varying)::text, ('CONTROLLER'::character varying)::text])))
);


ALTER TABLE public.users OWNER TO postgres;

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
-- Name: exams exam_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams ALTER COLUMN exam_id SET DEFAULT nextval('public.exams_exam_id_seq'::regclass);


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
-- Data for Name: academic_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.academic_sessions (session_id, label, is_active) FROM stdin;
1	2024-2025	t
\.


--
-- Data for Name: auth_group; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auth_group (id, name) FROM stdin;
\.


--
-- Data for Name: auth_group_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auth_group_permissions (id, group_id, permission_id) FROM stdin;
\.


--
-- Data for Name: auth_permission; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auth_permission (id, name, content_type_id, codename) FROM stdin;
1	Can add Data Import Tool	1	add_dataimport
2	Can change Data Import Tool	1	change_dataimport
3	Can delete Data Import Tool	1	delete_dataimport
4	Can view Data Import Tool	1	view_dataimport
5	Can add user	2	add_user
6	Can change user	2	change_user
7	Can delete user	2	delete_user
8	Can view user	2	view_user
9	Can add academic session	3	add_academicsession
10	Can change academic session	3	change_academicsession
11	Can delete academic session	3	delete_academicsession
12	Can view academic session	3	view_academicsession
13	Can add school	4	add_school
14	Can change school	4	change_school
15	Can delete school	4	delete_school
16	Can view school	4	view_school
17	Can add course	5	add_course
18	Can change course	5	change_course
19	Can delete course	5	delete_course
20	Can view course	5	view_course
21	Can add course allocation	6	add_courseallocation
22	Can change course allocation	6	change_courseallocation
23	Can delete course allocation	6	delete_courseallocation
24	Can view course allocation	6	view_courseallocation
25	Can add enrollment	7	add_enrollment
26	Can change enrollment	7	change_enrollment
27	Can delete enrollment	7	delete_enrollment
28	Can view enrollment	7	view_enrollment
29	Can add exam	8	add_exam
30	Can change exam	8	change_exam
31	Can delete exam	8	delete_exam
32	Can view exam	8	view_exam
33	Can add exam paper	9	add_exampaper
34	Can change exam paper	9	change_exampaper
35	Can delete exam paper	9	delete_exampaper
36	Can view exam paper	9	view_exampaper
37	Can add grievance	10	add_grievance
38	Can change grievance	10	change_grievance
39	Can delete grievance	10	delete_grievance
40	Can view grievance	10	view_grievance
41	Can add stream	11	add_stream
42	Can change stream	11	change_stream
43	Can delete stream	11	delete_stream
44	Can view stream	11	view_stream
45	Can add student	12	add_student
46	Can change student	12	change_student
47	Can delete student	12	delete_student
48	Can view student	12	view_student
49	Can add teacher	13	add_teacher
50	Can change teacher	13	change_teacher
51	Can delete teacher	13	delete_teacher
52	Can view teacher	13	view_teacher
53	Can add Blacklisted Token	14	add_blacklistedtoken
54	Can change Blacklisted Token	14	change_blacklistedtoken
55	Can delete Blacklisted Token	14	delete_blacklistedtoken
56	Can view Blacklisted Token	14	view_blacklistedtoken
57	Can add Outstanding Token	15	add_outstandingtoken
58	Can change Outstanding Token	15	change_outstandingtoken
59	Can delete Outstanding Token	15	delete_outstandingtoken
60	Can view Outstanding Token	15	view_outstandingtoken
61	Can add log entry	16	add_logentry
62	Can change log entry	16	change_logentry
63	Can delete log entry	16	delete_logentry
64	Can view log entry	16	view_logentry
65	Can add permission	17	add_permission
66	Can change permission	17	change_permission
67	Can delete permission	17	delete_permission
68	Can view permission	17	view_permission
69	Can add group	18	add_group
70	Can change group	18	change_group
71	Can delete group	18	delete_group
72	Can view group	18	view_group
73	Can add content type	19	add_contenttype
74	Can change content type	19	change_contenttype
75	Can delete content type	19	delete_contenttype
76	Can view content type	19	view_contenttype
77	Can add session	20	add_session
78	Can change session	20	change_session
79	Can delete session	20	delete_session
80	Can view session	20	view_session
\.


--
-- Data for Name: course_allocations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.course_allocations (allocation_id, course_code, teacher_id, session_id, section_name, semester) FROM stdin;
1	CS103	39	1	A	3
2	CS103	40	1	B	3
3	CS103	42	1	C	3
4	CS104	44	1	A	3
5	CS104	44	1	B	3
6	CS104	47	1	C	3
7	CS201	39	1	A	5
8	CS201	39	1	B	5
9	CS201	40	1	C	5
10	CS202	47	1	A	5
11	CS202	47	1	B	5
12	CS202	44	1	C	5
13	ME301	43	1	A	5
14	ME301	46	1	B	5
15	EC201	41	1	A	7
16	EC201	45	1	B	7
17	CS101	42	1	A	1
\.


--
-- Data for Name: courses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.courses (course_code, title, credits, course_type, coordinator_id) FROM stdin;
CS101	Introduction to Programming	3	CORE	\N
CS102	Data Structures	4	CORE	\N
CS103	Algorithms	4	CORE	\N
CS104	Database Management Systems	3	CORE	49
CS105	Operating Systems	3	CORE	\N
EC201	Digital Electronics	3	CORE	\N
EC202	Analog Circuits	4	CORE	\N
ME301	Thermodynamics	3	CORE	\N
ME302	Fluid Mechanics	4	CORE	\N
CS201	Machine Learning	3	PE	\N
CS202	Artificial Intelligence	3	PE	\N
CS203	Web Development	3	OE	\N
EC203	Signals and Systems	3	CORE	\N
\.


--
-- Data for Name: django_admin_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.django_admin_log (id, action_time, object_id, object_repr, action_flag, change_message, content_type_id, user_id) FROM stdin;
1	2026-03-14 08:01:46.815624+00	CS104	CS104 - Database Management Systems	2	[{"changed": {"fields": ["Coordinator"]}}]	5	1
2	2026-03-14 08:51:36.831198+00	28	Zara Kapoor (2305101)	2	[{"changed": {"fields": ["password"]}}]	2	1
3	2026-03-14 08:53:57.326223+00	49	Abhaya Sahoo (T011)	2	[{"changed": {"fields": ["password"]}}]	2	1
4	2026-03-14 10:18:41.37188+00	21	Paper 21 (COMPLETED)	2	[{"changed": {"fields": ["Marks json", "Total score"]}}]	9	1
5	2026-03-14 10:20:33.646927+00	11	MIDSEM - 100 Marks	2	[{"changed": {"fields": ["Apply schema to all sections of this subject", "Question paper schema"]}}]	8	1
\.


--
-- Data for Name: django_content_type; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.django_content_type (id, app_label, model) FROM stdin;
1	core	dataimport
2	core	user
3	core	academicsession
4	core	school
5	core	course
6	core	courseallocation
7	core	enrollment
8	core	exam
9	core	exampaper
10	core	grievance
11	core	stream
12	core	student
13	core	teacher
14	token_blacklist	blacklistedtoken
15	token_blacklist	outstandingtoken
16	admin	logentry
17	auth	permission
18	auth	group
19	contenttypes	contenttype
20	sessions	session
\.


--
-- Data for Name: django_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.django_migrations (id, app, name, applied) FROM stdin;
1	contenttypes	0001_initial	2026-03-14 07:50:14.761893+00
2	contenttypes	0002_remove_content_type_name	2026-03-14 07:50:14.778795+00
3	auth	0001_initial	2026-03-14 07:50:14.910957+00
4	auth	0002_alter_permission_name_max_length	2026-03-14 07:50:14.920325+00
5	auth	0003_alter_user_email_max_length	2026-03-14 07:50:14.927879+00
6	auth	0004_alter_user_username_opts	2026-03-14 07:50:14.935942+00
7	auth	0005_alter_user_last_login_null	2026-03-14 07:50:14.943381+00
8	auth	0006_require_contenttypes_0002	2026-03-14 07:50:14.947934+00
9	auth	0007_alter_validators_add_error_messages	2026-03-14 07:50:14.956733+00
10	auth	0008_alter_user_username_max_length	2026-03-14 07:50:14.964452+00
11	auth	0009_alter_user_last_name_max_length	2026-03-14 07:50:14.973506+00
12	auth	0010_alter_group_name_max_length	2026-03-14 07:50:14.987167+00
13	auth	0011_update_proxy_permissions	2026-03-14 07:50:14.995615+00
14	auth	0012_alter_user_first_name_max_length	2026-03-14 07:50:15.003085+00
15	core	0001_initial	2026-03-14 07:50:15.079247+00
16	admin	0001_initial	2026-03-14 07:50:15.161459+00
17	admin	0002_logentry_remove_auto_add	2026-03-14 07:50:15.174358+00
18	admin	0003_logentry_add_action_flag_choices	2026-03-14 07:50:15.187542+00
19	sessions	0001_initial	2026-03-14 07:50:15.234436+00
20	token_blacklist	0001_initial	2026-03-14 07:50:15.357095+00
21	token_blacklist	0002_outstandingtoken_jti_hex	2026-03-14 07:50:15.371293+00
22	token_blacklist	0003_auto_20171017_2007	2026-03-14 07:50:15.395385+00
23	token_blacklist	0004_auto_20171017_2013	2026-03-14 07:50:15.463202+00
24	token_blacklist	0005_remove_outstandingtoken_jti	2026-03-14 07:50:15.482364+00
25	token_blacklist	0006_auto_20171017_2113	2026-03-14 07:50:15.500067+00
26	token_blacklist	0007_auto_20171017_2214	2026-03-14 07:50:15.556702+00
27	token_blacklist	0008_migrate_to_bigautofield	2026-03-14 07:50:15.693758+00
28	token_blacklist	0010_fix_migrate_to_bigautofield	2026-03-14 07:50:15.719358+00
29	token_blacklist	0011_linearizes_history	2026-03-14 07:50:15.725581+00
30	token_blacklist	0012_alter_outstandingtoken_user	2026-03-14 07:50:15.747789+00
31	token_blacklist	0013_alter_blacklistedtoken_options_and_more	2026-03-14 07:50:15.770212+00
\.


--
-- Data for Name: django_session; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.django_session (session_key, session_data, expire_date) FROM stdin;
2ft615ob2bsnfqha7929ytu4g5tkk4kq	.eJxVjDkOwjAUBe_iGlm2g5dQ0ucM0d-CA8iW4qRC3B0ipYD2zcx7qRG2NY9bk2WcWV2UVaffDYEeUnbAdyi3qqmWdZlR74o-aNNDZXleD_fvIEPL39p5pIl77iBEHzEgE0wYEnQmBuOMk5jIsRhrz-IhJepFXMLoIBBbq94f_U04WA:1w1Kkv:b1icOuuE5RfZr3sX7r5RR8b7qcMjjz7AEBNuFbP0j5c	2026-03-28 08:53:57.346867+00
\.


--
-- Data for Name: enrollments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.enrollments (enrollment_id, student_id, allocation_id, enrollment_type, status) FROM stdin;
1	28	1	REGULAR	ACTIVE
2	28	4	REGULAR	ACTIVE
3	29	1	REGULAR	ACTIVE
4	29	4	REGULAR	ACTIVE
5	30	2	REGULAR	ACTIVE
6	30	5	REGULAR	ACTIVE
7	31	2	REGULAR	ACTIVE
8	31	5	REGULAR	ACTIVE
9	32	3	REGULAR	ACTIVE
10	32	6	REGULAR	ACTIVE
11	33	3	REGULAR	ACTIVE
12	33	6	REGULAR	ACTIVE
13	18	7	REGULAR	ACTIVE
14	18	10	REGULAR	ACTIVE
15	19	7	REGULAR	ACTIVE
16	19	10	REGULAR	ACTIVE
17	20	8	REGULAR	ACTIVE
18	20	11	REGULAR	ACTIVE
19	21	8	REGULAR	ACTIVE
20	21	11	REGULAR	ACTIVE
21	22	9	REGULAR	ACTIVE
22	22	12	REGULAR	ACTIVE
23	23	9	REGULAR	ACTIVE
24	23	12	REGULAR	ACTIVE
25	24	13	REGULAR	ACTIVE
26	25	13	REGULAR	ACTIVE
27	26	14	REGULAR	ACTIVE
28	27	14	REGULAR	ACTIVE
29	28	17	BACKLOG	ACTIVE
59	24	17	REGULAR	ACTIVE
60	24	14	REGULAR	ACTIVE
61	25	17	REGULAR	ACTIVE
62	25	14	REGULAR	ACTIVE
63	26	17	REGULAR	ACTIVE
64	26	13	REGULAR	ACTIVE
65	27	17	REGULAR	ACTIVE
66	27	13	REGULAR	ACTIVE
67	28	7	REGULAR	ACTIVE
68	28	8	REGULAR	ACTIVE
69	28	10	REGULAR	ACTIVE
\.


--
-- Data for Name: exam_papers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exam_papers (paper_id, enrollment_id, exam_id, pages, marks_json, total_score, evaluation_status) FROM stdin;
6	14	4	["media/papers/2205101_CS202/page1.jpg", "media/papers/2205101_CS202/page2.jpg", "media/papers/2205101_CS202/page3.jpg", "media/papers/2205101_CS202/page4.jpg", "media/papers/2205101_CS202/page5.jpg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}], "section_index": 1}], "template_version": 3, "generated_from_schema": true}	\N	PENDING
10	18	6	["media/papers/2205103_CS202/page1.jpg", "media/papers/2205103_CS202/page2.jpg", "media/papers/2205103_CS202/page3.jpg", "media/papers/2205103_CS202/page4.jpg", "media/papers/2205103_CS202/page5.jpg"]	\N	\N	PENDING
7	15	1	["media/papers/2205102_CS201/page1.jpg", "media/papers/2205102_CS201/page2.jpg", "media/papers/2205102_CS201/page3.jpg", "media/papers/2205102_CS201/page4.jpg", "media/papers/2205102_CS201/page5.jpg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}], "section_index": 1}], "template_version": 3, "generated_from_schema": true}	\N	PENDING
8	16	4	["media/papers/2205102_CS202/page1.jpg", "media/papers/2205102_CS202/page2.jpg", "media/papers/2205102_CS202/page3.jpg", "media/papers/2205102_CS202/page4.jpg", "media/papers/2205102_CS202/page5.jpg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}], "section_index": 1}], "template_version": 3, "generated_from_schema": true}	\N	PENDING
12	20	6	["media/papers/2205104_CS202/page1.jpg", "media/papers/2205104_CS202/page2.jpg", "media/papers/2205104_CS202/page3.jpg", "media/papers/2205104_CS202/page4.jpg", "media/papers/2205104_CS202/page5.jpg"]	\N	\N	PENDING
11	19	5	["media/papers/2205104_CS201/page1.jpg", "media/papers/2205104_CS201/page2.jpg", "media/papers/2205104_CS201/page3.jpg", "media/papers/2205104_CS201/page4.jpg", "media/papers/2205104_CS201/page5.jpg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}], "section_index": 1}], "template_version": 3, "generated_from_schema": true}	\N	PENDING
13	21	7	["media/papers/2205105_CS201/page1.jpg", "media/papers/2205105_CS201/page2.jpg", "media/papers/2205105_CS201/page3.jpg", "media/papers/2205105_CS201/page4.jpg", "media/papers/2205105_CS201/page5.jpg"]	\N	\N	PENDING
14	22	8	["media/papers/2205105_CS202/page1.jpg", "media/papers/2205105_CS202/page2.jpg", "media/papers/2205105_CS202/page3.jpg", "media/papers/2205105_CS202/page4.jpg", "media/papers/2205105_CS202/page5.jpg"]	\N	\N	PENDING
15	23	7	["media/papers/2205106_CS201/page1.jpg", "media/papers/2205106_CS201/page2.jpg", "media/papers/2205106_CS201/page3.jpg", "media/papers/2205106_CS201/page4.jpg", "media/papers/2205106_CS201/page5.jpg"]	\N	\N	PENDING
16	24	8	["media/papers/2205106_CS202/page1.jpg", "media/papers/2205106_CS202/page2.jpg", "media/papers/2205106_CS202/page3.jpg", "media/papers/2205106_CS202/page4.jpg", "media/papers/2205106_CS202/page5.jpg"]	\N	\N	PENDING
30	59	11	["media/papers/2207101_CS101/page1.jpg", "media/papers/2207101_CS101/page2.jpg", "media/papers/2207101_CS101/page3.jpg", "media/papers/2207101_CS101/page4.jpg", "media/papers/2207101_CS101/page5.jpg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}], "section_index": 1}, {"type": "OPTIONAL", "choose": 2, "questions": [{"q_no": 6, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 3, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 4, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 5, "awarded_marks": null, "expected_marks": 1.0}], "awarded_total": null, "expected_total": 5.0}, {"q_no": 7, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 2.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 2.0}, {"part_no": 3, "awarded_marks": null, "expected_marks": 1.0}], "awarded_total": null, "expected_total": 5.0}, {"q_no": 8, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 3.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 2.0}], "awarded_total": null, "expected_total": 5.0}], "section_index": 2}], "template_version": 3, "generated_from_schema": true}	\N	PENDING
17	25	9	["media/papers/2207101_ME301/page1.jpg", "media/papers/2207101_ME301/page2.jpg", "media/papers/2207101_ME301/page3.jpg", "media/papers/2207101_ME301/page4.jpg", "media/papers/2207101_ME301/page5.jpg"]	\N	\N	PENDING
31	60	10	["media/papers/2207101_ME301/page1.jpg", "media/papers/2207101_ME301/page2.jpg", "media/papers/2207101_ME301/page3.jpg", "media/papers/2207101_ME301/page4.jpg", "media/papers/2207101_ME301/page5.jpg"]	\N	\N	PENDING
18	26	9	["media/papers/2207102_ME301/page1.jpg", "media/papers/2207102_ME301/page2.jpg", "media/papers/2207102_ME301/page3.jpg", "media/papers/2207102_ME301/page4.jpg", "media/papers/2207102_ME301/page5.jpg"]	\N	\N	PENDING
33	62	10	["media/papers/2207102_ME301/page1.jpg", "media/papers/2207102_ME301/page2.jpg", "media/papers/2207102_ME301/page3.jpg", "media/papers/2207102_ME301/page4.jpg", "media/papers/2207102_ME301/page5.jpg"]	\N	\N	PENDING
19	27	10	["media/papers/2207103_ME301/page1.jpg", "media/papers/2207103_ME301/page2.jpg", "media/papers/2207103_ME301/page3.jpg", "media/papers/2207103_ME301/page4.jpg", "media/papers/2207103_ME301/page5.jpeg"]	\N	\N	PENDING
1	13	1	["media/papers/2205101_CS201/page1.jpeg", "media/papers/2205101_CS201/page2.jpg", "media/papers/2205101_CS201/page3.jpg", "media/papers/2205101_CS201/page4.jpg", "media/papers/2205101_CS201/page5.jpg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}], "section_index": 1}], "template_version": 3, "generated_from_schema": true}	\N	PENDING
9	17	5	["media/papers/2205103_CS201/page1.jpg", "media/papers/2205103_CS201/page2.jpg", "media/papers/2205103_CS201/page3.jpg", "media/papers/2205103_CS201/page4.jpg", "media/papers/2205103_CS201/page5.jpg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}], "section_index": 1}], "template_version": 3, "generated_from_schema": true}	\N	PENDING
35	64	9	["media/papers/2207103_ME301/page1.jpg", "media/papers/2207103_ME301/page2.jpg", "media/papers/2207103_ME301/page3.jpg", "media/papers/2207103_ME301/page4.jpg", "media/papers/2207103_ME301/page5.jpeg"]	\N	\N	PENDING
20	28	10	["media/papers/2207104_ME301/page1.jpg", "media/papers/2207104_ME301/page2.jpg", "media/papers/2207104_ME301/page3.jpeg", "media/papers/2207104_ME301/page4.jpeg", "media/papers/2207104_ME301/page5.jpeg"]	\N	\N	PENDING
37	66	9	["media/papers/2207104_ME301/page1.jpg", "media/papers/2207104_ME301/page2.jpg", "media/papers/2207104_ME301/page3.jpeg", "media/papers/2207104_ME301/page4.jpeg", "media/papers/2207104_ME301/page5.jpeg"]	\N	\N	PENDING
4	3	2	["media/papers/2305102_CS103/page1.jpeg", "media/papers/2305102_CS103/page2.jpeg", "media/papers/2305102_CS103/page3.jpeg", "media/papers/2305102_CS103/page4.jpeg", "media/papers/2305102_CS103/page5.jpeg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}], "section_index": 1}], "template_version": 3, "generated_from_schema": true}	\N	PENDING
32	61	11	["media/papers/2207102_CS101/page1.jpg", "media/papers/2207102_CS101/page2.jpg", "media/papers/2207102_CS101/page3.jpg", "media/papers/2207102_CS101/page4.jpeg", "media/papers/2207102_CS101/page5.jpeg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}], "section_index": 1}, {"type": "OPTIONAL", "choose": 2, "questions": [{"q_no": 6, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 3, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 4, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 5, "awarded_marks": null, "expected_marks": 1.0}], "awarded_total": null, "expected_total": 5.0}, {"q_no": 7, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 2.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 2.0}, {"part_no": 3, "awarded_marks": null, "expected_marks": 1.0}], "awarded_total": null, "expected_total": 5.0}, {"q_no": 8, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 3.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 2.0}], "awarded_total": null, "expected_total": 5.0}], "section_index": 2}], "template_version": 3, "generated_from_schema": true}	\N	PENDING
34	63	11	["media/papers/2207103_CS101/page1.jpg", "media/papers/2207103_CS101/page2.jpeg", "media/papers/2207103_CS101/page3.jpeg", "media/papers/2207103_CS101/page4.jpeg", "media/papers/2207103_CS101/page5.jpeg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}], "section_index": 1}, {"type": "OPTIONAL", "choose": 2, "questions": [{"q_no": 6, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 3, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 4, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 5, "awarded_marks": null, "expected_marks": 1.0}], "awarded_total": null, "expected_total": 5.0}, {"q_no": 7, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 2.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 2.0}, {"part_no": 3, "awarded_marks": null, "expected_marks": 1.0}], "awarded_total": null, "expected_total": 5.0}, {"q_no": 8, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 3.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 2.0}], "awarded_total": null, "expected_total": 5.0}], "section_index": 2}], "template_version": 3, "generated_from_schema": true}	\N	PENDING
5	4	3	["media/papers/2305102_CS104/page1.jpeg", "media/papers/2305102_CS104/page2.jpeg", "media/papers/2305102_CS104/page3.jpeg", "media/papers/2305102_CS104/page4.jpeg", "media/papers/2305102_CS104/page5.jpeg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}], "section_index": 1}], "template_version": 3, "generated_from_schema": true}	\N	PENDING
22	5	12	["media/papers/2305103_CS103/page1.jpeg", "media/papers/2305103_CS103/page2.jpeg", "media/papers/2305103_CS103/page3.jpeg", "media/papers/2305103_CS103/page4.jpeg", "media/papers/2305103_CS103/page5.jpeg"]	\N	\N	PENDING
23	6	13	["media/papers/2305103_CS104/page1.jpeg", "media/papers/2305103_CS104/page2.jpeg", "media/papers/2305103_CS104/page3.jpeg", "media/papers/2305103_CS104/page4.jpeg", "media/papers/2305103_CS104/page5.jpeg"]	\N	\N	PENDING
24	7	12	["media/papers/2305104_CS103/page1.jpeg", "media/papers/2305104_CS103/page2.jpeg", "media/papers/2305104_CS103/page3.jpeg", "media/papers/2305104_CS103/page4.jpeg", "media/papers/2305104_CS103/page5.jpeg"]	\N	\N	PENDING
25	8	13	["media/papers/2305104_CS104/page1.jpeg", "media/papers/2305104_CS104/page2.jpeg", "media/papers/2305104_CS104/page3.jpeg", "media/papers/2305104_CS104/page4.jpg", "media/papers/2305104_CS104/page5.jpg"]	\N	\N	PENDING
26	9	14	["media/papers/2305105_CS103/page1.jpeg", "media/papers/2305105_CS103/page2.jpeg", "media/papers/2305105_CS103/page3.jpeg", "media/papers/2305105_CS103/page4.jpeg", "media/papers/2305105_CS103/page5.jpeg"]	\N	\N	PENDING
27	10	15	["media/papers/2305105_CS104/page1.jpeg", "media/papers/2305105_CS104/page2.jpg", "media/papers/2305105_CS104/page3.jpg", "media/papers/2305105_CS104/page4.jpg", "media/papers/2305105_CS104/page5.jpg"]	\N	\N	PENDING
2	1	2	["media/papers/2305101_CS103/page1.jpeg", "media/papers/2305101_CS103/page2.jpeg", "media/papers/2305101_CS103/page3.jpeg", "media/papers/2305101_CS103/page4.jpeg", "media/papers/2305101_CS103/page5.jpeg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": 9.5, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 7.0, "expected_marks": 10.0}], "awarded_total": 16.5, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": 7.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 8.0, "expected_marks": 10.0}], "awarded_total": 15.0, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": 8.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 9.0, "expected_marks": 10.0}], "awarded_total": 17.0, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": 9.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 9.5, "expected_marks": 10.0}], "awarded_total": 18.5, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": 9.5, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 7.0, "expected_marks": 10.0}], "awarded_total": 16.5, "expected_total": 20.0}], "section_index": 1}], "template_version": 3, "generated_from_schema": true}	83.50	COMPLETED
28	11	14	["media/papers/2305106_CS103/page1.jpeg", "media/papers/2305106_CS103/page2.jpeg", "media/papers/2305106_CS103/page3.jpeg", "media/papers/2305106_CS103/page4.jpg", "media/papers/2305106_CS103/page5.jpg"]	\N	\N	PENDING
29	12	15	["media/papers/2305106_CS104/page1.jpg", "media/papers/2305106_CS104/page2.jpg", "media/papers/2305106_CS104/page3.jpg", "media/papers/2305106_CS104/page4.jpg", "media/papers/2305106_CS104/page5.jpg"]	\N	\N	PENDING
40	69	4	\N	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": 9.5, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 7.0, "expected_marks": 10.0}], "awarded_total": 16.5, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": 7.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 8.0, "expected_marks": 10.0}], "awarded_total": 15.0, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": 8.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 9.0, "expected_marks": 10.0}], "awarded_total": 17.0, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": 9.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 9.5, "expected_marks": 10.0}], "awarded_total": 18.5, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": 9.5, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 7.0, "expected_marks": 10.0}], "awarded_total": 16.5, "expected_total": 20.0}], "section_index": 1}], "template_version": 3, "generated_from_schema": true}	83.50	COMPLETED
3	2	3	["media/papers/2305101_CS104/page1.jpeg", "media/papers/2305101_CS104/page2.jpeg", "media/papers/2305101_CS104/page3.jpeg", "media/papers/2305101_CS104/page4.jpeg", "media/papers/2305101_CS104/page5.jpeg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": 9.5, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 7.0, "expected_marks": 10.0}], "awarded_total": 16.5, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": 7.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 8.0, "expected_marks": 10.0}], "awarded_total": 15.0, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": 8.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 9.0, "expected_marks": 10.0}], "awarded_total": 17.0, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": 9.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 9.5, "expected_marks": 10.0}], "awarded_total": 18.5, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": 9.5, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 7.0, "expected_marks": 10.0}], "awarded_total": 16.5, "expected_total": 20.0}], "section_index": 1}], "template_version": 3, "generated_from_schema": true}	83.50	COMPLETED
39	68	5	\N	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": 9.5, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 7.0, "expected_marks": 10.0}], "awarded_total": 16.5, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": 7.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 8.0, "expected_marks": 10.0}], "awarded_total": 15.0, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": 8.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 9.0, "expected_marks": 10.0}], "awarded_total": 17.0, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": 9.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 9.5, "expected_marks": 10.0}], "awarded_total": 18.5, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": 9.5, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 7.0, "expected_marks": 10.0}], "awarded_total": 16.5, "expected_total": 20.0}], "section_index": 1}], "template_version": 3, "generated_from_schema": true}	83.50	COMPLETED
38	67	1	\N	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": 9.5, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 7.0, "expected_marks": 10.0}], "awarded_total": 16.5, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": 7.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 8.0, "expected_marks": 10.0}], "awarded_total": 15.0, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": 8.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 9.0, "expected_marks": 10.0}], "awarded_total": 17.0, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": 9.0, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 9.5, "expected_marks": 10.0}], "awarded_total": 18.5, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": 9.5, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": 7.0, "expected_marks": 10.0}], "awarded_total": 16.5, "expected_total": 20.0}], "section_index": 1}], "template_version": 3, "generated_from_schema": true}	83.50	COMPLETED
36	65	11	["media/papers/2207104_CS101/page1.jpeg", "media/papers/2207104_CS101/page2.jpeg", "media/papers/2207104_CS101/page3.jpeg", "media/papers/2207104_CS101/page4.jpeg", "media/papers/2207104_CS101/page5.jpeg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}], "section_index": 1}, {"type": "OPTIONAL", "choose": 2, "questions": [{"q_no": 6, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 3, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 4, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 5, "awarded_marks": null, "expected_marks": 1.0}], "awarded_total": null, "expected_total": 5.0}, {"q_no": 7, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 2.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 2.0}, {"part_no": 3, "awarded_marks": null, "expected_marks": 1.0}], "awarded_total": null, "expected_total": 5.0}, {"q_no": 8, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 3.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 2.0}], "awarded_total": null, "expected_total": 5.0}], "section_index": 2}], "template_version": 3, "generated_from_schema": true}	\N	PENDING
21	29	11	["media/papers/2305101_CS101/page1.jpg", "media/papers/2305101_CS101/page2.jpg", "media/papers/2305101_CS101/page3.jpg", "media/papers/2305101_CS101/page4.jpeg", "media/papers/2305101_CS101/page5.jpeg"]	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 2, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 3, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 4, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}, {"q_no": 5, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 10.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 10.0}], "awarded_total": null, "expected_total": 20.0}], "section_index": 1}, {"type": "OPTIONAL", "choose": 2, "questions": [{"q_no": 6, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 3, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 4, "awarded_marks": null, "expected_marks": 1.0}, {"part_no": 5, "awarded_marks": null, "expected_marks": 1.0}], "awarded_total": null, "expected_total": 5.0}, {"q_no": 7, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 2.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 2.0}, {"part_no": 3, "awarded_marks": null, "expected_marks": 1.0}], "awarded_total": null, "expected_total": 5.0}, {"q_no": 8, "parts": [{"part_no": 1, "awarded_marks": null, "expected_marks": 3.0}, {"part_no": 2, "awarded_marks": null, "expected_marks": 2.0}], "awarded_total": null, "expected_total": 5.0}], "section_index": 2}], "template_version": 3, "generated_from_schema": true}	\N	PENDING
\.


--
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.exams (exam_id, allocation_id, exam_type, total_marks, passing_marks, question_paper_schema, question_paper_path, answer_key_path, is_active, created_at) FROM stdin;
2	1	MIDSEM	100	40	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [10.0, 10.0]}, {"q_no": 2, "parts": [10.0, 10.0]}, {"q_no": 3, "parts": [10.0, 10.0]}, {"q_no": 4, "parts": [10.0, 10.0]}, {"q_no": 5, "parts": [10.0, 10.0]}]}]}	media/exam_docs/Exam12_CS103_QP.pdf	media/exam_docs/Exam12_CS103_AK.pdf	t	2026-03-14 07:57:25.130633+00
12	2	MIDSEM	100	40	\N	media/exam_docs/Exam5_CS201_QP.pdf	media/exam_docs/Exam5_CS201_AK.pdf	t	2026-03-14 09:04:18.792911+00
14	3	MIDSEM	100	40	\N	media/exam_docs/Exam7_CS201_QP.pdf	media/exam_docs/Exam7_CS201_AK.pdf	t	2026-03-14 09:04:18.887372+00
3	4	MIDSEM	100	40	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [10.0, 10.0]}, {"q_no": 2, "parts": [10.0, 10.0]}, {"q_no": 3, "parts": [10.0, 10.0]}, {"q_no": 4, "parts": [10.0, 10.0]}, {"q_no": 5, "parts": [10.0, 10.0]}]}]}	media/exam_docs/Exam13_CS104_QP.pdf	media/exam_docs/Exam13_CS104_AK.pdf	t	2026-03-14 07:57:25.148736+00
13	5	MIDSEM	100	40	\N	media/exam_docs/Exam6_CS202_QP.pdf	media/exam_docs/Exam6_CS202_AK.pdf	t	2026-03-14 09:04:18.815721+00
15	6	MIDSEM	100	40	\N	media/exam_docs/Exam8_CS202_QP.pdf	media/exam_docs/Exam8_CS202_AK.pdf	t	2026-03-14 09:04:18.92229+00
1	7	MIDSEM	100	40	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [10.0, 10.0]}, {"q_no": 2, "parts": [10.0, 10.0]}, {"q_no": 3, "parts": [10.0, 10.0]}, {"q_no": 4, "parts": [10.0, 10.0]}, {"q_no": 5, "parts": [10.0, 10.0]}]}]}	media/exam_docs/Exam11_CS101_QP.pdf	media/exam_docs/Exam11_CS101_AK.pdf	t	2026-03-14 07:57:25.107185+00
7	9	MIDSEM	100	40	\N	media/exam_docs/Exam2_CS103_QP.pdf	media/exam_docs/Exam2_CS103_AK.pdf	t	2026-03-14 09:04:18.431161+00
6	11	MIDSEM	100	40	\N	media/exam_docs/Exam1_CS201_QP.pdf	media/exam_docs/Exam1_CS201_AK.pdf	t	2026-03-14 09:04:18.33922+00
8	12	MIDSEM	100	40	\N	media/exam_docs/Exam3_CS104_QP.pdf	media/exam_docs/Exam3_CS104_AK.pdf	t	2026-03-14 09:04:18.46826+00
5	8	MIDSEM	100	40	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [10.0, 10.0]}, {"q_no": 2, "parts": [10.0, 10.0]}, {"q_no": 3, "parts": [10.0, 10.0]}, {"q_no": 4, "parts": [10.0, 10.0]}, {"q_no": 5, "parts": [10.0, 10.0]}]}]}	media/exam_docs/Exam15_CS104_QP.pdf	media/exam_docs/Exam15_CS104_AK.pdf	t	2026-03-14 09:04:18.31347+00
4	10	MIDSEM	100	40	{"sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [10.0, 10.0]}, {"q_no": 2, "parts": [10.0, 10.0]}, {"q_no": 3, "parts": [10.0, 10.0]}, {"q_no": 4, "parts": [10.0, 10.0]}, {"q_no": 5, "parts": [10.0, 10.0]}]}]}	media/exam_docs/Exam14_CS103_QP.pdf	media/exam_docs/Exam14_CS103_AK.pdf	t	2026-03-14 09:04:18.225134+00
9	13	MIDSEM	100	40	\N	media/exam_docs/Exam4_CS104_QP.pdf	media/exam_docs/Exam4_CS104_AK.pdf	t	2026-03-14 09:04:18.553002+00
10	14	MIDSEM	100	40	\N	media/exam_docs/Exam4_CS202_QP.pdf	media/exam_docs/Exam4_CS202_AK.pdf	t	2026-03-14 09:04:18.615058+00
11	17	MIDSEM	100	40	{"version": 2, "sections": [{"type": "COMPULSORY", "choose": null, "questions": [{"q_no": 1, "parts": [10, 10]}, {"q_no": 2, "parts": [10, 10]}, {"q_no": 3, "parts": [10, 10]}, {"q_no": 4, "parts": [10, 10]}, {"q_no": 5, "parts": [10, 10]}]}, {"type": "OPTIONAL", "choose": 2, "questions": [{"q_no": 6, "parts": [1, 1, 1, 1, 1]}, {"q_no": 7, "parts": [2, 2, 1]}, {"q_no": 8, "parts": [3, 2]}]}]}	media/exam_docs/Exam5_CS104_QP.pdf	media/exam_docs/Exam5_CS104_AK.pdf	t	2026-03-14 09:04:18.674604+00
\.


--
-- Data for Name: grievances; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.grievances (id, paper_id, student_comment, assigned_coordinator, status) FROM stdin;
\.


--
-- Data for Name: schools; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.schools (school_id, name, code) FROM stdin;
1	School of Civil Engineering	SCE
2	School of Computer Engineering	SCS
3	School of Electrical Engineering	SEE
4	School of Mechanical Engineering	SME
5	School of Sciences	SOS
6	School of Law	SOL
7	School of Management	SOM
10	School of CSE	CSE
11	School of ECE	ECE
12	School of MECH	MECH
\.


--
-- Data for Name: streams; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.streams (stream_id, school_id, name, degree_type) FROM stdin;
1	1	Civil Engineering	B.Tech
2	1	Structural Engineering	M.Tech
3	2	Computer Science & Engineering	B.Tech
4	2	Systems Engineering	B.Tech
5	2	Information Security	M.Tech
6	3	Electrical Engineering	B.Tech
7	3	Power Systems	M.Tech
8	4	Mechanical Engineering	B.Tech
9	5	Mathematics	M.Sc
10	5	Physics	M.Sc
11	6	Law	B.A.LL.B
12	7	Management	MBA
13	10	Computer Science	B.Tech
14	11	Electronics & Comm.	B.Tech
\.


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.students (user_id, stream_id, current_semester, section_name, batch) FROM stdin;
4	13	1	A	2021-2025
5	13	1	A	2021-2025
6	13	1	A	2021-2025
7	13	1	B	2021-2025
8	13	1	B	2021-2025
9	13	1	B	2021-2025
10	13	1	C	2021-2025
11	13	1	C	2021-2025
12	13	1	C	2021-2025
13	13	1	D	2021-2025
14	14	1	A	2021-2025
15	14	1	A	2021-2025
16	14	1	B	2021-2025
17	14	1	B	2021-2025
18	13	1	A	2022-2026
19	13	1	A	2022-2026
20	13	1	B	2022-2026
21	13	1	B	2022-2026
22	13	1	C	2022-2026
23	13	1	C	2022-2026
24	8	1	A	2022-2026
25	8	1	A	2022-2026
26	8	1	B	2022-2026
27	8	1	B	2022-2026
28	13	1	A	2023-2027
29	13	1	A	2023-2027
30	13	1	B	2023-2027
31	13	1	B	2023-2027
32	13	1	C	2023-2027
33	13	1	C	2023-2027
34	13	1	C	2023-2027
35	14	1	C	2023-2027
36	8	1	C	2023-2027
37	8	1	C	2023-2027
38	13	1	C	2023-2027
\.


--
-- Data for Name: teachers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.teachers (user_id, school_id, specialization) FROM stdin;
39	10	Machine Learning
40	10	Data Analytics
41	11	VLSI
42	10	Algorithms
43	12	Thermodynamics
44	10	Software Engineering
45	11	Embedded Systems
46	12	Fluid Dynamics
47	10	Artificial Intelligence
48	11	Signal Processing
49	10	High Performance Computing
\.


--
-- Data for Name: token_blacklist_blacklistedtoken; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.token_blacklist_blacklistedtoken (id, blacklisted_at, token_id) FROM stdin;
1	2026-03-14 08:53:34.36862+00	1
2	2026-03-14 09:38:05.82151+00	3
3	2026-03-14 09:39:18.164141+00	4
4	2026-03-14 09:39:41.014669+00	5
5	2026-03-14 09:42:57.497936+00	6
6	2026-03-14 11:04:05.863461+00	11
\.


--
-- Data for Name: token_blacklist_outstandingtoken; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.token_blacklist_outstandingtoken (id, token, created_at, expires_at, user_id, jti) FROM stdin;
1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MzU2NDcxMywiaWF0IjoxNzczNDc4MzEzLCJqdGkiOiJjN2RjZGVhNGQzZjg0NGE5ODVjYzhiYTczYzc0YzM4MSIsInVzZXJfaWQiOiIyOCJ9.iTGW2GWEDCgy133kgVYuJblLmtopB9jXXZi3-nSHXCE	2026-03-14 08:51:53.931497+00	2026-03-15 08:51:53+00	28	c7dcdea4d3f844a985cc8ba73c74c381
2	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MzU2NDg0NywiaWF0IjoxNzczNDc4NDQ3LCJqdGkiOiI0NTc2MDFkOTFmMWI0ODcwODAzMzMxNGQwMDlkODZlNiIsInVzZXJfaWQiOiI0OSJ9.ibLYRqDp-exAN1uFnkYSpJRfVfgiA1EER7Cgse1QV8k	2026-03-14 08:54:07.586701+00	2026-03-15 08:54:07+00	49	457601d91f1b48708033314d009d86e6
3	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MzU2NzQ2MywiaWF0IjoxNzczNDgxMDYzLCJqdGkiOiIzMTYwYTM2OGUzZjY0MzAyYWE3MDM2ZTM1OTBmMzY0OSIsInVzZXJfaWQiOiIyOCJ9.cpudWZnsUe2nqRJWsxG-zak9mz7RPFNEL_Dg_O2M_Ls	2026-03-14 09:37:43.762386+00	2026-03-15 09:37:43+00	28	3160a368e3f64302aa7036e3590f3649
4	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MzU2NzQ5MSwiaWF0IjoxNzczNDgxMDkxLCJqdGkiOiJiYWNmYzA2ZjE1MWM0NGE2YWQ3YzViMjkyN2MwM2JmNCIsInVzZXJfaWQiOiI0MiJ9.mHvq3GYeLZOxFnvCpGeQyhrEBSIzp1ZGxA5xJdKqGgk	2026-03-14 09:38:11.102145+00	2026-03-15 09:38:11+00	42	bacfc06f151c44a6ad7c5b2927c03bf4
5	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MzU2NzU2NiwiaWF0IjoxNzczNDgxMTY2LCJqdGkiOiJhNjhhMmVkY2IxZDM0ODQzYTU3YjMxZTdmMDM3ZDc0NCIsInVzZXJfaWQiOiIyOCJ9.Nkl6RpHfUURE2dfOE5J7wh49jJ7nMjGxH23emQi8Yqk	2026-03-14 09:39:26.866818+00	2026-03-15 09:39:26+00	28	a68a2edcb1d34843a57b31e7f037d744
6	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MzU2NzU4NSwiaWF0IjoxNzczNDgxMTg1LCJqdGkiOiJhODNjM2MxNmNjYzM0YjE4OWNlZGJmMTIyYTYzNzViMSIsInVzZXJfaWQiOiI0MiJ9.9rRCZrqOW_hLr3BHX5ZNFl7cYZ2-499i9vbA8I_pd20	2026-03-14 09:39:45.180411+00	2026-03-15 09:39:45+00	42	a83c3c16ccc34b189cedbf122a6375b1
7	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MzU2Nzc4NCwiaWF0IjoxNzczNDgxMzg0LCJqdGkiOiI3MGFiZmFlOTA5MzY0ZjNjOGM5ZDdjNTI3NjY0OGM5MCIsInVzZXJfaWQiOiIyOCJ9.DsJTE0ni4Rhux2GnBpI-RS_dZKrsaPl9AkFdbbXwjo0	2026-03-14 09:43:04.932402+00	2026-03-15 09:43:04+00	28	70abfae909364f3c8c9d7c5276648c90
8	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MzU2ODk0MCwiaWF0IjoxNzczNDgyNTQwLCJqdGkiOiI5N2VjMzViMWIxM2I0Mzg1YmUxMTA2ZjlhMmY1YzE0YSIsInVzZXJfaWQiOiIyOCJ9.BVgjOlniRrdfnNYae8OBnHIS6MFcroQ9-T66KCfuGqs	2026-03-14 10:02:20.02107+00	2026-03-15 10:02:20+00	28	97ec35b1b13b4385be1106f9a2f5c14a
9	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MzU2OTQyOCwiaWF0IjoxNzczNDgzMDI4LCJqdGkiOiI0ZGFkMWYxZTc3NzI0ZmQ2ODkyODc0NWQwOTlhNWQxZiIsInVzZXJfaWQiOiI0MiJ9.aeDgPg0qIIoUwhVmHfOJswOSG4Ou5XYyUjIe_09JUu0	2026-03-14 10:10:28.184791+00	2026-03-15 10:10:28+00	42	4dad1f1e77724fd68928745d099a5d1f
10	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MzU3MjQ5MiwiaWF0IjoxNzczNDg2MDkyLCJqdGkiOiI5ODhiMmMzNjY5ZjI0OGU0ODIyODk2OTYzZGI5N2NkYSIsInVzZXJfaWQiOiI0MiJ9.08ijQ49tQVWrKrAj_FdMqPIvByTX4mTkdW-VXMgSRs8	2026-03-14 11:01:32.432052+00	2026-03-15 11:01:32+00	42	988b2c3669f248e4822896963db97cda
11	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MzU3MjU2NywiaWF0IjoxNzczNDg2MTY3LCJqdGkiOiJmMjk3OWEyMjhmYjE0OWNhOGY4MDUxZjYyNzljYWU4OCIsInVzZXJfaWQiOiIyOCJ9.1vpeEJ768Fl2nB3dsz9l_vaJI7yN1ScTNs1Fquxk9VE	2026-03-14 11:02:47.776923+00	2026-03-15 11:02:47+00	28	f2979a228fb149ca8f8051f6279cae88
12	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MzU3MjY1MywiaWF0IjoxNzczNDg2MjUzLCJqdGkiOiI2NmIyNTcxY2E1YWU0ZjdjOWRhOWU3ZjQ1YWRhYWNmNCIsInVzZXJfaWQiOiI0MiJ9.zAFcSar4FSq9BngANvdH0SIupw65uP3G610aC5QOf4s	2026-03-14 11:04:13.541646+00	2026-03-15 11:04:13+00	42	66b2571ca5ae4f7c9da9e7f45adaacf4
13	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoicmVmcmVzaCIsImV4cCI6MTc3MzU3MzMyNCwiaWF0IjoxNzczNDg2OTI0LCJqdGkiOiIzNGM0M2UxMGE4NDQ0MDcyOTM3YjU4MGI4NzgxNDVmNCIsInVzZXJfaWQiOiI0MiJ9.lNNV5Kng15QQtfSYK_7gIDgoyPQT4oV_9cwyomLHVPg	2026-03-14 11:15:24.712715+00	2026-03-15 11:15:24+00	42	34c43e10a8444072937b580b878145f4
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, university_id, full_name, email, role, created_at, password, last_login, is_superuser, is_active, is_staff, is_verified, date_joined) FROM stdin;
4	2105101	Aarav Sharma	2105101@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
5	2105102	Vivaan Gupta	2105102@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
6	2105103	Aditya Singh	2105103@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
7	2105104	Vihaan Kumar	2105104@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
8	2105105	Arjun Patel	2105105@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
9	2105106	Sai Redd	2105106@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
10	2105107	Reyansh Das	2105107@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
11	2105108	Ayaan Joshi	2105108@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
12	2105109	Krishna Mehta	2105109@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
13	2105110	Ishaan Malhotra	2105110@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
14	2106101	Sarthak Roy	2106101@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
15	2106102	Kabir Verma	2106102@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
16	2106103	Rohan Nair	2106103@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
17	2106104	Atharv Menon	2106104@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
20	2205103	Ananya Shetty	2205103@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
21	2205104	Aadhya Pillai	2205104@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
22	2205105	Kiara Rao	2205105@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
23	2205106	Pari Choudhury	2205106@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
24	2207101	Dhruv Saxena	2207101@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
25	2207102	Aarush Tiwari	2207102@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
26	2207103	Ryan Bhat	2207103@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
27	2207104	Om Deshmukh	2207104@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
29	2305102	Sana Khan	2305102@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
30	2305103	Riya Jain	2305103@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
31	2305104	Meera Agarwal	2305104@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
32	2305105	Isha Bose	2305105@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
33	2305106	Sara Mishra	2305106@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
34	23051626	Sunny Deol	23051626@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
35	2305741	Anushka Sharma	2305741@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
36	23051587	Kabir Singh	23051587@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
37	23051883	Prisha Nair	23051883@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
38	23052198	Priyanka Chopra	23052198@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
1	0000	System Admin	admin@kiit.ac.in	TEACHER	2026-03-14 07:50:16.760563	pbkdf2_sha256$1000000$UDH3DsN5sv9eprRdqpmLxC$AmjA7l1GrwC93fyCcYvf/wDC0twR0ly3yn+sIReRw0M=	2026-03-14 08:00:33.510369+00	t	t	t	f	2026-03-14 07:50:16.475127+00
19	2205102	Diya Iyer	2205102@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$Fk8QfYtqVhdSDcbHna8rfP$S1a/xe1GWP57Y9w9XrSW4mif2cp6Sw4QBJYZzghsV9M=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
18	2205101	Myra Kaur	2205101@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$6oim9iXu1gLKKs1OoYEpa0$rOFioooPWRNJSfeBfxRMaPJPPA0E/noNbEyaW77sFz0=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
28	2305101	Zara Kapoor	2305101@kiit.ac.in	STUDENT	2026-03-14 07:50:22.080099	pbkdf2_sha256$1000000$hCnZpADHkluUIEsMCEZY2e$n+x1geqvRz1TweAhcug3kcFotRtwWPXv8BK1oZvkBGM=	\N	f	t	f	f	2026-03-14 07:50:22.080099+00
39	T001	Dr. Amit Kumar	amit.kumar@example.com	TEACHER	2026-03-14 07:57:03.287328	pbkdf2_sha256$1000000$umNxe4GH7R2OZl2ggvA0K3$OK1pxvhGf6APbGNWfjvqrF72e4hqhUf2YM+P6Ta/cHA=	\N	f	t	f	f	2026-03-14 07:57:03.287328+00
40	T002	Prof. Sneha Das	sneha.das@example.com	TEACHER	2026-03-14 07:57:03.287328	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:57:03.287328+00
41	T003	Prof. Rajeev Singh	rajeev.singh@example.com	TEACHER	2026-03-14 07:57:03.287328	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:57:03.287328+00
42	T004	Dr. Kavita Mishra	kavita.mishra@example.com	TEACHER	2026-03-14 07:57:03.287328	pbkdf2_sha256$1000000$zB28My82IhT6gxZI3Hl4d0$HrVAambv5TfSj5SP8DcKKDv0PCfo6WyRh6fOsEbQpPg=	\N	f	t	f	f	2026-03-14 07:57:03.287328+00
43	T005	Mr. Vikram Joshi	vikram.joshi@example.com	TEACHER	2026-03-14 07:57:03.287328	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:57:03.287328+00
44	T006	Ms. Neha Sharma	neha.sharma@example.com	TEACHER	2026-03-14 07:57:03.287328	pbkdf2_sha256$1000000$TWSfZrJVJS8fVauY5NBMnk$qNOuKs/VBCYFzTo2WURoDGoiaq57AWJMWP9C5+b0qUI=	\N	f	t	f	f	2026-03-14 07:57:03.287328+00
45	T007	Dr. Rahul Gupta	rahul.gupta@example.com	TEACHER	2026-03-14 07:57:03.287328	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:57:03.287328+00
46	T008	Prof. Anil Mehta	anil.mehta@example.com	TEACHER	2026-03-14 07:57:03.287328	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:57:03.287328+00
47	T009	Mrs. Seema Verma	seema.verma@example.com	TEACHER	2026-03-14 07:57:03.287328	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:57:03.287328+00
48	T010	Mr. Sandeep Roy	sandeep.roy@example.com	TEACHER	2026-03-14 07:57:03.287328	pbkdf2_sha256$1000000$F2ZYe8DOhCY2xT52eSi8N7$bEdFTJpdDqv91LnqcajOHSK2mN9ztMsdOjFI5ELMXco=	\N	f	t	f	f	2026-03-14 07:57:03.287328+00
49	T011	Abhaya Sahoo	abhaya.sahoofcs@kiit.ac.in	TEACHER	2026-03-14 07:57:03.287328	pbkdf2_sha256$1000000$ZQx0f0DSy3sLuIuahqC5wq$duCMwxyDeDL9G9ui7wSJ5TTwyfhl5BGA/Vq0JgN52zA=	\N	f	t	f	f	2026-03-14 07:57:03.287328+00
\.


--
-- Name: academic_sessions_session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.academic_sessions_session_id_seq', 1, true);


--
-- Name: auth_group_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.auth_group_id_seq', 1, false);


--
-- Name: auth_group_permissions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.auth_group_permissions_id_seq', 1, false);


--
-- Name: auth_permission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.auth_permission_id_seq', 80, true);


--
-- Name: course_allocations_allocation_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.course_allocations_allocation_id_seq', 17, true);


--
-- Name: django_admin_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.django_admin_log_id_seq', 5, true);


--
-- Name: django_content_type_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.django_content_type_id_seq', 20, true);


--
-- Name: django_migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.django_migrations_id_seq', 31, true);


--
-- Name: enrollments_enrollment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.enrollments_enrollment_id_seq', 127, true);


--
-- Name: exam_papers_paper_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exam_papers_paper_id_seq', 40, true);


--
-- Name: exams_exam_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exams_exam_id_seq', 15, true);


--
-- Name: grievances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.grievances_id_seq', 1, false);


--
-- Name: schools_school_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.schools_school_id_seq', 12, true);


--
-- Name: streams_stream_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.streams_stream_id_seq', 14, true);


--
-- Name: token_blacklist_blacklistedtoken_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.token_blacklist_blacklistedtoken_id_seq', 6, true);


--
-- Name: token_blacklist_outstandingtoken_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.token_blacklist_outstandingtoken_id_seq', 13, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 82, true);


--
-- Name: academic_sessions academic_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.academic_sessions
    ADD CONSTRAINT academic_sessions_pkey PRIMARY KEY (session_id);


--
-- Name: auth_group auth_group_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group
    ADD CONSTRAINT auth_group_name_key UNIQUE (name);


--
-- Name: auth_group_permissions auth_group_permissions_group_id_permission_id_0cd325b0_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_group_id_permission_id_0cd325b0_uniq UNIQUE (group_id, permission_id);


--
-- Name: auth_group_permissions auth_group_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_pkey PRIMARY KEY (id);


--
-- Name: auth_group auth_group_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group
    ADD CONSTRAINT auth_group_pkey PRIMARY KEY (id);


--
-- Name: auth_permission auth_permission_content_type_id_codename_01ab375a_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_content_type_id_codename_01ab375a_uniq UNIQUE (content_type_id, codename);


--
-- Name: auth_permission auth_permission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_pkey PRIMARY KEY (id);


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
-- Name: django_admin_log django_admin_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_pkey PRIMARY KEY (id);


--
-- Name: django_content_type django_content_type_app_label_model_76bd3d3b_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_content_type
    ADD CONSTRAINT django_content_type_app_label_model_76bd3d3b_uniq UNIQUE (app_label, model);


--
-- Name: django_content_type django_content_type_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_content_type
    ADD CONSTRAINT django_content_type_pkey PRIMARY KEY (id);


--
-- Name: django_migrations django_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_migrations
    ADD CONSTRAINT django_migrations_pkey PRIMARY KEY (id);


--
-- Name: django_session django_session_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_session
    ADD CONSTRAINT django_session_pkey PRIMARY KEY (session_key);


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
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (exam_id);


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
-- Name: token_blacklist_blacklistedtoken token_blacklist_blacklistedtoken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_blacklistedtoken
    ADD CONSTRAINT token_blacklist_blacklistedtoken_pkey PRIMARY KEY (id);


--
-- Name: token_blacklist_blacklistedtoken token_blacklist_blacklistedtoken_token_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_blacklistedtoken
    ADD CONSTRAINT token_blacklist_blacklistedtoken_token_id_key UNIQUE (token_id);


--
-- Name: token_blacklist_outstandingtoken token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_uniq; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_outstandingtoken
    ADD CONSTRAINT token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_uniq UNIQUE (jti);


--
-- Name: token_blacklist_outstandingtoken token_blacklist_outstandingtoken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_outstandingtoken
    ADD CONSTRAINT token_blacklist_outstandingtoken_pkey PRIMARY KEY (id);


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
-- Name: auth_group_name_a6ea08ec_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_group_name_a6ea08ec_like ON public.auth_group USING btree (name varchar_pattern_ops);


--
-- Name: auth_group_permissions_group_id_b120cbf9; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_group_permissions_group_id_b120cbf9 ON public.auth_group_permissions USING btree (group_id);


--
-- Name: auth_group_permissions_permission_id_84c5c92e; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_group_permissions_permission_id_84c5c92e ON public.auth_group_permissions USING btree (permission_id);


--
-- Name: auth_permission_content_type_id_2f476e4b; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_permission_content_type_id_2f476e4b ON public.auth_permission USING btree (content_type_id);


--
-- Name: django_admin_log_content_type_id_c4bce8eb; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX django_admin_log_content_type_id_c4bce8eb ON public.django_admin_log USING btree (content_type_id);


--
-- Name: django_admin_log_user_id_c564eba6; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX django_admin_log_user_id_c564eba6 ON public.django_admin_log USING btree (user_id);


--
-- Name: django_session_expire_date_a5c62663; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX django_session_expire_date_a5c62663 ON public.django_session USING btree (expire_date);


--
-- Name: django_session_session_key_c0390e0f_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX django_session_session_key_c0390e0f_like ON public.django_session USING btree (session_key varchar_pattern_ops);


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
-- Name: token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_like; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX token_blacklist_outstandingtoken_jti_hex_d9bdf6f7_like ON public.token_blacklist_outstandingtoken USING btree (jti varchar_pattern_ops);


--
-- Name: token_blacklist_outstandingtoken_user_id_83bc629a; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX token_blacklist_outstandingtoken_user_id_83bc629a ON public.token_blacklist_outstandingtoken USING btree (user_id);


--
-- Name: auth_group_permissions auth_group_permissio_permission_id_84c5c92e_fk_auth_perm; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissio_permission_id_84c5c92e_fk_auth_perm FOREIGN KEY (permission_id) REFERENCES public.auth_permission(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: auth_group_permissions auth_group_permissions_group_id_b120cbf9_fk_auth_group_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_group_permissions
    ADD CONSTRAINT auth_group_permissions_group_id_b120cbf9_fk_auth_group_id FOREIGN KEY (group_id) REFERENCES public.auth_group(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: auth_permission auth_permission_content_type_id_2f476e4b_fk_django_co; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_permission
    ADD CONSTRAINT auth_permission_content_type_id_2f476e4b_fk_django_co FOREIGN KEY (content_type_id) REFERENCES public.django_content_type(id) DEFERRABLE INITIALLY DEFERRED;


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
-- Name: django_admin_log django_admin_log_content_type_id_c4bce8eb_fk_django_co; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_content_type_id_c4bce8eb_fk_django_co FOREIGN KEY (content_type_id) REFERENCES public.django_content_type(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: django_admin_log django_admin_log_user_id_c564eba6_fk_users_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.django_admin_log
    ADD CONSTRAINT django_admin_log_user_id_c564eba6_fk_users_id FOREIGN KEY (user_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;


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
-- Name: exam_papers exam_papers_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_papers
    ADD CONSTRAINT exam_papers_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id);


--
-- Name: exams exams_allocation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_allocation_id_fkey FOREIGN KEY (allocation_id) REFERENCES public.course_allocations(allocation_id);


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
-- Name: token_blacklist_blacklistedtoken token_blacklist_blacklistedtoken_token_id_3cc7fe56_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_blacklistedtoken
    ADD CONSTRAINT token_blacklist_blacklistedtoken_token_id_3cc7fe56_fk FOREIGN KEY (token_id) REFERENCES public.token_blacklist_outstandingtoken(id) DEFERRABLE INITIALLY DEFERRED;


--
-- Name: token_blacklist_outstandingtoken token_blacklist_outstandingtoken_user_id_83bc629a_fk_users_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_blacklist_outstandingtoken
    ADD CONSTRAINT token_blacklist_outstandingtoken_user_id_83bc629a_fk_users_id FOREIGN KEY (user_id) REFERENCES public.users(id) DEFERRABLE INITIALLY DEFERRED;


--
-- PostgreSQL database dump complete
--

\unrestrict 1T6fuNLgDHLCbe2Esdt1zHty55bfvlhj4788CUGXRIY07LgUYMCjgWAID8WRyOx

