--
-- PostgreSQL database dump
--

\restrict sH2f3dxNu36ysitvS7290pzPGf1DqTKdguuYYiAa7w8Y3uEzEhuxmjJJfFz7Q9e

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
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
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: command_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.command_logs (
    id text NOT NULL,
    "roomId" text,
    "deviceId" text,
    action text NOT NULL,
    "triggerType" text NOT NULL,
    "triggeredByUserId" text,
    "scheduleId" text,
    "executedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status text NOT NULL,
    notes text
);


ALTER TABLE public.command_logs OWNER TO postgres;

--
-- Name: devices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.devices (
    id text NOT NULL,
    eui text NOT NULL,
    "roomId" text,
    "gatewayId" text,
    name text NOT NULL,
    "deviceType" text,
    "intervalMinutes" integer DEFAULT 15 NOT NULL,
    status text DEFAULT 'off'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lastSeenAt" timestamp(3) without time zone,
    "commFailedAt" timestamp(3) without time zone
);


ALTER TABLE public.devices OWNER TO postgres;

--
-- Name: energy_readings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.energy_readings (
    id bigint NOT NULL,
    "deviceId" text NOT NULL,
    "powerWatt" double precision,
    "usageKwh" double precision,
    "recordedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.energy_readings OWNER TO postgres;

--
-- Name: energy_readings_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.energy_readings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.energy_readings_id_seq OWNER TO postgres;

--
-- Name: energy_readings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.energy_readings_id_seq OWNED BY public.energy_readings.id;


--
-- Name: gateways; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.gateways (
    id text NOT NULL,
    eui text NOT NULL,
    name text NOT NULL,
    description text,
    simcard text,
    "powerSource" text,
    "modelUnit" text,
    "installationDate" timestamp(3) without time zone,
    status text DEFAULT 'offline'::text NOT NULL,
    "lastSeenAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "installedById" text
);


ALTER TABLE public.gateways OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id text NOT NULL,
    module text NOT NULL,
    action text NOT NULL
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.refresh_tokens (
    id text NOT NULL,
    "tokenHash" text NOT NULL,
    "userId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.refresh_tokens OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    "roleId" text NOT NULL,
    "permissionId" text NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "isSystem" boolean DEFAULT false NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.rooms (
    id text NOT NULL,
    name text NOT NULL,
    "picName" text,
    "picPhone" text,
    location text,
    description text,
    "imageUrl" text,
    "isCritical" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public.rooms OWNER TO postgres;

--
-- Name: schedules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.schedules (
    id text NOT NULL,
    "roomId" text NOT NULL,
    action text NOT NULL,
    "scheduledDate" timestamp(3) without time zone NOT NULL,
    "startTime" text NOT NULL,
    "endTime" text,
    "repeatType" text DEFAULT 'none'::text NOT NULL,
    "repeatDays" jsonb,
    status text DEFAULT 'active'::text NOT NULL,
    "createdById" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    name text NOT NULL,
    description text
);


ALTER TABLE public.schedules OWNER TO postgres;

--
-- Name: security_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.security_events (
    id text NOT NULL,
    type text NOT NULL,
    username text,
    "userId" text,
    ip text,
    "userAgent" text,
    detail text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.security_events OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    "fullName" text NOT NULL,
    username text NOT NULL,
    email text NOT NULL,
    "passwordHash" text NOT NULL,
    phone text,
    address text,
    "avatarUrl" text,
    "roleId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lastActiveAt" timestamp(3) without time zone,
    "failedLoginCount" integer DEFAULT 0 NOT NULL,
    "lockedUntil" timestamp(3) without time zone
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: webhook_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.webhook_events (
    id text NOT NULL,
    source text NOT NULL,
    "eventId" text,
    "tbDeviceId" text,
    payload jsonb NOT NULL,
    status text NOT NULL,
    "errorMessage" text,
    "receivedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.webhook_events OWNER TO postgres;

--
-- Name: energy_readings id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.energy_readings ALTER COLUMN id SET DEFAULT nextval('public.energy_readings_id_seq'::regclass);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
b46fa30c-c7d9-466f-8c78-3d023993f027	d3dfac99d0d9978065d1d2dbb8b7b9873f7d15b15003b6cea84999d388e8ba29	2026-09-18 08:54:10.865233+00	20260819042505_init	\N	\N	2026-09-18 08:54:10.169854+00	1
73d1ccda-8b19-493d-988d-e9ffa49fd5ff	b05567266ef05f466988f16957b79f20a4327c5c51db9172718e67f31c24b1be	2026-09-18 08:54:11.703347+00	20260916093000_device_eui_replaces_tb_device_id	\N	\N	2026-09-18 08:54:11.665266+00	1
6b3a8261-92bf-4745-92a9-657b84304bf2	447902a8ffd30f2aae8ab7ede35236fd63d875bacf97bd66d21e2bd054f8b470	2026-09-18 08:54:10.910363+00	20260821045147_add_gateway_timestamps	\N	\N	2026-09-18 08:54:10.874222+00	1
ae9032d8-ab87-4374-8fed-8a541afced08	a320c6677dc6dd63effe284d77a6f2d9e3e6e4db7dddd86c3f9cd4383992ac61	2026-09-18 08:54:10.949718+00	20260821045558_admin	\N	\N	2026-09-18 08:54:10.919787+00	1
e4590f33-b2ef-4d89-8ea4-675641e1012d	9412b8ee808c01f52768caa985e9a95efb27624cbf3f886cb54b08bec8e56047	2026-09-18 08:54:11.018216+00	20260822053712_add_tb_device_id	\N	\N	2026-09-18 08:54:10.95869+00	1
1560bfcd-c2a7-4c28-88c9-adc4b6305861	516367a566e878c71c115164edff2ef31860841d0f08804c32f11079711868d0	2026-09-22 08:13:08.873098+00	20260921074608_device_room_gateway_optional	\N	\N	2026-09-22 08:13:08.805527+00	1
ecdcc6c5-8c41-4d14-8b21-a49e088653c0	6b8c204ef63a71711ebb7e6e96b5c171a82f6e7ba4832d5397beceb533704cd8	2026-09-18 08:54:11.056451+00	20260824040149_add_device_last_seen	\N	\N	2026-09-18 08:54:11.028375+00	1
33a2c453-c8bf-48fc-8443-bc03f143e3ed	3fbaefb1727a8c131b69c94abb39ecfbf414d3ee5e46532adf8da73158ddbda2	2026-09-18 08:54:11.118689+00	20260826090412_add_gateway_installed_by	\N	\N	2026-09-18 08:54:11.066749+00	1
dee22d39-f02a-4724-9835-d77fd881b022	508742154444653afb5d8ba42cfc46a62dc3cabebb4a95286d7f0877fd6c94ab	2026-09-18 08:54:11.168621+00	20260826162659_add_user_last_active_at	\N	\N	2026-09-18 08:54:11.139115+00	1
355479f4-246c-4218-adbc-72016cff3f1d	7a5a4e5b9fd9e6a1bce53253aa2b638baf13d06d55b79035d436ee9b6ff4d1e8	2026-09-22 08:13:08.972499+00	20260921095704_schedule_name_room_level	\N	\N	2026-09-22 08:13:08.883794+00	1
73bfe02b-cd7d-4b71-9795-4c3be34aac24	caa0bdb7c01adccdaaed14f33e08d65cd9316d7c0f4d20809b4f923aa3f7b444	2026-09-18 08:54:11.29332+00	20260827045551_add_webhook_events	\N	\N	2026-09-18 08:54:11.177886+00	1
0a87cd40-75e4-42d1-b5a1-5cbf3528a789	122eebef402c4414bcaa696f960bb264d622ae339728487e79832f5e75c6cb55	2026-09-18 08:54:11.420271+00	20260904063042_add_refresh_tokens	\N	\N	2026-09-18 08:54:11.303831+00	1
8dac501e-d482-4153-a181-405c21d2493c	d1a34fa7982f3761e8089995dd795980d38fc466fc9029e4861c93148783ed3a	2026-09-18 08:54:11.524667+00	20260904163953_add_login_lockout	\N	\N	2026-09-18 08:54:11.430511+00	1
dc672bd3-481d-4943-b266-f7ad18c18a9f	29a54a03ae6c1154f13cb9b82815fa8160bb2226d31e0a1cdfd1db1fcd8adc21	2026-09-22 08:13:09.007163+00	20260921095756_schedule_name_room_level	\N	\N	2026-09-22 08:13:08.981341+00	1
c208e151-6e9b-4ac7-bbf9-1b9d3376b0c9	3a7534ab8217ef4d76d0233e82b7181e3aff9a694b4661efe1eb1d9e62dbb6fe	2026-09-18 08:54:11.57125+00	20260906035249_device_interval_min_15	\N	\N	2026-09-18 08:54:11.535721+00	1
71bf33bf-8d6f-4221-b276-948c837f1bce	f6854601ff74d2e92b8348a5565c1552557bf5548316ed27d9cd23cc1a55a2f1	2026-09-18 08:54:11.615777+00	20260916040336_command_log_sent_at	\N	\N	2026-09-18 08:54:11.582189+00	1
2225b93a-3a76-47ff-ab21-490b11cd954b	76fd6903c95803fe249946fbd473f995f0c294303fdb02a51a703d40bbe10410	2026-09-18 08:54:11.655755+00	20260916080212_device_comm_failed_at	\N	\N	2026-09-18 08:54:11.626481+00	1
\.


--
-- Data for Name: command_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.command_logs (id, "roomId", "deviceId", action, "triggerType", "triggeredByUserId", "scheduleId", "executedAt", status, notes) FROM stdin;
0ad5253a-447e-4600-88ac-cdbeedeee177	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	off	manual	a7952ab6-da7e-40e3-9888-3e9752777961	\N	2026-09-21 05:02:48.87	success	Relai sudah dalam keadaan yang diminta, downlink dilewati
a3eceeb1-36c5-492a-abdd-24d102414349	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	on	manual	a7952ab6-da7e-40e3-9888-3e9752777961	\N	2026-09-22 08:16:18.525	skipped	Device offline (belum ada laporan dari meter), perintah tidak dikirim
c2acf29e-5fba-4f73-a330-12a867aad606	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	on	scheduled	\N	3ba343fe-052b-4dbd-bf48-a220cd4feaf4	2026-09-23 05:27:32.909	skipped	Device offline (belum ada laporan dari meter), perintah tidak dikirim
8cca3cc4-5b7d-4b51-a093-1d0c30e0cc09	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	on	manual	a7952ab6-da7e-40e3-9888-3e9752777961	\N	2026-09-21 05:02:56.922	success	\N
7f4d0bb0-ace5-44b6-9a23-53c723a6ea8b	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	off	scheduled	\N	3ba343fe-052b-4dbd-bf48-a220cd4feaf4	2026-09-23 05:28:32.912	success	Relai sudah dalam keadaan yang diminta, downlink dilewati
f4767be5-418d-48fe-b457-2b3f06e291e9	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	off	manual	a7952ab6-da7e-40e3-9888-3e9752777961	\N	2026-09-21 05:03:44.19	success	\N
dfb3db0a-7749-44c0-8db0-fc73e6cebd56	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	on	scheduled	\N	\N	2026-09-21 05:06:48.83	failed	Device offline (meter berhenti melapor), perintah dihentikan. Coba lagi setelah meter kembali online.
af8f5349-bb8b-4e33-a5b5-2246b708ac5f	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	on	manual	bc6664ef-6c60-436d-9936-0d0e09043462	\N	2026-09-22 07:44:12.581	skipped	Device offline (belum ada laporan dari meter), perintah tidak dikirim
4f098eff-aa3a-4a2e-88a2-c4da92cef128	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	on	manual	bc6664ef-6c60-436d-9936-0d0e09043462	\N	2026-09-22 07:44:18.92	skipped	Device offline (belum ada laporan dari meter), perintah tidak dikirim
63d9f8fe-8934-4b40-9d3c-fb09a9c4016e	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	on	manual	bc6664ef-6c60-436d-9936-0d0e09043462	\N	2026-09-22 07:44:19.872	skipped	Device offline (belum ada laporan dari meter), perintah tidak dikirim
4a8936aa-be52-42fc-a182-abf45d3fbf9d	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	on	manual	bc6664ef-6c60-436d-9936-0d0e09043462	\N	2026-09-22 07:44:20.081	skipped	Device offline (belum ada laporan dari meter), perintah tidak dikirim
e3ff1ebe-1a25-4fff-a5b7-2d615b550d2e	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	on	manual	bc6664ef-6c60-436d-9936-0d0e09043462	\N	2026-09-22 07:44:20.288	skipped	Device offline (belum ada laporan dari meter), perintah tidak dikirim
693ac16e-b79f-4f76-a3b0-1e20ce47bcfa	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	on	manual	bc6664ef-6c60-436d-9936-0d0e09043462	\N	2026-09-22 07:44:25.155	skipped	Device offline (belum ada laporan dari meter), perintah tidak dikirim
f1917f17-a864-42c6-96d7-29d2f5c35b5a	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	on	manual	bc6664ef-6c60-436d-9936-0d0e09043462	\N	2026-09-22 07:44:34.315	skipped	Device offline (belum ada laporan dari meter), perintah tidak dikirim
2d66d398-6b01-4b6a-a2a5-bb6f9f8f4bbb	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	on	manual	bc6664ef-6c60-436d-9936-0d0e09043462	\N	2026-09-22 07:46:20.206	success	\N
fd0596e8-b870-4599-924f-f29ca8c5239b	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	off	manual	bc6664ef-6c60-436d-9936-0d0e09043462	\N	2026-09-22 07:52:19.687	skipped	Device offline (belum ada laporan dari meter), perintah tidak dikirim
7be4fc3d-3b7b-474a-8231-94137a245bb3	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	off	manual	bc6664ef-6c60-436d-9936-0d0e09043462	\N	2026-09-22 07:53:28.93	success	\N
ff003d16-598e-4c2d-a65c-6bb92c03a263	df9c647f-e1a6-4988-8fba-a9896cd9524a	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	on	manual	a7952ab6-da7e-40e3-9888-3e9752777961	\N	2026-09-22 08:14:57.013	skipped	Device offline (belum ada laporan dari meter), perintah tidak dikirim
\.


--
-- Data for Name: devices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.devices (id, eui, "roomId", "gatewayId", name, "deviceType", "intervalMinutes", status, "createdAt", "updatedAt", "lastSeenAt", "commFailedAt") FROM stdin;
a3f64c6b-d527-4279-aa83-fdee345148a0	6027ef8c181c964a	\N	\N	wkwk	\N	15	off	2026-09-22 08:13:32.537	2026-09-22 08:13:32.537	\N	\N
7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	08000000410000e4	df9c647f-e1a6-4988-8fba-a9896cd9524a	125ca05c-2509-4984-ae90-ead41b1868fb	KwH Meter	Lampu	1	off	2026-09-21 05:00:26.322	2026-09-23 06:05:10.853	2026-09-23 06:05:10.852	\N
\.


--
-- Data for Name: energy_readings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.energy_readings (id, "deviceId", "powerWatt", "usageKwh", "recordedAt") FROM stdin;
1	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.167	2026-09-21 05:01:50.518
2	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.167	2026-09-21 05:05:18.366
3	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-21 09:32:19.085
4	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-21 09:35:01.091
5	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-21 09:39:49.701
6	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 02:25:21.355
7	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 02:27:26.877
8	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 02:34:10.221
9	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 02:37:11.96
10	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 02:38:16.564
11	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 02:40:16.844
12	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 02:45:33.227
13	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 02:47:22.301
14	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 02:49:25.805
15	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 02:52:26.844
16	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 02:54:29.013
17	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 02:57:21.73
18	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 02:59:21.868
19	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:01:22.116
20	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:03:21.374
21	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:05:21.62
22	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:07:21.87
23	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:09:22.131
24	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:11:21.394
25	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:13:21.667
26	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:15:21.921
27	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:17:22.185
28	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:19:21.456
29	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:21:21.725
30	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:23:21.969
31	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:25:22.222
32	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:27:21.479
33	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:29:21.747
34	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:31:22.008
35	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:33:22.301
36	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:35:21.566
37	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:37:21.812
38	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:39:22.072
39	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:41:22.339
40	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:43:21.594
41	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:45:21.874
42	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:47:22.172
43	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:49:21.421
44	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:51:21.689
45	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:53:21.931
46	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:55:22.175
47	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:57:21.432
48	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 03:59:21.721
49	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:01:21.989
50	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:03:22.258
51	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:05:21.572
52	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:07:21.801
53	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:09:22.069
54	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:11:22.359
55	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:13:21.644
56	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:15:21.922
57	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:17:22.226
58	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:19:21.471
59	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:22:56.743
60	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:30:48.493
61	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:41:46.457
62	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:43:46.487
63	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:45:46.517
64	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:52:02.709
65	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 04:54:56.326
66	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:00:56.673
67	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:09:47.78
68	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:11:47.807
69	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:14:56.03
70	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:16:57.018
71	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:18:48.037
72	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:23:47.992
73	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:26:54.425
74	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:32:12.651
75	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:34:12.616
76	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:36:13.085
77	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:38:20.575
78	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:40:21.923
79	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:42:45.548
80	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:44:45.576
81	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:47:50.864
82	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:50:00.361
83	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:52:00.364
84	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:54:00.406
85	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 05:56:00.414
86	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 06:04:22.063
87	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 06:06:30.881
88	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 06:14:21.777
89	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 06:20:21.671
90	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 06:24:08.126
91	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 06:29:21.95
92	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 06:37:18.191
93	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 06:46:35.52
94	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 06:49:34.33
95	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 07:00:20.517
96	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 07:03:48.01
97	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 07:06:02.351
98	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 07:11:07.254
99	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 07:12:18.682
100	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 07:17:32.711
101	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 07:25:32.386
102	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.168	2026-09-22 07:27:22.271
103	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.171	2026-09-22 07:52:47.077
104	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.175	2026-09-22 07:59:17.895
105	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.175	2026-09-22 08:03:37.457
106	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.175	2026-09-22 08:05:51.226
107	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.175	2026-09-22 08:07:51.269
108	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.175	2026-09-22 08:09:51.291
109	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.175	2026-09-22 08:11:51.314
110	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.175	2026-09-22 08:23:38.27
111	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.177	2026-09-22 08:37:18.191
112	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.194	2026-09-22 08:56:15.131
113	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.199	2026-09-22 09:02:49.239
114	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.215	2026-09-22 09:14:15.855
115	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.221	2026-09-22 09:19:15.301
116	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.249	2026-09-22 09:42:46.743
117	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.252	2026-09-22 09:44:43.41
118	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.261	2026-09-22 09:51:38.148
119	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-22 10:02:57.159
120	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 02:10:26.457
121	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 02:12:42.142
122	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 02:20:31.444
123	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 02:30:43.066
124	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 02:38:47.783
125	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 02:45:34.187
126	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 02:57:44.283
127	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 03:05:24.018
128	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 03:14:48.189
129	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 03:17:38.329
130	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 03:21:37.734
131	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 03:42:29.691
132	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 03:53:19.485
133	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 03:56:24.581
134	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 04:11:38.152
135	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 04:20:31.803
136	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 04:23:37.89
137	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 04:35:21.752
138	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 04:39:36.119
139	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 04:50:43.423
140	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 05:01:43.619
141	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 05:11:09.051
142	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 05:17:48.038
143	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 05:21:52.349
144	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 05:27:57.889
145	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 05:40:38.05
146	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 05:47:38.089
147	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 05:55:36.532
148	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 05:58:57.543
149	7ba0c5d4-a59d-4b17-b9aa-7ec9e183955a	\N	206.271	2026-09-23 06:05:10.868
\.


--
-- Data for Name: gateways; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.gateways (id, eui, name, description, simcard, "powerSource", "modelUnit", "installationDate", status, "lastSeenAt", "createdAt", "updatedAt", "installedById") FROM stdin;
29876d12-56a2-4a39-90e4-c91e7b1575b8	7276ff0045060ffa	ada	\N	\N	\N	\N	\N	offline	\N	2026-09-18 08:57:11.806	2026-09-18 08:57:11.806	\N
125ca05c-2509-4984-ae90-ead41b1868fb	7276ff0045060ffb	Kerlink	\N	\N	\N	\N	\N	online	2026-09-23 09:16:02.376	2026-09-18 08:57:11.788	2026-09-23 09:16:06.82	\N
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, module, action) FROM stdin;
360cdd3f-c1be-4392-8fa6-3e3abbef0eca	dashboard	view
b2a9c920-50ad-43c0-884c-bf4919e26aaa	schedule	view
94dd330a-c7cc-4cdc-a7bb-a794067ec387	schedule	create
e7fa50bd-7369-4fba-8402-abd3ac53a326	schedule	edit
ff4d079c-32f4-4b8f-8668-0fda75ce2b7b	schedule	delete
fad860d6-f73d-4d6d-ba03-d840b98dd504	room	view
0d4fbe80-940b-41c2-bece-e087113c86d8	room	create
05edb49a-fb43-40e1-8085-e0a776ff4a97	room	edit
be18ad2a-f7ac-4279-bb99-dd42a8f7b389	room	delete
36885116-7cc7-41bb-a0be-1524962b4b46	room	power_control
050d1723-3552-4964-94e1-d94a8eb03356	device	view
6cacafe5-6f3d-41d1-b858-781c967ba823	device	create
de8a28e3-b228-4938-ba4a-2fdbf8fe7169	device	edit
1491f64d-bb8c-41a1-a2fb-92fe2b23c6d5	device	delete
7d05a599-3b0b-492e-acbb-d6a9bca469f5	device	power_control
bbad99ef-c39d-4f92-8b40-2414b2b05288	gateway	view
9750fea1-71f2-4023-a46e-e3557cfec025	gateway	create
657071cb-8718-4737-8e0b-03136a392bcb	gateway	edit
a2534afc-3ccf-4423-bb4c-11526f068eae	gateway	delete
22bfb5b6-6e0b-49ed-8333-531057828f6e	report	view
16cf1478-cd96-4fdc-b783-a8c49d9420d4	report	list
aac3e52c-e4b0-415c-ab1d-0b46e88880df	report	export
55d8a60d-d779-4093-9da4-34964159eec0	user	view
69ef46c9-8c6c-4dc1-bde4-46f2ccf30790	user	create
0cf4bb91-10a0-4488-acd1-2affd830e6e2	user	edit
d0c38b12-5aa1-4fd9-a14b-9528ff7d9705	user	delete
934851a5-84fc-4a2e-96fe-25c49461e674	role	view
4298a4a1-f7f8-4254-93a2-b17ad707f722	role	create
e3f148de-8416-4411-b27f-4ff8f0560ee5	role	edit
84b23d37-957a-4762-85c8-255eb0235f1c	role	delete
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.refresh_tokens (id, "tokenHash", "userId", "expiresAt", "revokedAt", "createdAt") FROM stdin;
50219af8-f560-4746-b476-6e406b299e99	42574ecf54bd6e95f477236d7bdc894fe020b8f0ae3db82693a61e68eebe62a8	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 03:14:56.679	\N	2026-09-21 03:14:56.679
a8725218-5522-4926-9cdb-0a5dcef80ac2	a5d83eb7b84e898bd9485cf1d8aae0c2a065bd93b2955d710ae4e667cfa3773a	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 03:29:34.52	\N	2026-09-21 03:29:34.521
0d0ed737-4fb8-4f88-96a1-d3044688582a	a3f34e368ed04c9d93b2e10ca2df4ef91f9b0b47ec1296b4af0868c076f3a58d	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 03:11:53.998	2026-09-21 04:07:32.033	2026-09-21 03:11:53.998
66606cc9-8a27-4267-bf11-f484e45254be	6efc4b92891f200951aae9550bc6af236d94fdf1459d0e00aa7cc66ccc444587	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:13:40.509	\N	2026-09-21 04:13:40.51
bb005851-a183-465b-bb95-cd21f06f014a	1b770aefa9f84e55db696660b06bd0fad0535d3d2c547db4128ea94690145ab8	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:30:08.95	\N	2026-09-21 04:30:08.951
11363ec9-311f-48d8-883a-a03417b56c71	ce2853190939323cfedc8892e583fe42e7e1dbfe4c0b57f50fa31926cf661cbd	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:30:20.428	\N	2026-09-21 04:30:20.428
6b386c7c-9755-4056-be7a-200e802dfc6f	1b214174668e4f986bf0afca572d10433cb84ea3eede423b2cab4c95fa424195	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:30:22.848	\N	2026-09-21 04:30:22.849
30956a46-1611-4f7a-87e5-3911a92f53c9	67f999ab63acea948564fd118d4b4b007aea1568e53fdbde85fa0b245c422efa	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:30:23.497	\N	2026-09-21 04:30:23.498
a6590941-0028-4be1-87cf-b1b43d90f4f7	4577a5bf1e19e5acca109a4e86a43a6739ebd1dd4f61b736681ca0ed94e11a42	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:30:23.87	\N	2026-09-21 04:30:23.871
74923d35-b35e-4ade-80d9-18fa860fd0c7	d6d497ab13de1424714790b09ccfa1f5ed5aa086867a79df78a678a1cbc2f8f2	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:30:29.109	\N	2026-09-21 04:30:29.109
d7617f46-ad2d-41e6-acac-70af9add9b08	225d7acfe35901718d4db3f4dbc20d7f37f55308ec3735908d039188d62d865a	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:30:29.637	\N	2026-09-21 04:30:29.638
55bc6434-27e6-40d7-a5ba-8a481edb922c	f5a7ec61e5708ed513a95d70ebfa915da2c696e7c20368e4449e7e17fbb4c4e2	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:30:30.016	\N	2026-09-21 04:30:30.016
c0d7cfe6-d092-4cee-a6f9-e8610fcaa429	557d777d5c9e43e2691d52a2b32b3aefbe27cae8057d09726a220e2769cf7c75	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:30:30.416	\N	2026-09-21 04:30:30.417
4cd87c60-ecc3-4aba-88a6-1949d2e1a1de	21c473771150b92d86294103f2107068b59155641d4d0a9c80b7f1a90dd8c6fb	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:30:30.82	\N	2026-09-21 04:30:30.82
78558abf-2b9c-4486-b97c-1ada20b5a047	f589f13e942456bb51c9aaff7563fb00e41401e9973880affd9b7a526998f019	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:30:48.745	\N	2026-09-21 04:30:48.745
51032fca-5b09-4a66-8abf-0509e14a41c0	932fdcecadd2826949a81bb8931832b2e881be7103b5e2259f6ca8b2535ff6d3	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:33:34.992	2026-09-21 04:33:46.657	2026-09-21 04:33:34.992
d89e494a-d0b7-430d-accd-16cca31c96e8	e8bb310ea76d86ffc4e74faf1228e199aa94e37b25e4ca25ba65ce8fb8829e82	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:34:35.236	\N	2026-09-21 04:34:35.237
9b37ac61-c4d9-4a54-a070-a581b5309fa7	669c307e50884ac85c429059cd3a5779a6d35dde7422587ad3595d1d8f919d5e	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:34:39.99	\N	2026-09-21 04:34:39.991
206055d8-2afa-43c6-a437-06b44208dc2e	863d60bbdf270bf2f2930ac76c8a68245a2c05b5579c051819178bdd487ae8c1	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:34:40.791	\N	2026-09-21 04:34:40.792
094421ce-28be-4b30-b15d-381ae8ea9af0	543ea06b0ec0d2b100f7c409c69034e0a3657822862cdf162e075a9da5fd1793	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:34:41.17	\N	2026-09-21 04:34:41.171
24d9d614-1cf6-4514-bcd8-140b15aba062	347ae7e2078c45807d6080ea952c014e7dc681379cef9b21b9239ccb749c03ba	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:34:41.836	\N	2026-09-21 04:34:41.837
fd639413-3fbb-46dd-8e3d-1a3ca16fae27	e66f85650e26e42b0e94f91bacec9a4f292e1783f4c0c405174b9b8bbf91eb46	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:34:42.807	\N	2026-09-21 04:34:42.808
13761657-e055-4310-a6a0-2db789dc490c	b24488f583bc4c75083ed6fd016414039d0c502ef42377003dde081f15580008	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:34:45.727	\N	2026-09-21 04:34:45.728
ef490d7a-79e6-4fbf-b68a-7bcbb30ac8aa	044414ae92da598730900d6dd049b005ecbfa1c6a4cd29c5ff4afd409e59609b	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:34:46.34	\N	2026-09-21 04:34:46.341
79ffb11b-7311-42c4-b392-1b5c6d9fe447	79a18e37099395969aa5c80acb13144af4fef0f024f0c45192236ba32fe9a50c	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:34:46.886	\N	2026-09-21 04:34:46.887
b9b52553-08bb-4dbf-8526-d7f0ea4d5621	1dd024c602edf3202304cc1b55212b446a3f6cb4515e0fee75b5ef0847f3943b	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:34:58.657	\N	2026-09-21 04:34:58.658
0a4117f9-76a1-4681-86b4-5d42f1a4506a	194a223896a9605b327cb0ec7e6ff32ada50f0933cd32894fb8883dbdc6e424c	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:35:09.41	\N	2026-09-21 04:35:09.41
0006179a-31ec-4b34-b6af-6ea4a13bdd0e	b5c3af45df3446526ebb97481f79c282330a28f1e7510384869b88b8fb4dcf7a	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:35:41.793	\N	2026-09-21 04:35:41.794
23a5b2b1-360c-403d-aa95-86ad10692e8e	18a1c0e6dd54ff1624739abd63bc8b31afad3b3f1f9c3036a4f7fa9bcf0f7dbc	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:36:33.644	\N	2026-09-21 04:36:33.645
cdad343a-3dca-419b-8eca-89857541c3d3	3e5899bb96104daac6bc3021df25ad9e942b9196255e3c3fcd2890bf4b8b0a74	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:36:44.608	\N	2026-09-21 04:36:44.608
458527b9-a08d-41b4-911c-9ecbd1053753	d237c2cd3370335e5f866651c645b659bbf008d1892917905f6157c10e7dd173	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:36:45.49	\N	2026-09-21 04:36:45.491
889cf0c0-8f95-41bc-bafe-868c13504205	67001bb593a99c5e5f38356a86612ff09d75ef465059ecf8ad9e581da1f3586f	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:36:46.179	\N	2026-09-21 04:36:46.18
9d9d5200-9ce7-4e2a-9e24-01406f2729f9	729e2504f6bb4107d8bfbfe3bd1320209a6bc0b338d9dcd579eb0e15e8329078	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:37:26.815	\N	2026-09-21 04:37:26.815
76a6a9b5-1c7f-4551-b597-1e942b11eec8	2ade9dd32dea64a9575a211d84e125125ae9c3b5d8b1ff4fdf34aa1f8367ed41	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:37:27.545	\N	2026-09-21 04:37:27.545
32e27e76-9c1b-43e5-a4d2-7fa558975760	ebc2c81d8ea3370648884d6505799ac72a1a03572eb3604c100a20902b8abe12	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:39:34.743	\N	2026-09-21 04:39:34.744
cfc49bee-7d7c-42de-8e48-6330051c90d7	627e9d51087e859e0ffb70f229fcb4bc68f71a5b23ce0a0f3506aca8c9e3e1b9	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:07:32.049	2026-09-21 04:42:06.505	2026-09-21 04:07:32.05
67508955-4134-4322-b06c-2d956461308b	d5cf4551e2003072c06ffac294abc740b6f6ba20a3ab0ad4753c57d9c87372a2	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:42:08.778	2026-09-21 04:42:31.601	2026-09-21 04:42:08.779
ae66100d-f882-496a-a310-dad5a1d92c1f	b67f4f63fd9d1c374477e840c63ff7a404a72f4c26d396d44ce3a3fccd53bd02	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:42:37.117	\N	2026-09-21 04:42:37.117
88a51108-9088-4801-a0ee-1364dcca2fee	fdaad309ee3f6efbd40a881f4c2753d9d5bbe61868352ddbfd23a995e7669654	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:42:32.749	2026-09-21 04:42:46.065	2026-09-21 04:42:32.75
531beb65-5711-4a5c-b4c4-6853de8c5358	ae39e1162a39010a2202c81e410d8a71159843e6da7b653564a0bfe6708de604	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:07:39.783	2026-09-21 05:02:52.372	2026-09-21 04:07:39.783
52cbe105-1f5f-4413-a3a9-d802adb00ee7	b240f2310ad804c8324925a173d3c040411448c2f875b7dff873f3355ade52b5	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:04:23.92	2026-09-21 05:06:42.051	2026-09-21 04:04:23.921
16a0cc24-f1d0-4e0a-bc36-b7a3c6635a69	c6f34f7a1a0d93772b08b2cba2268b03c17e44a83d411091cb6669b5d8ce5461	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:50:36.666	\N	2026-09-21 04:50:36.667
eb475239-7d07-44d0-a309-4636acb595fd	c39cc74098977e387650555e07ae54cf0b8fb312586663169ddb7ca598f49614	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 05:02:52.387	\N	2026-09-21 05:02:52.388
aa1ef062-6043-4afa-86b3-49f90e54bbe8	de397e184ba4dffda99b54855dd80dfe3f0b9bbfd7eccd6465e598102e60f518	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 05:06:42.065	\N	2026-09-21 05:06:42.066
d723d748-f0c4-455f-b794-34157e307169	47351b96ca98f209fa2ed8da3fa0a70521cac3d9308f0f50938270f6f7e03d26	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 05:38:15.022	\N	2026-09-21 05:38:15.023
13243430-107f-4767-a2b5-dc17c380d9c9	5ef9bd93f1b23a236ae178365504aaddf5a5a0cdff44e0725c682c34382dc494	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 04:42:53.024	2026-09-21 05:45:20.008	2026-09-21 04:42:53.025
f5f02559-a2ab-4ac6-a02a-a452c903ffb5	039f1ed74bd87d616c1ef3b9aeb17150b0714b4b488043018ccaf8e22950dd58	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 06:11:40.242	\N	2026-09-21 06:11:40.243
9bf8ea5c-bd54-4fb0-9376-5867f023c947	ea074d3f087463cd98648a382a644efe4d8b3e5ab1af997fd7a48abb02b36f8d	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 05:04:26.171	2026-09-21 06:17:51.057	2026-09-21 05:04:26.172
370f5786-b8f5-4e0f-90c8-bdfbe0f48ad6	a2629efe7288181b0880cc7846e8d4a1bf0d6956814a444f1a5535cd3bf422fc	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:14:38.697	2026-09-21 09:13:13.603	2026-09-21 08:14:38.699
19b5d228-b9bf-4615-9da1-0e21b3057dbc	cd098469d17ed10c609a9321f2e63446cc2a15501ec27d294e9bf7b3e78ade53	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 05:45:20.023	2026-09-21 06:40:49.083	2026-09-21 05:45:20.023
02ca6df2-b30d-4f5f-b72c-a27bbb4e3a3f	d72f62589ddb11e70ddadf465ffb1b3869a6d293d767368740ab32ebb49f58d0	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 06:40:49.093	\N	2026-09-21 06:40:49.093
d6d059b9-ef04-4c61-bd60-5b4399566f3f	701b183789943b144d5be81ee4b27974ad5f9d5b959f5cef2c87a6bfa103f340	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 06:21:58.205	2026-09-21 07:17:06.102	2026-09-21 06:21:58.206
caad9de8-ecf2-4562-a518-ccafcad4e932	f53c52549f948c813ef41f405a6918dce164c1ee627d26996b1c5f2285c23d6d	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:34:24.093	2026-09-21 09:31:42.31	2026-09-21 08:34:24.094
a39eaa46-9494-406b-adeb-f4ac877965c8	38bb7075cd53d59703ee7b78e48bdb2e95b7143113190d2d3d81bb16f719414e	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 06:40:49.097	2026-09-21 07:35:57.061	2026-09-21 06:40:49.098
42b497bf-5581-4eb6-b8fd-15dc56af9380	354cbe05dfeb034f54ce8226729a69ac315a31e32c110a23bacc8e7cbd7bcbf0	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 07:35:57.083	\N	2026-09-21 07:35:57.084
8d274324-5e95-4353-ba60-3f7c34f6dbdf	80d12a96086c853aa9c508e2b003681e5de49444853482404dabc2456ff741df	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 07:44:00.225	\N	2026-09-21 07:44:00.228
2194564a-7384-429f-93d1-6b050c674704	ae8ee1a81ecd1e3c7a0b3a67514c7e1672ec47c5c42f9baf6dbe99a7c3341d26	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:05:04.307	\N	2026-09-21 08:05:04.309
7fcfb201-0c7e-4b4c-8181-0f6c1c5d705d	4616aa6d3875a985e087deb3e28fb9eee16753989a997fc25985f28a56dab4d3	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 07:17:06.122	2026-09-21 08:14:38.668	2026-09-21 07:17:06.123
ccabe61e-3cf2-403b-a542-2298825fe897	c0b1f0e2eb7b7accf25bda1f3d2b2ddf4cb2e3f2285b561418abd464181950ee	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:17:31.378	\N	2026-09-21 08:17:31.379
ebfc4fae-1780-41ee-b3ec-9b62ab9640e7	2f5430bc3ab8e29dee1b3bd7a1940246d60b932519f39269f69c853137cad8dc	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 06:17:51.069	2026-09-21 08:17:31.525	2026-09-21 06:17:51.07
a8b0f0fa-27b1-483c-8b7a-812556136fb8	168d62df6b835c7fba7ef6c2bc74f680aea03c45100a0b766d9ab3957ab1701e	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:17:31.538	\N	2026-09-21 08:17:31.54
0911aa9d-b080-4279-8380-7c6935fa1662	504b006bdd460ca6c59bd007fe4faad060a6d6633a9023e05e37070bee401ad1	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 07:35:57.079	2026-09-21 08:34:24.034	2026-09-21 07:35:57.08
c3276eb8-5e95-4d22-b544-59aeeb3f5581	79a9384986fe1d4e9b7eea8a74c507c5e30521b319c4acebf6345fd4c64b501e	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:34:24.084	\N	2026-09-21 08:34:24.088
1c60fed7-bfe6-44c9-855f-d3df59e383a4	b761c114b80fa4fdfa985905461d716ada26d4872363164725efb583ca912130	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:47:17.833	\N	2026-09-21 08:47:17.834
ede1a529-5106-4882-8910-93c5c5447315	632da72600cdcf66ce5a31e25ffe8500b962aad6a989e13fa90a5727fe81e1ff	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:47:20.466	\N	2026-09-21 08:47:20.467
4e5b61b0-37dc-41be-ae07-2804021b03af	2f1e6fe46f07da6b8274f77d94f899fdd9ef9fda2975c5ed699b2c75d22659f8	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:47:21.628	\N	2026-09-21 08:47:21.63
8aa292ce-7df6-45d7-a71d-9f42deb941b0	ca748ec2f0eb9a40a1cc6bde7312e983c5a69ed38994ed8b56593a33bae207d8	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:47:27.414	\N	2026-09-21 08:47:27.416
67c47fa4-59fd-4dfe-a1eb-2e6e54549c93	020382c36c5f2792d609cb9b032577d9076aca037edc45b15fb41e425e818f05	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:48:00.82	\N	2026-09-21 08:48:00.821
cc697450-3aed-419a-a47b-049ee6c67df6	3f782cfb6281d9e845ec467f38bcf2c7a73c19cd8cf002e0f594aeb9a696ef8b	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:48:02.055	\N	2026-09-21 08:48:02.056
e2b0bd10-92c2-4dd5-ac85-7e38c703e588	7e2ce9496c011edfb1e7c07d159ebd4aace82e77fc40eabf3f8fd06a75444c57	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:48:02.976	\N	2026-09-21 08:48:02.978
fe8291f7-6391-4a5e-8471-fc64cacce0c3	80f4d17708a044f15456d8b6ff945038c73838fb1cd57a495974a511b7db9ee1	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:49:52.128	\N	2026-09-21 08:49:52.13
3355fb6f-e83c-49e4-b140-babd000ceb16	0b4e44fecf741603ec867c0c8513e141ee0070cbcb5ebc39950f9f7b15e1ef64	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:50:38.88	\N	2026-09-21 08:50:38.882
c8a509db-f8eb-4dac-9995-f379cc50ffc5	f256d6801bd86764c91ee61443d538c11a52d7ef9ab3d5266e24ada8f67084d2	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 08:56:07.819	\N	2026-09-21 08:56:07.821
c3e659c9-9be2-44d7-92f6-6372291afca4	5f47aecc35fae37540e6af470d5b4c4f9e599ff428f2e789a4845c4a5a43e6a6	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 09:06:06.644	\N	2026-09-21 09:06:06.646
80a5f6c7-27fe-47d4-b32f-37a894b8ed91	b633c15aa2c0627435c0e3d5b4d99aa4227edc9bd4d90b324bf794b986849f9c	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 09:28:10.006	\N	2026-09-21 09:28:10.007
c6ac86b9-d670-4d29-a651-6442a594a8a2	de39489cae005db4f53e33b9d120e4e98b0167eaab1dd67dff5e5d08f1b715e4	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 09:31:42.332	\N	2026-09-21 09:31:42.334
f9daaf49-654d-47ec-9d05-4b9e8b914a6b	246796c1930be3c00d475efd08ddcbaf0d1ae6116c5c7b9d08e683a2cebe27f5	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 09:36:51.547	\N	2026-09-21 09:36:51.549
9b428e62-f290-4f0d-b9dc-6c31b06faa4c	8f43bdcfb10a44bf675fbb5661575ee949b56ec2c2aa72358104c45240e96d77	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 09:36:56.475	\N	2026-09-21 09:36:56.476
718912e5-4769-43e5-bde3-2bf9b4ec0eef	05bda39f4582bd212e9ac8d820bec6a63ee76fc583038ae0db702a32e60c07d2	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 02:34:43.668	\N	2026-09-22 02:34:43.67
c370e0d7-21f2-4c26-8921-fc5657b23f9e	b4de1bad13e170a64ab511220742ed453954a883fb684ce9ed5b649a146d51e1	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 01:39:18.988	2026-09-22 02:37:16.067	2026-09-22 01:39:18.99
4a72c4cd-22d3-451e-8070-9b2e4d7e50ff	173259a1347319c6c462ea84a8bd195cb2bc29aa1e1a906c4126a4128b1de593	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 06:33:05.511	2026-09-22 06:33:07.735	2026-09-22 06:33:05.512
e58e19fa-03da-4256-a14e-cfc6e780f5ec	d559a6937d607698f26f3099ddb87f038f5000ef5c4878272d925b8c414356b9	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 02:28:24.811	2026-09-22 03:24:38.609	2026-09-22 02:28:24.813
6b30d6f1-ef84-4527-8e94-7765e958f3eb	80462b497a34c5cfa809a8e7a4aa340f86758fba7c16fb9edb6cbb0d23580882	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 03:24:38.631	\N	2026-09-22 03:24:38.632
f4a99412-fb36-4f6b-89d1-3a44579231f6	7aac5724822bff741020a1713d89e22333677ac02f36b68dcd361a4aade14a0e	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 02:37:16.085	2026-09-22 03:33:26.362	2026-09-22 02:37:16.087
925fdc65-cca4-4266-958e-45ff16a94bd2	a4cfe8f3b68db25ebaa30dafb587acc301e0e5f64c37e1a88534795080f38a66	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 03:49:35.644	\N	2026-09-22 03:49:35.646
2959205d-dcc6-45a8-9b5a-941153108062	5781a7e2d88ffcf3e95db8fb3ba4a7433e79af396747f68c82387426242dcb66	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 03:06:19.534	2026-09-22 04:01:25.075	2026-09-22 03:06:19.535
38f7e926-a105-4ad5-ab21-ad9878f0339c	08eab3a612215c21501c9e0a1d2f1ad75ecdc460898ad9d759ba9ad64b46e754	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 03:24:38.626	2026-09-22 04:19:46.941	2026-09-22 03:24:38.627
688ceed8-4b51-4994-a758-e1d3de150036	78de41bf17a5f31c7ca40ee95a585bf55558bb55380e78c673ae57515f1fe18a	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 03:33:26.38	2026-09-22 04:30:51.696	2026-09-22 03:33:26.382
0a22e2fb-ad25-4785-ba75-ccd4ab5bd122	144da18b1813e34fc57e389a2b7146173a7dc8bcec09709720de1b0709382ca7	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-29 05:00:34.569	\N	2026-09-22 05:00:34.571
0f72a08d-7b63-44b5-8cd3-2f55a0bf5f91	ed12bfe7623f2c6da6c93e8f9d61bd60fa7096975a51ce5b64c84e779eac251d	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 04:01:25.098	2026-09-22 05:00:59.772	2026-09-22 04:01:25.1
af8796ff-3c06-45b2-92a3-97f647e5b6d9	75e60a0d0a6df29b02c70a208957a187ed48a6a558662a99fff3ba8ebcc9fb67	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-29 04:55:02.051	2026-09-22 05:50:03.421	2026-09-22 04:55:02.053
e0017a59-36d3-4f7e-bb2e-a740929c116f	325fc48304012e2faecfe2978c2f8fa5385d88a70af189b5c478f2cd84efeb51	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 05:00:59.838	2026-09-22 05:56:03.505	2026-09-22 05:00:59.839
32b97161-eba4-4100-9db7-ce2b9251bfd9	e7d6c8c0514292b2e36ccb912abc1168b24346d54fcac78813827a066727e01e	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 04:19:46.962	2026-09-22 06:09:53.585	2026-09-22 04:19:46.964
1bd97782-a2cc-481d-978c-410f29a6f075	d9b26559a41afc4651a73a568724efcaa4ace20bacee00473b775c0ad2b72f8c	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 06:09:53.605	\N	2026-09-22 06:09:53.606
c11306ce-5984-43b4-9cbd-45318ec7a68f	e2366525c19ef8aaecc4d2d58fd4dcab3e41dc63ec2580477b62e300c00a0ae3	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-29 06:22:08.497	\N	2026-09-22 06:22:08.498
a2997f75-e104-4c0f-9c8f-2333e6bd6cec	fd0d1bcec0d5397932003eccc85ebd9cdb7278b8423c63b458c5bb3bf2450e52	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-29 05:50:03.441	2026-09-22 06:33:03.089	2026-09-22 05:50:03.443
1dfc5112-9b89-424e-a78d-1d44480dba05	96c5460e36ddf18a7c0c58fe55ae01636146211b8d0bfd7eadb4ef66c4433ee1	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 03:06:54.779	2026-09-22 06:42:58.27	2026-09-22 03:06:54.781
00c7679f-819f-469e-aa54-371db74d0044	a23d730478463fd66bc59b5070bb3fd36a7711bbf8eb5b589242a693d97e4dbd	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 06:42:58.284	\N	2026-09-22 06:42:58.286
4351c658-4757-4c32-90b8-0fcb96d1887d	82491953b6f02d2e553f125f5793f9c38fbc2980bc828d31d6a5445f815874e1	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 06:44:09.043	\N	2026-09-22 06:44:09.045
4c3af575-56dd-4e55-a83a-0fb06eba0b12	b9c537ba87eda8be683d65bf39f32dce142d4d1f0090704194f41c64ab82d166	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 06:45:06.561	\N	2026-09-22 06:45:06.562
a24b17f7-5960-41a3-8e3e-65645d95ad12	1b50804d47da77f17fdc26a0b23599f29c26e701e8bec42444fd06e8e80e3879	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 05:56:03.52	2026-09-22 07:00:23.624	2026-09-22 05:56:03.522
20c4d7a0-548f-40f8-ab01-7c0aa5a790ca	215329ca46ba1be44b125e1aeac8586f03fa23a4f6cb3664fcedaf17ae3a0e20	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-29 06:33:12.839	2026-09-22 07:30:58.983	2026-09-22 06:33:12.844
6fd475b1-3682-484e-b629-8d0aa7c9bdd5	39ba47b26bdb6b6a3f85c4a209de34909521db844fd196cd81e33cb4c0057018	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 06:09:58.115	2026-09-22 07:05:41.161	2026-09-22 06:09:58.117
692dae06-24bb-43f3-94b8-b380ab550c54	a6c26966246031f1c85e1c465691a619659514988938d20a73af3a4f8933e5d3	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 07:05:41.173	\N	2026-09-22 07:05:41.174
bfba8eca-7ffa-4c9e-8653-bec39b446c35	ffb708a6f03434f02ef0093bf91210b901fa34af036fed6e5295503866adb7f5	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 07:23:10.5	\N	2026-09-22 07:23:10.502
90ce6178-6972-478c-b6e5-7465d36f096e	0ec266047f065a65b434849eb280762bf5aff329430408c42cecc5765ea6c04c	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-29 07:39:44.68	\N	2026-09-22 07:39:44.681
56c21d74-a6f5-421f-bd9f-aa1beae7ba50	fc99f07d269c7efe74e3e64a28705daf0b97e98f4374144d18bae9f60bc80e26	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-29 07:58:03.628	\N	2026-09-22 07:58:03.63
5125ed90-3e1c-4255-83a2-3fe7caf34abf	a3814a7d39b93797505db06a55f49fb3ed36a7df8f9dbdfd3f61629fb2aa5994	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 07:00:23.641	2026-09-22 07:59:20.981	2026-09-22 07:00:23.643
663036a5-1f08-42ea-baea-940d2ca0fa22	759fa5bb49cf47eb730b0858f00a2a395e437bd9b23a14468a409b6c030bb4ed	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 07:59:20.999	\N	2026-09-22 07:59:21.001
b99e8026-d427-44a1-8c2f-26dfbe94d1af	b9492d32b0be276d28e58119fdfcbf49d3f5528fecf3998508de4d022b115318	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 07:59:33.036	\N	2026-09-22 07:59:33.038
4d1d03c6-e130-4435-bf37-617949866a36	7f770c1aa59fa090b7fb7c87d87595a6d7d6a59699f38dc5345f36eb7f5af0b0	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 07:05:41.18	2026-09-22 08:03:18.773	2026-09-22 07:05:41.181
2bf956b2-a6e0-4107-80b7-bf32570d3ac0	8a865d773a8903204308643345b516072acad7616136fbfdb829bd09b8ca40a1	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-29 07:30:59	2026-09-22 08:31:43.576	2026-09-22 07:30:59.001
b4a17bdc-6791-470c-ba0a-3a58f4556785	9ded5bea397a65a46a7b9dde93d66d06384655c6a326434d9c78d186d2b8f4ed	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 04:30:51.708	2026-09-23 07:04:37.629	2026-09-22 04:30:51.709
18dd762a-d229-4ca0-865b-a7c72ed69512	88d9ebc3bd3864b33291757961d6cdb5619cafe83e3c551909c4919ea21f3931	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-28 09:13:13.623	2026-09-23 07:19:54.15	2026-09-21 09:13:13.624
873cfd03-be20-4492-a2d8-58533a8d811d	84ee8422d293dde3c17555545d39b48dd92e8212226b72aa0f6e20fc153ba8a6	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-29 08:03:18.797	\N	2026-09-22 08:03:18.798
05d3cb3a-4c41-4c4b-9644-6f3dc5100b8c	c9f9259817842314a53dbcdeb33c1ed74ab02fa382e07530dde7062389fac103	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-29 08:31:43.601	\N	2026-09-22 08:31:43.604
4ff37a5a-6f0e-4964-90fd-f07b25200201	656b696b0dc207d2104ff7a1d77e4fc59509743af1db7b7a40bab6a47206b39e	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 06:53:33.023	2026-09-23 07:52:40.61	2026-09-23 06:53:33.025
db8cdfc8-c97f-483d-af1d-9aecd3c49b6e	1a5e77b6ea27972404ed2fea15df67afa7d2792740719bbd2780c2b2509fed17	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 02:25:25.58	2026-09-23 03:20:30.304	2026-09-23 02:25:25.582
2eeb1422-e2f3-4f2a-984f-1f9275d71941	1d8762ce19ab83da32d3eecd202fa06184c8975a7ace5c0fdbd135d9614806b0	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 03:20:30.303	\N	2026-09-23 03:20:30.305
ccbc06be-9ae4-4ac4-8baf-a7d8422aa7fc	5241cc3375aeabcf7072ab11bbfe2094ff3c7d6650b97ffb953eb9a40fc33d40	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 03:20:30.317	\N	2026-09-23 03:20:30.318
4dbfc568-7d0e-44bb-8b79-d6414be5ccb9	56a2f19f7d40be5d75176394940dd2316f0ce198bb76161db54e1f7f74101eca	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 03:26:01.926	\N	2026-09-23 03:26:01.927
4820db5e-8519-4070-9cb6-aa1c5931e3a1	23b6607ae2eb18a62bd63137f625d8c3600ac43184651349e2486ac2e229db3c	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-30 02:29:53.883	2026-09-23 03:29:19.756	2026-09-23 02:29:53.884
7937dc31-4609-470b-98ce-08c5b3035e38	d090a7f5d2adcb2a58b89544ddc7a51ee9bd65e6f0f27abf3db9538e186cd0dd	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 04:11:25.156	2026-09-23 04:11:30.713	2026-09-23 04:11:25.158
2452d048-7294-4c19-88df-eb7a6d2503f0	5e991395a93864314a0a159a870159d2b88b13030fabb8742e4e9d616bef0375	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-30 03:29:19.769	2026-09-23 04:25:59.421	2026-09-23 03:29:19.77
66771ac1-4802-4c3c-b611-0dffdb2375af	08a6cbfccf7529a171d3f375db218c3bc83c294d9a105c0c39da324a42885760	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 04:14:12.437	2026-09-23 05:15:10.854	2026-09-23 04:14:12.438
d20cb6ee-698a-453a-a695-b66613e61af2	f0376953a56004139aff30c994e91430679af05c8b181f7897adbdd46c2a0f4e	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 05:15:10.878	\N	2026-09-23 05:15:10.88
381a6a3d-c3fa-4b8f-8c0c-6d5546f8f7d6	d71d1cfc6f4ae360d5e2b5d3ccab982dc3aa2dbfff285074bcfc079348a6630e	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-30 04:25:59.445	2026-09-23 05:22:04.522	2026-09-23 04:25:59.447
3cc19959-3d04-4ba1-9128-4a5bcf90b76c	79115a5f907e21500554229026c87534a7f0f0e69e7791aeab4701c4d158ae36	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-30 05:22:04.548	\N	2026-09-23 05:22:04.549
daf5e0c4-038b-4fe2-889c-a5ef1fbe50f8	2569e1bfe4d712ce17e1ccd8220a7b90275bac6a08c8d380bfcf71fab1eb2478	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 06:18:59.805	\N	2026-09-23 06:18:59.806
d480851a-8e8d-4992-8000-658654273a11	f9e67762b37128e33c73dc3620d5e2bea18aba34ef04d871323048203ffca810	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 06:43:03.262	\N	2026-09-23 06:43:03.264
62d8201b-a90b-4f39-82af-4277d4579c14	f6601c3a47e4616d2a4f5269380c5048e9d3f10f9f5ead489464585f43329ba5	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 06:43:41.012	\N	2026-09-23 06:43:41.014
dee16449-8dd6-4b47-b5af-3b9ae9faeed5	57ff1fdc56df6998a37717068e63469c879837dfae47b1f24ab522a7bad75fba	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 06:43:52.795	\N	2026-09-23 06:43:52.796
36c967e6-f4a7-4d97-9667-b4a64fc0f113	43fdb18cbdaa74a8f8be0a7710a73bffbaf09131cd266a56696c66264ca4a96c	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 06:43:54.252	\N	2026-09-23 06:43:54.253
62e0442d-14f2-439e-af25-fd68df47c80f	c53ae40c12bb30233bea61cc0893b8cba28842b0503e123d91ebe5efd28d0ed4	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 06:43:59.363	\N	2026-09-23 06:43:59.364
11f601b1-2b8f-4d2a-b1b2-55a35346f9ac	402afc2dd27dc8376161ae126e6c72c721ba2f3d87a31e5b4f77695003a6f7c4	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 06:50:25.287	\N	2026-09-23 06:50:25.288
cbe92dc9-61e1-4c08-8a9b-96ba24e003a4	4beb53da55ec17384496f77d0f0889078c2ec252ca30e7f98120fccf5d32d547	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 06:52:26.1	\N	2026-09-23 06:52:26.102
38c0d560-a014-4512-a4ec-b7dbd66f70c8	000455790aca870184c7367cd16c5c6123649280c846e5fc37d10a4f247b2a74	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 06:55:57.001	\N	2026-09-23 06:55:57.003
164aafec-d101-4129-8519-1221ef84522d	27dcedff13ebe906c01b7f7bca1d451529a9dc5225ab1db851faa02f1ea46a56	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 06:59:42.578	\N	2026-09-23 06:59:42.58
9f2f6821-a301-4f71-a436-11ff3c4fec1d	51418d339bc3ed82d4dc08496f480ed20c37e1ccbb7cda0fd9571e41ba1d206d	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 07:03:44.293	\N	2026-09-23 07:03:44.296
346c5676-1f67-4214-94b0-781473722389	44c1e00a5a7941c36395ae98c297d22a19b159e6e34cc4ad3eea944a53f634dd	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 07:04:37.519	\N	2026-09-23 07:04:37.521
a4740e9b-a867-446b-bb12-41adf983149d	e0527f16433d60de159642970d49dcb3ed6dfa2d653cea82de38ff7245f7b023	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 07:04:37.648	\N	2026-09-23 07:04:37.65
35e289f6-6532-4f19-a10b-0d11ca6256f3	effb58483f215b8ca69c32c98fbba4e0c8f70ee9be215466a851940128be3ede	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 07:15:38.559	\N	2026-09-23 07:15:38.561
bae1dd58-12f6-47f6-a477-0d0528b8e565	cfe12fb389cc000007b6f5f5f6528f9b3ddcaa9be8b12416335ae0aea05a12be	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 07:19:43.58	\N	2026-09-23 07:19:43.581
80b3007f-f013-41ce-9bd2-978966ba62b5	9f7c2d2bfeb73dd7b29bf0f5a526606e7ce2bbca8bdc0e399f258dc92d7a9b21	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 06:58:54.337	2026-09-23 07:35:56.273	2026-09-23 06:58:54.338
5fd1244d-e35e-404f-8824-d924e73d066a	f33ea03c144077c04a0815532f3f53ad764d079378af18e5e4ced75337eb2aeb	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 07:36:10.591	\N	2026-09-23 07:36:10.593
c20013d4-2c9e-4010-bb15-af8a1d747b47	269688ac612bb995beb210ac8f6b8c82ce2520720ab4ffd22a6cf090016b6895	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 07:37:11.581	\N	2026-09-23 07:37:11.583
daa2a2ab-eb80-4810-b6ae-d76c0e2e2921	8ea4fa0fd40e723f46a2e7bd8015dd8d1d526d330df2ec55a5bb0d086359ad73	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 07:58:55.089	\N	2026-09-23 07:58:55.091
691c1ae2-8db8-46bd-a5cd-c4822aae393b	39e64cd3f3cc4fc5d77b2dcff8d231ccbd104d58e956854f4b443e44c8bd06ea	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 07:59:33.401	\N	2026-09-23 07:59:33.404
f4557378-1591-4f71-9f1e-e2f7da59bb5e	30afa240bee22847aa8218940b4d0fd1730663041f842c6e4e2dfa5df3e3fc0c	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 07:19:54.166	2026-09-23 08:18:14.326	2026-09-23 07:19:54.168
9dc1d338-1b48-4790-b500-4b4453182c21	2bad7ae1d2b270a6af4ac3d83dd2b898b50488a7c7839ac2f12ba3953c16968c	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 08:20:01.306	\N	2026-09-23 08:20:01.307
b443ce93-ed39-426f-a376-227366e667e9	6103d450d35493879cfd462aff38e6cba20113f45b3d5e925e2a85cd349a40f5	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 08:20:13.156	\N	2026-09-23 08:20:13.157
1c6c91c5-bf47-4e13-a1ef-3103dca1b905	1f09199e4dfc95320accb14968861bdaf9376e66849348de27dec93aa340946c	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 08:34:40.442	\N	2026-09-23 08:34:40.444
050181d9-49a4-4073-990b-d8d2ac057a4e	1bcdf7a82b3f5a1307210df0cb95a5f9f4acfc83f5408e6672c68eb01779fbd8	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 07:52:40.623	2026-09-23 08:49:19.218	2026-09-23 07:52:40.624
85312efe-6f39-4e9b-abaf-f87d4ac1d9ae	4fc8262d4cc4b92cfc0b7e8945a6cb79a04ad47be32dad739f0ad352a63bec45	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 08:18:14.343	2026-09-23 09:15:54.709	2026-09-23 08:18:14.344
688961db-cae6-4d90-939b-ba8e96dc561f	eab6bb44f9eaa930081e62025bc59e6f174b2f6ddffde8b8e28c6eb52ce68b37	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 08:42:40.55	\N	2026-09-23 08:42:40.551
48693281-2f0a-4059-88ad-9f1675008a30	54736c1c521c1f0bb678ff6efbe9374590ae05a22bddefc7a3ad11e922b6fcbe	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 08:49:19.238	\N	2026-09-23 08:49:19.24
8dee3751-7748-4593-baa8-99b02f4cf243	ae1874a3e21248b758970aa9936ea128fa6375a864383f12a4b209a3296831d4	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-30 09:15:54.737	\N	2026-09-23 09:15:54.739
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions ("roleId", "permissionId") FROM stdin;
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	360cdd3f-c1be-4392-8fa6-3e3abbef0eca
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	b2a9c920-50ad-43c0-884c-bf4919e26aaa
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	fad860d6-f73d-4d6d-ba03-d840b98dd504
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	36885116-7cc7-41bb-a0be-1524962b4b46
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	050d1723-3552-4964-94e1-d94a8eb03356
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	6cacafe5-6f3d-41d1-b858-781c967ba823
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	de8a28e3-b228-4938-ba4a-2fdbf8fe7169
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	1491f64d-bb8c-41a1-a2fb-92fe2b23c6d5
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	7d05a599-3b0b-492e-acbb-d6a9bca469f5
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	bbad99ef-c39d-4f92-8b40-2414b2b05288
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	9750fea1-71f2-4023-a46e-e3557cfec025
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	657071cb-8718-4737-8e0b-03136a392bcb
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	a2534afc-3ccf-4423-bb4c-11526f068eae
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	22bfb5b6-6e0b-49ed-8333-531057828f6e
8ebeb35a-0586-4899-90d7-34750e275ada	360cdd3f-c1be-4392-8fa6-3e3abbef0eca
8ebeb35a-0586-4899-90d7-34750e275ada	b2a9c920-50ad-43c0-884c-bf4919e26aaa
8ebeb35a-0586-4899-90d7-34750e275ada	fad860d6-f73d-4d6d-ba03-d840b98dd504
8ebeb35a-0586-4899-90d7-34750e275ada	050d1723-3552-4964-94e1-d94a8eb03356
8ebeb35a-0586-4899-90d7-34750e275ada	22bfb5b6-6e0b-49ed-8333-531057828f6e
8ebeb35a-0586-4899-90d7-34750e275ada	16cf1478-cd96-4fdc-b783-a8c49d9420d4
5b6d9505-3270-49ae-afdd-9aac0a226a4a	360cdd3f-c1be-4392-8fa6-3e3abbef0eca
5b6d9505-3270-49ae-afdd-9aac0a226a4a	b2a9c920-50ad-43c0-884c-bf4919e26aaa
5b6d9505-3270-49ae-afdd-9aac0a226a4a	94dd330a-c7cc-4cdc-a7bb-a794067ec387
5b6d9505-3270-49ae-afdd-9aac0a226a4a	e7fa50bd-7369-4fba-8402-abd3ac53a326
5b6d9505-3270-49ae-afdd-9aac0a226a4a	ff4d079c-32f4-4b8f-8668-0fda75ce2b7b
5b6d9505-3270-49ae-afdd-9aac0a226a4a	fad860d6-f73d-4d6d-ba03-d840b98dd504
5b6d9505-3270-49ae-afdd-9aac0a226a4a	0d4fbe80-940b-41c2-bece-e087113c86d8
5b6d9505-3270-49ae-afdd-9aac0a226a4a	05edb49a-fb43-40e1-8085-e0a776ff4a97
5b6d9505-3270-49ae-afdd-9aac0a226a4a	be18ad2a-f7ac-4279-bb99-dd42a8f7b389
5b6d9505-3270-49ae-afdd-9aac0a226a4a	36885116-7cc7-41bb-a0be-1524962b4b46
5b6d9505-3270-49ae-afdd-9aac0a226a4a	050d1723-3552-4964-94e1-d94a8eb03356
5b6d9505-3270-49ae-afdd-9aac0a226a4a	6cacafe5-6f3d-41d1-b858-781c967ba823
5b6d9505-3270-49ae-afdd-9aac0a226a4a	de8a28e3-b228-4938-ba4a-2fdbf8fe7169
5b6d9505-3270-49ae-afdd-9aac0a226a4a	1491f64d-bb8c-41a1-a2fb-92fe2b23c6d5
5b6d9505-3270-49ae-afdd-9aac0a226a4a	7d05a599-3b0b-492e-acbb-d6a9bca469f5
5b6d9505-3270-49ae-afdd-9aac0a226a4a	bbad99ef-c39d-4f92-8b40-2414b2b05288
5b6d9505-3270-49ae-afdd-9aac0a226a4a	9750fea1-71f2-4023-a46e-e3557cfec025
5b6d9505-3270-49ae-afdd-9aac0a226a4a	657071cb-8718-4737-8e0b-03136a392bcb
5b6d9505-3270-49ae-afdd-9aac0a226a4a	a2534afc-3ccf-4423-bb4c-11526f068eae
5b6d9505-3270-49ae-afdd-9aac0a226a4a	22bfb5b6-6e0b-49ed-8333-531057828f6e
5b6d9505-3270-49ae-afdd-9aac0a226a4a	16cf1478-cd96-4fdc-b783-a8c49d9420d4
5b6d9505-3270-49ae-afdd-9aac0a226a4a	aac3e52c-e4b0-415c-ab1d-0b46e88880df
5b6d9505-3270-49ae-afdd-9aac0a226a4a	55d8a60d-d779-4093-9da4-34964159eec0
5b6d9505-3270-49ae-afdd-9aac0a226a4a	69ef46c9-8c6c-4dc1-bde4-46f2ccf30790
5b6d9505-3270-49ae-afdd-9aac0a226a4a	0cf4bb91-10a0-4488-acd1-2affd830e6e2
5b6d9505-3270-49ae-afdd-9aac0a226a4a	d0c38b12-5aa1-4fd9-a14b-9528ff7d9705
5b6d9505-3270-49ae-afdd-9aac0a226a4a	934851a5-84fc-4a2e-96fe-25c49461e674
5b6d9505-3270-49ae-afdd-9aac0a226a4a	4298a4a1-f7f8-4254-93a2-b17ad707f722
5b6d9505-3270-49ae-afdd-9aac0a226a4a	e3f148de-8416-4411-b27f-4ff8f0560ee5
5b6d9505-3270-49ae-afdd-9aac0a226a4a	84b23d37-957a-4762-85c8-255eb0235f1c
5ae37975-27db-49db-b75b-72c4a811aaee	b2a9c920-50ad-43c0-884c-bf4919e26aaa
5ae37975-27db-49db-b75b-72c4a811aaee	360cdd3f-c1be-4392-8fa6-3e3abbef0eca
5ae37975-27db-49db-b75b-72c4a811aaee	934851a5-84fc-4a2e-96fe-25c49461e674
5ae37975-27db-49db-b75b-72c4a811aaee	94dd330a-c7cc-4cdc-a7bb-a794067ec387
5ae37975-27db-49db-b75b-72c4a811aaee	050d1723-3552-4964-94e1-d94a8eb03356
5ae37975-27db-49db-b75b-72c4a811aaee	bbad99ef-c39d-4f92-8b40-2414b2b05288
5ae37975-27db-49db-b75b-72c4a811aaee	fad860d6-f73d-4d6d-ba03-d840b98dd504
5ae37975-27db-49db-b75b-72c4a811aaee	7d05a599-3b0b-492e-acbb-d6a9bca469f5
5ae37975-27db-49db-b75b-72c4a811aaee	55d8a60d-d779-4093-9da4-34964159eec0
5ae37975-27db-49db-b75b-72c4a811aaee	69ef46c9-8c6c-4dc1-bde4-46f2ccf30790
5ae37975-27db-49db-b75b-72c4a811aaee	d0c38b12-5aa1-4fd9-a14b-9528ff7d9705
5ae37975-27db-49db-b75b-72c4a811aaee	0cf4bb91-10a0-4488-acd1-2affd830e6e2
5ae37975-27db-49db-b75b-72c4a811aaee	4298a4a1-f7f8-4254-93a2-b17ad707f722
5ae37975-27db-49db-b75b-72c4a811aaee	e3f148de-8416-4411-b27f-4ff8f0560ee5
5ae37975-27db-49db-b75b-72c4a811aaee	22bfb5b6-6e0b-49ed-8333-531057828f6e
5ae37975-27db-49db-b75b-72c4a811aaee	aac3e52c-e4b0-415c-ab1d-0b46e88880df
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	360cdd3f-c1be-4392-8fa6-3e3abbef0eca
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	6cacafe5-6f3d-41d1-b858-781c967ba823
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	1491f64d-bb8c-41a1-a2fb-92fe2b23c6d5
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	de8a28e3-b228-4938-ba4a-2fdbf8fe7169
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	7d05a599-3b0b-492e-acbb-d6a9bca469f5
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	050d1723-3552-4964-94e1-d94a8eb03356
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	9750fea1-71f2-4023-a46e-e3557cfec025
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	a2534afc-3ccf-4423-bb4c-11526f068eae
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	657071cb-8718-4737-8e0b-03136a392bcb
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	bbad99ef-c39d-4f92-8b40-2414b2b05288
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	aac3e52c-e4b0-415c-ab1d-0b46e88880df
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	16cf1478-cd96-4fdc-b783-a8c49d9420d4
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	22bfb5b6-6e0b-49ed-8333-531057828f6e
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	4298a4a1-f7f8-4254-93a2-b17ad707f722
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	84b23d37-957a-4762-85c8-255eb0235f1c
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	e3f148de-8416-4411-b27f-4ff8f0560ee5
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	934851a5-84fc-4a2e-96fe-25c49461e674
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	94dd330a-c7cc-4cdc-a7bb-a794067ec387
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	ff4d079c-32f4-4b8f-8668-0fda75ce2b7b
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	e7fa50bd-7369-4fba-8402-abd3ac53a326
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	b2a9c920-50ad-43c0-884c-bf4919e26aaa
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	69ef46c9-8c6c-4dc1-bde4-46f2ccf30790
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	d0c38b12-5aa1-4fd9-a14b-9528ff7d9705
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	0cf4bb91-10a0-4488-acd1-2affd830e6e2
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	55d8a60d-d779-4093-9da4-34964159eec0
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	0d4fbe80-940b-41c2-bece-e087113c86d8
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	be18ad2a-f7ac-4279-bb99-dd42a8f7b389
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	05edb49a-fb43-40e1-8085-e0a776ff4a97
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	36885116-7cc7-41bb-a0be-1524962b4b46
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	fad860d6-f73d-4d6d-ba03-d840b98dd504
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, description, "isSystem") FROM stdin;
0a1dc96c-7190-456a-87c3-2a9ee8ed4946	PJ Gedung	\N	t
8ebeb35a-0586-4899-90d7-34750e275ada	Komandan	\N	t
5b6d9505-3270-49ae-afdd-9aac0a226a4a	Administrator	\N	t
ed8970b2-2e2f-47cc-ad7d-5bf6590f9f61	role baru	tes	f
5ae37975-27db-49db-b75b-72c4a811aaee	test role	dvdvdvd	f
\.


--
-- Data for Name: rooms; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.rooms (id, name, "picName", "picPhone", location, description, "imageUrl", "isCritical", "createdAt", "updatedAt") FROM stdin;
df9c647f-e1a6-4988-8fba-a9896cd9524a	Ruang Server	Budi Santoso	081234567890	Lantai 2, Gedung Utama	Ruang server pusat data	\N	t	2026-09-21 04:51:55.952	2026-09-21 04:51:55.952
\.


--
-- Data for Name: schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.schedules (id, "roomId", action, "scheduledDate", "startTime", "endTime", "repeatType", "repeatDays", status, "createdById", "createdAt", "updatedAt", name, description) FROM stdin;
82b4d6e8-4e35-4eb9-afff-ad6a3de30908	df9c647f-e1a6-4988-8fba-a9896cd9524a	on	2026-09-21 00:00:00	12:30	13:00	none	[]	completed	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-21 05:19:37.446	2026-09-21 06:00:15.519	Ruang Server · Lampu · ON 12:30	\N
3ba343fe-052b-4dbd-bf48-a220cd4feaf4	df9c647f-e1a6-4988-8fba-a9896cd9524a	on	2026-09-22 00:00:00	12:27	12:28	weekly	[1, 2, 3, 4, 5]	active	bc6664ef-6c60-436d-9936-0d0e09043462	2026-09-22 06:56:24.563	2026-09-22 06:56:24.563	Ruang Server · All devices · ON 12:27	\N
274c1d73-8b88-4727-a406-54d74743b11b	df9c647f-e1a6-4988-8fba-a9896cd9524a	on	2026-09-24 00:00:00	06:00	06:59	none	[]	active	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-23 06:56:27.233	2026-09-23 06:56:27.233	nama	desc
643c3b39-bec1-47ef-b1dc-b685e1ff89cf	df9c647f-e1a6-4988-8fba-a9896cd9524a	on	2026-09-23 00:00:00	17:00	\N	none	[]	active	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-23 08:28:06.066	2026-09-23 08:28:06.066	test schedule	desc
57b30282-fa88-4bf3-8dab-f354dc443e4d	df9c647f-e1a6-4988-8fba-a9896cd9524a	on	2026-09-23 00:00:00	17:00	18:00	weekly	[1, 2]	active	a7952ab6-da7e-40e3-9888-3e9752777961	2026-09-23 08:38:06.522	2026-09-23 08:38:06.522	nama	\N
\.


--
-- Data for Name: security_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.security_events (id, type, username, "userId", ip, "userAgent", detail, "createdAt") FROM stdin;
fb2d3aec-6dd9-40c6-83a8-504c7514ee70	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-21 03:11:44.035
f4bff9d1-a897-4824-80ad-0aa8a47a8c01	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-21 03:11:44.04
4a865bf3-7ac9-4fee-b4cb-e207c5933bf4	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-21 03:11:44.037
b850d702-0768-4bb2-b126-87555d33f4ae	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-21 03:11:44.066
941a65aa-dd52-4fa4-bd19-1fdadc73814c	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-21 03:11:44.068
091706d6-c8b9-4963-9374-2329afc29345	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk room.view	2026-09-21 03:11:44.07
51cbd388-e554-4ee7-ada9-83213bf64576	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-21 03:11:44.072
df26a2d5-583c-416a-a764-ad9a647c5e6c	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-21 03:11:44.074
0c90fafc-95e3-4f1e-9edd-fb1703533d76	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-21 03:11:44.041
894c5bee-4fc9-4426-a85d-20832fdb05ed	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-21 03:11:44.084
d685b4f1-530d-4f40-a2b3-e87208b8e80a	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-21 03:11:44.074
9f51ee32-9e74-4c42-a1b0-5a007a603907	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-21 03:11:44.096
0d6ae68a-1ed0-4920-9ec5-9f37cc89b3cb	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk room.view	2026-09-21 03:11:44.102
629ae0cb-7d5c-4a82-a873-6cab9eb6ea96	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk user.view	2026-09-21 03:11:44.11
9cd9f7c0-79a2-4ebb-9263-157ba7c9c2ce	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk room.view	2026-09-21 03:11:47.873
c778f2a8-0a66-4af2-b392-dcb2dcf809b1	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk room.view	2026-09-21 03:11:47.873
e8270ac9-29fa-4cea-a3f5-483068e57246	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	node	Akses ditolak untuk user.view	2026-09-21 03:11:47.875
d1256bb2-fc6e-4700-87f4-9977e8a9f23e	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-21 03:11:53.979
3ffea8c2-65b1-4644-a8ad-6d159b1b6b0e	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk room.create	2026-09-21 03:14:43.911
bde8748f-56d4-4aa5-89ac-dd8b7c7fe63d	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-21 03:14:56.669
4460d6e9-56cb-415d-b30f-65049e684a99	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	PostmanRuntime/7.51.1	Login berhasil	2026-09-21 03:29:34.507
eab20b65-ff57-4792-a640-ea1a3509ddb8	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-21 04:04:23.906
264f9780-9b0c-496d-b744-8d90302d9ac0	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-21 04:07:32.061
506c65de-054d-4b98-9593-081142a17464	LOGIN_FAILED	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Password salah. Percobaan ke-1	2026-09-21 04:07:33.81
7da56f1b-fcb5-4fb0-940f-e91ede4d06ff	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-21 04:07:39.775
ff8d540f-54e3-45e0-8b3c-eb9688f311f6	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-21 04:13:40.497
9547a682-0876-4cdc-ad97-e235c2c1ddef	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:30:08.937
d285cd47-4f3c-415e-9e75-cc85b78b743c	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:30:20.417
03f4b924-a1d9-4d7a-a685-d09247046fd9	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:30:22.841
af67fd50-2622-43c4-adf1-a33d74a8f8b5	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:30:23.49
fafe47ac-2453-44e7-9134-28ec7431c7e8	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:30:23.861
25b2fa82-452f-40e1-8e7f-004563abf2b0	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:30:29.101
76e8a635-a7de-465c-a8ef-3b6cd87b926a	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:30:29.63
06cbff2c-41b2-4738-8a54-6581c9159ce2	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:30:30.008
f436341f-5eba-45ea-b77b-8def722ce250	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:30:30.409
0d471894-d530-4237-8208-655d056951f8	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:30:30.81
50230764-a864-494a-ac0b-750ee5d63990	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:30:48.726
a2122017-e104-4e1d-87a4-b72be27ff1c2	LOGIN_FAILED	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Password salah. Percobaan ke-1	2026-09-21 04:33:26.679
a09b4cfd-20aa-4886-8df5-a2a33051b3ed	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:33:34.981
80b6ce9f-189a-431a-b7c0-b6b63a380489	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:34:35.225
f0b954e2-97e7-4b3e-989b-94949a23a618	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:34:39.984
eef10894-16b2-4bb5-87a6-9f6837232cc0	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:34:40.783
86f8a58d-c3e8-4dd9-8d55-9ef847f89d14	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:34:41.158
15f4bc23-5d8c-4e08-8583-37ece9597f7b	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:34:41.827
7c7068ab-e516-43c4-b90d-adc212630dcd	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:34:42.8
72a9de63-9f14-42b0-9894-aca5b5b78f87	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:34:45.713
d21f6ac8-822d-4310-be7d-079529315a13	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:34:46.334
e459755c-6281-43bd-b7cd-31f25af812f3	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:34:46.878
3f442ba6-9e91-4b2e-b21b-db12587a73c1	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:34:58.647
754f6ea0-fbe1-407d-8518-68589d6346ec	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:35:09.403
77ed5438-1d29-4c68-9fc1-b6a9b62c5d42	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:35:41.785
15974994-d6e9-4473-bccf-56999a51635c	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:36:33.637
84bd58ba-0cd7-4030-b0cf-aa30156f5f09	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:36:44.598
83996cf9-2410-4afe-9ae8-6649a0aee021	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:36:45.483
d016678e-2a01-47ac-a89e-add23d2da19e	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:36:46.171
d3557aea-f46a-4a84-a56c-f9415324d332	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:37:26.806
98fdf932-706b-495a-86e9-aef7d47f0105	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:37:27.538
6adca512-98e9-4139-8646-0d745171e5c3	LOGIN_FAILED	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Password salah. Percobaan ke-1	2026-09-21 04:39:25.113
3e31d832-2f5e-44ea-83cd-1e90b6814da7	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 04:39:34.733
dc8bcff2-e962-419e-9ab8-c290fa5ce3da	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-21 04:42:08.764
66b2dc59-120e-4146-b467-bc261fdc0c9c	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-21 04:42:32.737
8c0f9efe-3020-471f-8b65-64fe3e2efa10	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	PostmanRuntime/7.51.1	Login berhasil	2026-09-21 04:42:37.104
ff78d5aa-e910-4529-a2f8-9e36fff01cf4	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-21 04:42:53.017
e238c7e0-cbcf-4e13-b116-6386e0220a17	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	PostmanRuntime/7.51.1	Login berhasil	2026-09-21 04:50:36.658
64cfe86a-c97e-4397-b5df-ab07ff13e98c	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-21 05:02:52.402
175b9740-d897-4031-b181-f1aaf329236a	REFRESH_TOKEN_FAILED	\N	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Refresh token sudah dicabut	2026-09-21 05:02:54.084
1736ab90-d86d-4528-a7f1-44a57a66993f	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 05:04:26.156
9eece1d4-fb99-4ebb-bf4d-0774024c5b72	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Access token berhasil diperbarui	2026-09-21 05:06:42.077
58fc0f95-8cfa-45e1-9a37-22df05a6397f	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	PostmanRuntime/7.51.1	Login berhasil	2026-09-21 05:38:15.007
4add3d3f-6a64-45e5-aabe-c5e2b75a3481	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Access token berhasil diperbarui	2026-09-21 05:45:20.036
2a582b26-f077-47d4-ba9e-e1fd47be4b62	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-21 06:11:40.223
a4c5a2f7-c45d-4bc5-a7ee-96f9769c9f84	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	Next.js Middleware	Access token berhasil diperbarui	2026-09-21 06:17:51.08
4181d75b-274a-4b0e-8e3e-35c837778a95	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-21 06:21:58.193
f7806489-1981-4b62-abdc-3ea1636bc678	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-21 06:40:49.103
75b2565e-0734-4021-85ea-c6da6a68cd49	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-21 06:40:49.11
99e32504-b244-4cea-aaa9-9449d420f686	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-21 07:17:06.135
8c960407-ea67-4b57-acb5-fd103a4e9d30	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-21 07:35:57.092
97c17024-5b57-4ed2-ac0a-eab2ecbb7519	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-21 07:35:57.097
00b39515-1274-4a45-bbf0-fd31efcd224e	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	PostmanRuntime/7.51.1	Login berhasil	2026-09-21 07:44:00.199
7dfe9441-0a35-4818-9dc8-e3c10ddfb8bb	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-21 08:05:04.282
77278286-689c-41a2-9a6f-3034e0805b93	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-21 08:14:38.711
851c5a0b-f7a4-4dd1-8c6e-f61fe1485e07	LOGIN_FAILED	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Password salah. Percobaan ke-1	2026-09-21 08:17:13.721
9a2c8146-c2a2-4699-8cd5-b30ecec86dc0	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 08:17:31.367
8c5715a1-eca4-419c-9425-187b31bc9b75	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	Next.js Middleware	Access token berhasil diperbarui	2026-09-21 08:17:31.55
490c136f-0315-4639-8b6a-f4862a6c05a1	REFRESH_TOKEN_FAILED	\N	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	Next.js Middleware	Refresh token sudah dicabut	2026-09-21 08:17:31.628
70979ccf-a1f9-411b-8358-d1740e9b0fff	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-21 08:34:24.097
bfa3076c-913a-41ab-b99f-84020e49652a	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-21 08:34:24.103
a4170892-ab9c-4864-96e1-8b8ce5e80e50	LOGIN_FAILED	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Password salah. Percobaan ke-1	2026-09-21 08:47:11.995
16e4928f-923c-4bed-9e6f-b7d9c0c0ea29	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 08:47:17.822
32802592-4d68-4798-9946-ba36642af934	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 08:47:20.456
61759785-ad96-4db1-8937-5df9b474a46c	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 08:47:21.618
2852648a-726d-4c92-8aaf-ef2a0089b9be	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 08:47:27.397
a4edaf47-e6de-4762-bf3b-4c4a337844f3	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 08:48:00.81
f3e32e1a-860b-481c-a0dd-297f90bc5b54	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 08:48:02.041
6a1d6062-86b9-4027-8267-cc1bc0a8747c	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 08:48:02.963
cf1e9449-0325-42da-a07a-7c1c0f11201d	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 08:49:52.079
f72ae5da-d2a2-4bad-a18d-e578e4fe932e	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 08:50:38.867
71c99a56-9e34-4f3c-92a0-6b1b039b61e7	LOGIN_FAILED	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Password salah. Percobaan ke-1	2026-09-21 08:56:02.042
f256ac9c-7473-44d4-8010-e0d76a722737	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-21 08:56:07.798
55e7c5cc-b30b-424b-a53d-86e1929ea6bb	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 09:06:06.621
d033db36-1a56-4af9-9549-4f2503e4369b	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-21 09:13:13.639
f5947cfd-0559-4bc8-ada2-3f62cdcf5d53	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-21 09:28:09.99
09158ef0-308d-4cc2-bcd3-36eb907f06c5	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Access token berhasil diperbarui	2026-09-21 09:31:42.346
a10d8f2d-7a1f-4de4-8caf-cdd8d3454ff3	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 09:36:51.532
9504ba6e-6342-4292-bbec-b0755dd10201	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-21 09:36:56.461
55c2c8d8-971c-4723-b7e8-cb07ba118d6f	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-22 01:39:18.955
9f8cd7b5-98e3-41bf-920c-efc038464854	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-22 02:28:24.794
6102e34d-851f-4c37-b315-53c40c5c701a	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-22 02:34:43.652
87b1b8ce-238c-4869-9716-dddbd6878892	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Access token berhasil diperbarui	2026-09-22 02:37:16.1
798f9e77-dd5e-4756-bced-2cdd95d9a491	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-22 03:06:19.515
d641f3ac-b239-4c96-8898-63f1296af270	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-22 03:06:54.765
89e1a6ad-74b7-4c84-9711-d5756bcb8870	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 03:24:38.643
acc0e752-60ca-412a-a220-271979f35949	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 03:24:38.647
4e4fa40e-15ee-4164-9282-6ca00a0db5c7	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Access token berhasil diperbarui	2026-09-22 03:33:26.393
60e07caf-0da3-4c9f-8149-f3077231fddf	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-22 03:49:35.63
e9abf318-2035-44e2-b68b-4a717feb7ff4	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 04:01:25.116
cfa1eadf-737b-48c8-9555-90bb72d17f67	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 04:19:46.977
c818407b-fd4f-4be7-8a4e-62aca1881530	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Access token berhasil diperbarui	2026-09-22 04:30:51.718
80913d8b-a4cd-43c1-8ba9-3bc2377a5502	LOGIN_SUCCESS	bilah	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Login berhasil	2026-09-22 04:55:02.04
f1e7378b-481e-4994-9241-a0e1872a57eb	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:55:02.154
9bfbfd0b-43ea-4753-9758-e10358a7baf5	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:55:02.293
65a3d05b-9a32-4b79-ae4f-481e832162af	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:55:02.334
f9f76cc5-40df-46ee-bb7f-e62739456715	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:55:20.362
c10940cd-9634-44c7-bd96-49408bf983cd	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:55:39.036
e43c8136-5df6-4be9-9dcc-e8a9285b87d0	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:55:47.441
b944e69a-de35-4769-a05d-b1fafcaff7bf	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:55:58.593
bbe43917-2055-4df8-aeae-bac41f9381e9	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:56:00.872
ed882223-3289-4832-81f6-779ebb74ab6e	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:56:35.899
d2b56ce1-74f3-4861-baf0-b06ac41d2454	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:56:39.185
577ad819-c766-49f8-be93-b72018453851	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:57:01.901
79f1d4c4-40fa-4d7a-b5c2-1c4766c1c10c	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:57:10.223
a0ef5c94-0e00-45ce-be64-d461ac5b1246	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:57:25.484
d9de22a0-0949-459d-b294-247965ab0c4f	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:57:40.27
3030103d-9b33-4b0d-841c-f80e981e852d	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:57:51.269
ace0c240-82dc-45e6-a786-081357b19f4c	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:58:02.094
2a9ad966-8cc2-4b7d-86d0-74c78f3db8e6	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:58:21.564
82dd7f0a-3a5a-49f5-871c-b2bec311f548	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:58:38.044
b0e6ecc4-a79a-420a-a64a-2860774f99a7	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:58:56.72
ef1b108c-8b7a-49c5-b867-ffa02c4565aa	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:59:02.246
45151adb-f259-479f-bc65-b171029c9b5e	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:59:37.183
90b14faa-d0ce-4299-8889-f8df6abf3b9c	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 05:00:59.851
ba597327-1371-4f9c-9773-5fd72570e032	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:59:04.826
3f81b72d-dde3-4e45-b6fc-c647319ed0df	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 04:59:33.256
5d4e2c82-009b-4d17-9738-53e3d794e60e	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:00:02.486
ffecd4c2-3aae-4d9d-99e4-225c2513ba32	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:00:19.37
0a0d5561-8fff-428d-9351-24965f4a72fa	LOGIN_SUCCESS	bilah	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-22 05:00:34.553
99f0955f-d117-42a7-b5e9-f8403c8eecd1	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk role.view	2026-09-22 05:00:38.809
1d2d92da-d77b-4f9e-b9b0-8e10e2534999	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:00:59.875
f50305f4-9099-4fe5-87ca-752d89160109	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:09:51.051
a1af020a-2fa8-4424-9200-df5ecbf0dd12	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:11:51.112
9419f8a9-f254-47b7-bfb1-85450c688119	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:14:59.214
36d0d8d7-f5a0-4268-86b8-6e78dc1be07e	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:17:00.236
9cc91d1f-ec8b-4544-b183-973f163be443	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:18:51.244
6067e02a-6a37-44bc-8803-ae0927486313	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:23:51.18
77f9e45b-6535-4caa-bf63-266b3a133873	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:26:57.636
0a677a49-3427-4091-9b3d-f188b49ae9c6	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:32:16.011
f80352e8-33e4-4cea-b0b0-f51269de4b6a	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:34:15.795
d4e558de-6e0c-43b0-bb3b-e5a2a7d4a989	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:36:16.394
54ab9fb0-111d-4342-a0ae-a04f129df834	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:38:23.789
b5eeccd1-309a-4a9a-a168-db8d8824de3a	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:40:25.372
da1b8473-6bec-45f6-a215-8a7fd28cc986	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:42:48.813
b3ba750f-5be2-4cd7-b52c-a1d7df65edf8	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:44:48.797
94b69b93-e7a3-46e1-83d8-3b9748c193fc	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:47:54.098
bdd470ec-cf1c-48de-89a3-27750b82f619	REFRESH_TOKEN_SUCCESS	bilah	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 05:50:03.457
ce28a28d-5090-4322-83a6-8b2d840f0d98	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:50:03.622
5bf4258b-5c6a-4054-a27d-7c1a175813ed	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:52:03.686
02439681-99ef-43a7-8fe7-7b5f61465206	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:54:04.513
b35e581b-967d-4219-ab65-221f9b11fd8d	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 05:56:03.534
e792e248-c72e-4b3f-aa72-8748c87c9118	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 05:56:04.363
61a079f6-8d7b-45b8-ad1a-9e6a85fc05bb	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 06:04:25.278
a124dd12-be2a-4918-bb55-ad4a578d5084	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk role.view	2026-09-22 06:04:45.063
06ceb3c2-747d-4df7-8751-b3d4dacd1a52	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 06:06:34.583
3a370097-5ffa-480d-aa7a-eca7d6b05351	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Access token berhasil diperbarui	2026-09-22 06:09:53.618
a6e33411-1884-4f7d-84a0-ac17d1b27903	REFRESH_TOKEN_FAILED	\N	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Refresh token sudah dicabut	2026-09-22 06:09:53.633
c71ee244-5e8d-44b5-8c0e-9d8040654149	REFRESH_TOKEN_FAILED	\N	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Refresh token sudah dicabut	2026-09-22 06:09:53.636
e165b9bc-9a59-4c82-acf5-b07b34175135	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 06:09:53.772
7678ca80-82fb-401e-ade7-7c3d6aec103e	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 06:09:53.775
5de3ebc6-c7e1-4fc0-87c6-3ea731e1a37b	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 06:09:53.808
ef106e61-b44b-43b0-9584-f2c37400a099	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 06:09:53.815
4183e73f-90cb-4b8f-afbc-2e3e9329d8cf	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-22 06:09:58.106
2dcb1051-b8bd-4d6e-8392-51c050aef52d	LOGIN_SUCCESS	bilah	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-22 06:22:08.483
a2e47f3c-c40f-474a-bfb3-821508779786	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-22 06:33:05.501
7a3a14bd-8979-4be6-88fb-5cfe5eb9a3b5	LOGIN_SUCCESS	bilah	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Login berhasil	2026-09-22 06:33:12.825
f00b8c05-9693-4f38-8bd9-24025c225610	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk user.view	2026-09-22 06:35:07.774
5a4c94e6-05f8-4674-ac42-d1c41b3a7a94	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk room.view	2026-09-22 06:36:07.537
f8ff8e24-ac84-4d01-82bf-7a36333eebfb	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk gateway.view	2026-09-22 06:36:07.549
63762b30-1782-4832-b5dc-ab97bae672f8	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk room.view	2026-09-22 06:36:07.744
f4ee271f-c5c3-47e2-8a87-1bc396fbb834	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk gateway.view	2026-09-22 06:36:07.746
db96a160-b52d-4e92-a0ee-d3636eda392c	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk gateway.view	2026-09-22 06:36:29.874
3de03eaa-8dbd-41ea-939c-31c3d9e0e5b7	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk room.view	2026-09-22 06:36:29.883
dba9a5d1-3e1b-4c25-9668-41aebd64c50d	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk room.view	2026-09-22 06:38:21.866
e7365eef-3d73-4d57-a2f9-f124e13c730d	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk gateway.view	2026-09-22 06:38:21.867
00c296ba-0cbe-4189-8ddf-3d29ab293d1e	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Access token berhasil diperbarui	2026-09-22 06:42:58.299
5d927a21-6c63-467a-9525-7ac9feeb818f	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-22 06:44:09.031
8a9886e7-650c-4e90-8910-f34a4f9e3e10	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-22 06:45:06.546
a1455e26-91e5-441d-81e2-cad0dd19ebb3	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-22 06:48:41.326
073e0814-d710-4122-b71c-769a25f2c5c3	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-22 06:48:41.33
1ac59d5b-7cf0-4e88-bf20-fb591ce1724b	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-22 06:48:41.339
dae1804e-8d80-4000-b8c3-ef67bba94a36	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-22 06:48:41.352
4f8465c6-232d-412c-a414-f763b43c8c9e	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-22 06:48:41.371
64e2602a-ac57-4f93-9b18-28c3443b68f2	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-22 06:48:41.339
f44cd3e2-2cd7-481d-8b9e-3b10d19e6f62	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-22 06:48:41.384
6976fb7d-3953-40a8-a246-c46fa9e37a55	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-22 06:48:41.396
07f3fa73-fdcd-40cc-b337-a93443551f26	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-22 06:48:41.397
7e86d2b1-4ade-4c1e-b604-f99811ab79bf	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-22 06:48:41.404
973d9c21-d466-4857-a6bd-c4004d94dfd9	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk dashboard.view	2026-09-22 06:48:41.407
0efeaa71-c1ac-41d4-a4bc-0f849ad634b2	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk schedule.create	2026-09-22 06:56:02.159
23064469-45bc-433d-9b4f-0f99a9cbfc7b	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 07:00:23.656
d7411639-9fc7-4fc7-9c4a-ffd818a5c235	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 07:05:41.186
6e1375cc-9964-4f69-8729-269de8d100c6	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 07:05:41.194
5d1b1200-070e-4170-9bde-3f7dc805869d	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk room.view	2026-09-22 07:07:35.611
e1b503e0-90ad-46ae-8a0b-5572d1a25223	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-22 07:23:10.483
0599df8e-3800-420c-92cc-e444704ccd30	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk room.view	2026-09-22 07:24:22.259
a839e1f7-cc24-4acc-b1e7-57f9df0427fc	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk room.view	2026-09-22 07:24:31.677
dd0af344-94ee-42a9-b9cf-211518bf39c0	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk room.view	2026-09-22 07:24:35.57
238355bd-d326-4dad-bf78-9f53116a0baf	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk room.view	2026-09-22 07:25:10.742
4a912cd3-4f00-4624-b1df-36911f13a009	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk room.view	2026-09-22 07:25:51.961
e0ef7c06-88de-48b3-a434-b2f8565b816d	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk room.view	2026-09-22 07:26:00.851
43d6f381-1fea-4918-a3eb-814a80ba5200	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk room.view	2026-09-22 07:26:48.989
3e820b97-1ba9-415e-beae-f9918aabb1e3	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk room.view	2026-09-22 07:26:48.994
8904cbfe-f105-4d3e-afe1-6d2ef83e1ebd	REFRESH_TOKEN_SUCCESS	bilah	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 07:30:59.016
fc6732b3-3688-42cd-93c6-911272ba46e4	LOGIN_SUCCESS	bilah	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-22 07:39:44.663
c7ca67a9-59e2-442c-96df-77d61adcf4f6	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk user.view	2026-09-22 07:39:54.474
03b2a24a-534b-46ae-8092-43fb08b2ad59	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:156.0) Gecko/20100101 Firefox/156.0	Akses ditolak untuk room.power_control	2026-09-22 07:47:58.986
a07fd3d8-7969-489d-a452-894d486c4975	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk room.power_control	2026-09-22 07:52:09.494
2e9eac05-7d3f-49b3-9c4c-a1da79096afd	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 07:56:26.414
d477d4ef-d697-48a7-9667-9bae600d996c	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 07:56:27.961
28898cd0-0351-4bf2-8425-6c02cf21c179	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 07:56:32.736
6ef6d4fe-9a68-46f4-97d4-00499d90bbf9	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 07:56:44.453
dbf6b49e-4f02-4f98-b35e-6c62b94a93b5	LOGIN_SUCCESS	bilah	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-22 07:58:03.609
56745e30-eae5-43a2-982f-e9f2b5cd5c3a	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk role.view	2026-09-22 07:58:42.057
23203548-4939-4e65-97cb-d12e037620f5	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 07:59:21.014
9dae96e9-d383-4d14-8c49-e94b15152abf	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-22 07:59:33.022
7790706f-0fe0-464e-a3d2-ae1c2ea003aa	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 08:03:18.825
894426c9-1b9b-4931-a237-313a4fc13beb	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk user.view	2026-09-22 08:05:09.523
73a5e906-afd0-48ae-b93b-706b0bf448b9	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk user.view	2026-09-22 08:05:09.559
6e6e323c-bdc7-4cf4-82bf-bc3367dd19e7	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk user.view	2026-09-22 08:10:41.449
b923a3e2-0bca-4125-90b1-5773d2b1d069	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk user.view	2026-09-22 08:10:59.39
73616904-a103-4af5-ba0f-2d95b8b0eff7	REFRESH_TOKEN_SUCCESS	bilah	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-22 08:31:43.62
79d510f7-338c-4b8e-8748-32ce3bc4f270	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-23 02:25:25.561
7c9ad039-1aec-4e43-9346-cd656da66c04	LOGIN_SUCCESS	bilah	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Login berhasil	2026-09-23 02:29:53.866
9755b0a8-47f0-45e3-9ef7-ed1774190dca	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk user.view	2026-09-23 02:31:21.701
855c9595-959c-42d9-99e4-ec74295d811d	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk device.view	2026-09-23 02:36:59.345
e1db24f8-a9eb-41ce-baca-afe511860439	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk device.view	2026-09-23 02:38:25.841
8bd44474-2ec9-4c2f-992f-13776f3c7411	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:156.0) Gecko/20100101 Firefox/156.0	Akses ditolak untuk device.power_control	2026-09-23 02:57:02.165
e6924876-f5f6-4e78-8915-d68f61c55287	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:156.0) Gecko/20100101 Firefox/156.0	Akses ditolak untuk device.power_control	2026-09-23 02:57:11.316
0d813370-744d-4010-994a-5aa0a07b2521	PERMISSION_DENIED	\N	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Akses ditolak untuk user.view	2026-09-23 03:05:11.445
7d1cf331-8ef3-4a46-ab19-e460fe76c497	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-23 03:20:30.319
1bd1051a-ed26-47a6-95b3-351c77d1fd76	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-23 03:20:30.326
63c57a3f-ed25-4d50-8718-60983d2cbe34	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-23 03:26:01.912
bf32c75a-e742-4b4b-912d-fbdf241ff413	REFRESH_TOKEN_SUCCESS	bilah	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-23 03:29:19.784
d512a9fa-4737-4ffd-93d6-bcc2efeeb607	LOGIN_FAILED	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Password salah. Percobaan ke-1	2026-09-23 04:11:18.885
b5e67030-520b-4e24-9f97-669541144fe9	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-23 04:11:25.146
b5422bf2-ba77-4bdc-b35e-11858b298203	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-23 04:14:12.424
3b8f6216-e246-47e2-b2fb-18d3c4783977	REFRESH_TOKEN_SUCCESS	bilah	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-23 04:25:59.461
2b8cf9f6-a54d-430d-b1ea-20ff15375b20	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-23 05:15:10.891
65a54be1-7211-4d0f-8699-2da94041bd26	REFRESH_TOKEN_SUCCESS	bilah	bc6664ef-6c60-436d-9936-0d0e09043462	192.168.101.169	node	Access token berhasil diperbarui	2026-09-23 05:22:04.564
af39bca0-ab72-4c8d-a67b-efd47b256e3e	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk schedule.view	2026-09-23 06:18:55.327
f1a0bda7-5e90-4db2-93fb-d3472a98c8ad	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-23 06:18:59.79
eff28a18-e96b-40b9-8685-490ef11f0bb0	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 06:43:03.242
53abcb5c-b338-4427-a924-dd34758d8f71	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 06:43:40.999
e69b974d-219e-4d3d-8a5d-17771a122eae	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	PostmanRuntime/7.51.1	Login berhasil	2026-09-23 06:43:52.783
ef259052-5b32-4add-b7dd-646359a659a1	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	PostmanRuntime/7.51.1	Login berhasil	2026-09-23 06:43:54.242
a2a75b22-62b3-4130-baf9-fbabc954eb49	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 06:43:59.351
988fd0d5-2beb-4957-bbe2-74cb4a29ef24	LOGIN_FAILED	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Password salah. Percobaan ke-1	2026-09-23 06:50:12.905
73ab8547-d9bc-41c5-9a21-af9bdb6ceccc	LOGIN_FAILED	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Password salah. Percobaan ke-2	2026-09-23 06:50:21.975
e0806cc9-819c-41e0-9ea4-c9dc8bd23392	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 06:50:25.276
121572fd-f2e8-4051-bedc-59732f69c43b	PERMISSION_DENIED	\N	7cabe6e7-c123-42fc-9614-db65d19cc32a	192.168.101.169	PostmanRuntime/7.56.1	Akses ditolak untuk schedule.view	2026-09-23 06:52:22.764
cea1e4d3-68ab-40dc-8ec4-0ba54d9f816b	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	PostmanRuntime/7.56.1	Login berhasil	2026-09-23 06:52:26.086
54bcc10c-dc7b-44e3-bdbf-c36ba594a714	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Login berhasil	2026-09-23 06:53:33.003
0c9c11e5-1ea5-48d8-9c4d-a9298c9f3719	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 06:55:56.982
002f9c9b-2a42-4d75-b9bc-d7c5c1bd4f5e	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-23 06:58:54.318
b3526a18-ce9b-451e-b358-b56eecc18da2	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 06:59:42.562
f5895f2f-ef48-48db-8d8f-fd96e2bbdfcd	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 07:03:44.281
d81e133b-0107-4c12-96c1-0044bad34641	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 07:04:37.502
1af8a362-aee6-4241-a83b-90099e20d3d3	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	Next.js Middleware	Access token berhasil diperbarui	2026-09-23 07:04:37.662
06df8edd-fffc-40cd-b2b8-c4c317122de1	REFRESH_TOKEN_FAILED	\N	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	Next.js Middleware	Refresh token sudah dicabut	2026-09-23 07:04:37.84
53e9ee81-6f82-4017-a57e-e8f06bcdbb20	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 07:15:38.546
1203bdc3-2aed-4d5e-bb2c-29dcfe81a52e	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 07:19:43.568
19a92fd3-499d-4ca8-8331-be50b054ca8e	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-23 07:19:54.178
22f73e66-eac8-4e93-a68e-267c9c2a8420	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	node	Login berhasil	2026-09-23 07:36:10.575
b3f85a1f-f262-4663-89fe-0acc9c1caab7	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 07:37:11.567
792e84ef-3ef6-49e6-87a2-2cb6e6d1e805	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-23 07:52:40.635
9766676b-3ea9-413d-aa39-085d05068b09	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 07:58:55.076
3070d8ec-41e6-46b5-b168-a07fe252f883	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	PostmanRuntime/7.51.1	Login berhasil	2026-09-23 07:59:33.39
63068b28-11b0-415b-aa3c-a55539146283	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-23 08:18:14.359
97b9e596-086c-4fd5-a990-cbf3bb704ed0	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 08:20:01.294
449b897c-2f8c-4541-a0f0-952f86aa3c85	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	10.70.0.32	node	Login berhasil	2026-09-23 08:20:13.143
9648f29a-cfab-4c62-9771-eb7e303e4a9a	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	PostmanRuntime/7.51.1	Login berhasil	2026-09-23 08:34:40.422
6aca4e4d-a072-4102-8904-9915218011bc	LOGIN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.100.208	PostmanRuntime/7.51.1	Login berhasil	2026-09-23 08:42:40.533
27533f4d-0997-4459-a025-8ff12173df7c	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	node	Access token berhasil diperbarui	2026-09-23 08:49:19.255
f18aec43-4547-46dd-8995-ab97a293231d	REFRESH_TOKEN_SUCCESS	admin	a7952ab6-da7e-40e3-9888-3e9752777961	192.168.101.169	Next.js Middleware	Access token berhasil diperbarui	2026-09-23 09:15:54.754
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, "fullName", username, email, "passwordHash", phone, address, "avatarUrl", "roleId", "createdAt", "updatedAt", "lastActiveAt", "failedLoginCount", "lockedUntil") FROM stdin;
fa32f9e7-9760-4f94-a631-214bffe1618d	Brodie Winter	winter	winter@mail.mail	$2b$10$X0WvVAOH0HgX4U8DmO6b0eJ8Ls7t3tnqzCHYrLzi.Loe6acxiM.Gy	087284627183		\N	0a1dc96c-7190-456a-87c3-2a9ee8ed4946	2026-09-21 03:26:04.547	2026-09-21 03:26:04.547	\N	0	\N
bc6664ef-6c60-436d-9936-0d0e09043462	bilah	bilah	bilah@mail.mail	$2b$10$wRsbAy7frUMnFhdScVaebeRGdgnJsaIFXNKcerHlZNQDcRka0ij76	890347596349		\N	5ae37975-27db-49db-b75b-72c4a811aaee	2026-09-22 04:54:22.084	2026-09-23 02:29:53.85	2026-09-23 02:29:53.849	0	\N
a7952ab6-da7e-40e3-9888-3e9752777961	Administrator	admin	admin@falahtech.co.id	$2b$10$75rgtuJkDCAIwon/B53l6uQ0H4Bh7ycFJVPi3ADNbfrVVHGcPGpRG	\N	\N	\N	5b6d9505-3270-49ae-afdd-9aac0a226a4a	2026-09-18 08:54:51.408	2026-09-23 08:42:40.517	2026-09-23 08:42:40.516	0	\N
bc18e1e1-daee-42b3-83ef-0925436dbc82	amanda	amanda	amanda@mail.mail	$2b$10$3h0oFd7AU8ul.WeIuRdVHO.l1i8oSno/e/7cDPC7r95Sk4tygjl7O	0836273842986	alamat	\N	0a1dc96c-7190-456a-87c3-2a9ee8ed4946	2026-09-21 04:31:00.355	2026-09-21 04:31:00.355	\N	0	\N
\.


