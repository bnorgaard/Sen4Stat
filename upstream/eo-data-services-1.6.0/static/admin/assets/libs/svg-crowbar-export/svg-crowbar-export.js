var svg_crowbar = function (svg_el, options){
	// exit if not SVG element selected
	if (!((svg_el instanceof Element || svg_el instanceof HTMLDocument) && svg_el.tagName == "svg")) {
		alert('Selected element is not a SVG');
		return false;
	}
	
    // get options passed to svg_crowbar
    var filename = options.filename || "download.png";
    var width    = options.width    || svg_el.clientWidth;
    var height   = options.height   || svg_el.clientHeight;
	
	// purge crowbar workspace
	var crowbar_workspace = svg_el.parentNode.querySelectorAll('#crowbar-workspace');
	for (var i = 0; i < crowbar_workspace.length; i ++) {
		crowbar_workspace[i].remove();
	}
	var crowbar_el = document.createElement("DIV");
	crowbar_el.setAttribute("id", "crowbar-workspace");
	crowbar_el.setAttribute("style", "display:none")
	svg_el.parentNode.appendChild(crowbar_el);
	
	// create svg clone element
    if (options.keepItClean) {
		var duplicate = duplicateElement(svg_el);
		duplicate.setAttribute("viewBox", "0 0 " + width + " " + height);
		duplicate.setAttribute("preserveAspectRation", "none");
		svg_el = duplicate;
	}
	
	// make sure required attributes are set
	svg_el.setAttribute("version", "1.1");
	svg_el.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	
	// set background
	if (options.fill) {
		// create background
		var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
		rect.setAttribute('width', '100%');
		rect.setAttribute('height', '100%');
		rect.setAttribute('fill', options.fill);
		if (svg_el.firstChild) {
			svg_el.insertBefore(rect, svg_el.firstChild);
		} else {
			svg_el.appendChild(rect);
		}
	}
	
	// apply the stylesheet to the svg to be sure to capture all of the stylings
	applyStylesheets(svg_el);
	rect.setAttribute('style', 'width:100% !important;height:100% !important');
	
    // grab the html from the svg and encode the svg in a data url
    var html = svg_el.outerHTML;
    var imgsrc = 'data:image/svg+xml;base64,' + btoa(html);
	
    // create a canvas element that has the right dimensions
    crowbar_el.innerHTML = (
        '<canvas width="' + width + '" height="' + height + '" style="width:' + width + 'px;height:' + height + 'px"></canvas>'
    )
    var canvas = crowbar_el.querySelector("canvas");
    var context = canvas.getContext("2d");
    var image = new Image;
    image.src = imgsrc;
    image.onload = function () {
        context.drawImage(image, 0, 0);
        var canvasdata = canvas.toDataURL("image/png");
        
		// download the data
        var a = document.createElement("a");
        a.download = filename;
        a.href = canvasdata;
        a.click();
		
		// remove temporary elements
		if (options.keepItClean && duplicate) {
			duplicate.remove();
		}
		crowbar_el.remove();
    };
	
	function insertAfter(newElement, afterElement) {
		if (afterElement.nextSibling) {
			afterElement.parentNode.insertBefore(newElement, afterElement.nextSibling);
		} else {
			afterElement.parentNode.appendChild(newElement);
		}
	}
	
	function duplicateElement(svgEl) {
		if (svgEl instanceof Element || svgEl instanceof HTMLDocument) {
			while (svgEl.nextElementSibling && svgEl.nextElementSibling.classList.contains("duplicate")) {
				svgEl.nextElementSibling.remove();
			}
			var clone = svgEl.cloneNode(true);
			clone.classList.add("duplicate");
			insertAfter(clone, svgEl);
			return clone;
		} else {
			return null;
		}
	}
	
    function applyStylesheets(svgEl) {
        // use an empty svg to compute the browser applied stylesheets
        var emptySvg = window.document.createElementNS("http://www.w3.org/2000/svg", 'svg');
        window.document.body.appendChild(emptySvg);
        var emptySvgDeclarationComputed = getComputedStyle(emptySvg);
        emptySvg.parentNode.removeChild(emptySvg);
		
        // traverse the element tree and explicitly set all stylesheet values
        // on an element. this is ripped from svg-crowbar
        var allElements = traverse(svgEl);
        var i = allElements.length;
        while (i--){
            explicitlySetStyle(allElements[i], emptySvgDeclarationComputed);
        }
    }
	
    function explicitlySetStyle (element, emptySvgDeclarationComputed) {
        var cSSStyleDeclarationComputed = getComputedStyle(element);
        var i, len, key, value;
        var computedStyleStr = "";
        for (i=0, len=cSSStyleDeclarationComputed.length; i<len; i++) {
            key=cSSStyleDeclarationComputed[i];
            value=cSSStyleDeclarationComputed.getPropertyValue(key);
            if (value!==emptySvgDeclarationComputed.getPropertyValue(key)) {
                computedStyleStr+=key+":"+value+";";
            }
        }
        element.setAttribute('style', computedStyleStr);
    }
	
    // traverse an svg and append all of the elements to the tree array. This
    // ignores some elements that can appear in <svg> elements but whose
    // children's styles should not be tweaked
    function traverse(obj) {
        var tree = [];
        var ignoreElements = {
            'script': undefined,
            'defs': undefined,
        };
        tree.push(obj);
        visit(obj);
        function visit(node) {
            if (node && node.hasChildNodes() && !(node.nodeName.toLowerCase() in ignoreElements)) {
                var child = node.firstChild;
                while (child) {
                    if (child.nodeType === 1) {
                        tree.push(child);
                        visit(child);
                    }
                    child = child.nextSibling;
                }
            }
        }
        return tree;
    }
}
//# sourceURL=svg-crowbar-expoort.js