-- Undo tessera-migration.sql.
-- Switch general.orchestrator.s4s-crop-type-mapping.docker_image back to the
-- original image first. A "tessera" token left in features-filter is then
-- ignored by the original crop-map-s4s.py.

BEGIN;

DELETE FROM config WHERE key IN ('processor.s4s_crop_mapping.tessera-root', 'processor.s4s_crop_mapping.tessera-version');

DELETE FROM config_metadata WHERE key IN ('processor.s4s_crop_mapping.tessera-root', 'processor.s4s_crop_mapping.tessera-version');

UPDATE config_metadata
   SET friendly_name = replace(friendly_name, ', tessera (TESSERA embeddings, needs /eodata)', '')
 WHERE key = 'processor.s4s_crop_mapping.features-filter';

COMMIT;
