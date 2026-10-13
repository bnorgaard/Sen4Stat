CREATE SCHEMA gadm;
ALTER SCHEMA gadm OWNER TO admin;

CREATE TABLE gadm.adm_l1 (
    gid integer NOT NULL,
    gid_0 character varying(80),
    name_0 character varying(80),
    gid_1 character varying(80),
    name_1 character varying(80),
    varname_1 character varying(129),
    nl_name_1 character varying(87),
    type_1 character varying(80),
    engtype_1 character varying(80),
    cc_1 character varying(80),
    hasc_1 character varying(80),
    geom public.geometry(MultiPolygon),
    enabled boolean DEFAULT true NOT NULL
);
ALTER TABLE gadm.adm_l1 OWNER TO postgres;

CREATE SEQUENCE gadm.adm_l1_gid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER TABLE gadm.adm_l1_gid_seq OWNER TO postgres;

ALTER SEQUENCE gadm.adm_l1_gid_seq OWNED BY gadm.adm_l1.gid;


CREATE TABLE gadm.adm_l2 (
    gid integer NOT NULL,
    gid_0 character varying(80),
    name_0 character varying(80),
    gid_1 character varying(80),
    name_1 character varying(80),
    nl_name_1 character varying(87),
    gid_2 character varying(80),
    name_2 character varying(80),
    varname_2 character varying(116),
    nl_name_2 character varying(80),
    type_2 character varying(80),
    engtype_2 character varying(80),
    cc_2 character varying(80),
    hasc_2 character varying(80),
    geom public.geometry(MultiPolygon)
);


ALTER TABLE gadm.adm_l2 OWNER TO postgres;

CREATE SEQUENCE gadm.adm_l2_gid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE gadm.adm_l2_gid_seq OWNER TO postgres;

ALTER SEQUENCE gadm.adm_l2_gid_seq OWNED BY gadm.adm_l2.gid;

CREATE TABLE gadm.countries (
    gid integer NOT NULL,
    fips character varying(2),
    iso2 character varying(2),
    iso3 character varying(3),
    un smallint,
    name character varying(50),
    area integer,
    pop2005 bigint,
    region smallint,
    subregion smallint,
    lon double precision,
    lat double precision,
    geom public.geometry(MultiPolygon),
    enabled boolean DEFAULT true NOT NULL
);
ALTER TABLE gadm.countries OWNER TO admin;

CREATE TABLE gadm.regions (
    name character varying(30) NOT NULL,
    geom public.geometry NOT NULL,
    id integer NOT NULL,
    enabled boolean DEFAULT true NOT NULL
);
ALTER TABLE gadm.regions OWNER TO admin;

CREATE TABLE gadm.subregions (
    name character varying(100) NOT NULL,
    geom public.geometry NOT NULL,
    region_id integer,
    id integer NOT NULL,
    enabled boolean DEFAULT true NOT NULL
);
ALTER TABLE gadm.subregions OWNER TO admin;

ALTER TABLE ONLY gadm.adm_l1 ALTER COLUMN gid SET DEFAULT nextval('gadm.adm_l1_gid_seq'::regclass);

ALTER TABLE ONLY gadm.adm_l2 ALTER COLUMN gid SET DEFAULT nextval('gadm.adm_l2_gid_seq'::regclass);

ALTER TABLE ONLY gadm.adm_l1
    ADD CONSTRAINT adm_l1_pkey PRIMARY KEY (gid);

ALTER TABLE ONLY gadm.adm_l2
    ADD CONSTRAINT adm_l2_pkey PRIMARY KEY (gid);

ALTER TABLE ONLY gadm.regions
    ADD CONSTRAINT pk_regions PRIMARY KEY (id);

ALTER TABLE ONLY gadm.subregions
    ADD CONSTRAINT pk_subregions PRIMARY KEY (id);

ALTER TABLE ONLY gadm.countries
    ADD CONSTRAINT "tm_world_borders_simpl-0.3_pkey" PRIMARY KEY (gid);

ALTER TABLE ONLY gadm.adm_l1
    ADD CONSTRAINT u_gid_1 UNIQUE (gid_1);

ALTER TABLE ONLY gadm.countries
    ADD CONSTRAINT u_iso_code UNIQUE (iso3);

CREATE INDEX adm_l1_geom_idx ON gadm.adm_l1 USING gist (geom);

CREATE INDEX adm_l2_geom_idx ON gadm.adm_l2 USING gist (geom);


CREATE INDEX fki_fk_adm_l1_countries ON gadm.adm_l1 USING btree (gid_0);

CREATE INDEX fki_fk_adm_l2_adm_l1 ON gadm.adm_l2 USING btree (gid_1);

CREATE INDEX fki_fk_adm_l2_countries ON gadm.adm_l2 USING btree (gid_0);

CREATE INDEX fki_fk_countries_regions ON gadm.countries USING btree (region);

CREATE INDEX fki_fk_countries_subregions ON gadm.countries USING btree (subregion);

CREATE INDEX fki_p ON gadm.subregions USING btree (region_id);

CREATE INDEX idx_countries_enabled ON gadm.countries USING btree (enabled);

CREATE INDEX idx_regions_enabled ON gadm.regions USING btree (enabled);

CREATE INDEX idx_subregions_enabled ON gadm.subregions USING btree (enabled);

CREATE INDEX ix_adm_l1_country ON gadm.adm_l1 USING btree (name_0) INCLUDE (name_1);

CREATE INDEX "tm_world_borders_simpl-0.3_geom_idx" ON gadm.countries USING gist (geom);

ALTER TABLE ONLY gadm.adm_l1
    ADD CONSTRAINT fk_adm_l1_countries FOREIGN KEY (gid_0) REFERENCES gadm.countries(iso3) NOT VALID;

ALTER TABLE ONLY gadm.adm_l2
    ADD CONSTRAINT fk_adm_l2_adm_l1 FOREIGN KEY (gid_1) REFERENCES gadm.adm_l1(gid_1) NOT VALID;

ALTER TABLE ONLY gadm.adm_l2
    ADD CONSTRAINT fk_adm_l2_countries FOREIGN KEY (gid_0) REFERENCES gadm.countries(iso3) NOT VALID;

ALTER TABLE ONLY gadm.countries
    ADD CONSTRAINT fk_countries_regions FOREIGN KEY (region) REFERENCES gadm.regions(id) NOT VALID;

ALTER TABLE ONLY gadm.countries
    ADD CONSTRAINT fk_countries_subregions FOREIGN KEY (subregion) REFERENCES gadm.subregions(id) NOT VALID;

ALTER TABLE ONLY gadm.subregions
    ADD CONSTRAINT fk_subregions_regions FOREIGN KEY (region_id) REFERENCES gadm.regions(id) NOT VALID;
