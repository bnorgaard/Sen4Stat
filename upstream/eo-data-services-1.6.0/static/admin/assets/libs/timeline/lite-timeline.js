/**
  * jQuery liteTimeline
  * Vertical timeline with cards
  *
  * @author Nicu Stancioi
  *
  * Copyright (c) 2024 CS GROUP - Romania
  */
(function ($, window) {
	'use strict';
	
	var liteTimeline = function (element, options) {
		var _self = this;
		
		_self.options = $.extend({}, $.fn.liteTimeline.defaults, options);
		
		_self.el = $(element);
		_self.el.html('');
		_self.el.addClass("lite-timeline");
		_self.el.css({ "font-size": _self.options.fontSize });
		_self.el.data({ "liteTimeline": _self });
		// Timeline items
		_self.populate();
		
		return _self;
	};
	
	liteTimeline.prototype = {
		
		itemHtml: function () {
			var $el = $('<div class="sc">' +
						'	<div class="sc-image"></div>' +
						'	<div class="sc-title"></div>' +
						'	<div class="sc-description"></div>' +
						'</div>');
			return $el.html();
		},
		
		addItem: function (item) {
			var _self = this;
			
			var $el = $('<div id="' + item.cardId + '" class="' + ('tl-card ' + item.cardClass).trim() + '">' + _self.itemHtml() + '</div>');
			$(".sc-image"      , $el).html('<img src="' + item.cardImage + '" width="100%" height="100%" />');
			$(".sc-title"      , $el).html(item.cardTitle === "" ? '' : '<span>' + item.cardTitle + '</span>');
			$(".sc-description", $el).html(item.cardText  === "" ? '' : '<span>' + item.cardText  + '</span>');
			$el.data("cardOptions", item);
			_self.el.append($el);
			
			$el.on("click", ".sc-image", function (e) {
				$.isFunction(_self.options.expand) && _self.options.expand($el);
			});
			
			$(".sc-image img", $el)
			.one("load", function (e) {
				if (e.delegateTarget.src.indexOf("missing.png") < 0) {
					$(e.delegateTarget).removeClass("missing");
				}
				$(e.delegateTarget).closest(".tl-card").attr("thumb-loaded", "yes");
				if ($('.tl-card[thumb-loaded="yes"]', _self.el).length == $('.tl-card', _self.el).length) {
					$.isFunction(_self.options.callback) && _self.options.callback(_self.el);
				}
			}).error(function (e) {
				$(e.delegateTarget).addClass("missing").attr("src", "assets/libs/timeline/missing.png");
			});
			
			return $el;
		},
		
		populate: function () {
			var _self = this;
			
			if ($.isArray(_self.options.items) && _self.options.items.length > 0) {
				$(".tl-card", _self.el).remove();
				$.each(_self.options.items, function (idx, elem) {
					var $el = _self.addItem($.extend({}, $.fn.liteTimeline.defaults.item_defaults, $.extend(true, {}, elem)));
					$el.addClass(idx == 0 ? "is-first" : "");
				});
				$(".sc-back", _self.el).removeClass("hidden");
			}
		}
	};
	
	$.fn.extend({
		liteTimeline: function (options) { return new liteTimeline(this, options); }
	});
	
	$.fn.liteTimeline.defaults = {
		fontSize     : '16px',
		items        : [],
		item_defaults: {
			cardId   : '',
			cardSize : '10em',
			cardTitle: '',
			cardText : '',
			cardImage: '',
			cardClass: ''
		},
		expand  : null,
		callback: null
	};
	
})(jQuery, window, document);

//# sourceURL=lite-timeline.js