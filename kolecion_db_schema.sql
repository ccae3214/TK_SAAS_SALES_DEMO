--
-- PostgreSQL database dump
--

\restrict l8NmjHU4ImXS3zQ8fg7OhF9ldEOziWIWihugfxKu4xUBi1Gaz9wKBqe4Ek3eZIg

-- Dumped from database version 16.16
-- Dumped by pg_dump version 16.16

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

--
-- Name: hr_sync_member_active_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hr_sync_member_active_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.active IS DISTINCT FROM OLD.active THEN
        IF NEW.worker_id IS NOT NULL THEN
          UPDATE hr_workers
            SET status = CASE WHEN NEW.active THEN 'active' ELSE 'inactive' END, updated_at = NOW()
            WHERE id = NEW.worker_id
              AND status <> CASE WHEN NEW.active THEN 'active' ELSE 'inactive' END;
        END IF;
        IF NEW.employer_id IS NOT NULL THEN
          UPDATE hr_employers
            SET status = CASE WHEN NEW.active THEN 'active' ELSE 'inactive' END, updated_at = NOW()
            WHERE id = NEW.employer_id
              AND status <> CASE WHEN NEW.active THEN 'active' ELSE 'inactive' END;
        END IF;
      END IF;
      RETURN NULL;
    END;
    $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: hr_admin_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_admin_audit_log (
    id bigint NOT NULL,
    actor_member_id bigint,
    actor_name text NOT NULL,
    actor_email text DEFAULT ''::text NOT NULL,
    action text NOT NULL,
    target_type text DEFAULT ''::text NOT NULL,
    target_id bigint,
    target_name text DEFAULT ''::text NOT NULL,
    summary text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_admin_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_admin_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_admin_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_admin_audit_log_id_seq OWNED BY public.hr_admin_audit_log.id;


--
-- Name: hr_agencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_agencies (
    id bigint NOT NULL,
    name text NOT NULL,
    agency_type text NOT NULL,
    country text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_agencies_agency_type_check CHECK ((agency_type = ANY (ARRAY['taiwan'::text, 'philippines'::text])))
);


--
-- Name: hr_agencies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_agencies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_agencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_agencies_id_seq OWNED BY public.hr_agencies.id;


--
-- Name: hr_agency_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_agency_audit_log (
    id bigint NOT NULL,
    agency_id bigint NOT NULL,
    agency_name text DEFAULT ''::text NOT NULL,
    actor_member_id bigint,
    actor_name text NOT NULL,
    actor_email text DEFAULT ''::text NOT NULL,
    actor_is_admin boolean DEFAULT false NOT NULL,
    action text NOT NULL,
    target_type text DEFAULT ''::text NOT NULL,
    target_id bigint,
    target_name text DEFAULT ''::text NOT NULL,
    summary_zh text NOT NULL,
    summary_en text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_agency_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_agency_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_agency_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_agency_audit_log_id_seq OWNED BY public.hr_agency_audit_log.id;


--
-- Name: hr_agency_cert_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_agency_cert_progress (
    certification_id bigint NOT NULL,
    side text NOT NULL,
    item_key text NOT NULL,
    stage text DEFAULT 'todo'::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    updated_by_member_id bigint,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_agency_cert_progress_side_check CHECK ((side = ANY (ARRAY['taiwan'::text, 'philippines'::text])))
);


--
-- Name: hr_agency_certificates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_agency_certificates (
    id bigint NOT NULL,
    agency_id bigint NOT NULL,
    cert_type text DEFAULT 'license'::text NOT NULL,
    original_filename text NOT NULL,
    content_type text NOT NULL,
    size_bytes integer NOT NULL,
    sha256 text NOT NULL,
    iv bytea NOT NULL,
    auth_tag bytea NOT NULL,
    encrypted_data bytea NOT NULL,
    expires_on date,
    note text DEFAULT ''::text NOT NULL,
    uploaded_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_agency_certificates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_agency_certificates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_agency_certificates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_agency_certificates_id_seq OWNED BY public.hr_agency_certificates.id;


--
-- Name: hr_agency_certifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_agency_certifications (
    id bigint NOT NULL,
    taiwan_agency_id bigint NOT NULL,
    philippines_agency_id bigint NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    requested_by_side text,
    requested_by_member_id bigint,
    decided_by_member_id bigint,
    taiwan_confirmed_at timestamp with time zone,
    philippines_confirmed_at timestamp with time zone,
    source text DEFAULT 'request'::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_agency_certifications_check CHECK (((status <> 'pending'::text) OR (requested_by_side IS NOT NULL))),
    CONSTRAINT hr_agency_certifications_check1 CHECK (((status <> 'certified'::text) OR ((taiwan_confirmed_at IS NOT NULL) AND (philippines_confirmed_at IS NOT NULL)))),
    CONSTRAINT hr_agency_certifications_requested_by_side_check CHECK ((requested_by_side = ANY (ARRAY['taiwan'::text, 'philippines'::text]))),
    CONSTRAINT hr_agency_certifications_source_check CHECK ((source = ANY (ARRAY['request'::text, 'admin'::text, 'grandfathered'::text]))),
    CONSTRAINT hr_agency_certifications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'certified'::text, 'rejected'::text, 'revoked'::text])))
);


--
-- Name: hr_agency_certifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_agency_certifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_agency_certifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_agency_certifications_id_seq OWNED BY public.hr_agency_certifications.id;


