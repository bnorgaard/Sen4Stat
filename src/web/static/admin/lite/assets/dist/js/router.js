// Scripts of the page fragments: same synchronous load as jQuery._evalUrl,
// but cacheable by the browser (no "_=" parameter added to the url).
jQuery._evalUrl = function (url) {
	return jQuery.ajax({
		url: url,
		type: "GET",
		dataType: "script",
		cache: true,
		async: false,
		global: false,
		"throws": true
	});
};

$(function () {
	window.prevhash = "";
	
    var $dynPageDiv        = $("#main2");
	var $staticPageMenu    = $("#menu");
    var DEFAULT_PAGE_URL   = "#dashboard";
    var UNDEFINED_PAGE_URL = "#undefined";
    var NOT_FOUND_PAGE_URL = "#notfound";
	var hashRoutesMap      = [];
	
	hashRoutesMap["undefined"     ] = "./fragments/undefined.fragment.html";
	hashRoutesMap["notfound"      ] = "./fragments/notfound.fragment.html";
	hashRoutesMap["products"      ] = "./fragments/products.fragment.html";
	hashRoutesMap["dashboard"     ] = "./fragments/dashboard.fragment.html";
	hashRoutesMap["requestUsrForm"] = "./fragments/request.form.fragment.html";
	hashRoutesMap["details"       ] = "./fragments/request.details.fragment.html";
	hashRoutesMap["contactForm"   ] = "./fragments/contact.form.fragment.html";
	hashRoutesMap["rate"          ] = "./fragments/rating.request.fragment.html";
	
	// UI loading indicator management
	function routeLoading(action) {
		if (action === "hide") {
			// Add support for CSS variables in IE11
			if (window.navigator.userAgent.indexOf("MSIE ") != -1 || !!window.navigator.userAgent.match(/Trident.*rv\:11\./)) {
				if ($('script[src*="css-vars-ponyfill.min.js"]').length === 0) {
					$('head').append('<script src="assets/libs/css-vars-ponyfill/css-vars-ponyfill.min.js"><\/script>');
				}
				cssVars({ include: 'link[rel="stylesheet"][href*="assets/dist"],style' });
			}
		}
		return;
		var loadingDiv = $("#myModalLoading");
		if (action === "show") {
			if (loadingDiv.data("bs.modal") && loadingDiv.data("bs.modal").$backdrop == null) {
				loadingDiv.modal('show');
			} else {
				loadingDiv.modal('hide');
			}
		} else if (action === "hide") {
			setTimeout(function () {
				loadingDiv.modal('hide');
			}, 500);
		}
	}
	
	function purgeDialogs(hash) {
		if (!hash || (typeof hash === "string" && hash === "") || (typeof hash === "string" && hash.charAt(0) !== "#")) {
			return;
		} else {
			hash = hash.substring(1); // remove #
			var functionName = "purgeAll" + hash.charAt(0).toUpperCase() + hash.substring(1) + "Dialogs";
			if ($.isFunction(window[functionName])) {
				window[functionName]();
			}
		}
	}
	function purgeDatePickers() {
		$("#ui-datepicker-div").remove();
	}
	function selectCurrentMenu(menuName) {
		$(">ul>li", $staticPageMenu).removeClass("selected");
		$(">ul>li." + menuName, $staticPageMenu).addClass("selected");
	}
	
    // Navigation/router function will call appropriate functions.
    function navRouter(toHash, fromHash, toParam) {
		purgeDatePickers();
		
        var hash = toHash;
		if (!hash || (typeof hash === "string" && hash === "") || (typeof hash === "string" && hash === "#")) {
            hash = DEFAULT_PAGE_URL;
        }
        if (hash.charAt(0) === "#") {
            routeFilters = {};
            hash = hash.substring(1);
        }
        if (typeof hashRoutesMap[hash] === "undefined") {
            hash = UNDEFINED_PAGE_URL.substring(1);
        }
		// Reject access to Admin pages for non-admin users
		if ((hash == "xxxx" || hash == "datasources") && !window.userIsAdmin) {
			hash = UNDEFINED_PAGE_URL.substring(1);
		}
		
        routeLoading('show');
		selectCurrentMenu(hash);
		$.ajax({
			cache: false,
			url: hashRoutesMap[hash] + toParam
		})
		.done(function (data) {
			adjustFooterPosition();
			purgeDialogs(fromHash);
			$dynPageDiv.html(data);
			routeLoading('hide');
		})
		.fail(function (jqXHR, textStatus) {
			// Load NOT FOUND 404 page
			hash = NOT_FOUND_PAGE_URL.substring(1);
			$.ajax({
				cache: false,
				url: hashRoutesMap[hash]
			})
			.done(function (dataX) {
				purgeDialogs(fromHash);
				$dynPageDiv.html(dataX);
				routeLoading('hide');
			})
			.fail(function () {
				var notfounfHtml = '<div class="panel panel-default"><div class="panel-body"><div class="panel-heading row">Page ' + toHash + ' not found!</div></div></div>';
				$dynPageDiv.html(notfounfHtml);
				routeLoading('hide');
			});
		});
    }
	
    // Event handlers for frontend navigation
    $(window).on('hashchange', function (e) {
        //check authtoken
		readAuthUserCookie();
		readExtProjectCookie();
		var toHash = window.location.hash
		var urlData = toHash.split("?");
		navRouter(urlData[0], window.prevhash, typeof urlData[1] === "undefined" ? "" : "?" + urlData[1]);
		window.prevhash = urlData[0];		
    });
});
