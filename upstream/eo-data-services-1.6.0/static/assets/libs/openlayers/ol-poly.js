/**
 * jQuery Polygon2D
 * Draw 2D shapes on map
 *
 * @author Nicu Stancioi
 *
 * Copyright (c) 2019 CS Romania
  */

(function ($, window) {
	'use strict';
	
	var Polygon2D = function (element, options) {
		// Return the complete object only when map has finished rendering all elements
		var deferred = $.Deferred();
		
		var _self = this;
		_self.options = $.extend({}, $.fn.poly2D.defaults, options);
		_self.el = $(element);
		
		// Load necessary scripts if not already loaded
		var $olPolyScript = $("script[src*='poly']");
		if ($olPolyScript.length > 0) {
			var scriptPath = $olPolyScript.attr("src").lastIndexOf("/") >= 0 ? $olPolyScript.attr("src").substring(0, $olPolyScript.attr("src").lastIndexOf("/")) + "/" : "";
			// Add open layers reference
			if (typeof ol === "undefined" || typeof ol.interaction.Transform === "undefined") {
				// Get stylesheets
				$('head').append('<link rel="stylesheet" type="text/css" href="' + scriptPath + 'ol.css" />');
				$('head').append('<link rel="stylesheet" type="text/css" href="' + scriptPath + 'ol-poly.css" />');
				$('head').append('<link rel="stylesheet" type="text/css" href="' + scriptPath + 'ol-ext.css" />');
				// Get scripts
				$('head').append('<script type="text/javascript" src="' + scriptPath + 'ol.js"></script>');
				$('head').append('<script type="text/javascript" src="' + scriptPath + 'ol-ext.js"></script>');
				// Fix for IE: 'Promise' not defined
				if (window.navigator.userAgent.indexOf("MSIE ") != -1 || !!window.navigator.userAgent.match(/Trident.*rv\:11\./)) {
					$('head').append('<script type="text/javascript" src="' + scriptPath + 'polyfill.min.js"></script>');
				}
			}
			
			// Define map content
			$.ajax({
				url: scriptPath + 'ol-poly.html',
				cache: false,
				async: false,
				type: "GET",
				success: function(response) {
					_self.el.html(response);
				},
				error: function () {
					_self.el.html('<div id="myFlatMap" tabindex="-1"><div id="map" class="map" tabindex="0"></div></div></div>');
				}
			});
		} else {
			_self.el.html('<div id="myFlatMap" tabindex="-1"><div id="map" class="map" tabindex="0"></div></div></div>');
		}
		
		// Controls
		_self.container                  = _self.el.find("#myFlatMap");
		_self.actionsPanel               = _self.container.find("div.poly-actions-panel");
		_self.userText                   = _self.container.find("textarea[name='userText']");
		_self.btnSelectShape             = _self.container.find("select[name='select-shape']");
		_self.btnAddNewShape             = _self.container.find("button[name='addNewShape']");
		_self.btnRemoveSelectedShapes    = _self.container.find("button[name='removeSelectedShapes']");
		_self.btnRemoveAllShapes         = _self.container.find("button[name='removeAllShapes']");
		_self.btnStraightenSelectedShape = _self.container.find("button[name='straightenSelectedShape']");
		_self.btnParseUserText           = _self.container.find("button[name='parseUserText']");
		_self.btnAdjustFeature           = _self.container.find("input[name='adjustFeature']");
		
		// Status variables
		_self.readOnly = false;
		_self.mapActive = false;
		
		// Map interactions
		_self.draw = null;
		_self.transform = null;
		_self.modify = null;
		_self.snap = null;
		
		_self.selectedFeatures = new ol.Collection();
		
		// Map styles based on interaction type
		_self.styleDefault   = new ol.style.Style ({ stroke: new ol.style.Stroke(_self.options.strokeDefault  ), fill: new ol.style.Fill(_self.options.fillDefault  ) });
		_self.styleDefaultRO = new ol.style.Style ({ stroke: new ol.style.Stroke(_self.options.strokeDefaultRO), fill: new ol.style.Fill(_self.options.fillDefaultRO) });
		_self.styleDefaultEN = new ol.style.Style ({ stroke: new ol.style.Stroke(_self.options.strokeDefaultEN), fill: new ol.style.Fill(_self.options.fillDefaultEN) });
		_self.styleDraw      = new ol.style.Style ({ stroke: new ol.style.Stroke(_self.options.strokeDraw     ), fill: new ol.style.Fill(_self.options.fillDraw     ) });
		_self.styleTransform = new ol.style.Style ({ stroke: new ol.style.Stroke(_self.options.strokeTransform), fill: new ol.style.Fill(_self.options.fillTransform) });
		_self.styleModify    = new ol.style.Style ({ stroke: new ol.style.Stroke(_self.options.strokeModify   ), fill: new ol.style.Fill(_self.options.fillModify   ) });
		
		_self.renderFinished = false;
		
		// Interactive Features Layer
		_self.source = new ol.source.Vector({ wrapX: false });
		_self.featureLayer = new ol.layer.Vector({ name: "Features", source: _self.source, style: _self.defaultStyle });	//vector
		_self.featureLayer.setZIndex(99);
		
		// Map
		_self.rasterSource = new ol.source.OSM();
		_self.mapLayer     = new ol.layer.Tile  ({ name: "Map"     , source: _self.rasterSource }), 						//raster
		_self.map = new ol.Map({
			interactions: ol.interaction.defaults({ mouseWheelZoom: true, doubleClickZoom: false, shiftDragZoom: false }),
			layers: [ _self.mapLayer, _self.featureLayer ],
			target: 'map',
			view  : new ol.View({
				center : ol.proj.transform([_self.options.startLon, _self.options.startLat], 'EPSG:4326', 'EPSG:3857'),
				extent : ol.proj.transformExtent([_self.options.lonMin, _self.options.latMin, _self.options.lonMax, _self.options.latMax], 'EPSG:4326', 'EPSG:3857'),
				minZoom: _self.options.minZoom,
				maxZoom: _self.options.maxZoom,
				zoom   : _self.options.zoom,
			})
		});
		_self.renderer = $(_self.map.getRenderer().element_);
		
		_self.rasterSource.on('tileloadstart', function () {
			if (!_self.renderFinished) {
				_self.postRenderActions();
				_self.renderFinished = true;	
			}
		});
		_self.map.once('postrender', function() {
			_self.updateMapSize();
			
			// Define map interactions
			_self.initializeInteractions();
			
			// Initialize the map with the default feature set by the user in the options section
			if (_self.options.defaultFootprint !== "") {
				_self.userText.val(_self.options.defaultFootprint);
				_self.createShapeFromUserText();
			}
			
			_self.mapActive = true;
			
			// Return the complete object only when map has finished rendering all elements
			deferred.resolve(_self);
		});
		_self.map.once('postcompose', function() {
			_self.fitAllFeatures();
		});
		
		return deferred.promise();
	};
	
	Polygon2D.prototype = {
		updateMapSize: function () {
			var _self = this;
			setTimeout(function() {
				$(_self.map.getTargetElement()).css({ "height": _self.el.height() + "px" });
				_self.map.updateSize();
				_self.adjustDrawersPosition();
			}, 300);
		},
		toggleReadOnly: function () {
			var _self = this;
			_self.setReadOnly(!_self.readOnly);
		},
		setReadOnly: function (readonly) {
			var _self = this;
			if (_self.transform) {
				if (readonly && !_self.readOnly) {
					_self.readOnly = readonly;
					_self.container.find(".poly-panel").addClass("hidden");
					
					_self.resetInteractions();
					_self.transform.select();
					_self.refreshSelection();
				} if (!readonly && _self.readOnly) {
					_self.readOnly = readonly;
					_self.container.find(".poly-panel").removeClass("hidden");
					
					_self.restartActiveInteraction();
				}
			}
		},
		createDrawer: function (title, left) {
			var _self = this;
			var $container = $('<div class="' + title.toLowerCase() + 'container drawer-panel ' + (left ? 'left-side' : 'right-side') + ' pinned">' +
										'<div class="drawer-pin"><button class="btn-poly"><i class="fa fa-thumb-tack"></i></button></div>' +
										'<div class="drawer-title">' + title.toLowerCase() + '</div><div class="drawer-content"></div>' +
									'</div>');
			_self.container.find(left ? ".drawers.left-side" : ".drawers.right-side").append($container);
		},
		adjustDrawersPosition: function () {
			var _self = this;
			$(".drawers", _self.container).css({ "width": (100 - _self.options.panPrc) + "%" });
		},
		togglePinDrawer: function ($drawer) {
			$drawer.toggleClass("pinned");
			if (!$drawer.hasClass("hovering")) {
				if ($drawer.hasClass("pinned")) {
					$drawer.removeClass("closed");
				} else {
					$drawer.addClass("closed");
				}
			}
		},
		focusOnMap: function () {
			var _self = this;
			$(_self.map.getViewport()).closest(".map").focus();
		},
		refreshLayerOpacity: function () {
			var _self = this;
			$(".slidercontainer", _self.container).remove();
			_self.map.getLayers().forEach(function (layer) {
				var name = layer.get("name");
				var opacity = layer.getOpacity()*100;
				var $slider = $('<div class="slidercontainer">' +
									'<input type="range" min="1" max="100" value="' + opacity + '" class="slider" data-name="' + name + '" />' +
									'<p><span>' + name + ': ' + opacity + '</span></p>' +
								'</div>');
				var $fit = {};
				if (name == 'Map') {
					// Set read-only button
					$fit = $('<button class="btn-poly" title="Toggle read only"><i class="fa fa-eye-slash fa-fw"></i></button>').on("click", function (event) {event.preventDefault(); _self.toggleReadOnly(); });
					$slider.append($fit);
				} else {
					// Set fit button
					$fit = $('<button class="btn-poly" title="Fit"><i class="fa fa-expand fa-fw"></i></button>').on("click", function (event) {event.preventDefault(); _self.fitAll(name); });
					$slider.append($fit);
				}
				$slider.on("input change", 'input.slider', function () {
					$(this).closest(".slidercontainer").find("span").html($(this).data("name") + ": " + parseInt(this.value));
					_self.setLayerOpacity(name, this.value/100);
				});
				$(".sliderscontainer .drawer-content", _self.container).append($slider);
			});
		},
		getLayerOpacity: function (layerName) {
			var _self = this;
			var opacity = 1;
			_self.map.getLayers().forEach(function (layer) {
				if (layer.get("name") == layerName) {
					opacity = layer.getOpacity();
				}
			});
			return opacity;
		},
		setLayerOpacity: function (layerName, opacity) {
			var _self = this;
			_self.map.getLayers().forEach(function (layer) {
				if (layer.get("name") == layerName) {
					layer.setOpacity(opacity);
					_self.el.trigger("layerOpacityChange", [layer]);
				}
			});
		},
		setFeaturesStyleById: function (id, style) {
			var _self = this;
			var feature = _self.source.getFeatureById(id);
			if (feature) {
				// Set feature style
				feature.setStyle(style);
				// Bring feature on top
				var tmp = feature.clone();
				_self.source.removeFeature(feature);
				tmp.setId(id);
				_self.source.addFeature(tmp);
			}
		},
		setFeaturesStyleByProperty: function (property, style) {
			var _self = this;
			var key   = Object.keys(property)[0];
			if (typeof key !== "undefined" && typeof property[key] !== "undefined") {
				var value = property[key];
				$.each(_self.source.getFeatures(), function (index, feature) {
					if (feature.getProperties()[key] == value) {
						feature.setStyle(style);
					}
				});
			}
		},
		setFeaturesDataByProperty: function (property, data) {
			var _self = this;
			var key   = Object.keys(property)[0];
			if (typeof key !== "undefined" && typeof property[key] !== "undefined") {
				var value = property[key];
				$.each(_self.source.getFeatures(), function (index, feature) {
					if (feature.getProperties()[key] == value) {
						feature.setProperties(data);
					}
				});
			}
		},
		removeFeaturesByProperty: function (property) {
			var _self = this;
			var key   = Object.keys(property)[0];
			if (typeof key !== "undefined" && typeof property[key] !== "undefined") {
				var value = property[key];
				$.each(_self.source.getFeatures(), function (index, feature) {
					if (feature.getProperties()[key] == value) {
						_self.source.removeFeature(feature);
					}
				});
			}
		},
		getFeatureById: function (id) {
			var _self = this;
			return _self.source.getFeatureById(id);
		},
		getFootprint: function () {
			var _self = this;
			return _self.userText.val();
		},
		resetStyleByInteraction: function () {
			var _self = this;
			
			// Set style for unselected features
			if (_self.draw.getActive()) {
				_self.setFeaturesStyleByProperty({ "description": "footprint" }, _self.styleDraw);
			} else if (_self.readOnly) {
				_self.setFeaturesStyleByProperty({ "description": "footprint" }, _self.styleDefaultRO);
			} else {
				_self.setFeaturesStyleByProperty({ "description": "footprint" }, _self.styleDefault);
			}
			
			// Set style for selected features
			$.each(_self.selectedFeatures.getArray(), function (index, feature) {
				if (feature.getProperties().description === "footprint") {
					if (_self.draw.getActive()) {
						feature.setStyle(_self.styleDraw);
					} else if (_self.modify.getActive()) {
						feature.setStyle(_self.styleModify);
					} else {
						feature.setStyle(_self.styleTransform);
					}
				}
			});
		},
		createShapeFromGeometry: function (geometryText, properties, clean) {
			if (!geometryText || geometryText.length === 0) return [];		// Nothing should happed if input geometry parameter is empty
			
			var _self = this;
			var parseFeatures = [];
			try {
				var polysArray = [];
				
				var readGeometry = (new ol.format.WKT()).readGeometry(geometryText, 'EPSG:4326');
				var geometries   = (typeof readGeometry.getCoordinates === "function") ? [ readGeometry ] : readGeometry.getGeometries();
				$.each(geometries, function (index, geom) {
					if (typeof geom.getEnds === "function") {
						// GEOMETRYCOLLECTION
						polysArray.push(geom.getCoordinates());
					} else if (typeof geom.getEndss === "function") {
						// MULTIPOLYGON
						$.each(geom.getCoordinates(), function (idx, gm) {
							polysArray.push(gm);
						});
					}
				});
				if (polysArray.length > 0) {
					$.each(polysArray, function (idx, array) {
						$.each(array, function (idx, item) {
							// Check if polygon has at least 3 edges
							if (item.length > 3) {
								// Check if polygon is closed
								if (item[0][0] == item[item.length-1][0] && item[0][1] == item[item.length-1][1]) {
									var polygon = new ol.geom.Polygon([item]);
									polygon.transform('EPSG:4326', 'EPSG:3857');
									
									var feature = new ol.Feature(polygon);
									if (properties) {
										feature.setProperties(properties);
										if (properties.id) { feature.setId(properties.id); }
									}
									parseFeatures.push(feature);
								} else {
									throw "error: First and last point should be the same";
								}
							} else {
								throw "error: Polygons should have at least 3 edges";
							}
						});
					});
				}
			} catch (e) {
				// Show error:
				alert(e);
				_self.transform.select();
				_self.refreshSelection();
				_self.restartActiveInteraction();
				return false;
			}
			if (clean) { _self.removeAllFeatures(); }
			if (parseFeatures.length > 0) {
				$.each(parseFeatures, function(index, item) {
					/*if ((_self.getAllFeatures().getArray().length < _self.options.maxFeaturesNo) ||
						(properties && properties.description === _self.options.extraFeatureDescription)
						) {*/
					if (properties && properties.extraFeatureDescription === _self.options.extraFeatureDescription) {
						_self.source.addFeature(item);
					}
				});
			} else {
				_self.transform.select();
				_self.refreshSelection();
				_self.restartActiveInteraction();
			}
			return parseFeatures;
		},
		createShapeFromUserText: function () {
			var _self = this;
			var geometry = 	_self.userText.val();
			var features = _self.createShapeFromGeometry(geometry, null, true);
			if (!features) {
				_self.userText.val(geometry);
				_self.userText.addClass("error");
			} else if (features.length > 0) {
				_self.userText.removeClass("error");
				_self.restartActiveInteraction();
				return true;
			} else {
				_self.getFeaturesGeometry();
			}
			return false;
		},
		trimGeometryCoordinates: function (geometry, fixed) {
			var coords = geometry.getCoordinates();
			var trim = [];
			$.each(coords[0], function (index, coord) {
				coord[0] = parseFloat(coord[0].toFixed(fixed));
				coord[1] = parseFloat(coord[1].toFixed(fixed));
				trim.push([ coord[0], coord[1] ]);
			});
			var polygon = new ol.geom.Polygon([trim]);
			return polygon;
		},
		getFeaturesGeometry: function () {
			var _self = this;
			var polys = [];
			$.each(_self.getAllFeatures().getArray(), function (index, item) {
				var clone = item.clone();
				var geometry = _self.trimGeometryCoordinates(clone.getGeometry().transform('EPSG:3857', 'EPSG:4326'), 6);
				clone.setGeometry(geometry);
				polys.push(clone);
			});
			var geometry = (new ol.format.WKT()).writeFeatures(polys);
			
			_self.userText.removeClass("error");
			_self.userText.val(geometry);
			
			_self.el.trigger("newfootprint", [_self.userText.val()]);
			return geometry;
		},
		clearSelection: function () {
			var _self = this;
			_self.selectedFeatures = new ol.Collection();
		},
		backupSelection: function () {
			var _self = this;
			_self.selectedFeatures = $.extend(true, {}, _self.transform.getFeatures());
		},
		restoreSelection: function () {
			var _self = this;
			_self.transform.select();
			$.each(_self.selectedFeatures.getArray(), function (index, feature) {
				_self.transform.select(feature, true);
			});
		},
		refreshSelection: function () {
			var _self = this;
			_self.backupSelection();
			_self.resetStyleByInteraction();
		},
		resetInteractions: function () {
			var _self = this;
			_self.draw.setActive(false);
			_self.transform.setActive(false);
			_self.modify.setActive(false);
			_self.snap.setActive(false);
			
			_self.map.removeInteraction(_self.draw);
			_self.map.removeInteraction(_self.modify);
			_self.map.removeInteraction(_self.snap);
		},
		refreshMapTitle: function () {
			var _self = this;
			var $mapTitle = $(".poly-map-title", _self.container);
			if (_self.btnAdjustFeature.is(':checked')) {
				$mapTitle.html("Modify polygon at vertex level");
				$mapTitle.addClass("modify");
			} else {
				$mapTitle.html("Reshape selected polygon");
				$mapTitle.removeClass("modify");
			}
		},
		restartActiveInteraction: function () {
			var _self = this;
			if (_self.btnAdjustFeature.is(':checked')) {
				_self.startModifying();
			} else {
				_self.startTransforming();
			}
		},
		startDrawing: function () {
			var _self = this;
			_self.resetInteractions();
			
			// Set draw shape
			if (_self.btnSelectShape.val() === "Box") {
				_self.draw = new ol.interaction.Draw({ source: _self.source, type: "Circle", geometryFunction: ol.interaction.Draw.createBox(), stopClick: true });
			} else {
				_self.draw = new ol.interaction.Draw({ source: _self.source, type: "Polygon", stopClick: true });
			}
			_self.map.addInteraction(_self.draw);
			
			_self.draw.on('drawend', function (e) {
				_self.clearSelection();
				_self.selectedFeatures.push(e.feature);
				_self.restartActiveInteraction();
			});
			
			_self.draw.setActive(true);
			_self.resetStyleByInteraction();
		},
		startTransforming: function () {
			var _self = this;
			_self.resetInteractions();
			
			_self.transform.setActive(true);
			_self.restoreSelection();
			
			_self.resetStyleByInteraction();
			_self.btnAdjustFeature.prop("checked", false);
			_self.refreshMapTitle();
		},
		startModifying: function () {
			var _self = this;
			_self.resetInteractions();
			
			// Add MODIFY interaction on vertex level for all selected features
			_self.modify = new ol.interaction.Modify({
				features: _self.selectedFeatures,
				deleteCondition: function (e) { return ol.events.condition.click(e); }
			});
			_self.map.addInteraction(_self.modify);
			_self.modify.setActive(true);
			_self.modify.set("lastAction", "none");
			_self.modify.on("modifystart", function (e) {
				// set focus to map
				_self.container.focus();
				$.each(e.features.getArray(), function (index, feature) {
					feature.coordinatesBefore = feature.getGeometry().getCoordinates();
				});
			});
			_self.modify.on("modifyend", function (e) {
				$.each(e.features.getArray(), function (index, feature) {
					delete feature.coordinatesBefore;
				});
				_self.modify.set("lastAction", e.mapBrowserEvent.type != "pointerup" ? "point removed" : "shape changed");
				_self.getFeaturesGeometry();
			});
			
			// Add SNAP interaction
			_self.snap = new ol.interaction.Snap({ features: _self.getAllFeatures() });
			_self.map.addInteraction(_self.snap);
			_self.snap.setActive(true);
			
			_self.resetStyleByInteraction();
			_self.btnAdjustFeature.prop("checked", true);
			_self.refreshMapTitle();
		},
		removeSelectedFeatures: function () {
			var _self = this;
			// Remove one by one all selected features
			_self.transform.select();
			$.each(_self.selectedFeatures.getArray(), function (index, feature) {
				_self.source.removeFeature(feature);
			});
			_self.clearSelection();
			
			// Start drawing if all features have been removed
			if (_self.getAllFeatures().getArray().length === 0) {
				_self.startDrawing();
			} else {
				_self.restartActiveInteraction();
			}
		},
		removeAllFeatures: function (description) {
			var _self = this;
			$.each(_self.getAllFeatures(description).getArray(), function (index, feature) {
				_self.source.removeFeature(feature);
			});
			_self.clearSelection();
		},
		getAllFeatures: function (description) {
			var _self = this;
			var collection = [];
			var desc = (typeof description === "undefined" ? "footprint" : description);
			$.each(_self.source.getFeatures(), function (index, feature) {
				if (feature.getProperties().description === desc) {
					collection.push(feature);
				}
			});
			return (new ol.Collection(collection));
		},
		getStraightenFeature: function (feature) {
			var geometry = $.extend(true, {}, feature.getGeometry());
			var center   = ol.extent.getCenter(geometry.getExtent());
			var deg      = (-1)*Math.PI/4;
			
			geometry.rotate(deg, center);
			
			var gran = Math.PI/180/16;
			var minArea = void 0;
			var degree  = deg;
			while (deg < Math.PI/4) {
				geometry.rotate(gran, center);
				
				var extArea = (new ol.Feature(ol.geom.Polygon.fromExtent(geometry.getExtent()))).getGeometry().getArea();
				if (typeof minArea === "undefined") {
					minArea = extArea;
				} else if (extArea < minArea) {
					minArea = extArea;
					degree = deg;
				}
				deg += gran;
			}
			var tmp = feature.clone();
			tmp.getGeometry().rotate(degree, center);
			
			tmp.set("angle", degree);
			return tmp;
		},
		straightenSelectedFeature: function () {
			var _self = this;
			$.each(_self.selectedFeatures.getArray(), function (index, feature) {
				
				var tmp      = feature.clone();
				var geometry = tmp.getGeometry();
				var center   = ol.extent.getCenter(geometry.getExtent());
				var deg      = (-1)*Math.PI/4;
				
				geometry.rotate(deg, center);
				
				var gran = Math.PI/180/16;
				var minArea = void 0;
				var degree  = deg;
				while (deg < Math.PI/4) {
					geometry.rotate(gran, center);
					
					var extArea = (new ol.Feature(ol.geom.Polygon.fromExtent(geometry.getExtent()))).getGeometry().getArea();
					if (typeof minArea === "undefined") {
						minArea = extArea;
					} else if (extArea < minArea) {
						minArea = extArea;
						degree = deg;
					}
					deg += gran;
				}
				geometry = feature.getGeometry();
				geometry.rotate(degree, center);
				feature.setGeometry(geometry);
			});
			_self.getFeaturesGeometry();
		},
		fitFeatureById: function (id) {
			var _self = this;
			var feature = _self.source.getFeatureById(id);
			if (feature) {
				_self.map.getView().fit(feature.getGeometry(), _self.map.getSize());
				var crtZoom = _self.map.getView().getZoom();
				if (crtZoom - 1 >= _self.options.minZoom) _self.map.getView().setZoom(crtZoom - 1);
				_self.panToFit();
				
				// Bring feature on top
				var tmp = feature.clone();
				_self.source.removeFeature(feature);
				tmp.setId(id);
				_self.source.addFeature(tmp);
			}
		},
		setPanPercentage: function (newPanPrc) {
			var _self = this;
			//var shift = newPanPrc - _self.options.panPrc;
			//_self.panToFit(shift);
			_self.options.panPrc = newPanPrc;
			_self.adjustDrawersPosition();
		},
		panToFit: function (delta) {
			var _self = this;
			var extent = _self.map.getView().calculateExtent(_self.map.getSize());
			var x1 = extent[0];
			var x2 = extent[2];
			var y1 = extent[1];
			var y2 = extent[3];
			var dlt = (delta ? delta : _self.options.panPrc)/100;
			var xc = (x1+x2)/2-(x2-x1)*dlt/2;
			var yc = (y1+y2)/2;
			var cnt = [xc, yc];
			
			_self.map.getView().animate({
			  center: cnt,
			  duration: 0
			});
		},
		fitAll: function (layerName) {
			var _self = this;
			if (layerName === "Features") {
				_self.fitAllFeatures();
			} else {
				_self.map.getLayers().forEach(function (layer) {
					if (layer.get("name") == layerName) {
						var extent = false;
						if (typeof layer.get("extent") !== "undefined") {
							extent = layer.get("extent");
						} else if (typeof layer.getSource().getExtent !== "undefined") {
							extent = layer.getSource().getExtent();
						} else if (typeof layer.extent !== "undefined") {
							extent = layer.extent;
						} else if (typeof layer.getSource().getImage === "function") {
							extent = layer.getSource().getImageExtent();
							extent = ol.proj.transformExtent(extent, layer.getSource().getProjection().getCode(), 'EPSG:3857');
						}
						if (extent) {
							_self.map.getView().fit(extent, _self.map.getSize());
							var crtZoom = _self.map.getView().getZoom();
							if (crtZoom >= _self.options.minZoom) _self.map.getView().setZoom(crtZoom);
							_self.panToFit();
						}
						return false;
					}
				});
			}
		},
		fitAllFeatures: function () {
			var _self = this;
			var xsi = [];
			var yci = [];
			// Get minimum and maximum coordinates
			$.each(_self.source.getFeatures(), function (index, feature) {
				var coordinates = feature.getGeometry().getCoordinates()[0];
				coordinates.map(function (v) { xsi.push(v[1]); yci.push(v[0]); return false; });
			});
			if (xsi.length > 0 && yci.length > 0) {
				var xmin = Math.min.apply(null, xsi);
				var xmax = Math.max.apply(null, xsi);
				var ymin = Math.min.apply(null, yci);
				var ymax = Math.max.apply(null, yci);
				
				if (xmin != xmax || ymin != ymax) {
					var item = [[ymin, xmin], [ymax, xmin], [ymax, xmax], [ymin, xmax], [ymin, xmin]];
					var polygon = new ol.geom.Polygon([item]);
					var feature = new ol.Feature(polygon);
					var sz = _self.map.getSize();
					_self.map.getView().fit(feature.getGeometry(), { size: sz });
					var crtZoom = _self.map.getView().getZoom();
					if (crtZoom - 1 >= _self.options.minZoom) _self.map.getView().setZoom(crtZoom - 1);
					_self.panToFit();
				}
			}
		},
		getTopFeatureAtCoordByProperty: function (coordinate, property) {
			var _self = this;
			var featuresAtCoordinate = [];
			
			var key   = Object.keys(property)[0];
			if (typeof key !== "undefined" && typeof property[key] !== "undefined") {
				var value = property[key];
				$.each(_self.source.getFeaturesAtCoordinate(coordinate), function(index, feature) {
					if (feature.getProperties()[key] == value) {
						featuresAtCoordinate.push(feature);
					}
				});
			}
			var topFeatureAtCoordinate = featuresAtCoordinate[0];
			if (featuresAtCoordinate.length > 1) {
				var topDownFeatures = featuresAtCoordinate.sort(function(a, b) { return b.ol_uid - a.ol_uid; } );
				topFeatureAtCoordinate = topDownFeatures[0];
			}
			return topFeatureAtCoordinate;
		},
		toggleFeatureInCollection: function (feature, features, shiftOn) {
			var collection = [];
			if (typeof feature !== "undefined") {
				var inCollection = false;
				$.each(features, function(index, item) { if (feature.ol_uid == item.ol_uid) { inCollection = true; return false; } });
				if (shiftOn) {
					$.each(features, function (index, item) {
						if (!inCollection || inCollection && feature.ol_uid != item.ol_uid) {
							collection.push(item);
						}
					});
					if (!inCollection) {
						collection.push(feature);
					}
				} else {
					collection.push(feature);
				}
			}
			return collection;
		},
		revertModifiedFeatures: function () {
			var _self = this;
			var canceled = false;
			$.each(_self.selectedFeatures.getArray(), function (index, feature) {
				if (feature.coordinatesBefore) {
					canceled = true;
					feature.getGeometry().setCoordinates(feature.coordinatesBefore);
					delete feature.coordinatesBefore;
				}
			});
			return canceled;
		},
		// Initialize map interactions (transform, modify, snap, draw)
		initializeInteractions: function () {
			var _self = this;
			/* =========== TRANSFORM =========== */
			_self.transform = new ol.interaction.Transform ({
				addCondition    : ol.events.condition.shiftKeyOnly,
				hitTolerance    : 2,
				filter          : function (f) { return f.getGeometry().getType() === "Polygon" && f.getProperties().description === "footprint"; },
				keepAspectRatio : function (e)   { return !ol.events.condition.noModifierKeys(e); },
				modifyCenter    : ol.events.condition.always,
				translate       : true,
				translateFeature: true,
				scale           : true,
				rotate          : true,
				stretch         : true
			});
			_self.map.addInteraction(_self.transform);
			_self.clearSelection();
			
			// Set cursor style for rotate feature
			_self.transform.Cursors.rotate  = 'url(\'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAXAgMAAACdRDwzAAAAAXNSR0IArs4c6QAAAAlQTFRF////////AAAAjvTD7AAAAAF0Uk5TAEDm2GYAAAABYktHRACIBR1IAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH2wwSEgUFmXJDjQAAAEZJREFUCNdjYMAOuCCk6goQpbp0GpRSAFKcqdNmQKgIILUoNAxIMUWFhoKosNDQBKDgVAilCqcaQBogFFNoGNjsqSgUTgAAM3ES8k912EAAAAAASUVORK5CYII=\') 5 5, auto';
			_self.transform.Cursors.rotate0 = 'url(\'data:image/png;base64,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\') 5 5, auto';
			
			// Define selection extent (ghost) style
			var dDash  = new ol.style.Stroke({ color: [255, 0, 0, 0.5], width: 0.5, lineDash: [6, 2] });
			var dFill  = new ol.style.Fill  ({ color: [255, 0, 0, 0] });
			var dStyle = new ol.style.Style ({ stroke: dDash, fill: dFill });
			_self.transform.setStyle("default", dStyle);
			
			_self.container.on('keyup keydown', function (e) {
				// TRANSFORM keyboard interactions
				// Toggle SHIFT flag
				_self.transform.set("shiftOnly", e.type == 'keydown' && ol.events.condition.shiftKeyOnly(e));
				
				// SNAP keyboard interactions
				if (_self.snap.getActive()) {
					_self.snap.edge_   = !((e.type == "keydown") && ol.events.condition.platformModifierKeyOnly(e));
					_self.snap.vertex_ = _self.snap.edge_;
				}
				
				// DRAW keyboard interactions
				// Cancel drawing on ESC
				if (e.type === "keyup" && e.key.toLowerCase() === "escape") {
					if (_self.draw.getActive()) {
						_self.restartActiveInteraction();
					} else if (_self.transform.getActive()) {
						_self.transform.select();
						_self.refreshSelection();
					} else if (_self.modify.getActive()) {
						if (!_self.revertModifiedFeatures()) {
							_self.transform.select();
							_self.refreshSelection();
						}
						_self.startModifying();
					}
				}  
			});
			
			_self.source.on(["addfeature", "removefeature", "clear"], function (e) {
				if (e.type == "addfeature" && typeof e.feature.getProperties().description === "undefined") {
					e.feature.setProperties({ "description": "footprint" });
					if (_self.transform.getActive()) {
						_self.transform.setSelection([e.feature]);
					} else if (_self.modify.getActive()) {
						_self.transform.setSelection([e.feature]);
						_self.refreshSelection();
						_self.startModifying();
					} else if (_self.readOnly) {
						_self.refreshSelection();
					}
				}
				_self.getFeaturesGeometry();
				
				if (_self.getAllFeatures().getArray().length >= _self.options.maxFeaturesNo) {
					_self.btnAddNewShape.attr("disabled", true);
					_self.btnSelectShape.attr("disabled", true).addClass("disabled");
				} else {
					_self.btnAddNewShape.attr("disabled", false);
					_self.btnSelectShape.attr("disabled", false).removeClass("disabled");
				}
			});
			_self.map.on(['singleclick', 'dblclick'], function (e) {
				var topFeatureAtCoordinate = {};
				if (_self.modify.getActive() || _self.transform.getActive()) {
					if (e.type == 'singleclick') {
						// Change selected features while in MODIFY mode for different CLICK/SHIFT combinations
						if (_self.modify.getActive() && _self.modify.get("lastAction") != "point removed") {
							topFeatureAtCoordinate = _self.getTopFeatureAtCoordByProperty(e.coordinate, { "description": "footprint" });
							var selFeatures = _self.toggleFeatureInCollection(topFeatureAtCoordinate, _self.selectedFeatures.getArray(), ol.events.condition.shiftKeyOnly(e));
							_self.transform.select();
							$.each(selFeatures, function (index, feature) { _self.transform.select(feature, true); });
							_self.refreshSelection();
							_self.startModifying();
						}
					} else if (e.type == 'dblclick') {
						// Switch interaction mode between TRANSFORM and MODIFY when DBLCLICK a feature (no modifiers keys allowed)
						if (ol.events.condition.noModifierKeys(e)) {
							topFeatureAtCoordinate = _self.getTopFeatureAtCoordByProperty(e.coordinate, { "description": "footprint" });
							if (topFeatureAtCoordinate) {
								if (_self.modify.getActive()) {
									_self.transform.setSelection([topFeatureAtCoordinate]);
									_self.refreshSelection();
									_self.startTransforming();
								} else {
									_self.refreshSelection();
									_self.startModifying();
								}
							}
						}
					}
					// Reset last Modify action AFTER any mouse interaction processing
					_self.modify.set("lastAction", "none");
				} else {
					// Retrieve extra feature at pointer position
					if (e.type == 'singleclick' || e.type == 'dblclick') {
						topFeatureAtCoordinate = _self.getTopFeatureAtCoordByProperty(e.coordinate, { "description": _self.options.extraFeatureDescription });
						var modifier = { "ctrlKey": e.originalEvent.ctrlKey, "altKey": e.originalEvent.altKey, "shiftKey": e.originalEvent.shiftKey };
						if (typeof topFeatureAtCoordinate !== "undefined") {
							_self.el.trigger(e.type == 'singleclick' ? "clickextrafeature" : "dblclickextrafeature", [topFeatureAtCoordinate, modifier]);
						}
					}
				}
				if (e.type == 'singleclick') {
					_self.el.trigger("clickMap", [e.coordinate]);
				}
			});
			_self.transform.on('select', function () {
				if (_self.transform.getActive()) {
					_self.refreshSelection();
				}
			});
			_self.transform.on('translatestart', function (e) {
				_self.transform.set("startCoordinate", e.target.coordinate_);
			});
			_self.transform.on('translateend', function (e) {
				// Change selected features while in TRANSFORM mode for different CLICK/SHIFT combinations
				if (_self.transform.get("startCoordinate") == e.target.coordinate_) {
					var topFeatureAtCoordinate = _self.getTopFeatureAtCoordByProperty(e.target.coordinate_, { "description": "footprint" });
					var selFeatures = _self.toggleFeatureInCollection(topFeatureAtCoordinate, _self.transform.getFeatures().getArray(), _self.transform.get("shiftOnly"));
					_self.transform.select();
					$.each(selFeatures, function (index, feature) { _self.transform.select(feature, true); });
				}
				_self.refreshSelection();
				
				_self.getFeaturesGeometry();
			});
			_self.transform.on('rotateend', function () {
				_self.getFeaturesGeometry();
			});
			_self.transform.on('scaleend', function () {
				_self.getFeaturesGeometry();
			});
			_self.renderer.on("mouseover", function (e) {
				_self.focusOnMap();
				_self.el.trigger("hoverMap", [e]);
			});
			$(window).resize(function() {
				_self.updateMapSize();
			});
			
			/* =========== MODIFY / SNAP =========== */
			_self.modify = new ol.interaction.Modify({ features: _self.selectedFeatures });
			_self.snap = new ol.interaction.Snap({ source: _self.source });
			
			
			/* =========== DRAW =========== */
			_self.draw = new ol.interaction.Draw({ source: _self.source, type: "Polygon", stopClick: true });
			_self.startDrawing();
			
			_self.refreshSelection();
			
			// ---- EVENTS section ----
			_self.btnSelectShape.on("change", function(event) {
				event.preventDefault();
				_self.startDrawing();
			});
			_self.btnAddNewShape.on("click", function (event) {
				event.preventDefault();
				_self.startDrawing();
			});
			_self.btnRemoveSelectedShapes.on("click", function (event) {
				event.preventDefault();
				_self.removeSelectedFeatures();
			});
			_self.btnRemoveAllShapes.on("click", function (event) {
				event.preventDefault();
				_self.removeAllFeatures();
				_self.startDrawing();
			});
			_self.btnStraightenSelectedShape.on("click", function (event) {
				event.preventDefault();
				_self.straightenSelectedFeature();
			});
			_self.btnAdjustFeature.on("change", function(event) {
				event.preventDefault();
				_self.restartActiveInteraction();
			});
			_self.btnParseUserText.on("click", function (event) {
				event.preventDefault();
				if (_self.createShapeFromUserText()) {
					_self.fitAllFeatures();
				}
			});
			
			/* Map tools section */
			_self.refreshLayerOpacity();
			_self.container.on("click", ".drawer-pin", function (event) {
				event.preventDefault();
				_self.togglePinDrawer($(this).closest(".drawer-panel"));
			});
			_self.container.on("mouseover", ".drawer-panel", function (event) {
				event.preventDefault();
				$(this).removeClass("closed").addClass("hovering");
			});
			_self.container.on("mouseout", ".drawer-panel", function (event) {
				event.preventDefault();
				$(this).removeClass("hovering");
				if (!$(this).hasClass("pinned")) {
					$(this).addClass("closed");
				}
			});
		},
		postRenderActions: function () {
			var _self = this;
			_self.adjustDrawersPosition();
		}
	};
	
	$.fn.poly2D = function (options) {
		// Workaround for missing requestAnimationFrame variable in different browsers
		window.requestAnimationFrame = (function () {
			return  window.requestAnimationFrame       || 
					window.webkitRequestAnimationFrame || 
					window.mozRequestAnimationFrame    || 
					window.oRequestAnimationFrame      || 
					window.msRequestAnimationFrame     || 
					function (/* function */ callback) {
						window.setTimeout(callback, 1000/60);
					};
		})();
		return new Polygon2D(this, options);
	};
	
	$.fn.poly2D.defaults = {
		startLat:   47,
		startLon:   14,
		latMin  :  -85,
		latMax  :   85,
		lonMin  : -180,
		lonMax  :  180,
		minZoom :    1,
		maxZoom :   19,
		zoom    :    5,
		panPrc  :    0,
		maxFeaturesNo: 10,
		extraFeatureDescription: "preview",
		// Styles
		strokeDefaultRO: { color: [ 57, 138, 222, 1.0], width: 1.0 },	fillDefaultRO  : { color: [255, 255, 255, 0.0] },
		strokeDefaultEN: { color: [240,  20,  20, 1.0], width: 1.5 },	fillDefaultEN  : { color: [255,   0,   0, 0.1] },
		strokeDefault  : { color: [  0, 153, 255, 1.0], width: 1.5 },	fillDefault    : { color: [255, 255, 255, 0.3] },
		strokeDraw     : { color: [  0, 153, 255, 1.0], width: 0.5 },	fillDraw       : { color: [255, 255, 255, 0.3] },
		strokeTransform: { color: [  0, 153, 255, 1.0], width: 3.0 },	fillTransform  : { color: [255, 255, 255, 0.3] },
		strokeModify   : { color: [111, 216,  97, 1.0], width: 1.0 },	fillModify     : { color: [119, 232, 103, 0.3] },
		// Footprint
		defaultFootprint: ""
	};

})(jQuery, window, document);

//# sourceURL=ol-poly.js
