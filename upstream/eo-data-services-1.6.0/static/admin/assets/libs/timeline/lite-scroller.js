/**
  * jQuery liteScroller
  *
  * @author Nicu Stancioi
  *
  * Copyright (c) 2024 CS GROUP - Romania
  */
(function ($, window) {
	'use strict';
	
	var liteScroller = function (element, options) {
		var _self = this;
		
		_self.options = $.extend({}, $.fn.liteScroller.defaults, options);
		
		// liteScroller elements
		_self.el     = $(element);
		_self.knob = $('<div class="lite-scroller-knob"></div>');
		_self.body   = $('<div class="lite-scroller-body"></div>');
		
		_self.clean();
		_self.addControls();
		_self.addEvents();
		
		_self.el.data({ "liteScroller": _self });
		return _self;
	};
	
	liteScroller.prototype = {
		
		clean: function () {
			var _self = this;
			
			// Old stuff
			var _oldSelf = _self.el.data("liteScroller");
			if (typeof _oldSelf !== "undefined") {
				// Remove scroll knob elements
				if ($(".lite-scroller-body"  , _oldSelf.el).length > 0) {
					$(".lite-scroller-body"  , _oldSelf.el).children().appendTo(_oldSelf.el);
					$(".lite-scroller-knob", _oldSelf.el).remove();
					$(".lite-scroller-body"  , _oldSelf.el).remove();
				}
				_oldSelf.el.removeClass("lite-scroller");
				
				// Unbind global events
				$(window).unbind("resize"   , _oldSelf.onResize   );
				$("body").unbind("mousemove", _oldSelf.onMouseMove);
				$("body").unbind("mouseup"  , _oldSelf.onMouseUp  );
				
				// Remove object data
				_self.el.removeData("liteScroller");
			}
		},
		
		addControls: function () {
			var _self = this;
			
			// Knob
			var shiftoutPx = "calc(-" + _self.options.width + " - " + parseInt(parseFloat(_self.options.shiftout)*(_self.options.shiftout.includes("em") ? parseFloat(_self.el.css("font-size")) : 1)) + "px)";
			_self.knob.addClass('knob-' + (_self.options.position === "left" ? 'left' : 'right') + ' knob-' + (_self.options.outside ? 'out' : 'in') + ' hidden');
			_self.knob.css({
				"width"        : _self.options.width,
				"height"       : _self.options.height,
				"margin-top"   : _self.options.fitToContent ? _self.el.css("padding-top"   ) : "",
				"margin-bottom": _self.options.fitToContent ? _self.el.css("padding-bottom") : "",
				"left"         : _self.options.outside && _self.knob.hasClass("knob-left" ) ? shiftoutPx : "",
				"right"        : _self.options.outside && _self.knob.hasClass("knob-right") ? shiftoutPx : "",
			});
			
			// Container
			_self.body.css({
				"height" : _self.el.outerHeight() + "px",
				"padding": _self.el.css("padding"),
				"border" : _self.el.css("border" )
			});
			_self.el.children().appendTo(_self.body);
			
			// Apply controls
			_self.knob.appendTo(_self.el);
			_self.body.appendTo(_self.el);
			_self.el.addClass("lite-scroller");
			
			// Show/hide knob
			if (_self.body.prop("scrollHeight") > _self.body.innerHeight()) { _self.knob.removeClass("hidden"); }
		},
		
		updateKnobPos: function () {
			var _self = this;
			
			_self.body.css({ "height": _self.el.outerHeight() + "px" });
			var newtop = _self.body.scrollTop()*(_self.body.outerHeight() - _self.knob.outerHeight(true))/(_self.body.prop("scrollHeight") - _self.body.innerHeight());
			_self.knob.css({ "top": newtop + "px" });
			if (_self.body.prop("scrollHeight") > _self.body.innerHeight()) { _self.knob.removeClass("hidden"); } else { _self.knob.addClass("hidden"); }
		},
		
		doOnResize: function (e) {
			var _self = this;
			
			_self.body.css({ "height": "" });
			_self.body.css({ "height": _self.el.outerHeight() + "px" });
			_self.updateKnobPos(e);
		},
		
		doOnMouseMove: function (e) {
			var _self = this;
			
			if (e.buttons == 1 && _self.clickd) {
				var newtop = parseFloat(_self.knob.css("top")) - (_self.clickY - e.pageY);
				newtop = Math.max(newtop, 0);
				newtop = Math.min(newtop, _self.body.outerHeight() - _self.knob.outerHeight(true));
				_self.clickY = e.pageY;
				_self.knob.css({ "top": newtop + "px" });
				var newscrl = newtop*(_self.body.prop("scrollHeight") - _self.body.innerHeight())/(_self.body.outerHeight() - _self.knob.outerHeight(true));
				_self.body.scrollTop(newscrl);
			}
			if (e.buttons != 1) {
				_self.clickd = false;
			}
		},
		
		doOnMouseUp: function (e) {
			var _self = this;
			
			_self.clickd = false;
		},
		
		addEvents: function () {
			var _self = this;
			
			// Variables and events
			_self.clickd = false;
			_self.clickY = 0;
			
			// Global events
			_self.onResize    = function (e) { _self.doOnResize(e);    }
			_self.onMouseMove = function (e) { _self.doOnMouseMove(e); };
			_self.onMouseUp   = function (e) { _self.doOnMouseUp(e);   };
			$(window).on("resize"   , _self.onResize   );
			$("body").on("mousemove", _self.onMouseMove);
			$("body").on("mouseup"  , _self.onMouseUp  );
			
			// liteScroller events
			_self.body.on("scroll", function(e) { !_self.clickd && _self.updateKnobPos(); });
			_self.knob.on("mousedown", function(e) { _self.clickd = true; _self.clickY = e.pageY; });
		}
	};
	
	$.fn.extend({
		liteScroller: function (options) { return new liteScroller(this, options); }
	});
	
	$.fn.liteScroller.defaults = {
		position    : 'right',
		fitToContent: false,
		outside     : false,
		shiftout    : '0px',
		width       : '2em',
		height      : '4em'
	};
	
})(jQuery, window, document);

//# sourceURL=lite-scroller.js