--
-- Data for Name: webhook_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.webhook_events (id, source, "eventId", "tbDeviceId", payload, status, "errorMessage", "receivedAt") FROM stdin;
\.


--
-- Name: energy_readings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.energy_readings_id_seq', 149, true);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: command_logs command_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.command_logs
    ADD CONSTRAINT command_logs_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: energy_readings energy_readings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.energy_readings
    ADD CONSTRAINT energy_readings_pkey PRIMARY KEY (id);


--
-- Name: gateways gateways_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gateways
    ADD CONSTRAINT gateways_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY ("roleId", "permissionId");


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: rooms rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rooms
    ADD CONSTRAINT rooms_pkey PRIMARY KEY (id);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: security_events security_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.security_events
    ADD CONSTRAINT security_events_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: webhook_events webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.webhook_events
    ADD CONSTRAINT webhook_events_pkey PRIMARY KEY (id);


--
-- Name: devices_eui_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX devices_eui_key ON public.devices USING btree (eui);


--
-- Name: energy_readings_deviceId_recordedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "energy_readings_deviceId_recordedAt_idx" ON public.energy_readings USING btree ("deviceId", "recordedAt");


--
-- Name: gateways_eui_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX gateways_eui_key ON public.gateways USING btree (eui);


--
-- Name: permissions_module_action_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX permissions_module_action_key ON public.permissions USING btree (module, action);


