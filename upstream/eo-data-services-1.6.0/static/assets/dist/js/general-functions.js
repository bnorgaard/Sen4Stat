var siteTitle = 'Sen4Stat';

var baseApiUrl = '/';
// Global Definitions
var responseStatus = { success: "SUCCEEDED", fail: "FAILED" };
var existingServicesArray = [];
//Array.from is not supported in IE11
//The following lines will emulate an ES6's Array.from method.
if (!Array.from) {
  Array.from = (function () {
    var toStr = Object.prototype.toString;
    var isCallable = function (fn) {
      return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
    };
    var toInteger = function (value) {
      var number = Number(value);
      if (isNaN(number)) { return 0; }
      if (number === 0 || !isFinite(number)) { return number; }
      return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
    };
    var maxSafeInteger = Math.pow(2, 53) - 1;
    var toLength = function (value) {
      var len = toInteger(value);
      return Math.min(Math.max(len, 0), maxSafeInteger);
    };

    // The length property of the from method is 1.
    return function from(arrayLike/*, mapFn, thisArg */) {
      var C = this;

      var items = Object(arrayLike);

      if (arrayLike == null) {
        throw new TypeError("Array.from requires an array-like object - not null or undefined");
      }

      var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
      var T;
      if (typeof mapFn !== 'undefined') {
        if (!isCallable(mapFn)) {
          throw new TypeError('Array.from: when provided, the second argument must be a function');
        }

        if (arguments.length > 2) {
          T = arguments[2];
        }
      }

      var len = toLength(items.length);

      var A = isCallable(C) ? Object(new C(len)) : new Array(len);

      var k = 0;
      var kValue;
      while (k < len) {
        kValue = items[k];
        if (mapFn) {
          A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
        } else {
          A[k] = kValue;
        }
        k += 1;
      }
      A.length = len;
      return A;
    };
  }());
}

