--
-- PostgreSQL database dump
--

-- Dumped from database version 13.1 (Debian 13.1-1.pgdg100+1)
-- Dumped by pg_dump version 13.1

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

DROP DATABASE IF EXISTS bpdb;
--
-- Name: bpdb; Type: DATABASE; Schema: -; Owner: bpuser
--

CREATE DATABASE bpdb WITH TEMPLATE = template0 ENCODING = 'UTF8';


ALTER DATABASE bpdb OWNER TO bpuser;

\connect bpdb
--CONNECT to 'bpdb' AS bpuser;

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
-- Name: bpschema; Type: SCHEMA; Schema: -; Owner: bpuser
--

CREATE SCHEMA bpschema;


ALTER SCHEMA bpschema OWNER TO bpuser;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: user_profile; Type: TABLE; Schema: bpschema; Owner: bpuser
--

CREATE TABLE bpschema.user_profile (
    id integer NOT NULL,
    email character varying NOT NULL UNIQUE,
    first_name character varying,
    last_name character varying,
    created timestamptz default now()

--    notes character varying
);


ALTER TABLE bpschema.user_profile OWNER TO bpuser;

--
-- Name: user_profile_id_seq; Type: SEQUENCE; Schema: bpschema; Owner: bpuser
--

CREATE SEQUENCE bpschema.user_profile_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE bpschema.user_profile_id_seq OWNER TO bpuser;

--
-- Name: user_profile_id_seq; Type: SEQUENCE OWNED BY; Schema: bpschema; Owner: bpuser
--

ALTER SEQUENCE bpschema.user_profile_id_seq OWNED BY bpschema.user_profile.id;


--
-- Name: user_profile id; Type: DEFAULT; Schema: bpschema; Owner: bpuser
--

ALTER TABLE ONLY bpschema.user_profile ALTER COLUMN id SET DEFAULT nextval('bpschema.user_profile_id_seq'::regclass);


--
-- Name: user_profile user_profile_pkey; Type: CONSTRAINT; Schema: bpschema; Owner: bpuser
--

ALTER TABLE ONLY bpschema.user_profile
    ADD CONSTRAINT user_profile_pkey PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

-- Set default search path
ALTER ROLE bpuser SET search_path TO bpschema;