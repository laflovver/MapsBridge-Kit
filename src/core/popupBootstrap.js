(function () {
  "use strict";
  try {
    if (typeof location === "undefined" || !location.search) return;
    var p = new URLSearchParams(location.search);
    var s = p.get("sourceWin");
    if (s) {
      var n = parseInt(s, 10);
      if (!isNaN(n) && n > 0) {
        self.mapsbridgeSourceWindowId = n;
      }
    }
    if (location.search && location.search.indexOf("sourceWin=") >= 0) {
      try {
        history.replaceState(null, "", location.origin + location.pathname + location.hash);
      } catch (e2) {}
    }
  } catch (e) {}
})();