//SHA256 password hash
function  passwordSHA(plaintextPass){
    var ASCII = {};
//Encodes byte array to ASCII string
    ASCII.encode = function(bytes) {
        var str = "";
        for (var i = 0; i < bytes.length; i++) {
            str += String.fromCharCode(bytes[i]);
        }
        return str;
    };
//Decodes ASCII string to byte array
    ASCII.decode = function(str) {
        var bytes = [];
        for (var i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }
        return bytes;
    };
    var Hex = {};
    Hex.map = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
//Encodes byte array to hex string
    Hex.encode = function(bytes) {
        var str = "";
        for (var i = 0; i < bytes.length; i++) {
            str += Hex.map[bytes[i] >> 4] + Hex.map[bytes[i] % 16];
        }
        return str;
    };
//Decodes hex string to byte array
    Hex.decode = function(str) {
        var bytes = [];
        for (var i = 0; i < Math.floor(str.length / 2); i++) {
            bytes.push((Hex.map.indexOf(str[i * 2]) << 4) + Hex.map.indexOf(str[i * 2 + 1]));
        }
        return bytes;
    };

    var Sha256 = {};
    Sha256.K = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    Sha256.hash = function(message) {
        Sha256.H = [ 0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19 ];
        //Preprocessing
        message = Sha256.preProcessing(message);
        //Split the message in 64 bytes long blocks
        message = Utilities.split(message, 64);
        //Process each block
        for (var i = 0; i < message.length; i++) {
            //Split the block in 4 bytes long words
            message[i] = Utilities.split(message[i], 4);
            //Convert the words from byte arrays to intagers
            for (var i2 = 0; i2 < message[i].length; i2++) {
                message[i][i2] = Utilities.bytesToInt(message[i][i2]);
            }
            //Extend the block's words
            message[i] = Sha256.extendBlock(message[i]);
            //Main loop
            Sha256.mainLoop(message[i]);
        }
        //Convert the words from intagers to 4 byte long byte arrays
        for (var i = 0; i < Sha256.H.length; i++) {
            Sha256.H[i] = Utilities.intToBytes(Sha256.H[i], 4);
        }
        return Utilities.join(Sha256.H);
    };
    Sha256.preProcessing = function(message) {
        //Get the original length of the message
        var messageLength = message.length;
        //Append one bit and seven 0s (byte 80 in base 16)
        message.push(0x80);
        //Append the minimum number of bytes 0 until the length of the message modulo 64 is equal 56
        while (message.length % 64 !== 56) {
            message.push(0x0);
        }
        //Append the length in bits of the original message as a 8 byte long intager
        message = message.concat(Utilities.intToBytes(messageLength * 8, 8));
        return message;
    };
    Sha256.extendBlock = function(words) {
        for (var i = 16; i < 64; i++) {
            words[i] = (words[i - 16] + Sha256.σ0(words[i - 15]) + words[i - 7] + Sha256.σ1(words[i - 2])) & 0xffffffff;
        }
        return words;
    };
    Sha256.mainLoop = function(words) {
        //Initialize variables
        var a = Sha256.H[0],
            b = Sha256.H[1],
            c = Sha256.H[2],
            d = Sha256.H[3],
            e = Sha256.H[4],
            f = Sha256.H[5],
            g = Sha256.H[6],
            h = Sha256.H[7],
            tmp0, tmp1;
        //Main loop
        for (var i = 0; i < 64; i++) {
            tmp0 = h + Sha256.Σ1(e) + Sha256.Ch(e, f, g) + Sha256.K[i] + words[i];
            tmp1 = Sha256.Σ0(a) + Sha256.Maj(a, b, c);
            h = g;
            g = f;
            f = e;
            e = d + tmp0 & 0xffffffff;
            d = c;
            c = b;
            b = a;
            a = tmp0 + tmp1 & 0xffffffff;
        }
        //Add the result of the loop to the hash's value's array
        Sha256.H[0] = (Sha256.H[0] + a) & 0xffffffff;
        Sha256.H[1] = (Sha256.H[1] + b) & 0xffffffff;
        Sha256.H[2] = (Sha256.H[2] + c) & 0xffffffff;
        Sha256.H[3] = (Sha256.H[3] + d) & 0xffffffff;
        Sha256.H[4] = (Sha256.H[4] + e) & 0xffffffff;
        Sha256.H[5] = (Sha256.H[5] + f) & 0xffffffff;
        Sha256.H[6] = (Sha256.H[6] + g) & 0xffffffff;
        Sha256.H[7] = (Sha256.H[7] + h) & 0xffffffff;
    };
    Sha256.RotR = function(input, places) {
        return (input >>> places) | (input << (32 - places));
    };
    Sha256.Σ0 = function(x) {
        return Sha256.RotR(x, 2) ^ Sha256.RotR(x, 13) ^ Sha256.RotR(x, 22);
    };
    Sha256.Σ1 = function(x) {
        return Sha256.RotR(x, 6) ^ Sha256.RotR(x, 11) ^ Sha256.RotR(x, 25);
    };
    Sha256.σ0 = function(x) {
        return Sha256.RotR(x, 7) ^ Sha256.RotR(x, 18) ^ (x >>> 3);
    };
    Sha256.σ1 = function(x) {
        return Sha256.RotR(x, 17) ^ Sha256.RotR(x, 19) ^ (x >>> 10);
    };
    Sha256.Ch = function(x, y, z) {
        return (x & y) ^ (~x & z);
    };
    Sha256.Maj = function(x, y, z) {
        return (x & y) ^ (x & z) ^ (y & z);
    };

    var Utilities = {};
    Utilities.split = function(input, size) {
        var output = [];
        while (input.length > 0) {
            output.push(input.splice(0, size));
        }
        return output;
    };
    Utilities.join = function(input) {
        var output = [];
        for (var i = 0; i < input.length; i++) {
            output = output.concat(input[i]);
        }
        return output;
    };
    Utilities.intToBytes = function(int, size) {
        var bytes = [];
        for (var i = size - 1; i >= 0; i--) {
            bytes[i] = int & 0xFF;
            int = int >> 8;
        }
        return bytes;
    };
    Utilities.bytesToInt = function(bytes) {
        var int = 0;
        for (var i = 0; i < bytes.length; i++) {
            int = int << 8;
            int += bytes[i];
        }
        return int;
    };
    Utilities.xorBytes = function(a, b) {
        for (var i = 0; i < a.length; i++) {
            a ^= b;
        }
        return a;
    };

	return Hex.encode(Sha256.hash(ASCII.decode(plaintextPass)));
}

