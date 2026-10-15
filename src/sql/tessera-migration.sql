-- TESSERA features for the S4S crop mapping processor (s4s_crop_mapping).
-- Adds the tessera-* keys and documents the "tessera" token of features-filter.
-- Can be applied several times. Undo: tessera-rollback.sql.

BEGIN;

-- NEW KEYS --

INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4s_crop_mapping.tessera-root', NULL, '/eodata/geoAI-embeddings/Tessera', now())
    ON CONFLICT ("key", (COALESCE(site_id, -1))) DO NOTHING;
INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4s_crop_mapping.tessera-version', NULL, 'v1.0', now())
    ON CONFLICT ("key", (COALESCE(site_id, -1))) DO NOTHING;

-- METADATA --

INSERT INTO config_metadata VALUES ('processor.s4s_crop_mapping.tessera-root', 'Directory of the TESSERA embeddings (CreoDias EODATA)', 'string', true, 30, true, 'TESSERA directory', null)
    ON CONFLICT (key) DO NOTHING;
INSERT INTO config_metadata VALUES ('processor.s4s_crop_mapping.tessera-version', 'Version of the TESSERA embeddings', 'string', true, 30, true, 'TESSERA version', '{ "allowed_values": [{ "value": "v1.0", "display": "v1.0" }] }')
    ON CONFLICT (key) DO NOTHING;

-- the suffix is removed as is by tessera-rollback.sql
UPDATE config_metadata
   SET friendly_name = friendly_name || ', tessera (TESSERA embeddings, needs /eodata)'
 WHERE key = 'processor.s4s_crop_mapping.features-filter'
   AND friendly_name NOT LIKE '%tessera%';

COMMIT;