--
-- Name: hr_agency_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_agency_profiles (
    agency_id bigint NOT NULL,
    contact_person text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    license_number text DEFAULT ''::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_application_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_application_steps (
    id bigint NOT NULL,
    case_id bigint NOT NULL,
    step_key text NOT NULL,
    label text NOT NULL,
    started_on date,
    completed_on date,
    note text DEFAULT ''::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    detail text DEFAULT ''::text NOT NULL
);


--
-- Name: hr_application_steps_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_application_steps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_application_steps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_application_steps_id_seq OWNED BY public.hr_application_steps.id;


--
-- Name: hr_case_acknowledgments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_case_acknowledgments (
    case_id bigint NOT NULL,
    ack_key text NOT NULL,
    confirmed_by text DEFAULT ''::text NOT NULL,
    confirmed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_case_activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_case_activity (
    id bigint NOT NULL,
    case_id bigint NOT NULL,
    actor_email text NOT NULL,
    action text NOT NULL,
    detail text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_case_activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_case_activity_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_case_activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_case_activity_id_seq OWNED BY public.hr_case_activity.id;


--
-- Name: hr_case_certifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_case_certifications (
    id bigint NOT NULL,
    case_id bigint NOT NULL,
    name text NOT NULL,
    status text DEFAULT 'not_started'::text NOT NULL,
    target_date date,
    note text DEFAULT ''::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_case_certifications_status_check CHECK ((status = ANY (ARRAY['not_started'::text, 'training'::text, 'assessment'::text, 'obtained'::text])))
);


--
-- Name: hr_case_certifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_case_certifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_case_certifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_case_certifications_id_seq OWNED BY public.hr_case_certifications.id;


--
-- Name: hr_case_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_case_requirements (
    id bigint NOT NULL,
    case_id bigint NOT NULL,
    name text NOT NULL,
    required boolean DEFAULT true NOT NULL,
    entry_gate boolean DEFAULT false NOT NULL,
    status text DEFAULT 'missing'::text NOT NULL,
    review_reason text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    applicability text DEFAULT ''::text NOT NULL,
    applicable boolean DEFAULT true NOT NULL,
    CONSTRAINT hr_case_requirements_status_check1 CHECK ((status = ANY (ARRAY['missing'::text, 'submitted'::text, 'approved'::text, 'returned'::text])))
);


--
-- Name: hr_worker_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_worker_documents (
    id bigint NOT NULL,
    name text NOT NULL,
    required boolean DEFAULT true NOT NULL,
    entry_gate boolean DEFAULT false NOT NULL,
    status text DEFAULT 'missing'::text NOT NULL,
    review_reason text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    applicability text DEFAULT ''::text NOT NULL,
    applicable boolean DEFAULT true NOT NULL,
    applicability_source text DEFAULT 'manual'::text NOT NULL,
    worker_id bigint NOT NULL,
    CONSTRAINT hr_case_requirements_status_check CHECK ((status = ANY (ARRAY['missing'::text, 'submitted'::text, 'approved'::text, 'returned'::text])))
);


--
-- Name: hr_case_requirements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_case_requirements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_case_requirements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_case_requirements_id_seq OWNED BY public.hr_worker_documents.id;


--
-- Name: hr_case_requirements_id_seq1; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_case_requirements_id_seq1
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_case_requirements_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_case_requirements_id_seq1 OWNED BY public.hr_case_requirements.id;


--
-- Name: hr_case_tasks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_case_tasks (
    id bigint NOT NULL,
    case_id bigint NOT NULL,
    title text NOT NULL,
    category text DEFAULT 'other'::text NOT NULL,
    status text DEFAULT 'todo'::text NOT NULL,
    due_date date,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_case_tasks_category_check CHECK ((category = ANY (ARRAY['document'::text, 'medical'::text, 'training'::text, 'other'::text]))),
    CONSTRAINT hr_case_tasks_status_check CHECK ((status = ANY (ARRAY['todo'::text, 'in_progress'::text, 'done'::text, 'blocked'::text])))
);


--
-- Name: hr_case_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_case_tasks_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_case_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_case_tasks_id_seq OWNED BY public.hr_case_tasks.id;


--
-- Name: hr_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_cases (
    id bigint NOT NULL,
    case_number text NOT NULL,
    employer_id bigint NOT NULL,
    worker_id bigint NOT NULL,
    assigned_staff_id bigint,
    job_type text DEFAULT ''::text NOT NULL,
    stage text DEFAULT 'intake'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    expected_start_date date,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    medical_status text DEFAULT 'not_scheduled'::text NOT NULL,
    training_status text DEFAULT 'not_scheduled'::text NOT NULL,
    assigned_member_id bigint,
    CONSTRAINT hr_cases_stage_check CHECK ((stage = ANY (ARRAY['intake'::text, 'matching'::text, 'documents'::text, 'medical_training'::text, 'application'::text, 'arrangement'::text, 'completed'::text]))),
    CONSTRAINT hr_cases_status_check CHECK ((status = ANY (ARRAY['open'::text, 'on_hold'::text, 'closed'::text])))
);


--
-- Name: hr_cases_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_cases_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_cases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_cases_id_seq OWNED BY public.hr_cases.id;


--
-- Name: hr_chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_chat_messages (
    id bigint NOT NULL,
    room_id bigint NOT NULL,
    member_id bigint,
    sender_name text NOT NULL,
    sender_role text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_chat_messages_body_check CHECK (((length(body) >= 1) AND (length(body) <= 3000)))
);


--
-- Name: hr_chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_chat_messages_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_chat_messages_id_seq OWNED BY public.hr_chat_messages.id;


--
-- Name: hr_chat_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_chat_participants (
    room_id bigint NOT NULL,
    participant_key text NOT NULL,
    member_id bigint,
    display_name text NOT NULL
);


--
-- Name: hr_chat_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_chat_reads (
    reader_key text NOT NULL,
    room_id bigint NOT NULL,
    last_read_message_id bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_chat_rooms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_chat_rooms (
    id bigint NOT NULL,
    room_type text NOT NULL,
    agency_id bigint,
    case_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    direct_key text,
    center_id bigint,
    CONSTRAINT hr_chat_rooms_type_check CHECK ((((room_type = 'agency'::text) AND (agency_id IS NOT NULL) AND (case_id IS NULL) AND (center_id IS NULL)) OR ((room_type = 'case'::text) AND (case_id IS NOT NULL) AND (agency_id IS NULL) AND (center_id IS NULL)) OR ((room_type = 'direct'::text) AND (agency_id IS NULL) AND (case_id IS NULL) AND (center_id IS NULL) AND (direct_key IS NOT NULL)) OR ((room_type = 'training_center'::text) AND (center_id IS NOT NULL) AND (agency_id IS NULL) AND (case_id IS NULL))))
);


--
-- Name: hr_chat_rooms_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_chat_rooms_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_chat_rooms_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_chat_rooms_id_seq OWNED BY public.hr_chat_rooms.id;


--
-- Name: hr_document_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_document_files (
    submission_id bigint NOT NULL,
    original_filename text NOT NULL,
    content_type text NOT NULL,
    size_bytes integer NOT NULL,
    sha256 text NOT NULL,
    iv bytea NOT NULL,
    auth_tag bytea NOT NULL,
    encrypted_data bytea NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_document_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_document_reviews (
    id bigint NOT NULL,
    submission_id bigint NOT NULL,
    decision text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    reviewer text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_document_reviews_decision_check CHECK ((decision = ANY (ARRAY['approved'::text, 'returned'::text])))
);


--
-- Name: hr_document_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_document_reviews_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_document_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_document_reviews_id_seq OWNED BY public.hr_document_reviews.id;


--
-- Name: hr_document_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_document_submissions (
    id bigint NOT NULL,
    requirement_id bigint NOT NULL,
    version_number integer NOT NULL,
    filename text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    submitted_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_document_submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_document_submissions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_document_submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_document_submissions_id_seq OWNED BY public.hr_document_submissions.id;


--
-- Name: hr_employer_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employer_documents (
    id bigint NOT NULL,
    employer_id bigint NOT NULL,
    doc_type text DEFAULT 'approval_letter'::text NOT NULL,
    original_filename text NOT NULL,
    content_type text NOT NULL,
    size_bytes integer NOT NULL,
    sha256 text NOT NULL,
    iv bytea NOT NULL,
    auth_tag bytea NOT NULL,
    encrypted_data bytea NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    uploaded_by text DEFAULT ''::text NOT NULL,
    uploaded_by_role text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    approval_date date,
    approval_number text DEFAULT ''::text NOT NULL
);


--
-- Name: hr_employer_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_employer_documents_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_employer_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_employer_documents_id_seq OWNED BY public.hr_employer_documents.id;


--
-- Name: hr_employers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_employers (
    id bigint NOT NULL,
    name text NOT NULL,
    contact_name text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agency_id bigint,
    employer_type text DEFAULT 'other'::text NOT NULL,
    employer_profile jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT hr_employers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: hr_employers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_employers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_employers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_employers_id_seq OWNED BY public.hr_employers.id;


--
-- Name: hr_expiry_reminder_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_expiry_reminder_log (
    worker_id bigint NOT NULL,
    kind text NOT NULL,
    due_on date NOT NULL,
    phase text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_job_order_agencies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_job_order_agencies (
    id bigint NOT NULL,
    job_order_id bigint NOT NULL,
    taiwan_agency_id bigint NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    broker_member_id bigint
);


--
-- Name: hr_job_order_agencies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_job_order_agencies_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_job_order_agencies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_job_order_agencies_id_seq OWNED BY public.hr_job_order_agencies.id;


--
-- Name: hr_job_order_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_job_order_candidates (
    id bigint NOT NULL,
    route_id bigint NOT NULL,
    worker_id bigint NOT NULL,
    proposed_by bigint,
    status text DEFAULT 'proposed'::text NOT NULL,
    interview_at timestamp with time zone,
    notes text DEFAULT ''::text NOT NULL,
    case_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deposit_amount integer,
    deposit_paid_at timestamp with time zone,
    deposit_recorded_by bigint,
    CONSTRAINT hr_job_order_candidates_deposit_amount_check CHECK (((deposit_amount IS NULL) OR (deposit_amount > 0))),
    CONSTRAINT hr_job_order_candidates_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'scheduled'::text, 'passed'::text, 'rejected'::text])))
);


--
-- Name: hr_job_order_candidates_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_job_order_candidates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_job_order_candidates_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_job_order_candidates_id_seq OWNED BY public.hr_job_order_candidates.id;


--
-- Name: hr_job_order_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_job_order_routes (
    id bigint NOT NULL,
    order_agency_id bigint NOT NULL,
    philippines_agency_id bigint NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_job_order_routes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_job_order_routes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_job_order_routes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_job_order_routes_id_seq OWNED BY public.hr_job_order_routes.id;


--
-- Name: hr_job_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_job_orders (
    id bigint NOT NULL,
    employer_id bigint NOT NULL,
    job_type text DEFAULT ''::text NOT NULL,
    headcount integer NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    expected_start_date date,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    care_recipient jsonb DEFAULT '{}'::jsonb NOT NULL,
    monthly_salary integer,
    work_months integer,
    work_days integer,
    issue_date date,
    CONSTRAINT hr_job_orders_headcount_check CHECK ((headcount > 0)),
    CONSTRAINT hr_job_orders_status_check CHECK ((status = ANY (ARRAY['open'::text, 'filled'::text, 'cancelled'::text])))
);


--
-- Name: hr_job_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_job_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_job_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_job_orders_id_seq OWNED BY public.hr_job_orders.id;


--
-- Name: hr_line_admin_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_line_admin_sessions (
    line_user_id text NOT NULL,
    session_data jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_line_handoffs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_line_handoffs (
    state text NOT NULL,
    secret_hash text NOT NULL,
    nonce text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    line_user_id text,
    display_name text,
    confirm_code_hash text,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    chat_code_hash text,
    via text,
    CONSTRAINT hr_line_handoffs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'ready'::text, 'used'::text]))),
    CONSTRAINT hr_line_handoffs_via_check CHECK (((via IS NULL) OR (via = ANY (ARRAY['chat'::text, 'browser'::text]))))
);


--
-- Name: hr_line_member_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_line_member_settings (
    line_user_id text NOT NULL,
    preferred_language text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    rich_menu_role text,
    line_language_synced_at timestamp with time zone,
    CONSTRAINT hr_line_member_settings_preferred_language_check CHECK ((preferred_language = ANY (ARRAY['zh'::text, 'en'::text, 'tl'::text])))
);


--
-- Name: hr_line_rich_menus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_line_rich_menus (
    menu_key text NOT NULL,
    rich_menu_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_line_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_line_webhook_events (
    event_id text NOT NULL,
    event_type text NOT NULL,
    status text NOT NULL,
    attempts integer DEFAULT 1 NOT NULL,
    last_error text,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_line_webhook_events_status_check CHECK ((status = ANY (ARRAY['processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: hr_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_members (
    id bigint NOT NULL,
    email text,
    line_user_id text,
    display_name text NOT NULL,
    password_hash text,
    role text,
    worker_id bigint,
    employer_id bigint,
    agency_id bigint,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    requested_role text,
    admin_scope text DEFAULT 'none'::text NOT NULL,
    requested_agency_id bigint,
    last_worker_id bigint,
    last_employer_id bigint,
    onboarding_seen jsonb DEFAULT '{}'::jsonb NOT NULL,
    welcomed_at timestamp with time zone,
    deleted_at timestamp with time zone,
    training_center_id bigint,
    CONSTRAINT hr_members_admin_scope_check CHECK ((admin_scope = ANY (ARRAY['none'::text, 'agency'::text, 'system'::text]))),
    CONSTRAINT hr_members_check CHECK ((((role IS NULL) AND (worker_id IS NULL) AND (employer_id IS NULL) AND (agency_id IS NULL)) OR ((role = 'worker'::text) AND (worker_id IS NOT NULL) AND (employer_id IS NULL) AND (agency_id IS NULL)) OR ((role = 'employer'::text) AND (employer_id IS NOT NULL) AND (worker_id IS NULL) AND (agency_id IS NULL)) OR ((role = 'agency'::text) AND (agency_id IS NOT NULL) AND (worker_id IS NULL) AND (employer_id IS NULL)) OR ((role = 'training_center'::text) AND (worker_id IS NULL) AND (employer_id IS NULL) AND (agency_id IS NULL)) OR ((role = 'system_admin'::text) AND (worker_id IS NULL) AND (employer_id IS NULL) AND (agency_id IS NULL)))),
    CONSTRAINT hr_members_identity_check CHECK (((email IS NOT NULL) OR (line_user_id IS NOT NULL))),
    CONSTRAINT hr_members_requested_role_check CHECK (((requested_role IS NULL) OR (requested_role = ANY (ARRAY['worker'::text, 'employer'::text, 'agency'::text, 'training_center'::text])))),
    CONSTRAINT hr_members_role_check CHECK (((role IS NULL) OR (role = ANY (ARRAY['worker'::text, 'employer'::text, 'agency'::text, 'training_center'::text, 'system_admin'::text]))))
);


--
-- Name: hr_members_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_members_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_members_id_seq OWNED BY public.hr_members.id;


--
-- Name: hr_notification_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_notification_outbox (
    id bigint NOT NULL,
    event_key text NOT NULL,
    subject_member_id bigint,
    recipient_member_id bigint,
    recipient_kind text NOT NULL,
    recipient_line_id text NOT NULL,
    delivery_key uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    lease_until timestamp with time zone,
    lease_key uuid,
    last_error_code text,
    attempt_history jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    CONSTRAINT hr_notification_outbox_attempts_check CHECK (((attempts >= 0) AND (attempts <= 5))),
    CONSTRAINT hr_notification_outbox_recipient_kind_check CHECK ((recipient_kind = ANY (ARRAY['member'::text, 'environment'::text]))),
    CONSTRAINT hr_notification_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'retry'::text, 'sent'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: hr_notification_outbox_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_notification_outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_notification_outbox_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_notification_outbox_id_seq OWNED BY public.hr_notification_outbox.id;


--
-- Name: hr_push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_push_subscriptions (
    id bigint NOT NULL,
    member_key text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    lang text DEFAULT 'zh'::text NOT NULL,
    user_agent text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_push_subscriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_push_subscriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_push_subscriptions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_push_subscriptions_id_seq OWNED BY public.hr_push_subscriptions.id;


--
-- Name: hr_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_staff (
    id bigint NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_staff_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_staff_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_staff_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_staff_id_seq OWNED BY public.hr_staff.id;


--
-- Name: hr_tc_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tc_audit_log (
    id bigint NOT NULL,
    center_id bigint NOT NULL,
    center_name text DEFAULT ''::text NOT NULL,
    actor_member_id bigint,
    actor_name text NOT NULL,
    actor_email text DEFAULT ''::text NOT NULL,
    actor_kind text NOT NULL,
    action text NOT NULL,
    target_type text DEFAULT ''::text NOT NULL,
    target_id bigint,
    target_name text DEFAULT ''::text NOT NULL,
    detail text DEFAULT ''::text NOT NULL,
    summary text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_tc_audit_log_actor_kind_check CHECK ((actor_kind = ANY (ARRAY['system_admin'::text, 'training_center'::text])))
);


--
-- Name: hr_tc_audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_tc_audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_tc_audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_tc_audit_log_id_seq OWNED BY public.hr_tc_audit_log.id;


--
-- Name: hr_tc_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tc_batches (
    id bigint NOT NULL,
    class_id bigint NOT NULL,
    batch_no text NOT NULL,
    applied_date date,
    student_count integer,
    status text DEFAULT 'preparing'::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_tc_batches_status_check CHECK ((status = ANY (ARRAY['preparing'::text, 'submitted'::text, 'issued'::text])))
);


--
-- Name: hr_tc_batches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_tc_batches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_tc_batches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_tc_batches_id_seq OWNED BY public.hr_tc_batches.id;


--
-- Name: hr_tc_certifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tc_certifications (
    id bigint NOT NULL,
    center_id bigint NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_tc_certifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_tc_certifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_tc_certifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_tc_certifications_id_seq OWNED BY public.hr_tc_certifications.id;


--
-- Name: hr_tc_classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tc_classes (
    id bigint NOT NULL,
    center_id bigint NOT NULL,
    certification_id bigint NOT NULL,
    course_id bigint NOT NULL,
    teacher_id bigint,
    name text NOT NULL,
    training_start_date date NOT NULL,
    training_end_date date NOT NULL,
    exam_date date,
    exam_location text DEFAULT ''::text NOT NULL,
    certificate_issue_date date,
    capacity integer,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_tc_classes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_tc_classes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_tc_classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_tc_classes_id_seq OWNED BY public.hr_tc_classes.id;


--
-- Name: hr_tc_course_units; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tc_course_units (
    id bigint NOT NULL,
    center_id bigint NOT NULL,
    course_id bigint NOT NULL,
    "position" integer DEFAULT 1 NOT NULL,
    name text NOT NULL,
    name_en text DEFAULT ''::text NOT NULL,
    hours integer,
    topics text DEFAULT ''::text NOT NULL,
    topics_en text DEFAULT ''::text NOT NULL,
    examples text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    vocabulary text DEFAULT ''::text NOT NULL,
    dialogue text DEFAULT ''::text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    category_en text DEFAULT ''::text NOT NULL
);


--
-- Name: hr_tc_course_units_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_tc_course_units_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_tc_course_units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_tc_course_units_id_seq OWNED BY public.hr_tc_course_units.id;


--
-- Name: hr_tc_courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tc_courses (
    id bigint NOT NULL,
    center_id bigint NOT NULL,
    certification_id bigint NOT NULL,
    name text NOT NULL,
    hours integer,
    description text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    fee numeric(12,2),
    currency text DEFAULT 'PHP'::text NOT NULL
);


--
-- Name: hr_tc_courses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_tc_courses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_tc_courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_tc_courses_id_seq OWNED BY public.hr_tc_courses.id;


--
-- Name: hr_tc_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tc_enrollments (
    id bigint NOT NULL,
    class_id bigint NOT NULL,
    worker_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_tc_enrollments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_tc_enrollments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_tc_enrollments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_tc_enrollments_id_seq OWNED BY public.hr_tc_enrollments.id;


--
-- Name: hr_tc_quiz_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tc_quiz_results (
    id bigint NOT NULL,
    worker_id bigint NOT NULL,
    unit_id bigint NOT NULL,
    correct integer NOT NULL,
    total integer NOT NULL,
    percent integer NOT NULL,
    passed boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hr_tc_quiz_results_correct_check CHECK ((correct >= 0)),
    CONSTRAINT hr_tc_quiz_results_percent_check CHECK (((percent >= 0) AND (percent <= 100))),
    CONSTRAINT hr_tc_quiz_results_total_check CHECK ((total > 0))
);


--
-- Name: hr_tc_quiz_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_tc_quiz_results_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_tc_quiz_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_tc_quiz_results_id_seq OWNED BY public.hr_tc_quiz_results.id;


--
-- Name: hr_tc_teacher_certifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tc_teacher_certifications (
    id bigint NOT NULL,
    teacher_id bigint NOT NULL,
    certification_id bigint NOT NULL,
    certificate_no text DEFAULT ''::text NOT NULL,
    issued_date date,
    expires_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_tc_teacher_certifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_tc_teacher_certifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_tc_teacher_certifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_tc_teacher_certifications_id_seq OWNED BY public.hr_tc_teacher_certifications.id;


--
-- Name: hr_tc_teachers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tc_teachers (
    id bigint NOT NULL,
    center_id bigint NOT NULL,
    name text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_tc_teachers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_tc_teachers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_tc_teachers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_tc_teachers_id_seq OWNED BY public.hr_tc_teachers.id;


--
-- Name: hr_tc_unit_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_tc_unit_progress (
    id bigint NOT NULL,
    worker_id bigint NOT NULL,
    unit_id bigint NOT NULL,
    completed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_tc_unit_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_tc_unit_progress_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_tc_unit_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_tc_unit_progress_id_seq OWNED BY public.hr_tc_unit_progress.id;


--
-- Name: hr_worker_activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_worker_activity_log (
    id bigint NOT NULL,
    worker_id bigint NOT NULL,
    worker_name text DEFAULT ''::text NOT NULL,
    actor_member_id bigint,
    actor_name text DEFAULT ''::text NOT NULL,
    actor_role text DEFAULT 'system'::text NOT NULL,
    action text NOT NULL,
    target_type text DEFAULT ''::text NOT NULL,
    target_name text DEFAULT ''::text NOT NULL,
    summary_zh text NOT NULL,
    summary_en text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_worker_activity_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_worker_activity_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_worker_activity_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_worker_activity_log_id_seq OWNED BY public.hr_worker_activity_log.id;


--
-- Name: hr_worker_health_training; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_worker_health_training (
    worker_id bigint NOT NULL,
    medical_status text DEFAULT 'not_scheduled'::text NOT NULL,
    training_status text DEFAULT 'not_scheduled'::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: hr_worker_progress_steps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_worker_progress_steps (
    worker_id bigint NOT NULL,
    step_key text NOT NULL,
    started_on date,
    completed_on date,
    note text DEFAULT ''::text NOT NULL,
    updated_by text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    detail text DEFAULT ''::text NOT NULL
);


--
-- Name: hr_workers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hr_workers (
    id bigint NOT NULL,
    name text NOT NULL,
    nationality text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    job_preference text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    agency_id bigint,
    resume_profile jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT hr_workers_status_check CHECK ((status = ANY (ARRAY['active'::text, 'inactive'::text])))
);


--
-- Name: hr_workers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.hr_workers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hr_workers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.hr_workers_id_seq OWNED BY public.hr_workers.id;


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;


--
-- Name: hr_admin_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_admin_audit_log ALTER COLUMN id SET DEFAULT nextval('public.hr_admin_audit_log_id_seq'::regclass);


--
-- Name: hr_agencies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agencies ALTER COLUMN id SET DEFAULT nextval('public.hr_agencies_id_seq'::regclass);


--
-- Name: hr_agency_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_audit_log ALTER COLUMN id SET DEFAULT nextval('public.hr_agency_audit_log_id_seq'::regclass);


--
-- Name: hr_agency_certificates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_certificates ALTER COLUMN id SET DEFAULT nextval('public.hr_agency_certificates_id_seq'::regclass);


--
-- Name: hr_agency_certifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_certifications ALTER COLUMN id SET DEFAULT nextval('public.hr_agency_certifications_id_seq'::regclass);


--
-- Name: hr_application_steps id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_application_steps ALTER COLUMN id SET DEFAULT nextval('public.hr_application_steps_id_seq'::regclass);


--
-- Name: hr_case_activity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_activity ALTER COLUMN id SET DEFAULT nextval('public.hr_case_activity_id_seq'::regclass);


--
-- Name: hr_case_certifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_certifications ALTER COLUMN id SET DEFAULT nextval('public.hr_case_certifications_id_seq'::regclass);


--
-- Name: hr_case_requirements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_requirements ALTER COLUMN id SET DEFAULT nextval('public.hr_case_requirements_id_seq1'::regclass);


--
-- Name: hr_case_tasks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_tasks ALTER COLUMN id SET DEFAULT nextval('public.hr_case_tasks_id_seq'::regclass);


--
-- Name: hr_cases id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_cases ALTER COLUMN id SET DEFAULT nextval('public.hr_cases_id_seq'::regclass);


--
-- Name: hr_chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_messages ALTER COLUMN id SET DEFAULT nextval('public.hr_chat_messages_id_seq'::regclass);


--
-- Name: hr_chat_rooms id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_rooms ALTER COLUMN id SET DEFAULT nextval('public.hr_chat_rooms_id_seq'::regclass);


--
-- Name: hr_document_reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_reviews ALTER COLUMN id SET DEFAULT nextval('public.hr_document_reviews_id_seq'::regclass);


--
-- Name: hr_document_submissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_submissions ALTER COLUMN id SET DEFAULT nextval('public.hr_document_submissions_id_seq'::regclass);


--
-- Name: hr_employer_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employer_documents ALTER COLUMN id SET DEFAULT nextval('public.hr_employer_documents_id_seq'::regclass);


--
-- Name: hr_employers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employers ALTER COLUMN id SET DEFAULT nextval('public.hr_employers_id_seq'::regclass);


--
-- Name: hr_job_order_agencies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_agencies ALTER COLUMN id SET DEFAULT nextval('public.hr_job_order_agencies_id_seq'::regclass);


--
-- Name: hr_job_order_candidates id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_candidates ALTER COLUMN id SET DEFAULT nextval('public.hr_job_order_candidates_id_seq'::regclass);


--
-- Name: hr_job_order_routes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_routes ALTER COLUMN id SET DEFAULT nextval('public.hr_job_order_routes_id_seq'::regclass);


--
-- Name: hr_job_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_orders ALTER COLUMN id SET DEFAULT nextval('public.hr_job_orders_id_seq'::regclass);


--
-- Name: hr_members id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_members ALTER COLUMN id SET DEFAULT nextval('public.hr_members_id_seq'::regclass);


--
-- Name: hr_notification_outbox id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_notification_outbox ALTER COLUMN id SET DEFAULT nextval('public.hr_notification_outbox_id_seq'::regclass);


--
-- Name: hr_push_subscriptions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_push_subscriptions ALTER COLUMN id SET DEFAULT nextval('public.hr_push_subscriptions_id_seq'::regclass);


--
-- Name: hr_staff id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_staff ALTER COLUMN id SET DEFAULT nextval('public.hr_staff_id_seq'::regclass);


--
-- Name: hr_tc_audit_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_audit_log ALTER COLUMN id SET DEFAULT nextval('public.hr_tc_audit_log_id_seq'::regclass);


--
-- Name: hr_tc_batches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_batches ALTER COLUMN id SET DEFAULT nextval('public.hr_tc_batches_id_seq'::regclass);


--
-- Name: hr_tc_certifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_certifications ALTER COLUMN id SET DEFAULT nextval('public.hr_tc_certifications_id_seq'::regclass);


--
-- Name: hr_tc_classes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_classes ALTER COLUMN id SET DEFAULT nextval('public.hr_tc_classes_id_seq'::regclass);


--
-- Name: hr_tc_course_units id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_course_units ALTER COLUMN id SET DEFAULT nextval('public.hr_tc_course_units_id_seq'::regclass);


--
-- Name: hr_tc_courses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_courses ALTER COLUMN id SET DEFAULT nextval('public.hr_tc_courses_id_seq'::regclass);


--
-- Name: hr_tc_enrollments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_enrollments ALTER COLUMN id SET DEFAULT nextval('public.hr_tc_enrollments_id_seq'::regclass);


--
-- Name: hr_tc_quiz_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_quiz_results ALTER COLUMN id SET DEFAULT nextval('public.hr_tc_quiz_results_id_seq'::regclass);


--
-- Name: hr_tc_teacher_certifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_teacher_certifications ALTER COLUMN id SET DEFAULT nextval('public.hr_tc_teacher_certifications_id_seq'::regclass);


--
-- Name: hr_tc_teachers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_teachers ALTER COLUMN id SET DEFAULT nextval('public.hr_tc_teachers_id_seq'::regclass);


--
-- Name: hr_tc_unit_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_unit_progress ALTER COLUMN id SET DEFAULT nextval('public.hr_tc_unit_progress_id_seq'::regclass);


--
-- Name: hr_worker_activity_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_worker_activity_log ALTER COLUMN id SET DEFAULT nextval('public.hr_worker_activity_log_id_seq'::regclass);


--
-- Name: hr_worker_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_worker_documents ALTER COLUMN id SET DEFAULT nextval('public.hr_case_requirements_id_seq'::regclass);


--
-- Name: hr_workers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_workers ALTER COLUMN id SET DEFAULT nextval('public.hr_workers_id_seq'::regclass);


--
-- Name: schema_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);


--
-- Name: hr_admin_audit_log hr_admin_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_admin_audit_log
    ADD CONSTRAINT hr_admin_audit_log_pkey PRIMARY KEY (id);


--
-- Name: hr_agencies hr_agencies_name_agency_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agencies
    ADD CONSTRAINT hr_agencies_name_agency_type_key UNIQUE (name, agency_type);


--
-- Name: hr_agencies hr_agencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agencies
    ADD CONSTRAINT hr_agencies_pkey PRIMARY KEY (id);


--
-- Name: hr_agency_audit_log hr_agency_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_audit_log
    ADD CONSTRAINT hr_agency_audit_log_pkey PRIMARY KEY (id);


--
-- Name: hr_agency_cert_progress hr_agency_cert_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_cert_progress
    ADD CONSTRAINT hr_agency_cert_progress_pkey PRIMARY KEY (certification_id, side, item_key);


--
-- Name: hr_agency_certificates hr_agency_certificates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_certificates
    ADD CONSTRAINT hr_agency_certificates_pkey PRIMARY KEY (id);


--
-- Name: hr_agency_certifications hr_agency_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_certifications
    ADD CONSTRAINT hr_agency_certifications_pkey PRIMARY KEY (id);


--
-- Name: hr_agency_certifications hr_agency_certifications_taiwan_agency_id_philippines_agenc_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_certifications
    ADD CONSTRAINT hr_agency_certifications_taiwan_agency_id_philippines_agenc_key UNIQUE (taiwan_agency_id, philippines_agency_id);


--
-- Name: hr_agency_profiles hr_agency_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_profiles
    ADD CONSTRAINT hr_agency_profiles_pkey PRIMARY KEY (agency_id);


--
-- Name: hr_application_steps hr_application_steps_case_id_step_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_application_steps
    ADD CONSTRAINT hr_application_steps_case_id_step_key_key UNIQUE (case_id, step_key);


--
-- Name: hr_application_steps hr_application_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_application_steps
    ADD CONSTRAINT hr_application_steps_pkey PRIMARY KEY (id);


--
-- Name: hr_case_acknowledgments hr_case_acknowledgments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_acknowledgments
    ADD CONSTRAINT hr_case_acknowledgments_pkey PRIMARY KEY (case_id, ack_key);


--
-- Name: hr_case_activity hr_case_activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_activity
    ADD CONSTRAINT hr_case_activity_pkey PRIMARY KEY (id);


--
-- Name: hr_case_certifications hr_case_certifications_case_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_certifications
    ADD CONSTRAINT hr_case_certifications_case_id_name_key UNIQUE (case_id, name);


--
-- Name: hr_case_certifications hr_case_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_certifications
    ADD CONSTRAINT hr_case_certifications_pkey PRIMARY KEY (id);


--
-- Name: hr_worker_documents hr_case_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_worker_documents
    ADD CONSTRAINT hr_case_requirements_pkey PRIMARY KEY (id);


--
-- Name: hr_case_requirements hr_case_requirements_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_requirements
    ADD CONSTRAINT hr_case_requirements_pkey1 PRIMARY KEY (id);


--
-- Name: hr_case_tasks hr_case_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_tasks
    ADD CONSTRAINT hr_case_tasks_pkey PRIMARY KEY (id);


--
-- Name: hr_cases hr_cases_case_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_cases
    ADD CONSTRAINT hr_cases_case_number_key UNIQUE (case_number);


--
-- Name: hr_cases hr_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_cases
    ADD CONSTRAINT hr_cases_pkey PRIMARY KEY (id);


--
-- Name: hr_chat_messages hr_chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_messages
    ADD CONSTRAINT hr_chat_messages_pkey PRIMARY KEY (id);


--
-- Name: hr_chat_participants hr_chat_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_participants
    ADD CONSTRAINT hr_chat_participants_pkey PRIMARY KEY (room_id, participant_key);


--
-- Name: hr_chat_reads hr_chat_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_reads
    ADD CONSTRAINT hr_chat_reads_pkey PRIMARY KEY (reader_key, room_id);


--
-- Name: hr_chat_rooms hr_chat_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_rooms
    ADD CONSTRAINT hr_chat_rooms_pkey PRIMARY KEY (id);


--
-- Name: hr_document_files hr_document_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_files
    ADD CONSTRAINT hr_document_files_pkey PRIMARY KEY (submission_id);


--
-- Name: hr_document_reviews hr_document_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_reviews
    ADD CONSTRAINT hr_document_reviews_pkey PRIMARY KEY (id);


--
-- Name: hr_document_reviews hr_document_reviews_submission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_reviews
    ADD CONSTRAINT hr_document_reviews_submission_id_key UNIQUE (submission_id);


--
-- Name: hr_document_submissions hr_document_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_submissions
    ADD CONSTRAINT hr_document_submissions_pkey PRIMARY KEY (id);


--
-- Name: hr_document_submissions hr_document_submissions_requirement_id_version_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_submissions
    ADD CONSTRAINT hr_document_submissions_requirement_id_version_number_key UNIQUE (requirement_id, version_number);


--
-- Name: hr_employer_documents hr_employer_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employer_documents
    ADD CONSTRAINT hr_employer_documents_pkey PRIMARY KEY (id);


--
-- Name: hr_employers hr_employers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employers
    ADD CONSTRAINT hr_employers_pkey PRIMARY KEY (id);


--
-- Name: hr_expiry_reminder_log hr_expiry_reminder_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_expiry_reminder_log
    ADD CONSTRAINT hr_expiry_reminder_log_pkey PRIMARY KEY (worker_id, kind, due_on, phase);


--
-- Name: hr_job_order_agencies hr_job_order_agencies_job_order_id_taiwan_agency_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_agencies
    ADD CONSTRAINT hr_job_order_agencies_job_order_id_taiwan_agency_id_key UNIQUE (job_order_id, taiwan_agency_id);


--
-- Name: hr_job_order_agencies hr_job_order_agencies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_agencies
    ADD CONSTRAINT hr_job_order_agencies_pkey PRIMARY KEY (id);


--
-- Name: hr_job_order_candidates hr_job_order_candidates_case_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_candidates
    ADD CONSTRAINT hr_job_order_candidates_case_id_key UNIQUE (case_id);


--
-- Name: hr_job_order_candidates hr_job_order_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_candidates
    ADD CONSTRAINT hr_job_order_candidates_pkey PRIMARY KEY (id);


--
-- Name: hr_job_order_candidates hr_job_order_candidates_route_id_worker_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_candidates
    ADD CONSTRAINT hr_job_order_candidates_route_id_worker_id_key UNIQUE (route_id, worker_id);


--
-- Name: hr_job_order_routes hr_job_order_routes_order_agency_id_philippines_agency_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_routes
    ADD CONSTRAINT hr_job_order_routes_order_agency_id_philippines_agency_id_key UNIQUE (order_agency_id, philippines_agency_id);


--
-- Name: hr_job_order_routes hr_job_order_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_routes
    ADD CONSTRAINT hr_job_order_routes_pkey PRIMARY KEY (id);


--
-- Name: hr_job_orders hr_job_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_orders
    ADD CONSTRAINT hr_job_orders_pkey PRIMARY KEY (id);


--
-- Name: hr_line_admin_sessions hr_line_admin_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_line_admin_sessions
    ADD CONSTRAINT hr_line_admin_sessions_pkey PRIMARY KEY (line_user_id);


--
-- Name: hr_line_handoffs hr_line_handoffs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_line_handoffs
    ADD CONSTRAINT hr_line_handoffs_pkey PRIMARY KEY (state);


--
-- Name: hr_line_member_settings hr_line_member_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_line_member_settings
    ADD CONSTRAINT hr_line_member_settings_pkey PRIMARY KEY (line_user_id);


--
-- Name: hr_line_rich_menus hr_line_rich_menus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_line_rich_menus
    ADD CONSTRAINT hr_line_rich_menus_pkey PRIMARY KEY (menu_key);


--
-- Name: hr_line_webhook_events hr_line_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_line_webhook_events
    ADD CONSTRAINT hr_line_webhook_events_pkey PRIMARY KEY (event_id);


--
-- Name: hr_members hr_members_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_members
    ADD CONSTRAINT hr_members_email_key UNIQUE (email);


--
-- Name: hr_members hr_members_employer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_members
    ADD CONSTRAINT hr_members_employer_id_key UNIQUE (employer_id);


--
-- Name: hr_members hr_members_line_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_members
    ADD CONSTRAINT hr_members_line_user_id_key UNIQUE (line_user_id);


--
-- Name: hr_members hr_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_members
    ADD CONSTRAINT hr_members_pkey PRIMARY KEY (id);


--
-- Name: hr_members hr_members_worker_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_members
    ADD CONSTRAINT hr_members_worker_id_key UNIQUE (worker_id);


--
-- Name: hr_notification_outbox hr_notification_outbox_delivery_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_notification_outbox
    ADD CONSTRAINT hr_notification_outbox_delivery_key_key UNIQUE (delivery_key);


--
-- Name: hr_notification_outbox hr_notification_outbox_event_key_recipient_line_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_notification_outbox
    ADD CONSTRAINT hr_notification_outbox_event_key_recipient_line_id_key UNIQUE (event_key, recipient_line_id);


--
-- Name: hr_notification_outbox hr_notification_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_notification_outbox
    ADD CONSTRAINT hr_notification_outbox_pkey PRIMARY KEY (id);


--
-- Name: hr_push_subscriptions hr_push_subscriptions_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_push_subscriptions
    ADD CONSTRAINT hr_push_subscriptions_endpoint_key UNIQUE (endpoint);


--
-- Name: hr_push_subscriptions hr_push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_push_subscriptions
    ADD CONSTRAINT hr_push_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: hr_staff hr_staff_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_staff
    ADD CONSTRAINT hr_staff_email_key UNIQUE (email);


--
-- Name: hr_staff hr_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_staff
    ADD CONSTRAINT hr_staff_pkey PRIMARY KEY (id);


--
-- Name: hr_tc_audit_log hr_tc_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_audit_log
    ADD CONSTRAINT hr_tc_audit_log_pkey PRIMARY KEY (id);


--
-- Name: hr_tc_batches hr_tc_batches_class_id_batch_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_batches
    ADD CONSTRAINT hr_tc_batches_class_id_batch_no_key UNIQUE (class_id, batch_no);


--
-- Name: hr_tc_batches hr_tc_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_batches
    ADD CONSTRAINT hr_tc_batches_pkey PRIMARY KEY (id);


--
-- Name: hr_tc_certifications hr_tc_certifications_center_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_certifications
    ADD CONSTRAINT hr_tc_certifications_center_id_name_key UNIQUE (center_id, name);


--
-- Name: hr_tc_certifications hr_tc_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_certifications
    ADD CONSTRAINT hr_tc_certifications_pkey PRIMARY KEY (id);


--
-- Name: hr_tc_classes hr_tc_classes_center_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_classes
    ADD CONSTRAINT hr_tc_classes_center_id_name_key UNIQUE (center_id, name);


--
-- Name: hr_tc_classes hr_tc_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_classes
    ADD CONSTRAINT hr_tc_classes_pkey PRIMARY KEY (id);


--
-- Name: hr_tc_course_units hr_tc_course_units_course_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_course_units
    ADD CONSTRAINT hr_tc_course_units_course_id_name_key UNIQUE (course_id, name);


--
-- Name: hr_tc_course_units hr_tc_course_units_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_course_units
    ADD CONSTRAINT hr_tc_course_units_pkey PRIMARY KEY (id);


--
-- Name: hr_tc_courses hr_tc_courses_center_id_certification_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_courses
    ADD CONSTRAINT hr_tc_courses_center_id_certification_id_name_key UNIQUE (center_id, certification_id, name);


--
-- Name: hr_tc_courses hr_tc_courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_courses
    ADD CONSTRAINT hr_tc_courses_pkey PRIMARY KEY (id);


--
-- Name: hr_tc_enrollments hr_tc_enrollments_class_id_worker_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_enrollments
    ADD CONSTRAINT hr_tc_enrollments_class_id_worker_id_key UNIQUE (class_id, worker_id);


--
-- Name: hr_tc_enrollments hr_tc_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_enrollments
    ADD CONSTRAINT hr_tc_enrollments_pkey PRIMARY KEY (id);


--
-- Name: hr_tc_quiz_results hr_tc_quiz_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_quiz_results
    ADD CONSTRAINT hr_tc_quiz_results_pkey PRIMARY KEY (id);


--
-- Name: hr_tc_teacher_certifications hr_tc_teacher_certifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_teacher_certifications
    ADD CONSTRAINT hr_tc_teacher_certifications_pkey PRIMARY KEY (id);


--
-- Name: hr_tc_teacher_certifications hr_tc_teacher_certifications_teacher_id_certification_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_teacher_certifications
    ADD CONSTRAINT hr_tc_teacher_certifications_teacher_id_certification_id_key UNIQUE (teacher_id, certification_id);


--
-- Name: hr_tc_teachers hr_tc_teachers_center_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_teachers
    ADD CONSTRAINT hr_tc_teachers_center_id_name_key UNIQUE (center_id, name);


--
-- Name: hr_tc_teachers hr_tc_teachers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_teachers
    ADD CONSTRAINT hr_tc_teachers_pkey PRIMARY KEY (id);


--
-- Name: hr_tc_unit_progress hr_tc_unit_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_unit_progress
    ADD CONSTRAINT hr_tc_unit_progress_pkey PRIMARY KEY (id);


--
-- Name: hr_tc_unit_progress hr_tc_unit_progress_worker_id_unit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_unit_progress
    ADD CONSTRAINT hr_tc_unit_progress_worker_id_unit_id_key UNIQUE (worker_id, unit_id);


--
-- Name: hr_worker_activity_log hr_worker_activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_worker_activity_log
    ADD CONSTRAINT hr_worker_activity_log_pkey PRIMARY KEY (id);


--
-- Name: hr_worker_health_training hr_worker_health_training_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_worker_health_training
    ADD CONSTRAINT hr_worker_health_training_pkey PRIMARY KEY (worker_id);


--
-- Name: hr_worker_progress_steps hr_worker_progress_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_worker_progress_steps
    ADD CONSTRAINT hr_worker_progress_steps_pkey PRIMARY KEY (worker_id, step_key);


--
-- Name: hr_workers hr_workers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_workers
    ADD CONSTRAINT hr_workers_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_name_key UNIQUE (name);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: hr_admin_audit_log_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_admin_audit_log_created ON public.hr_admin_audit_log USING btree (created_at DESC, id DESC);


--
-- Name: hr_agency_audit_log_agency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_agency_audit_log_agency ON public.hr_agency_audit_log USING btree (agency_id, id DESC);


--
-- Name: hr_agency_certificates_agency; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_agency_certificates_agency ON public.hr_agency_certificates USING btree (agency_id, created_at DESC);


--
-- Name: hr_agency_certifications_philippines; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_agency_certifications_philippines ON public.hr_agency_certifications USING btree (philippines_agency_id, status);


--
-- Name: hr_case_requirements_case_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hr_case_requirements_case_name ON public.hr_case_requirements USING btree (case_id, name);


--
-- Name: hr_cases_status_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_cases_status_updated ON public.hr_cases USING btree (status, updated_at DESC);


--
-- Name: hr_chat_messages_room_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_chat_messages_room_created ON public.hr_chat_messages USING btree (room_id, created_at DESC, id DESC);


--
-- Name: hr_chat_rooms_agency_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hr_chat_rooms_agency_unique ON public.hr_chat_rooms USING btree (agency_id) WHERE (room_type = 'agency'::text);


--
-- Name: hr_chat_rooms_case_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hr_chat_rooms_case_unique ON public.hr_chat_rooms USING btree (case_id) WHERE (room_type = 'case'::text);


--
-- Name: hr_chat_rooms_center_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hr_chat_rooms_center_unique ON public.hr_chat_rooms USING btree (center_id) WHERE (room_type = 'training_center'::text);


--
-- Name: hr_chat_rooms_direct_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hr_chat_rooms_direct_unique ON public.hr_chat_rooms USING btree (direct_key) WHERE (room_type = 'direct'::text);


--
-- Name: hr_employer_documents_employer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_employer_documents_employer ON public.hr_employer_documents USING btree (employer_id, created_at DESC);


--
-- Name: hr_line_handoffs_chat_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_line_handoffs_chat_code ON public.hr_line_handoffs USING btree (chat_code_hash) WHERE (chat_code_hash IS NOT NULL);


--
-- Name: hr_line_handoffs_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_line_handoffs_expires_at ON public.hr_line_handoffs USING btree (expires_at);


--
-- Name: hr_members_active_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_members_active_role ON public.hr_members USING btree (role, active);


--
-- Name: hr_members_agency_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_members_agency_id_idx ON public.hr_members USING btree (agency_id) WHERE (agency_id IS NOT NULL);


--
-- Name: hr_notification_outbox_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_notification_outbox_due ON public.hr_notification_outbox USING btree (next_attempt_at) WHERE (status = ANY (ARRAY['pending'::text, 'retry'::text, 'processing'::text]));


--
-- Name: hr_push_subscriptions_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_push_subscriptions_key ON public.hr_push_subscriptions USING btree (member_key);


--
-- Name: hr_tasks_case_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_tasks_case_status ON public.hr_case_tasks USING btree (case_id, status, due_date);


--
-- Name: hr_tc_audit_log_center_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_tc_audit_log_center_id ON public.hr_tc_audit_log USING btree (center_id, id DESC);


--
-- Name: hr_tc_classes_center; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_tc_classes_center ON public.hr_tc_classes USING btree (center_id, training_start_date);


--
-- Name: hr_tc_course_units_course; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_tc_course_units_course ON public.hr_tc_course_units USING btree (course_id, "position");


--
-- Name: hr_tc_enrollments_worker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_tc_enrollments_worker ON public.hr_tc_enrollments USING btree (worker_id);


--
-- Name: hr_tc_quiz_results_worker_unit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_tc_quiz_results_worker_unit ON public.hr_tc_quiz_results USING btree (worker_id, unit_id, created_at DESC);


--
-- Name: hr_worker_activity_log_worker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_worker_activity_log_worker ON public.hr_worker_activity_log USING btree (worker_id, id DESC);


--
-- Name: hr_worker_documents_worker; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hr_worker_documents_worker ON public.hr_worker_documents USING btree (worker_id);


--
-- Name: hr_worker_documents_worker_name; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hr_worker_documents_worker_name ON public.hr_worker_documents USING btree (worker_id, name);


--
-- Name: hr_members hr_members_sync_active_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER hr_members_sync_active_status AFTER UPDATE OF active ON public.hr_members FOR EACH ROW EXECUTE FUNCTION public.hr_sync_member_active_status();


--
-- Name: hr_agency_cert_progress hr_agency_cert_progress_certification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_cert_progress
    ADD CONSTRAINT hr_agency_cert_progress_certification_id_fkey FOREIGN KEY (certification_id) REFERENCES public.hr_agency_certifications(id) ON DELETE CASCADE;


--
-- Name: hr_agency_cert_progress hr_agency_cert_progress_updated_by_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_cert_progress
    ADD CONSTRAINT hr_agency_cert_progress_updated_by_member_id_fkey FOREIGN KEY (updated_by_member_id) REFERENCES public.hr_members(id) ON DELETE SET NULL;


--
-- Name: hr_agency_certificates hr_agency_certificates_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_certificates
    ADD CONSTRAINT hr_agency_certificates_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.hr_agencies(id) ON DELETE CASCADE;


--
-- Name: hr_agency_certifications hr_agency_certifications_decided_by_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_certifications
    ADD CONSTRAINT hr_agency_certifications_decided_by_member_id_fkey FOREIGN KEY (decided_by_member_id) REFERENCES public.hr_members(id) ON DELETE SET NULL;


--
-- Name: hr_agency_certifications hr_agency_certifications_philippines_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_certifications
    ADD CONSTRAINT hr_agency_certifications_philippines_agency_id_fkey FOREIGN KEY (philippines_agency_id) REFERENCES public.hr_agencies(id) ON DELETE CASCADE;


--
-- Name: hr_agency_certifications hr_agency_certifications_requested_by_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_certifications
    ADD CONSTRAINT hr_agency_certifications_requested_by_member_id_fkey FOREIGN KEY (requested_by_member_id) REFERENCES public.hr_members(id) ON DELETE SET NULL;


--
-- Name: hr_agency_certifications hr_agency_certifications_taiwan_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_certifications
    ADD CONSTRAINT hr_agency_certifications_taiwan_agency_id_fkey FOREIGN KEY (taiwan_agency_id) REFERENCES public.hr_agencies(id) ON DELETE CASCADE;


--
-- Name: hr_agency_profiles hr_agency_profiles_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_agency_profiles
    ADD CONSTRAINT hr_agency_profiles_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.hr_agencies(id) ON DELETE CASCADE;


--
-- Name: hr_application_steps hr_application_steps_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_application_steps
    ADD CONSTRAINT hr_application_steps_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.hr_cases(id) ON DELETE CASCADE;


--
-- Name: hr_case_acknowledgments hr_case_acknowledgments_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_acknowledgments
    ADD CONSTRAINT hr_case_acknowledgments_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.hr_cases(id) ON DELETE CASCADE;


--
-- Name: hr_case_activity hr_case_activity_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_activity
    ADD CONSTRAINT hr_case_activity_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.hr_cases(id) ON DELETE CASCADE;


--
-- Name: hr_case_certifications hr_case_certifications_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_certifications
    ADD CONSTRAINT hr_case_certifications_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.hr_cases(id) ON DELETE CASCADE;


--
-- Name: hr_case_requirements hr_case_requirements_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_requirements
    ADD CONSTRAINT hr_case_requirements_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.hr_cases(id) ON DELETE CASCADE;


--
-- Name: hr_case_tasks hr_case_tasks_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_case_tasks
    ADD CONSTRAINT hr_case_tasks_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.hr_cases(id) ON DELETE CASCADE;


--
-- Name: hr_cases hr_cases_assigned_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_cases
    ADD CONSTRAINT hr_cases_assigned_member_id_fkey FOREIGN KEY (assigned_member_id) REFERENCES public.hr_members(id) ON DELETE SET NULL;


--
-- Name: hr_cases hr_cases_assigned_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_cases
    ADD CONSTRAINT hr_cases_assigned_staff_id_fkey FOREIGN KEY (assigned_staff_id) REFERENCES public.hr_staff(id);


--
-- Name: hr_cases hr_cases_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_cases
    ADD CONSTRAINT hr_cases_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.hr_employers(id);


--
-- Name: hr_cases hr_cases_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_cases
    ADD CONSTRAINT hr_cases_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.hr_workers(id);


--
-- Name: hr_chat_messages hr_chat_messages_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_messages
    ADD CONSTRAINT hr_chat_messages_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.hr_members(id) ON DELETE SET NULL;


--
-- Name: hr_chat_messages hr_chat_messages_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_messages
    ADD CONSTRAINT hr_chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.hr_chat_rooms(id) ON DELETE CASCADE;


--
-- Name: hr_chat_participants hr_chat_participants_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_participants
    ADD CONSTRAINT hr_chat_participants_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.hr_members(id) ON DELETE CASCADE;


--
-- Name: hr_chat_participants hr_chat_participants_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_participants
    ADD CONSTRAINT hr_chat_participants_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.hr_chat_rooms(id) ON DELETE CASCADE;


--
-- Name: hr_chat_reads hr_chat_reads_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_reads
    ADD CONSTRAINT hr_chat_reads_room_id_fkey FOREIGN KEY (room_id) REFERENCES public.hr_chat_rooms(id) ON DELETE CASCADE;


--
-- Name: hr_chat_rooms hr_chat_rooms_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_rooms
    ADD CONSTRAINT hr_chat_rooms_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.hr_agencies(id) ON DELETE CASCADE;


--
-- Name: hr_chat_rooms hr_chat_rooms_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_rooms
    ADD CONSTRAINT hr_chat_rooms_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.hr_cases(id) ON DELETE CASCADE;


--
-- Name: hr_chat_rooms hr_chat_rooms_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_chat_rooms
    ADD CONSTRAINT hr_chat_rooms_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.hr_members(id) ON DELETE CASCADE;


--
-- Name: hr_document_files hr_document_files_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_files
    ADD CONSTRAINT hr_document_files_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.hr_document_submissions(id) ON DELETE CASCADE;


--
-- Name: hr_document_reviews hr_document_reviews_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_reviews
    ADD CONSTRAINT hr_document_reviews_submission_id_fkey FOREIGN KEY (submission_id) REFERENCES public.hr_document_submissions(id) ON DELETE CASCADE;


--
-- Name: hr_document_submissions hr_document_submissions_requirement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_document_submissions
    ADD CONSTRAINT hr_document_submissions_requirement_id_fkey FOREIGN KEY (requirement_id) REFERENCES public.hr_worker_documents(id) ON DELETE CASCADE;


--
-- Name: hr_employer_documents hr_employer_documents_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employer_documents
    ADD CONSTRAINT hr_employer_documents_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.hr_employers(id) ON DELETE CASCADE;


--
-- Name: hr_employers hr_employers_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_employers
    ADD CONSTRAINT hr_employers_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.hr_agencies(id);


--
-- Name: hr_expiry_reminder_log hr_expiry_reminder_log_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_expiry_reminder_log
    ADD CONSTRAINT hr_expiry_reminder_log_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.hr_workers(id) ON DELETE CASCADE;


--
-- Name: hr_job_order_agencies hr_job_order_agencies_broker_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_agencies
    ADD CONSTRAINT hr_job_order_agencies_broker_member_id_fkey FOREIGN KEY (broker_member_id) REFERENCES public.hr_members(id) ON DELETE SET NULL;


--
-- Name: hr_job_order_agencies hr_job_order_agencies_job_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_agencies
    ADD CONSTRAINT hr_job_order_agencies_job_order_id_fkey FOREIGN KEY (job_order_id) REFERENCES public.hr_job_orders(id) ON DELETE CASCADE;


--
-- Name: hr_job_order_agencies hr_job_order_agencies_taiwan_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_agencies
    ADD CONSTRAINT hr_job_order_agencies_taiwan_agency_id_fkey FOREIGN KEY (taiwan_agency_id) REFERENCES public.hr_agencies(id);


--
-- Name: hr_job_order_candidates hr_job_order_candidates_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_candidates
    ADD CONSTRAINT hr_job_order_candidates_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.hr_cases(id);


--
-- Name: hr_job_order_candidates hr_job_order_candidates_deposit_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_candidates
    ADD CONSTRAINT hr_job_order_candidates_deposit_recorded_by_fkey FOREIGN KEY (deposit_recorded_by) REFERENCES public.hr_members(id) ON DELETE SET NULL;


--
-- Name: hr_job_order_candidates hr_job_order_candidates_proposed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_candidates
    ADD CONSTRAINT hr_job_order_candidates_proposed_by_fkey FOREIGN KEY (proposed_by) REFERENCES public.hr_members(id);


--
-- Name: hr_job_order_candidates hr_job_order_candidates_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_candidates
    ADD CONSTRAINT hr_job_order_candidates_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.hr_job_order_routes(id) ON DELETE CASCADE;


--
-- Name: hr_job_order_candidates hr_job_order_candidates_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_candidates
    ADD CONSTRAINT hr_job_order_candidates_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.hr_workers(id);


--
-- Name: hr_job_order_routes hr_job_order_routes_order_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_routes
    ADD CONSTRAINT hr_job_order_routes_order_agency_id_fkey FOREIGN KEY (order_agency_id) REFERENCES public.hr_job_order_agencies(id) ON DELETE CASCADE;


--
-- Name: hr_job_order_routes hr_job_order_routes_philippines_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_order_routes
    ADD CONSTRAINT hr_job_order_routes_philippines_agency_id_fkey FOREIGN KEY (philippines_agency_id) REFERENCES public.hr_agencies(id);


--
-- Name: hr_job_orders hr_job_orders_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_job_orders
    ADD CONSTRAINT hr_job_orders_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.hr_employers(id);


--
-- Name: hr_members hr_members_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_members
    ADD CONSTRAINT hr_members_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.hr_agencies(id) ON DELETE CASCADE;


--
-- Name: hr_members hr_members_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_members
    ADD CONSTRAINT hr_members_employer_id_fkey FOREIGN KEY (employer_id) REFERENCES public.hr_employers(id) ON DELETE CASCADE;


--
-- Name: hr_members hr_members_last_employer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_members
    ADD CONSTRAINT hr_members_last_employer_id_fkey FOREIGN KEY (last_employer_id) REFERENCES public.hr_employers(id) ON DELETE SET NULL;


--
-- Name: hr_members hr_members_last_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_members
    ADD CONSTRAINT hr_members_last_worker_id_fkey FOREIGN KEY (last_worker_id) REFERENCES public.hr_workers(id) ON DELETE SET NULL;


--
-- Name: hr_members hr_members_requested_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_members
    ADD CONSTRAINT hr_members_requested_agency_id_fkey FOREIGN KEY (requested_agency_id) REFERENCES public.hr_agencies(id) ON DELETE SET NULL;


--
-- Name: hr_members hr_members_training_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_members
    ADD CONSTRAINT hr_members_training_center_id_fkey FOREIGN KEY (training_center_id) REFERENCES public.hr_members(id) ON DELETE SET NULL;


--
-- Name: hr_members hr_members_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_members
    ADD CONSTRAINT hr_members_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.hr_workers(id) ON DELETE CASCADE;


--
-- Name: hr_notification_outbox hr_notification_outbox_recipient_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_notification_outbox
    ADD CONSTRAINT hr_notification_outbox_recipient_member_id_fkey FOREIGN KEY (recipient_member_id) REFERENCES public.hr_members(id) ON DELETE SET NULL;


--
-- Name: hr_notification_outbox hr_notification_outbox_subject_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_notification_outbox
    ADD CONSTRAINT hr_notification_outbox_subject_member_id_fkey FOREIGN KEY (subject_member_id) REFERENCES public.hr_members(id) ON DELETE SET NULL;


--
-- Name: hr_tc_batches hr_tc_batches_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_batches
    ADD CONSTRAINT hr_tc_batches_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.hr_tc_classes(id) ON DELETE CASCADE;


--
-- Name: hr_tc_certifications hr_tc_certifications_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_certifications
    ADD CONSTRAINT hr_tc_certifications_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.hr_members(id) ON DELETE CASCADE;


--
-- Name: hr_tc_classes hr_tc_classes_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_classes
    ADD CONSTRAINT hr_tc_classes_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.hr_members(id) ON DELETE CASCADE;


--
-- Name: hr_tc_classes hr_tc_classes_certification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_classes
    ADD CONSTRAINT hr_tc_classes_certification_id_fkey FOREIGN KEY (certification_id) REFERENCES public.hr_tc_certifications(id) ON DELETE RESTRICT;


--
-- Name: hr_tc_classes hr_tc_classes_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_classes
    ADD CONSTRAINT hr_tc_classes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.hr_tc_courses(id) ON DELETE RESTRICT;


--
-- Name: hr_tc_classes hr_tc_classes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_classes
    ADD CONSTRAINT hr_tc_classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.hr_tc_teachers(id) ON DELETE RESTRICT;


--
-- Name: hr_tc_course_units hr_tc_course_units_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_course_units
    ADD CONSTRAINT hr_tc_course_units_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.hr_members(id) ON DELETE CASCADE;


--
-- Name: hr_tc_course_units hr_tc_course_units_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_course_units
    ADD CONSTRAINT hr_tc_course_units_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.hr_tc_courses(id) ON DELETE CASCADE;


--
-- Name: hr_tc_courses hr_tc_courses_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_courses
    ADD CONSTRAINT hr_tc_courses_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.hr_members(id) ON DELETE CASCADE;


--
-- Name: hr_tc_courses hr_tc_courses_certification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_courses
    ADD CONSTRAINT hr_tc_courses_certification_id_fkey FOREIGN KEY (certification_id) REFERENCES public.hr_tc_certifications(id) ON DELETE RESTRICT;


--
-- Name: hr_tc_enrollments hr_tc_enrollments_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_enrollments
    ADD CONSTRAINT hr_tc_enrollments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.hr_tc_classes(id) ON DELETE CASCADE;


--
-- Name: hr_tc_enrollments hr_tc_enrollments_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_enrollments
    ADD CONSTRAINT hr_tc_enrollments_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.hr_workers(id) ON DELETE CASCADE;


--
-- Name: hr_tc_quiz_results hr_tc_quiz_results_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_quiz_results
    ADD CONSTRAINT hr_tc_quiz_results_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.hr_tc_course_units(id) ON DELETE CASCADE;


--
-- Name: hr_tc_quiz_results hr_tc_quiz_results_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_quiz_results
    ADD CONSTRAINT hr_tc_quiz_results_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.hr_workers(id) ON DELETE CASCADE;


--
-- Name: hr_tc_teacher_certifications hr_tc_teacher_certifications_certification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_teacher_certifications
    ADD CONSTRAINT hr_tc_teacher_certifications_certification_id_fkey FOREIGN KEY (certification_id) REFERENCES public.hr_tc_certifications(id) ON DELETE CASCADE;


--
-- Name: hr_tc_teacher_certifications hr_tc_teacher_certifications_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_teacher_certifications
    ADD CONSTRAINT hr_tc_teacher_certifications_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.hr_tc_teachers(id) ON DELETE CASCADE;


--
-- Name: hr_tc_teachers hr_tc_teachers_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_teachers
    ADD CONSTRAINT hr_tc_teachers_center_id_fkey FOREIGN KEY (center_id) REFERENCES public.hr_members(id) ON DELETE CASCADE;


--
-- Name: hr_tc_unit_progress hr_tc_unit_progress_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_unit_progress
    ADD CONSTRAINT hr_tc_unit_progress_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.hr_tc_course_units(id) ON DELETE CASCADE;


--
-- Name: hr_tc_unit_progress hr_tc_unit_progress_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_tc_unit_progress
    ADD CONSTRAINT hr_tc_unit_progress_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.hr_workers(id) ON DELETE CASCADE;


--
-- Name: hr_worker_documents hr_worker_documents_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_worker_documents
    ADD CONSTRAINT hr_worker_documents_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.hr_workers(id) ON DELETE CASCADE;


--
-- Name: hr_worker_health_training hr_worker_health_training_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_worker_health_training
    ADD CONSTRAINT hr_worker_health_training_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.hr_workers(id) ON DELETE CASCADE;


--
-- Name: hr_worker_progress_steps hr_worker_progress_steps_worker_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_worker_progress_steps
    ADD CONSTRAINT hr_worker_progress_steps_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES public.hr_workers(id) ON DELETE CASCADE;


--
-- Name: hr_workers hr_workers_agency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hr_workers
    ADD CONSTRAINT hr_workers_agency_id_fkey FOREIGN KEY (agency_id) REFERENCES public.hr_agencies(id);


--
-- PostgreSQL database dump complete
--

\unrestrict l8NmjHU4ImXS3zQ8fg7OhF9ldEOziWIWihugfxKu4xUBi1Gaz9wKBqe4Ek3eZIg