--
-- Name: refresh_tokens_tokenHash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON public.refresh_tokens USING btree ("tokenHash");


--
-- Name: refresh_tokens_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "refresh_tokens_userId_idx" ON public.refresh_tokens USING btree ("userId");


--
-- Name: roles_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);


--
-- Name: security_events_type_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "security_events_type_createdAt_idx" ON public.security_events USING btree (type, "createdAt");


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: webhook_events_eventId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "webhook_events_eventId_key" ON public.webhook_events USING btree ("eventId");


--
-- Name: webhook_events_tbDeviceId_receivedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "webhook_events_tbDeviceId_receivedAt_idx" ON public.webhook_events USING btree ("tbDeviceId", "receivedAt");


--
-- Name: command_logs command_logs_deviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.command_logs
    ADD CONSTRAINT "command_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES public.devices(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: command_logs command_logs_roomId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.command_logs
    ADD CONSTRAINT "command_logs_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES public.rooms(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: command_logs command_logs_scheduleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.command_logs
    ADD CONSTRAINT "command_logs_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES public.schedules(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: command_logs command_logs_triggeredByUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.command_logs
    ADD CONSTRAINT "command_logs_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: devices devices_gatewayId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES public.gateways(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: devices devices_roomId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES public.rooms(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: energy_readings energy_readings_deviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.energy_readings
    ADD CONSTRAINT "energy_readings_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES public.devices(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: gateways gateways_installedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.gateways
    ADD CONSTRAINT "gateways_installedById_fkey" FOREIGN KEY ("installedById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: refresh_tokens refresh_tokens_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_permissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: schedules schedules_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT "schedules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: schedules schedules_roomId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT "schedules_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES public.rooms(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: users users_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict sH2f3dxNu36ysitvS7290pzPGf1DqTKdguuYYiAa7w8Y3uEzEhuxmjJJfFz7Q9e

