(function () {
  "use strict";

  var drawerState = {
    open: false,
    returnFocus: null,
    hideTimer: 0
  };
  var drawerBackgroundState = [];

  function readConfig() {
    var node = document.getElementById("pd-header-config");
    if (!node) return {};

    try {
      return JSON.parse(node.textContent || "{}");
    } catch (error) {
      return {};
    }
  }

  function initHeader() {
    var config = readConfig();
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    applyNavigationRestrictions(config);
    setupDesktopDisclosures();
    setupPeptideFamilyDisclosures();
    setupMobileSubmenus();
    var resetMobileSearch = setupMobileNavigationSearch();
    setupMobileDrawer(config, reducedMotion, resetMobileSearch);
    setupReadingProgress();
    setupHeaderShadow();
  }

  function applyNavigationRestrictions(config) {
    var auth = window.pdAuth || {};
    var loggedIn = typeof auth.loggedIn === "boolean" ? auth.loggedIn : Boolean(config.loggedIn);
    var restrictions = Array.isArray(auth.restricted) ? auth.restricted : [];
    var blur = Number(auth.blurPx);

    if (Number.isFinite(blur) && blur > 0) {
      document.documentElement.style.setProperty("--pdcg-blur", Math.min(blur, 16) + "px");
    }

    if (loggedIn || !restrictions.length) return;

    var restrictionMap = new Map();
    restrictions.forEach(function (restriction) {
      if (!restriction || !restriction.url) return;
      restrictionMap.set(normalizeNavigationUrl(restriction.url, config), restriction);
    });

    document.querySelectorAll("[data-nav-url]").forEach(function (item) {
      var originalUrl = item.getAttribute("data-nav-url");
      var restriction = restrictionMap.get(normalizeNavigationUrl(originalUrl, config));
      var link = item.querySelector("a[href]");

      if (!restriction || !link) return;

      if (restriction.mode === "hide") {
        item.hidden = true;
        item.inert = true;
        item.setAttribute("aria-hidden", "true");
        return;
      }

      if (restriction.mode === "blur") {
        var label = (link.textContent || "Restricted page").trim();
        item.classList.add("nav-item-blurred");
        item.setAttribute("data-restricted-mode", "blur");
        link.href = buildLoginRedirect(auth.loginUrl || config.loginUrl, originalUrl, config);
        link.setAttribute("aria-label", label + ". Sign in to access this page.");
      }
    });

    document.querySelectorAll(".peptide-family-item.has-variants").forEach(function (family) {
      var variants = Array.prototype.slice.call(family.querySelectorAll(".peptide-variant-list > li[data-nav-url]"));
      var hasAvailableVariant = variants.some(function (variant) {
        return !variant.hidden && variant.getAttribute("aria-hidden") !== "true";
      });

      if (!hasAvailableVariant) {
        family.hidden = true;
        family.inert = true;
        family.setAttribute("aria-hidden", "true");
      }
    });
  }

  function normalizeNavigationUrl(value, config) {
    try {
      var home = new URL(config.homeUrl || document.documentElement.baseURI || window.location.origin, window.location.origin);
      var url = new URL(value, home);
      var path = decodeURIComponent(url.pathname).replace(/\/{2,}/g, "/").replace(/\/$/, "") || "/";
      var basePath = home.pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "");

      if (basePath && basePath !== "/" && (path === basePath || path.indexOf(basePath + "/") === 0)) {
        path = path.slice(basePath.length) || "/";
      }

      return path.toLowerCase();
    } catch (error) {
      return String(value || "").replace(/\/$/, "").toLowerCase();
    }
  }

  function buildLoginRedirect(loginUrl, destination, config) {
    try {
      var url = new URL(loginUrl || "/login/", config.homeUrl || window.location.origin);
      url.searchParams.set("redirect_to", destination);
      return url.toString();
    } catch (error) {
      return loginUrl || "/login/";
    }
  }

  function setupDesktopDisclosures() {
    var nav = document.querySelector(".main-nav");
    if (!nav) return;

    var items = Array.prototype.slice.call(nav.querySelectorAll(".main-nav-list > .has-dropdown"));

    function setExpanded(item, expanded) {
      var button = item.querySelector(":scope > .nav-caret");
      if (button) button.setAttribute("aria-expanded", expanded ? "true" : "false");
    }

    function closeItem(item, restoreFocus) {
      var button = item.querySelector(":scope > .nav-caret");
      item.classList.remove("dropdown-open");
      setExpanded(item, false);
      if (restoreFocus && button) button.focus();
      if (restoreFocus) item.classList.add("dropdown-suppressed");
    }

    function closeAll(except) {
      items.forEach(function (item) {
        if (item !== except) closeItem(item, false);
      });
    }

    items.forEach(function (item) {
      var button = item.querySelector(":scope > .nav-caret");
      if (!button) return;

      button.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        var willOpen = !item.classList.contains("dropdown-open");
        closeAll(item);
        item.classList.toggle("dropdown-open", willOpen);
        item.classList.toggle("dropdown-suppressed", !willOpen);
        setExpanded(item, willOpen);
      });

      item.addEventListener("mouseenter", function () {
        item.classList.remove("dropdown-suppressed");
        setExpanded(item, true);
      });

      item.addEventListener("mouseleave", function () {
        if (!item.classList.contains("dropdown-open")) setExpanded(item, false);
      });

      item.addEventListener("focusin", function () {
        setExpanded(item, true);
      });

      item.addEventListener("focusout", function () {
        window.setTimeout(function () {
          if (!item.contains(document.activeElement)) {
            closeItem(item, false);
            item.classList.remove("dropdown-suppressed");
          }
        }, 0);
      });
    });

    document.addEventListener("click", function (event) {
      if (!event.target.closest(".main-nav-list > .has-dropdown")) closeAll(null);
    });

    nav.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var item = event.target.closest(".main-nav-list > .has-dropdown");
      if (!item) return;
      event.preventDefault();
      closeItem(item, true);
    });
  }

  function setupPeptideFamilyDisclosures() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".peptide-family-toggle[aria-controls]"));

    function close(button, restoreFocus) {
      var list = document.getElementById(button.getAttribute("aria-controls"));
      if (list) list.hidden = true;
      button.classList.remove("family-open");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", button.getAttribute("aria-label").replace(/^Hide /, "Show "));
      if (restoreFocus) button.focus({ preventScroll: true });
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function (event) {
        var list = document.getElementById(button.getAttribute("aria-controls"));
        var menu = button.closest(".peptide-family-menu");
        if (!list || !menu) return;

        event.preventDefault();
        event.stopPropagation();

        var opening = list.hidden;
        Array.prototype.slice.call(menu.querySelectorAll(":scope > .peptide-family-item.has-variants > .peptide-family-toggle")).forEach(function (other) {
          if (other !== button) close(other, false);
        });

        list.hidden = !opening;
        button.classList.toggle("family-open", opening);
        button.setAttribute("aria-expanded", opening ? "true" : "false");
        button.setAttribute("aria-label", button.getAttribute("aria-label").replace(/^(Show|Hide) /, opening ? "Hide " : "Show "));
      });

      button.addEventListener("keydown", function (event) {
        if (event.key !== "Escape" || button.getAttribute("aria-expanded") !== "true") return;
        event.preventDefault();
        event.stopPropagation();
        close(button, true);
      });
    });
  }

  function setupMobileSubmenus() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll(".mobile-caret[aria-controls]"));

    function close(button) {
      var submenu = document.getElementById(button.getAttribute("aria-controls"));
      if (submenu) submenu.hidden = true;
      button.classList.remove("submenu-open");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", button.getAttribute("aria-label").replace(/^Hide /, "Show "));
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        var submenu = document.getElementById(button.getAttribute("aria-controls"));
        if (!submenu) return;

        var opening = submenu.hidden;
        buttons.forEach(function (other) {
          if (other !== button) close(other);
        });

        submenu.hidden = !opening;
        button.classList.toggle("submenu-open", opening);
        button.setAttribute("aria-expanded", opening ? "true" : "false");
        button.setAttribute("aria-label", button.getAttribute("aria-label").replace(/^(Show|Hide) /, opening ? "Hide " : "Show "));
      });
    });
  }

  function setupMobileNavigationSearch() {
    var input = document.getElementById("mobileNavSearch");
    var clearButton = document.getElementById("mobileNavSearchClear");
    var status = document.getElementById("mobileNavSearchStatus");
    var empty = document.getElementById("mobileNavSearchEmpty");
    var list = document.querySelector(".mobile-nav-list");
    var savedSubmenuStates = [];
    var searching = false;

    if (!input || !clearButton || !status || !empty || !list) return function () {};

    function normalize(value) {
      var text = String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
      return typeof text.normalize === "function" ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : text;
    }

    function saveSubmenuStates() {
      savedSubmenuStates = Array.prototype.slice.call(list.querySelectorAll(".mobile-caret[aria-controls], .mobile-peptide-family-toggle[aria-controls]")).map(function (button) {
        var submenu = document.getElementById(button.getAttribute("aria-controls"));
        return {
          button: button,
          submenu: submenu,
          hidden: submenu ? submenu.hidden : true,
          expanded: button.getAttribute("aria-expanded") || "false",
          label: button.getAttribute("aria-label") || ""
        };
      });
    }

    function setSearchExpanded(button, submenu, expanded) {
      if (!button || !submenu) return;
      submenu.hidden = !expanded;
      button.classList.toggle(button.classList.contains("mobile-peptide-family-toggle") ? "family-open" : "submenu-open", expanded);
      button.setAttribute("aria-expanded", expanded ? "true" : "false");
      button.setAttribute("aria-label", button.getAttribute("aria-label").replace(/^(Show|Hide) /, expanded ? "Hide " : "Show "));
    }

    function restore() {
      Array.prototype.slice.call(list.querySelectorAll(".mobile-search-hidden")).forEach(function (item) {
        item.classList.remove("mobile-search-hidden");
      });

      savedSubmenuStates.forEach(function (state) {
        if (!state.button || !state.submenu) return;
        state.submenu.hidden = state.hidden;
        state.button.classList.toggle(state.button.classList.contains("mobile-peptide-family-toggle") ? "family-open" : "submenu-open", state.expanded === "true");
        state.button.setAttribute("aria-expanded", state.expanded);
        state.button.setAttribute("aria-label", state.label);
      });

      savedSubmenuStates = [];
      searching = false;
    }

    function reset(options) {
      options = options || {};
      input.value = "";
      restore();
      clearButton.hidden = true;
      empty.hidden = true;
      status.textContent = "";
      if (options.focus) input.focus({ preventScroll: true });
    }

    function updateResults() {
      var query = normalize(input.value);

      if (!query) {
        reset();
        return;
      }

      if (!searching) {
        searching = true;
        saveSubmenuStates();
      }

      var matches = 0;
      var sections = Array.prototype.slice.call(list.children);

      sections.forEach(function (section) {
        if (section.classList.contains("mobile-cta-item")) {
          section.classList.add("mobile-search-hidden");
          return;
        }

        var rowLink = section.querySelector(":scope > .mobile-nav-row > a, :scope > a");
        var sectionMatches = rowLink ? normalize(rowLink.textContent).indexOf(query) !== -1 : false;
        var submenu = section.querySelector(":scope > .mobile-submenu");
        var button = section.querySelector(":scope > .mobile-nav-row > .mobile-caret");
        var childMatches = 0;

        if (submenu) {
          Array.prototype.slice.call(submenu.children).forEach(function (child) {
            var familyButton = child.querySelector(":scope > .mobile-peptide-family-toggle");
            var variantList = child.querySelector(":scope > .mobile-peptide-variant-list");

            if (familyButton && variantList) {
              var familyLabel = familyButton.querySelector(".nav-link-label");
              var familyText = normalize(familyLabel ? familyLabel.textContent : familyButton.textContent);
              var familyMatches = sectionMatches || familyText.indexOf(query) !== -1;
              var variantMatches = 0;

              Array.prototype.slice.call(variantList.children).forEach(function (variant) {
                var variantLink = variant.querySelector("a");
                var isAvailable = !variant.hidden && variant.getAttribute("aria-hidden") !== "true";
                var combinedText = normalize(familyText + " " + (variantLink ? variantLink.textContent : ""));
                var variantMatchesQuery = isAvailable && (familyMatches || combinedText.indexOf(query) !== -1);
                variant.classList.toggle("mobile-search-hidden", !variantMatchesQuery);
                if (variantMatchesQuery) variantMatches += 1;
              });

              var familyVisible = familyMatches || variantMatches > 0;
              child.classList.toggle("mobile-search-hidden", !familyVisible);
              setSearchExpanded(familyButton, variantList, familyVisible);
              if (familyVisible) childMatches += familyMatches ? 1 : variantMatches;
              return;
            }

            var childLink = child.querySelector(":scope > a");
            var isAvailable = !child.hidden && child.getAttribute("aria-hidden") !== "true";
            var childMatchesQuery = isAvailable && (sectionMatches || (childLink && normalize(childLink.textContent).indexOf(query) !== -1));
            child.classList.toggle("mobile-search-hidden", !childMatchesQuery);
            if (childMatchesQuery) childMatches += 1;
          });
        }

        var sectionVisible = sectionMatches || childMatches > 0;
        section.classList.toggle("mobile-search-hidden", !sectionVisible);
        if (sectionMatches) matches += 1;
        matches += childMatches;
        setSearchExpanded(button, submenu, childMatches > 0);
      });

      clearButton.hidden = false;
      empty.hidden = matches !== 0;
      status.textContent = matches === 1 ? "1 matching menu link." : matches + " matching menu links.";
    }

    input.addEventListener("input", updateResults);
    input.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || !input.value) return;
      event.preventDefault();
      event.stopPropagation();
      reset({ focus: true });
    });
    clearButton.addEventListener("click", function () { reset({ focus: true }); });

    return reset;
  }

  function setupMobileDrawer(config, reducedMotion, resetMobileSearch) {
    var button = document.getElementById("mobileHamburgerBtn");
    var panel = document.getElementById("mobileNavPanel");
    var overlay = document.getElementById("mobileOverlay");
    var closeButton = document.getElementById("mobileCloseBtn");

    if (!button || !panel || !overlay || !closeButton) return;

    function setBackgroundInert(inert) {
      if (inert) {
        drawerBackgroundState = [];
        Array.prototype.forEach.call(document.body.children, function (element) {
          if (element === panel || element === overlay || element.tagName === "SCRIPT" || element.tagName === "STYLE") return;
          drawerBackgroundState.push({
            element: element,
            hadInert: element.hasAttribute("inert"),
            ariaHidden: element.getAttribute("aria-hidden")
          });
          element.setAttribute("inert", "");
          element.setAttribute("aria-hidden", "true");
        });
        return;
      }

      drawerBackgroundState.forEach(function (state) {
        if (!state.hadInert) state.element.removeAttribute("inert");
        if (state.ariaHidden === null) state.element.removeAttribute("aria-hidden");
        else state.element.setAttribute("aria-hidden", state.ariaHidden);
      });
      drawerBackgroundState = [];
    }

    function finishClosing() {
      if (drawerState.open) return;
      panel.hidden = true;
      overlay.hidden = true;
      window.clearTimeout(drawerState.hideTimer);
    }

    function openDrawer() {
      if (drawerState.open || window.matchMedia("(min-width: 1025px)").matches) return;

      drawerState.open = true;
      drawerState.returnFocus = document.activeElement;
      window.clearTimeout(drawerState.hideTimer);
      panel.hidden = false;
      overlay.hidden = false;
      panel.inert = false;
      panel.setAttribute("aria-hidden", "false");
      button.setAttribute("aria-expanded", "true");
      button.setAttribute("aria-label", "Close navigation menu");
      button.classList.add("active");
      document.body.classList.add("mobile-menu-open");
      setBackgroundInert(true);

      window.requestAnimationFrame(function () {
        if (!drawerState.open) return;
        panel.classList.add("active");
        overlay.classList.add("active");
        closeButton.focus({ preventScroll: true });
      });
    }

    function closeDrawer(options) {
      options = options || {};
      if (!drawerState.open && panel.hidden) return;

      var focusTarget = drawerState.returnFocus;
      drawerState.open = false;

      if (typeof resetMobileSearch === "function") resetMobileSearch();
      setBackgroundInert(false);

      if (options.restoreFocus !== false && focusTarget && typeof focusTarget.focus === "function") {
        focusTarget.focus({ preventScroll: true });
      }

      panel.classList.remove("active");
      overlay.classList.remove("active");
      panel.inert = true;
      panel.setAttribute("aria-hidden", "true");
      button.classList.remove("active");
      button.setAttribute("aria-expanded", "false");
      button.setAttribute("aria-label", "Open navigation menu");
      document.body.classList.remove("mobile-menu-open");

      if (options.immediate || reducedMotion.matches) {
        finishClosing();
      } else {
        window.clearTimeout(drawerState.hideTimer);
        drawerState.hideTimer = window.setTimeout(finishClosing, Number(config.drawerTransitionMs) || 420);
      }
    }

    button.addEventListener("click", function () {
      if (drawerState.open) closeDrawer();
      else openDrawer();
    });
    closeButton.addEventListener("click", function () { closeDrawer(); });
    overlay.addEventListener("click", function () { closeDrawer(); });

    document.addEventListener("keydown", function (event) {
      if (!drawerState.open) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== "Tab") return;

      var focusable = getFocusableElements(panel);
      if (!focusable.length) {
        event.preventDefault();
        closeButton.focus();
        return;
      }

      var first = focusable[0];
      var last = focusable[focusable.length - 1];

      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    var desktopQuery = window.matchMedia("(min-width: 1025px)");
    var handleViewportChange = function (event) {
      if (event.matches && drawerState.open) closeDrawer({ restoreFocus: false, immediate: true });
    };

    if (typeof desktopQuery.addEventListener === "function") desktopQuery.addEventListener("change", handleViewportChange);
    else if (typeof desktopQuery.addListener === "function") desktopQuery.addListener(handleViewportChange);
  }

  function getFocusableElements(container) {
    var selector = "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";
    return Array.prototype.slice.call(container.querySelectorAll(selector)).filter(function (element) {
      return !element.closest("[hidden], [inert]") && element.getClientRects().length > 0;
    });
  }

  function setupReadingProgress() {
    var bar = document.getElementById("progressBar");
    if (!bar) return;

    var ticking = false;
    var update = function () {
      var root = document.documentElement;
      var range = Math.max(0, root.scrollHeight - root.clientHeight);
      var percent = range === 0 ? 100 : Math.min(100, Math.max(0, (window.scrollY / range) * 100));
      var rounded = Math.round(percent);
      bar.style.width = percent.toFixed(2) + "%";
      bar.setAttribute("aria-valuenow", String(rounded));
      ticking = false;
    };

    var requestUpdate = function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate, { passive: true });
    update();
  }

  function setupHeaderShadow() {
    var header = document.getElementById("siteHeader");
    if (!header) return;

    var ticking = false;
    var update = function () {
      header.classList.toggle("scrolled", window.scrollY > 10);
      ticking = false;
    };

    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeader, { once: true });
  } else {
    initHeader();
  }
})();