function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
}

function guid() {
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

//get query value from request
function jsGetUrlQueryValue (sVar) {
    return decodeURI(window.location.search.replace(new RegExp("^(?:.*[&\\?]" + encodeURI(sVar).replace(/[\.\+\*]/g, "\\$&") + "(?:\\=([^&]*))?)?.*$", "i"), "$1"));
}

function humanFileSize(size) {
    var i = Math.floor( Math.log(size) / Math.log(1024) );
    return ( size / Math.pow(1024, i) ).toFixed(2) * 1 + ' ' + ['B', 'KB', 'MB', 'GB', 'TB'][i];
}

var _cookiesSettings = {
    init: function() {
        var ck = document.cookie;
    },
    // Cookies
    createCookie: function (name, value, days) {
        var expires = "";
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            expires = "; expires=" + date.toGMTString();
        }
        document.cookie = name + "=" + value + expires + "; path=/";
    },
    readCookie: function (name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for (var i = 0; i < ca.length; i ++) {
            var c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    },
    eraseCookie: function (name) {
        this.createCookie(name, "", -1);
    },
    closeandremember: function (e) {
        this.hide(e);
        var date = new Date();
        date.setTime(date.getTime() + (24 * 60 * 60 * 1000));
        document.cookie = e + '=hide; path=/'
    },
    chkCookie: function (e) {
        var filter = new RegExp('(?:(?:^|.*;\\s*)' + e + '\\s*\\=\\s*([^;]*).*$)|^.*$');
        return document.cookie.replace(filter, "$1");
    }
};

function readAuthUserCookie() {
	try {
		var cookieAuthUser = JSON.parse(_cookiesSettings.readCookie("authuser"));
		if (cookieAuthUser) {
			// Set global variables
			window.userID      = cookieAuthUser.userID;
			window.userLogin   = cookieAuthUser.userLogin;
			window.userIsAdmin = cookieAuthUser.userIsAdmin;
            window.userRole = cookieAuthUser.userRole;
			window.tokenKey    = cookieAuthUser.tokenKey;
		} else {
			window.location.href = "login.html";
		}
	} catch(e) {
		window.location.href = "login.html";
	}
}

Number.prototype.round = function(places) {
  return +(Math.round(this + "e+" + places)  + "e-" + places);
}

function logout() {
	// Set global variables
	window.userID      = void 0;
	window.userLogin   = void 0;
	window.userIsAdmin = void 0;
    window.userRole    = void 0;
	window.tokenKey    = void 0;
	
	_cookiesSettings.eraseCookie("authuser");
	readAuthUserCookie();
}

function showFragmentHtml(fragmentName, $container, init) {
	if ($container && $container.length > 0) {
		$.ajax({
			url: "fragments/" + fragmentName,
			type: "GET",
			async: false,
			success: function(response) {
				$container.html(response);
			},
			error: function (jqXHR, textStatus, errorThrown) {
				var msg = textStatus;
				$container.html(jqXHR.responseText.replace("Map", "pre"));
			}
		});
	}
}

// Dialog Ui related functions
function purgeUiDialog(dialogId) {
	var _this = $("#" + dialogId + ".ui-dialog-content");
	if (_this.length > 0) { _this.dialog('destroy').parent().remove(); }
}
function refreshDialogPosition($dialog) {
	if (typeof $dialog.data("ui-dialog") !== "undefined") {
		$dialog.dialog("option", "position", {my: "center", at: "center", of: window, "collision": "fit"});
	}
}
function closeDialog(element) {
	$dialog = $(element).closest(".ui-dialog-content");
	if (typeof $dialog.data("ui-dialog") !== "undefined") {
		$dialog.dialog("close");
	}
}
function xmlToJson(xml) {
	try {
		var pXml = (typeof xml === "string") ? $.parseXML(xml).children : xml;
	} catch (e) {
		return xml;
	}
	var json = new Object();
	$.each(pXml, function (index, child) {
		if (child.children.length > 0) {
			json[child.nodeName] = xmlToJson(child.children);
		} else {
			json[child.nodeName] = child.textContent;
		}
	});
	return json;
}
function showPanelError(panel, message, append) {
	if ($("div.error", panel).length > 0) {
		var msg = (message == null ? "ERROR" : message);
		if (typeof msg !== "string") {
			msg = "";
			var json = new Array();
			if (message.responseJSON) {
				json = message.responseJSON;
			} else if (message.responseText) {
				json = xmlToJson(message.responseText.replace("<!doctype html>", ""));
				if (typeof json["Map"] !== "undefined") {
					json = json["Map"];
				} else if (typeof json["html"] !== "undefined") {
					json = json["html"].body;
				}
			} else if (message.statusText) {
				msg = message.statusText;
			}
			$.each(json, function (key, val) {
				msg += (msg.length > 0 ? "<br>" : "") + key + ": " + val;
			});
			msg = "<pre>" + msg + "</pre>";
		} else {
			if (msg.indexOf("Map>") >= 0) {
				msg = msg.replace(/Map>/g, "pre>");
			} else {
				msg = "<pre>" + msg + "</pre>";
			}
		}
		if (append) {
			$("div.error", panel).append(msg);
		} else {
			$("div.error", panel).html(msg);
		}
		$("div.error", panel).removeClass("hidden");
		
		// If panel is part of a dialog control, update dialog position because its size changed
		refreshDialogPosition($(panel).closest(".ui-dialog-content"));
	}
}
function hidePanelError(panel) {
	if ($("div.error", panel).length > 0) {
		$("div.error", panel).html("").addClass("hidden");
		
		// If panel is part of a dialog control, update dialog position because its size changed
		refreshDialogPosition($(panel).closest(".ui-dialog-content"));
	}
}
function adjustFooterPosition() {
	if (window.location.hash === "#products") {
		$("body").addClass("layout-sm");
	} else {
		$("body").removeClass("layout-sm");
	}
	var h = $("#header").outerHeight() + $("#bar").outerHeight() + $("#footer").outerHeight();
	$("#main").css({ "min-height": "calc(100vh - " + h/10 + "rem)" });
}

var waitForFinalEvent = (function () {
  var timers = {};
  return function (callback, ms, uniqueId) {
    if (!uniqueId) {
      uniqueId = "Don't call this twice without a uniqueId";
    }
    if (timers[uniqueId]) {
      clearTimeout (timers[uniqueId]);
    }
    timers[uniqueId] = setTimeout(callback, ms);
  };
})();

// Extend dialog to set title color same as dialog outline-color
if (typeof $.widget !== "undefined") {
	$.widget( "ui.dialog", $.ui.dialog, {
		open: function () {
			var _self = this;
			if (typeof _self.options.dashConvert !== "undefined" && !_self.element.hasClass("dash-row")) {
				_self.uiDialog.addClass("panel no-close");
				_self.uiDialogTitlebar.addClass("panel-heading");
				_self.uiDialogTitlebar.find(".ui-dialog-title").addClass("panel-title");
				_self.element.addClass("dash-row panel-body");
				_self.updateDashTitle(_self.options.dashConvert.title);
				
				$(">.panel", _self.element).addClass("dash-panel");
				$.each(_self.options.dashConvert.buttons, function (name, position) {
					var $button = false;
					switch (name) {
						case "reduce":
						case "minimize":
							$button = $('<span class="glyphicon glyphicon-chevron-up panel-control min"></span><span class="glyphicon glyphicon-chevron-down panel-control max"></span>');
							$button.on("click", function (e) {
								_self.uiDialog.css({ "max-width": $(this).hasClass("min") ? "unset" : _self.options.width });
								$(".ui-dialog-title", _self.uiDialogTitlebar).html($(this).hasClass("min") ? $(".dash-row-title", _self.uiDialog).html() : _self.options.title);
								_self.uiDialog.toggleClass("minimized" + (name == "reduce" ? " reduced" : ""), 150, "easeOutSine");
								setTimeout(function () {
									_self.uiDialog.css({ width: _self.options.width });
									_self.element.trigger(name);
								}, 160);
							});
							break;
						case "home":
							$button = $('<span class="glyphicon glyphicon-home panel-control home"></span>');
							$button.on("click", function () {
								setTimeout(function () { $("li.dashboard a", "#menu").get(0).click(); }, 200);
							});
							break;
						case "close":
							$button = $('<span class="glyphicon glyphicon-remove panel-control close"></span>');
							$button.on("click", function () {
								_self.element.dialog("close");
							});
							break;
					}
					if ($button && position === "left") {
						$button.addClass("rspace");
						_self.uiDialogTitlebar.prepend($button);
					} else if ($button) {
						$button.addClass("lspace");
						_self.uiDialogTitlebar.append($button);
					}
				});
				if (_self.uiDialog.hasClass("dash-horizontal")) {
					$(">*:last-child", _self.element).css({ "margin-right": 0 });
				} else {
					$(">*:last-child", _self.element).css({ "margin-bottom": 0 });
				}
				_self.element.append("<hr/>");
			}
			var rgbColor = $(this.element).css("outline-color");
			if ($(this.uiDialog).css("outline-color") !== rgbColor) {
				$(this.uiDialogTitlebar).css({ "color": rgbColor, "border-color": rgbColor });
			}
			return this._super();
		},
		updateDashTitle: function (title) {
			var _self = this;
			if (typeof _self.options.dashConvert.title === "undefined") { return; }
			_self.options.dashConvert.title = title;
			if ($(".dash-row-title", _self.element).length === 0) {
				_self.element.prepend('<div class="dash-row-header"><h4 class="dash-row-title">' + title + '</h4></div>');
			} else {
				$(".dash-row-title", _self.element).html(title);	
			}
			if (_self.uiDialog.hasClass("minimized")) {
				_self.uiDialogTitlebar.find(".ui-dialog-title").html(title);
			}
		}
	});
}
function hasUrlParameters (sParam) {
	return typeof window.location.hash.split("?")[1] !== "undefined"
}
function getUrlParameter(sParam) {
    var sPageURL = window.location.hash.split("?"),
        sURLVariables = sPageURL[1].split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return typeof sParameterName[1] === undefined ? true : decodeURIComponent(sParameterName[1]);
        }
    }
    return false;
};

