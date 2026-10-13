-- DELETE -- 

DELETE FROM config WHERE key = 'processor.s4c_mdb1.input_l3b';

DELETE FROM config WHERE key = 'processor.s4s_yield_feat.algorithm';
DELETE FROM config WHERE key = 'processor.s4s_yield_feat.selection-type';
DELETE FROM config WHERE key = 'processor.s4s_yield_feat.max-automatic-features-no';
DELETE FROM config WHERE key = 'processor.s4s_yield_feat.manual-selection-features';

DELETE FROM config WHERE key = 'general.scratch-path.s4s_yield_su';
DELETE FROM config WHERE key = 'executor.processor.s4s_yield_su.keep_job_folders';
DELETE FROM config WHERE key = 'executor.processor.s4s_yield_su.slurm_qos';

DELETE FROM config WHERE key = 'processor.s4s_yield_su.algorithm';

DELETE FROM config WHERE key = 'processor.s4s_yield_su.selection-type';
DELETE FROM config WHERE key = 'processor.s4s_yield_su.max-automatic-features-no';
DELETE FROM config WHERE key = 'processor.s4s_yield_su.manual-selection-features';

DELETE FROM config WHERE key = 'processor.s4s_yield_su.su_path';
DELETE FROM config WHERE key = 'processor.s4s_yield_su.data_extr_dir';

DELETE FROM config WHERE key = 'processor.s4s_yield_su.historical_data_upload_dir';
DELETE FROM config WHERE key = 'processor.s4s_yield_su.historical_data_path';
DELETE FROM config WHERE key = 'executor.module.path.s4s_yield_su_historical_data_import';

DELETE FROM config WHERE key = 'processor.s4s_yield_su.input_l2a';
DELETE FROM config WHERE key = 'processor.s4s_yield_su.start_date';
DELETE FROM config WHERE key = 'processor.s4s_yield_su.end_date';

DELETE FROM config_metadata WHERE key = 'processor.s4c_mdb1.input_l3b';

DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_feat.algorithm';
DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_feat.selection-type';
DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_feat.max-automatic-features-no';
DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_feat.manual-selection-features';

DELETE FROM config_metadata WHERE key = 'general.scratch-path.s4s_yield_su';
DELETE FROM config_metadata WHERE key = 'executor.processor.s4s_yield_su.keep_job_folders';
DELETE FROM config_metadata WHERE key = 'executor.processor.s4s_yield_su.slurm_qos';

DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_su.algorithm';
DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_su.selection-type';
DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_su.max-automatic-features-no';
DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_su.manual-selection-features';
DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_su.input_l2a';
DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_su.start_date';
DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_su.end_date';

DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_su.su_path';
DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_su.data_extr_dir';

DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_su.historical_data_upload_dir';
DELETE FROM config_metadata WHERE key = 'processor.s4s_yield_su.historical_data_path';

-- NEW KEYS --

INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4c_mdb1.input_l3b_ndvi', NULL, 'N/A', '2025-12-16 17:31:06.01191+02');
INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4c_mdb1.input_l3b_lai', NULL, 'N/A', '2025-12-16 17:31:06.01191+02');
INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4c_mdb1.input_l3b_fapar', NULL, 'N/A', '2025-12-16 17:31:06.01191+02');
INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4c_mdb1.input_l3b_facover', NULL, 'N/A', '2025-12-16 17:31:06.01191+02');

INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4s_yield.algorithm',  NULL, 'rf', '2021-01-18 14:43:00.720811+00');
INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4s_yield.selection-type',  NULL, 'automatic', '2021-01-18 14:43:00.720811+00');
INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4s_yield.max-automatic-features-no',  NULL, '44', '2021-01-18 14:43:00.720811+00');
INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4s_yield.manual-selection-features',  NULL, '', '2021-01-18 14:43:00.720811+00');

INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4s_yield.su_path',  NULL, '/mnt/archive/s4s_yield/{site}/yield_su/', '2021-02-19 14:43:00.720811+00');
INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4s_yield.historical_data_upload_dir',  NULL, '/mnt/archive/s4s_yield_upload/su_historical_data', '2023-09-19 14:43:00.720811+00');
INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4s_yield.historical_data_path',  NULL, '/mnt/archive/s4s_yield/{site}/yield_su/HistoricalData/SU_yield_historical_data.csv', '2023-09-19 14:43:00.720811+00');
INSERT INTO config(key, site_id, value, last_updated) VALUES ('executor.module.path.s4s_yield_su_historical_data_import',  NULL, 's4s-yield-su-historical-data-import.py', '2023-09-19 14:43:00.720811+00');

INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4s_yield.input_l2a', NULL, 'N/A', '2023-03-04 11:09:58.820032+02');
INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4s_yield.start_date',  NULL, '', '2023-10-04 15:27:41.861613+02');
INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4s_yield.end_date',  NULL, '', '2023-03-04 15:27:41.861613+02');

