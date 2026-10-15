#!/usr/bin/env python3
"""Patch an admin/fragments/sites.fragment.html: regions loaded on demand.

Works on any version of the fragment holding the same three blocks (v4.0 and
the one of eostat-12m); keeps the BOM and CRLF line endings. Usage:

    python3 sites_regions.py <original> <patched>
"""
import sys
src, dst = sys.argv[1], sys.argv[2]
data = open(src, "rb").read()
bom = data.startswith(b"\xef\xbb\xbf")
crlf = b"\r\n" in data
s = data.decode("utf-8-sig").replace("\r\n", "\n")

old_get = """				cache: false,
				async: false,
				url  : baseApiUrl + "rois/countries","""
new_get = """				cache: false,
				url  : baseApiUrl + "rois/countries","""

old_start = """        // populating the continent, country and region fileds
		$.when(getRegions()).done(function (response) {
			if (response.status === responseStatus.success) {
				$("#div_addsite").data("retrivedRegions", response.data);
			} else {
				console.log(response.status + ": " + response.message);
			}
		});
		
"""
new_start = """        // the regions (countries with their geometries, about 4 MB) are only needed by
        // the Add new site dialog: requested at its first opening, then kept for the session
		function withRegions(callback) {
			if (!window.sitesRegionsRequest) {
				window.sitesRegionsRequest = getRegions().then(function (response) {
					if (response.status === responseStatus.success) {
						return response.data;
					}
					console.log(response.status + ": " + response.message);
					window.sitesRegionsRequest = null;
				}, function () {
					window.sitesRegionsRequest = null;
					return $.Deferred().resolve().promise();
				});
			}
			window.sitesRegionsRequest.done(callback);
		}
		
"""

old_click = """        $("input[name=addsite]").on("click", function (e) {
			// if retrive region wasn't success the roi selection section will be hidden
			if ( typeof $("#div_addsite").data("retrivedRegions") !== "undefined") {
				$(".roiRegionSelection", "#div_addsite").removeClass("hidden");
				populateCountry($("#div_addsite").data("retrivedRegions").regions, 1, "", "");
			} else {
				$(".roiRegionSelection", "#div_addsite").addClass("hidden");
			}
            openAddNewSiteDialog();
        });"""
new_click = """        $("input[name=addsite]").on("click", function (e) {
			var $button = $(this).prop("disabled", true);
			withRegions(function (regions) {
				$button.prop("disabled", false);
				// if retrive region wasn't success the roi selection section will be hidden
				if (typeof regions !== "undefined") {
					$("#div_addsite").data("retrivedRegions", regions);
					$(".roiRegionSelection", "#div_addsite").removeClass("hidden");
					populateCountry(regions.regions, 1, "", "");
				} else {
					$(".roiRegionSelection", "#div_addsite").addClass("hidden");
				}
				openAddNewSiteDialog();
			});
        });"""

for a, b in ((old_get, new_get), (old_start, new_start), (old_click, new_click)):
    n = s.count(a)
    if n != 1:
        sys.exit("bloc introuvable ou ambigu (%d) : %r" % (n, a[:70]))
    s = s.replace(a, b)
if crlf:
    s = s.replace("\n", "\r\n")
out = s.encode("utf-8")
if bom:
    out = b"\xef\xbb\xbf" + out
open(dst, "wb").write(out)
print("ok", dst, "BOM" if bom else "", "CRLF" if crlf else "LF")