var regionTypeEnum = function (value) {
	switch (value) {
	 case 1: return $("#roiContinent"); break;
	 case 3: return $("#roiCountry"); break;
	 case 4: return $("#roiRegion"); break;
	}
};

var jobStatusEnum = function (value) {
	switch (value) {
	 case 1: return "submitted"; break;
	 case 2: return "pending"; break;
	 case 3: case 8: return "rejected"; break;
	 case 4: return "running"; break;
	 case 5: return "paused"; break;
	 case 6: return "completed"; break;
	 case 7: return "cancelled"; break;
	}
};

function resetFormDialog($forms) {
	$.each($forms, function (index, form) {
		hidePanelError(form);
		form.reset();
	});
};

function cancelRequest (data) {
	$.ajax({
		url: "/request/cancel",
		type: "POST",
		data: JSON.stringify(data),
		headers: { "content-type": "application/json"},
		async: false,
		success: function(response) {
			if (response.status === responseStatus.success) {
				window.location.reload();
			}else {
				console.log(response.status + ": " + response.message);
			}
		},
		error: function (jqXHR, textStatus, errorThrown) {
			console.log("ERROR: " + textStatus);
			if (jqXHR.status == 401) { // unauthorized
				logout();
			}
		}
	});
};

function stringToBoolean(string){
    switch(string.toLowerCase().trim()){
        case "true": 
        case "yes": 
        case "on": 
        case "1": 
          return true;

        case "false": 
        case "no": 
		case "off": 
        case "0": 
        case null: 
          return false;

        default: 
          return Boolean(string);
    }
};

