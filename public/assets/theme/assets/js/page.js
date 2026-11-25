var oaES = /^es\b/i.test(document.documentElement.lang || '');
(function () {
  'use strict';

  function slugify(text) {
    var slug = (text || '').toLowerCase();
    if (slug.normalize) {
      slug = slug.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    }

    return slug
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 64);
  }

  function assignUniqueHeadingIds(headings) {
    var headingSet = new Set(headings);
    var used = new Set();

    document.querySelectorAll('[id]').forEach(function (element) {
      if (!headingSet.has(element) && element.id) {
        used.add(element.id);
      }
    });

    headings.forEach(function (heading, index) {
      var base = heading.id || slugify(heading.textContent) || 'section-' + (index + 1);
      var candidate = base;
      var suffix = 2;

      while (used.has(candidate)) {
        candidate = base + '-' + suffix;
        suffix += 1;
      }

      heading.id = candidate;
      heading.setAttribute('tabindex', '-1');
      used.add(candidate);
    });
  }

  function focusHashDestination() {
    if (!window.location.hash) {
      return;
    }

    var id;
    try {
      id = decodeURIComponent(window.location.hash.substring(1));
    } catch (error) {
      id = window.location.hash.substring(1);
    }

    var target = document.getElementById(id);
    if (target && target.matches('.page-content h2, .page-content h3')) {
      target.focus({ preventScroll: true });
    }
  }

  function buildTableOfContents(content, tocList) {
    var headings = Array.prototype.slice.call(content.querySelectorAll('h2, h3'));
    var tocNav = tocList.closest('.toc-container');

    if (!headings.length) {
      if (tocNav) {
        tocNav.hidden = true;
      }
      return;
    }

    assignUniqueHeadingIds(headings);
    var links = new Map();

    function setCurrent(id) {
      links.forEach(function (link, headingId) {
        var isCurrent = headingId === id;
        link.classList.toggle('active', isCurrent);
        if (isCurrent) {
          link.setAttribute('aria-current', 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    headings.forEach(function (heading) {
      var item = document.createElement('li');
      var link = document.createElement('a');
      var icon = document.createElement('i');

      link.href = '#' + heading.id;
      if (heading.tagName === 'H3') {
        link.classList.add('toc-subheading');
      }

      icon.className = heading.tagName === 'H3' ? 'fas fa-angle-double-right' : 'fas fa-angle-right';
      icon.setAttribute('aria-hidden', 'true');
      link.appendChild(icon);
      link.appendChild(document.createTextNode(heading.textContent.trim()));
      link.addEventListener('click', function () {
        setCurrent(heading.id);
        window.setTimeout(focusHashDestination, 0);
      });

      item.appendChild(link);
      tocList.appendChild(item);
      links.set(heading.id, link);
    });

    setCurrent(headings[0].id);

    if ('IntersectionObserver' in window) {
      var observer = null;
      var desktopToc = window.matchMedia('(min-width: 1024px)');

      var syncObserver = function () {
        if (!desktopToc.matches) {
          if (observer) {
            observer.disconnect();
            observer = null;
          }
          return;
        }

        if (observer) {
          return;
        }

        observer = new IntersectionObserver(function (entries) {
        var visible = entries
          .filter(function (entry) { return entry.isIntersecting; })
          .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });

        if (visible.length) {
          setCurrent(visible[0].target.id);
        }
        }, {
          rootMargin: '-120px 0px -65% 0px',
          threshold: [0, 1]
        });

        headings.forEach(function (heading) { observer.observe(heading); });
      };

      syncObserver();
      if (desktopToc.addEventListener) {
        desktopToc.addEventListener('change', syncObserver);
      } else if (desktopToc.addListener) {
        desktopToc.addListener(syncObserver);
      }
    }

    window.addEventListener('hashchange', focusHashDestination);
    window.setTimeout(focusHashDestination, 0);
  }

  function setupMobileToc(tocList) {
    var tocNav = tocList ? tocList.closest('.toc-container') : null;
    var toggle = tocNav ? tocNav.querySelector('.toc-toggle') : null;
    var panel = tocNav ? tocNav.querySelector('.nav-list-wrapper') : null;
    var mobileToc = window.matchMedia('(max-width: 1024px)');

    if (!tocNav || !toggle || !panel || tocNav.hidden) {
      return;
    }

    function setOpen(open) {
      tocNav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', (oaES ? (open ? 'Ocultar' : 'Mostrar') + ' los enlaces de esta página' : (open ? 'Hide' : 'Show') + ' on this page links'));
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      panel.toggleAttribute('inert', !open);
    }

    function syncTocMode() {
      var isMobile = mobileToc.matches;
      toggle.tabIndex = isMobile ? 0 : -1;
      setOpen(!isMobile);
    }

    toggle.addEventListener('click', function () {
      if (!mobileToc.matches) {
        return;
      }
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    tocList.addEventListener('click', function (event) {
      if (mobileToc.matches && event.target.closest('a')) {
        setOpen(false);
      }
    });

    syncTocMode();
    if (mobileToc.addEventListener) {
      mobileToc.addEventListener('change', syncTocMode);
    } else if (mobileToc.addListener) {
      mobileToc.addListener(syncTocMode);
    }
  }

  function prepareMobileCardTable(table, wrapper) {
    var headerRows = table.tHead ? table.tHead.rows : [];
    var bodyRows = table.tBodies.length ? Array.prototype.slice.call(table.tBodies[0].rows) : [];

    if (
      headerRows.length !== 1 ||
      table.tBodies.length !== 1 ||
      table.tFoot ||
      !bodyRows.length ||
      table.querySelector('tbody th, [rowspan]:not([rowspan="1"]), [colspan]:not([colspan="1"])')
    ) {
      return false;
    }

    var headers = Array.prototype.slice.call(headerRows[0].cells);
    if (headers.length < 2 || headers.length > 6) {
      return false;
    }

    var labels = headers.map(function (header) {
      return header.textContent.replace(/\s+/g, ' ').trim();
    });
    if (labels.some(function (label) { return !label; })) {
      return false;
    }

    if (bodyRows.some(function (row) { return row.cells.length !== labels.length; })) {
      return false;
    }

    bodyRows.forEach(function (row) {
      Array.prototype.forEach.call(row.cells, function (cell, cellIndex) {
        if (cell.querySelector(':scope > .pd-mobile-cell-label')) {
          return;
        }
        var label = document.createElement('span');
        label.className = 'pd-mobile-cell-label';
        label.setAttribute('aria-hidden', 'true');
        label.textContent = labels[cellIndex];
        cell.insertBefore(label, cell.firstChild);
      });
    });

    table.classList.add('pd-mobile-card-table');
    wrapper.classList.add('pd-mobile-card-region');
    return true;
  }

  function enhanceTables(content) {
    content.querySelectorAll('table').forEach(function (table, index) {
      table.querySelectorAll('thead th').forEach(function (header) {
        if (!header.hasAttribute('scope')) {
          header.setAttribute('scope', header.colSpan > 1 ? 'colgroup' : 'col');
        }
      });
      table.querySelectorAll('tbody th').forEach(function (header) {
        if (!header.hasAttribute('scope')) {
          header.setAttribute('scope', header.rowSpan > 1 ? 'rowgroup' : 'row');
        }
      });

      var wrapper = table.closest('.table-responsive, .table-scroll-wrapper');
      if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.className = 'table-scroll-wrapper';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }

      var caption = table.querySelector('caption');
      var label = caption && caption.textContent.trim()
        ? caption.textContent.trim()
        : (oaES ? 'Tabla de datos ' : 'Data table ') + (index + 1);

      wrapper.setAttribute('role', 'region');
      wrapper.setAttribute('aria-label', label);
      prepareMobileCardTable(table, wrapper);

      var updateKeyboardAccess = function () {
        if (wrapper.scrollWidth > wrapper.clientWidth + 1) {
          wrapper.setAttribute('tabindex', '0');
        } else {
          wrapper.removeAttribute('tabindex');
        }
      };

      updateKeyboardAccess();
      if ('ResizeObserver' in window) {
        new ResizeObserver(updateKeyboardAccess).observe(wrapper);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var content = document.querySelector('.page-content');
    if (!content || content.closest('[inert]')) {
      return;
    }

    content.querySelectorAll('i').forEach(function (icon) {
      icon.setAttribute('aria-hidden', 'true');
    });

    var tocList = document.getElementById('toc');
    if (tocList) {
      buildTableOfContents(content, tocList);
      setupMobileToc(tocList);
    }
    enhanceTables(content);
  });
})();