INSERT INTO config(key, site_id, value, last_updated) VALUES ('processor.s4s_yield_feat.enable_safy',  NULL, 'true', '2025-11-03 14:43:00.720811+00');

INSERT INTO config_metadata VALUES ('processor.s4c_mdb1.input_l3b_ndvi', 'The list of L3B NDVI products', 'select', FALSE, 26, TRUE, 'Available L3B NDVI input files', '{"name":"inputFiles_L3B_NDVI[]","product_type_id":36,"satellite_ids":[1,2]}');
INSERT INTO config_metadata VALUES ('processor.s4c_mdb1.input_l3b_lai', 'The list of L3B LAI products', 'select', FALSE, 26, TRUE, 'Available L3B LAI input files', '{"name":"inputFiles_L3B_LAI[]","product_type_id":37,"satellite_ids":[1,2]}');
INSERT INTO config_metadata VALUES ('processor.s4c_mdb1.input_l3b_fapar', 'The list of L3B FAPAR products', 'select', FALSE, 26, TRUE, 'Available L3B FAPAR input files', '{"name":"inputFiles_L3B_FAPAR[]","product_type_id":38,"satellite_ids":[1,2]}');
INSERT INTO config_metadata VALUES ('processor.s4c_mdb1.input_l3b_fcover', 'The list of L3B FCOVER products', 'select', FALSE, 26, TRUE, 'Available L3B FCOVER input files', '{"name":"inputFiles_L3B_FCOVER[]","product_type_id":39,"satellite_ids":[1,2]}');

INSERT INTO config_metadata VALUES ('processor.s4s_yield_feat.enable_safy', 'Enable SAFY', 'bool', TRUE, 29, TRUE, 'Enable SAFY', NULL, FALSE);

INSERT INTO config_metadata VALUES ('general.scratch-path.s4s_yield', 'Path for Yield SU temporary files', 'string', false, 1, FALSE, 'Path for Yield SU temporary files', NULL);
INSERT INTO config_metadata VALUES ('executor.processor.s4s_yield.keep_job_folders', 'Keep yield temporary files', 'int', false, 8);
INSERT INTO config_metadata VALUES ('executor.processor.s4s_yield.slurm_qos', 'Slurm QOS for Yield SU', 'string', true, 8, FALSE, 'Slurm QOS for Yield SU', NULL);

INSERT INTO config_metadata VALUES ('processor.s4s_yield.algorithm', 'Yield estimation algorithm', 'string', true, 38, true, 'Yield estimation algorithm', '{ "allowed_values": [{ "value": "rf", "display": "Random Forest" }, { "value": "lmr", "display": "Linear regression"}, { "value": "svm", "display": "Support Vector Machine"}] }', true);
INSERT INTO config_metadata VALUES ('processor.s4s_yield.selection-type',  'Yield estimation selection type', 'string', true, 38, true, 'Yield estimation selection type', '{ "allowed_values": [{ "value": "automatic", "display": "Automatic" }, { "value": "manual", "display": "Manual"}, { "value": "none", "display": "None" }] }', true);
INSERT INTO config_metadata VALUES ('processor.s4s_yield.max-automatic-features-no', 'Maximum number of automatic features', 'int', true, 38, true, 'Maximum number of automatic features', null);
INSERT INTO config_metadata VALUES ('processor.s4s_yield.manual-selection-features', 'Manual selection features', 'string', true, 38, true, 'Manual selection features', null);
INSERT INTO config_metadata VALUES ('processor.s4s_yield.input_l2a', 'The list of L2A products', 'select', FALSE, 38, FALSE, 'Available L2A input files', '{"name":"inputFiles_L2A[]","product_type_id":1,"satellite_ids":[1,2]}', FALSE);
INSERT INTO config_metadata VALUES ('processor.s4s_yield.start_date', 'Start date (YYYY-MM-DD)', 'string', FALSE, 38, TRUE, 'Start date', NULL, FALSE);
INSERT INTO config_metadata VALUES ('processor.s4s_yield.end_date', 'End date (YYYY-MM-DD)', 'string', FALSE, 38, TRUE, 'End date', NULL, FALSE);

INSERT INTO config_metadata VALUES ('processor.s4s_yield.su_path', 'Yield SU path', 'string', TRUE, 38, FALSE, 'Yield SU path', null);

INSERT INTO config_metadata VALUES ('processor.s4s_yield.historical_data_upload_dir', 'Yield SU historical data upload dir', 'string', TRUE, 38, FALSE, 'Yield SU historical data upload dir', null);
INSERT INTO config_metadata VALUES ('processor.s4s_yield.historical_data_path', 'Yield SU historical data import location', 'string', TRUE, 38, FALSE, 'Yield SU historical data import location', null);

-- UPDATE -- 
UPDATE config SET value = '/mnt/archive/s4s_yield/{site}/{season}/SAFY_Config/safy_params.json' WHERE key = 'processor.s4s_yield_feat.safy_params_path';
UPDATE config SET value = '/mnt/archive/insitu/{site}/{season}' WHERE key = 'processor.insitu.path';

