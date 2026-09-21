(function () {
  "use strict";

  // Standard links remain the complete no-JavaScript interface.
  document.querySelectorAll(".publication-entry").forEach(function (entry) {
    var links = entry.querySelector(".publication-links");
    var main = entry.querySelector(".publication-main");
    if (!links || !main) return;

    var title = entry.querySelector(".publication-title").textContent.trim();
    var bibtexLink = entry.querySelector(".publication-bibtex");
    var status = document.createElement("p");
    status.className = "publication-copy-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.setAttribute("aria-atomic", "true");
    main.appendChild(status);

    var busy = false;
    var buttons = [];
    var fallback = null;
    var cachedBibtex = null;

    function clearFallback() {
      if (fallback) fallback.remove();
      fallback = null;
    }

    function legacyCopy(text) {
      var active = document.activeElement;
      var field = document.createElement("textarea");
      field.value = text;
      field.readOnly = true;
      field.setAttribute("aria-label", "Temporary copy field");
      field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
      document.body.appendChild(field);
      var copied = false;
      try {
        field.focus({ preventScroll: true });
        field.select();
        copied = document.execCommand("copy");
      } catch (_) {
        copied = false;
      } finally {
        field.remove();
        if (active && typeof active.focus === "function") {
          active.focus({ preventScroll: true });
        }
      }
      return copied;
    }

    function showManualCopy(text, label, button) {
      fallback = document.createElement("div");
      fallback.className = "publication-copy-fallback";
      var field = document.createElement("textarea");
      field.readOnly = true;
      field.value = text;
      field.rows = label === "BibTeX" ? 8 : 4;
      field.setAttribute("aria-label", label + " for " + title);
      var close = document.createElement("button");
      close.type = "button";
      close.className = "publication-copy";
      close.textContent = "Hide text";
      close.addEventListener("click", function () {
        clearFallback();
        status.textContent = "";
        button.focus();
      });
      fallback.appendChild(field);
      fallback.appendChild(close);
      main.appendChild(fallback);
      status.textContent = "Automatic copy is unavailable. Select and copy the " + label + " below.";
      field.focus({ preventScroll: true });
      field.select();
    }

    async function loadBibtex() {
      if (cachedBibtex !== null) return cachedBibtex;
      var url = new URL(bibtexLink.href, window.location.href);
      if (url.origin !== window.location.origin) throw new Error("Cross-origin BibTeX");
      var controller = new AbortController();
      var timeout = window.setTimeout(function () { controller.abort(); }, 10000);
      try {
        var response = await fetch(url.href, {
          credentials: "same-origin",
          signal: controller.signal
        });
        if (!response.ok) throw new Error("BibTeX request failed");
        var text = await response.text();
        // Reject an HTML error page served with a successful status.
        if (!/^\s*@\w+\s*[{(]/.test(text)) throw new Error("Invalid BibTeX response");
        cachedBibtex = text;
        return text;
      } finally {
        window.clearTimeout(timeout);
      }
    }

    function addCopyButton(label, getText) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "publication-copy";
      button.textContent = "Copy " + label;
      button.setAttribute("aria-label", "Copy " + label + " for " + title);
      button.addEventListener("click", async function () {
        // One operation per entry avoids rapid clicks racing to overwrite the clipboard.
        if (busy) return;
        busy = true;
        buttons.forEach(function (item) { item.setAttribute("aria-disabled", "true"); });
        links.setAttribute("aria-busy", "true");
        clearFallback();
        status.textContent = label === "BibTeX" ? "Loading BibTeX…" : "Copying citation…";
        try {
          var text;
          try {
            text = await getText();
          } catch (_) {
            status.textContent = "BibTeX could not be loaded. Use the BibTeX link to open or download it.";
            bibtexLink.focus({ preventScroll: true });
            return;
          }
          var copied = false;
          if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
            try {
              await navigator.clipboard.writeText(text);
              copied = true;
            } catch (_) {
              // Clipboard permissions and insecure contexts need a non-Clipboard API fallback.
            }
          }
          if (!copied) copied = legacyCopy(text);
          if (copied) {
            status.textContent = label === "BibTeX" ? "BibTeX copied." : "Citation copied.";
          } else {
            showManualCopy(text, label, button);
          }
        } finally {
          busy = false;
          buttons.forEach(function (item) { item.removeAttribute("aria-disabled"); });
          links.removeAttribute("aria-busy");
        }
      });
      buttons.push(button);
      links.appendChild(button);
    }

    if (entry.dataset.citation) {
      addCopyButton("citation", function () { return entry.dataset.citation; });
    }
    if (bibtexLink && typeof window.fetch === "function" && typeof window.AbortController === "function") {
      addCopyButton("BibTeX", loadBibtex);
    }
  });
}());