//used to keep the seson period to one year
function validPeriod(start,end) {
	var diff =(new Date(end).getTime() - new Date(start).getTime()) / 1000;
	diff /= (60 * 60 * 24);
	return Math.abs(diff/365.25) <= 1;
}

var getAllRequests = function () {
	return $.ajax({
		url: "/request/all?userId=" + window.userID,
		type: "GET",
		async: false,
		dataType: 'json',
		beforeSend: function (xhr) {
			xhr.setRequestHeader("Accept", "application/json");
			xhr.setRequestHeader("Content-Type", "application/json");
		}
	});
}

/* START get request data */
	var getDataFrom = function (requestId) {
		return $.ajax({
			async: false,
			url: baseApiUrl + "request/get/" + requestId,
			dataType: 'json',
			beforeSend: function (xhr) {
				xhr.setRequestHeader("Accept", "application/json");
				xhr.setRequestHeader("Content-Type", "application/json");
			}
		});
	};
/* END get request data */

/*START get default scheduled task values*/
	var getDefaultScheduledTaskVal = function (data) {
		return $.ajax({
			cache: false,
			async: false,
			url  : baseApiUrl + "request/default_scheduled_tasks",
			data: data,
			type : "GET"
		});
	};
	
	function defaultScheduledTaskVal () {
		var exceptMonthDisabled = $("#exceptMonth").prop("disabled");
		var startDateDisabled = $("#startDate").prop("disabled");
		var endDateDisabled = $("#endDate").prop("disabled");
		if (exceptMonthDisabled) {
			$("#exceptMonth").prop("disabled",false);
		}
		if (endDateDisabled) {
			$("#endDate").prop("disabled",false);
		}
		if (startDateDisabled) {
			$("#startDate").prop("disabled",false);
		}
		var formData = new FormData($('#request_usr_form').get(0));
		if (exceptMonthDisabled) {
			$("#exceptMonth").prop("disabled",true);
		}
		if (endDateDisabled) {
			$("#endDate").prop("disabled",true);
		}
		if (startDateDisabled) {
			$("#startDate").prop("disabled",true);
		}
		
		var urlData = {name:formData.get("name"),startDate:formData.get("startDate"),endDate:formData.get("endDate"),exceptMonth:JSON.stringify(formData.getAll("exceptMonth"))};
		$.when(getDefaultScheduledTaskVal(urlData)).done(function (response) {
			if (response.status === responseStatus.success) {
				if (response.data.length > 0) {
					$("#content").data("defaultScheduledType", response.data);
				}
			} else {
				console.log(response.status + ": " + response.message);
			}
		});
	}
