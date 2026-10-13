/**
  * jQuery liteDialog
  * Vertical timeline with cards
  *
  * @author Nicu Stancioi
  *
  * Copyright (c) 2024 CS GROUP - Romania
  */
(function ($, window) {
	'use strict';
	
	var liteDialog = function (element, options) {
		var _self = this;
		
		_self.options = $.extend({}, $.fn.liteDialog.defaults, options);
		
		_self.el = $(element);
		_self.addEvents();
		
		return _self;
	};
	
	liteDialog.prototype = {
		
		addEvents: function (item) {
			var _self = this;
			
		},
	};
	
	$.fn.extend({
		liteDialog: function (options) { return new liteDialog(this, options); }
	});
	
	$.fn.liteDialog.defaults = {
		callback: null
	};
	
})(jQuery, window, document);

//# sourceURL=lite-dialog.js