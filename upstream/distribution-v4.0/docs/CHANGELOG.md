# Known issues
 - The SAFE validation step flags as invalid products with even a single tile having a low-variance band as invalid (`NOTV`)
 - When deleting a site, the folders for the L2A products that were not processed by MACCS are not deleted and should be deleted manually. Normally these folders contain no valid product and contain only log and EEF files.
  
# Change Log

## [4.0]


### Added
- Catboost as classifier in the Crop Type Processor
- Information in the System Monitoring containing insitu data upload messages and errors
- The following product types were added, specific for each spectral and biophysical indicator, and containing only one tile:
  *	L3 NDVI Vegetation Status      
  *	L3 LAI Vegetation Status       
  *	L3 FAPAR Vegetation Status     
  *	L3 FCOVER Vegetation Status    
  *	L3 NDWI Vegetation Status      
  *	L3 Brightness Vegetation Status
- Insitu data quality check during data preparation
- Crop Type product validation report
- New classification features added to Crop Type Processor (LAI, FAPAR and FCover)
 

### Changed
- Yield Features and Yield Estimation were created as distinct processors
- New product types for Yield Features, Yield SU Features, Yield Estimation and Yield SU Estimation
- include the training and validation polygons in the crop map product
- improve handling of multiple seasons in the crop map processor
- various performance optimizations to the crop map processor
 
### Fixed
- fix crop classification with only Sentinel-1 data
- improve parametrization of the crop map processor