/*END get default scheduled task values*/

/* START Check if exist previous service request and populate fields */
function refreshAreaOfInterest(){
	if (typeof $("#content").data("existingServices") !== "undefined") {
		$("#usePrevSite").prop("disabled", false);
		$.each($("#content").data("existingServices"), function (index, value){
			$("#prevSites").append("<option value='" + value.id +"'>" + value.name + "</option>");
		});
	} else {
		$("#usePrevSite").prop("disabled", true);
		$("#prevSites").find("option[value='']").prop("selected", true);
		$("#prevSites").find("option[value!='']").remove();
		//$("#defineNew").prop("checked", true).trigger("change");
	}
}
/* END Check if exist previous service request and populate fields */
function createObsDataList () {
	var selectedProcessorList = $("#processor").val();
	var observationData = $("#content").data("serviceList").filter(i => $.inArray(i.id.toString(),selectedProcessorList)>=0).map(item=>item.supportedSatellites);
	var uniqueObsData = Array.from(new Set(Array.prototype.concat(...observationData)));
	var mandatoryObservationData = $("#content").data("serviceList").filter(i => $.inArray(i.id.toString(),selectedProcessorList)>=0).map(item=>item.mandatorySatellites);
	var uniqueMandatory = Array.from(new Set(Array.prototype.concat(...mandatoryObservationData)));
	$("#earthObsData").html("");
	$.each(uniqueObsData, function(idex, sensor) {
		$("#earthObsData").append("<div class='form-group row'><label class='col-md-12' for='use"+sensor+"'><input type='checkbox' class='form-control' name='observationData' id='use"+sensor+"' value='"+sensor+"' /><label>" + sensor + "</label></label></div>");
	});

	//check and disabled all mandatory observation data
	$.each($("input[type='checkbox']", "#earthObsData"),function(idx,elem) {
		if ($.inArray(elem.value,uniqueMandatory) >= 0) {
			$(elem).prop({"checked":true,"disabled":true});
		}
	});
	//if no mandatory observation data, check the first one
	if ($("input[type='checkbox']:checked", "#earthObsData").length < uniqueMandatory.length) {
		$("input[type='checkbox']", "#earthObsData").first().prop("checked", true);
	}
}