document.addEventListener('DOMContentLoaded', function() {

  function normalizeExternalHost(host) {
    return String(host || '').toLowerCase().replace(/^www\./, '');
  }

  function getExternalRel(host, existingRel) {
    var tokens = String(existingRel || '').toLowerCase().split(/\s+/).filter(Boolean);
    var preserved = tokens.filter(function(token) {
      return token !== 'nofollow' && token !== 'sponsored' && token !== 'noopener' && token !== 'noreferrer';
    });
    if (preserved.indexOf('ugc') !== -1) {
      preserved.push('nofollow');
    }
    preserved.push('noopener');
    return Array.from(new Set(preserved)).join(' ');
  }

  // ============================================================
  // CITATIONS & REFERENCES SYSTEM
  // Handles TWO article formats:
  //   Format A (BPC-157 style): plain <span>N</span> inline + "Works cited" <ol>
  //   Format B (AOD-9604 style): <a href="URL">[N]</a> inline + flat citation block
  // ============================================================

  // ----------------------------------------------------------
  // STEP 1: PROCESS "WORKS CITED" <ol> (Format A only)
  // Detects "Works cited" heading + <ol>, builds card-style UI.
  // Returns true if found, false otherwise.
  // ----------------------------------------------------------
  function processWorksCited() {
    var postContent = document.querySelector('.post-content');
    if (!postContent) return false;
    var plpIsNewFormat = postContent.getAttribute('data-plp-format') === 'new';

    var worksCitedHeading = null;
    postContent.querySelectorAll('h2, h3, h4').forEach(function(h) {
      var text = h.textContent.trim().toLowerCase();
      if (text === 'works cited' || text === 'references' || text === 'sources' || text === 'bibliography') {
        worksCitedHeading = h;
      }
    });
    if (!worksCitedHeading) return false;

    var disclosure = worksCitedHeading.closest('details.oa-citations');
    var refList = disclosure ? disclosure.querySelector('ol') : worksCitedHeading.nextElementSibling;
    while (refList && refList.tagName !== 'OL') { refList = refList.nextElementSibling; }
    if (!refList) return false;

    // Parse each <li> into structured data
    var items = refList.querySelectorAll('li');
    var refs = [];
    items.forEach(function(li, index) {
      var num = index + 1;

      // NEW FORMAT: first external (http) link + descriptive linked title
      // (e.g. <strong><a>Paper Title</a></strong>), with the legacy parse as fallback.
      if (plpIsNewFormat) {
        var nlink = li.querySelector('a[href^="http"]') || li.querySelector('a');
        var nurl = nlink ? nlink.href : '';
        var ndomain = '';
        if (nurl) { try { ndomain = new URL(nurl).hostname.replace('www.', ''); } catch(e) {} }
        var ntitle = '';
        if (nlink) {
          var lt = (nlink.textContent || '').trim();
          if (lt.length > 3 && !/^\d+$/.test(lt) && !/^https?:\/\//i.test(lt) && !/^10\.\d{4,}/.test(lt)) ntitle = lt;
        }
        if (!ntitle) {
          var nft = li.textContent.trim();
          var nai = nft.indexOf(', accessed');
          if (nai > 0) { ntitle = nft.substring(0, nai).trim(); }
          else if (nurl) { var nui = nft.indexOf('http'); if (nui > 0) ntitle = nft.substring(0, nui).replace(/,\s*$/, '').trim(); }
        }
        if ((!ntitle || /^accessed\s/i.test(ntitle)) && ndomain) { ntitle = getTitleFromDomain(ndomain); }
        else if (!ntitle) { ntitle = 'Reference ' + num; }
        refs.push({ num: num, title: ntitle, url: nurl, domain: ndomain });
        return;
      }

      // LEGACY: unchanged from the original template.
      var link = li.querySelector('a');
      var url = link ? link.href : '';
      var domain = '';
      if (url) { try { domain = new URL(url).hostname.replace('www.', ''); } catch(e) {} }

      var fullText = li.textContent.trim();
      var title = '';
      var accessedIdx = fullText.indexOf(', accessed');
      if (accessedIdx > 0) { title = fullText.substring(0, accessedIdx).trim(); }
      else if (url) { var urlIdx = fullText.indexOf('http'); if (urlIdx > 0) title = fullText.substring(0, urlIdx).replace(/,\s*$/, '').trim(); }
      if ((!title || /^accessed\s/i.test(title)) && domain) { title = getTitleFromDomain(domain); }
      else if (!title) { title = 'Reference ' + num; }

      refs.push({ num: num, title: title, url: url, domain: domain });
    });

    // Build card-style HTML
    var cardsHtml = '<div class="auto-references-section works-cited-section">';
    cardsHtml += '<h2><i aria-hidden="true" class="fas fa-book-open"></i> References</h2>';
    cardsHtml += '<div class="auto-reference-list">';
    refs.forEach(function(ref) {
      cardsHtml += '<div class="auto-reference-item" id="ref-' + ref.num + '" tabindex="-1">';
      cardsHtml += '<div class="auto-reference-content"><div class="auto-reference-title">' + ref.title + '</div>';
      if (ref.domain) cardsHtml += '<div class="auto-reference-domain"><i aria-hidden="true" class="fas fa-globe"></i>' + ref.domain + '</div>';
      cardsHtml += '</div><div class="auto-reference-right">';
      if (ref.url) {
        var relAttr = getExternalRel(ref.domain, '');
        cardsHtml += '<a href="' + ref.url + '" target="_blank" rel="' + relAttr + '" class="auto-reference-button"><i aria-hidden="true" class="fas fa-external-link-alt"></i>View Source</a>';
      }
      cardsHtml += '<div class="auto-reference-numbers">' + ref.num + '</div></div></div>';
    });
    cardsHtml += '</div></div>';

    if (disclosure) {
      refList.insertAdjacentHTML('beforebegin', cardsHtml);
      disclosure.querySelector('.auto-references-section > h2').remove();
    } else {
      worksCitedHeading.insertAdjacentHTML('beforebegin', cardsHtml);
      worksCitedHeading.remove();
    }
    refList.remove();
    return true;
  }

  // ----------------------------------------------------------
  // STEP 2: CLEANUP - Always runs
  // Removes PUBLISHING FIELDS + any flat citation block after it
  // ----------------------------------------------------------
  function cleanupBottomSections() {
    var postContent = document.querySelector('.post-content');
    if (!postContent) return;

    // Find PUBLISHING FIELDS heading
    var pubHeading = null;
    postContent.querySelectorAll('h2, h3, h4').forEach(function(h) {
      if (h.textContent.trim().toUpperCase() === 'PUBLISHING FIELDS') pubHeading = h;
    });

    if (pubHeading) {
      // Step 1: Remove the <ul> immediately after PUBLISHING FIELDS (SEO fields)
      var nextEl = pubHeading.nextElementSibling;
      if (nextEl && nextEl.tagName === 'UL') nextEl.remove();

      // Step 2: Remove remaining flat citation block nodes after the heading
      // These are loose <a>, text nodes, <br> etc. NOT wrapped in headings/sections
      var toRemove = [];
      var sibling = pubHeading.nextSibling;
      while (sibling) {
        if (sibling.nodeType === 1) {
          // Stop at any structural element that isn't part of the citation block
          var tag = sibling.tagName;
          if (tag && /^(H[1-6]|ARTICLE|SECTION|NAV|FOOTER|ASIDE)$/i.test(tag)) break;
          if (sibling.classList && (sibling.classList.contains('auto-references-section') || sibling.classList.contains('works-cited-section') || sibling.classList.contains('post-navigation'))) break;
        }
        toRemove.push(sibling);
        sibling = sibling.nextSibling;
      }
      for (var i = 0; i < toRemove.length; i++) {
        try { toRemove[i].parentNode.removeChild(toRemove[i]); } catch(e) {}
      }
      try { pubHeading.remove(); } catch(e) {}
    }

    // Remove stray source-list divs
    postContent.querySelectorAll('.source-list').forEach(function(div) { try { div.remove(); } catch(e) {} });

    // ---- Format B fallback: remove trailing flat citation block ----
    // When there's no PUBLISHING FIELDS heading, the flat citation block
    // (clusters of [N] links + bare URLs) sits at the bottom of .post-content.
    // Scan children from the end and remove any that look like citation-block nodes.
    function isCitationBlockNode(node) {
      if (node.nodeType === 3) {
        // Text node: remove if it's only whitespace or a bare URL
        var t = node.textContent.trim();
        return t === '' || /^https?:\/\/\S+$/.test(t);
      }
      if (node.nodeType !== 1) return true; // comments etc.
      var tag = node.tagName;
      // Skip the styled references section and navigation
      if (node.classList && (node.classList.contains('auto-references-section') || node.classList.contains('works-cited-section') || node.classList.contains('post-navigation'))) return false;
      // A <p> is a citation-block paragraph if its content is mostly [N] links and/or bare URLs
      if (tag === 'P') {
        var text = node.textContent.trim();
        // Empty or &nbsp;-only paragraphs
        if (text === '' || text === '\u00a0') return true;
        // Check: does this paragraph contain [N]-style citation links?
        var bracketLinks = node.querySelectorAll('a');
        var hasBracketCites = false;
        var hasBareUrls = false;
        bracketLinks.forEach(function(a) {
          if (/^\[\d+\]$/.test(a.textContent.trim())) hasBracketCites = true;
          if (/^https?:\/\//.test(a.textContent.trim())) hasBareUrls = true;
        });
        // Also check for bare URL text outside links
        if (/https?:\/\/\S+/.test(text)) hasBareUrls = true;
        // It's a citation block paragraph if it has bracket citations or is just a URL display
        if (hasBracketCites) return true;
        // A paragraph that is ONLY a URL (no other meaningful text)
        if (hasBareUrls && text.replace(/https?:\/\/\S+/g, '').replace(/\[\d+\]/g, '').trim().length === 0) return true;
        return false;
      }
      // Bare <a> tags or <br> outside paragraphs
      if (tag === 'A' || tag === 'BR') {
        if (tag === 'A') {
          var lt = node.textContent.trim();
          if (/^\[\d+\]$/.test(lt) || /^https?:\/\//.test(lt)) return true;
        }
        return tag === 'BR';
      }
      return false;
    }

    // Walk backward from the last child of .post-content
    var children = postContent.childNodes;
    var removeFromBottom = [];
    for (var j = children.length - 1; j >= 0; j--) {
      var child = children[j];
      if (isCitationBlockNode(child)) {
        removeFromBottom.push(child);
      } else {
        // Stop as soon as we hit real content
        break;
      }
    }
    for (var k = 0; k < removeFromBottom.length; k++) {
      try { removeFromBottom[k].parentNode.removeChild(removeFromBottom[k]); } catch(e) {}
    }
  }

  // ----------------------------------------------------------
  // STEP 3: CONVERT PLAIN-TEXT CITATION NUMBERS (Format A)
  // Finds a span containing only a 1-2 digit number and makes it a citation link.
  // ----------------------------------------------------------
  function convertInlineCitations() {
    var postContent = document.querySelector('.post-content');
    if (!postContent) return;

    var toReplace = [];
    postContent.querySelectorAll('span').forEach(function(span) {
      var text = span.textContent.trim();
      if (/^\d{1,2}$/.test(text)) {
        if (span.closest('.works-cited-section,.auto-references-section,a,table,th,td,h1,h2,h3,h4,h5,h6')) return;
        if (span.children.length > 0) return;
        toReplace.push({ span: span, num: parseInt(text) });
      }
    });

    toReplace.forEach(function(item) {
      if (!document.getElementById('ref-' + item.num)) return;
      var link = document.createElement('a');
      link.href = '#ref-' + item.num;
      link.className = 'inline-citation';
      link.textContent = item.num;
      link.title = 'Jump to reference ' + item.num;
      attachCitationScroll(link, item.num);
      item.span.parentNode.replaceChild(link, item.span);
    });
  }

  // ----------------------------------------------------------
  // STEP 4: CONVERT BRACKET [N] CITATION LINKS (Format B)
  // Finds a bracketed citation link and converts it to a styled superscript.
  // to the matching reference card. Must run AFTER generateReferences.
  // ----------------------------------------------------------
  function convertBracketCitations() {
    var postContent = document.querySelector('.post-content');
    if (!postContent) return;

    postContent.querySelectorAll('a').forEach(function(link) {
      var text = link.textContent.trim();
      var match = text.match(/^\[(\d+)\]$/);
      if (!match) return;
      // Skip links already inside the references section
      if (link.closest('.auto-references-section,.works-cited-section')) return;

      var num = match[1];
      // Preserve the original destination if no bibliography entry exists.
      if (!document.getElementById('ref-' + num)) return;
      link.href = '#ref-' + num;
      link.className = 'inline-citation';
      link.textContent = num;
      link.title = 'Jump to reference ' + num;
      link.removeAttribute('target');
      link.removeAttribute('rel');
      attachCitationScroll(link, num);
    });
  }

  // ----------------------------------------------------------
  // STEP 5: AUTO-GENERATE REFERENCES (Format B fallback)
  // Scans [N] links, builds card-style reference list with IDs.
  // Only runs if no Works Cited <ol> was found.
  // ----------------------------------------------------------
  function formatReferenceNumbers(numbers) {
    if (!numbers || numbers.length === 0) return '';
    numbers.sort(function(a, b) { return a - b; });
    var ranges = [], start = numbers[0], end = numbers[0];
    for (var i = 1; i < numbers.length; i++) {
      if (numbers[i] === end + 1) { end = numbers[i]; }
      else { ranges.push(start === end ? start.toString() : (end - start === 1 ? start + ', ' + end : start + '\u2013' + end)); start = numbers[i]; end = numbers[i]; }
    }
    ranges.push(start === end ? start.toString() : (end - start === 1 ? start + ', ' + end : start + '\u2013' + end));
    var result = ranges.join(', ');
    return (result.length > 50 && ranges.length > 3) ? ranges.slice(0, 3).join(', ') + '...' : result;
  }

  function generateReferences() {
    if (document.querySelector('.works-cited-section')) return;
    var postContent = document.querySelector('.post-content');
    if (!postContent) return;
    var refs = {}, order = [];
    postContent.querySelectorAll('a').forEach(function(link) {
      try {
        var text = link.textContent.trim(), url = link.href;
        if (!url || !url.startsWith('http') || url.startsWith('#') || url.startsWith('javascript:')) return;
        var linkUrl = new URL(url);
        var m = text.match(/^\[(\d+)\]$/);
        var internal = linkUrl.hostname.replace('www.','') === window.location.hostname.replace('www.','');
        // Numbered internal references are real citations too. Omitting them
        // here while converting their inline links created dead #ref-N links.
        // Ordinary related-reading links must not become bibliography cards.
        if (internal && !m) return;
        var norm = url.replace(/\/$/, '').split('#')[0].replace(/\?utm_source=[^&]*/,'');
        var domain = linkUrl.hostname.replace('www.','');
        if (m) {
          var n = parseInt(m[1]);
          if (!refs[norm]) { refs[norm] = { numbers: [n], url: url, domain: domain, title: internal ? 'Peptide Dosages' : getTitleFromDomain(linkUrl.hostname), type: 'numbered' }; order.push(norm); }
          else if (!refs[norm].numbers.includes(n)) { refs[norm].numbers.push(n); }
        } else if (text.length > 0 && text.length < 80 && !text.toLowerCase().includes('click here') && !text.toLowerCase().includes('read more') && !/^https?:\/\//.test(text)) {
          if (!refs[norm]) { refs[norm] = { url: url, domain: domain, title: getTitleFromDomain(linkUrl.hostname), linkTexts: new Set([text]), type: 'descriptive' }; order.push(norm); }
          else if (refs[norm].linkTexts) { refs[norm].linkTexts.add(text); }
        }
      } catch(e) { /* skip malformed URLs */ }
    });
    Object.values(refs).forEach(function(r) { if (r.type === 'numbered') r.numbers.sort(function(a,b){return a-b}); else if (r.linkTexts) r.displayText = Array.from(r.linkTexts).join(', '); });
    var numbered = order.filter(function(u){return refs[u].type==='numbered'}).sort(function(a,b){return (refs[a].numbers[0]||0)-(refs[b].numbers[0]||0)});
    var descriptive = order.filter(function(u){return refs[u].type==='descriptive'});
    if (numbered.length > 0 || descriptive.length > 0) {
      var html = '<div class="auto-references-section"><h2><i aria-hidden="true" class="fas fa-book-open"></i> References</h2><div class="auto-reference-list">';
      numbered.concat(descriptive).forEach(function(u) {
        var r = refs[u];
        // Build anchor IDs for all citation numbers pointing to this card
        var anchorIds = '';
        if (r.type === 'numbered' && r.numbers.length > 0) {
          r.numbers.forEach(function(n) { anchorIds += '<span id="ref-' + n + '" class="citation-anchor" tabindex="-1"></span>'; });
        }
        html += '<div class="auto-reference-item" tabindex="-1">' + anchorIds;
        html += '<div class="auto-reference-content"><div class="auto-reference-title">' + r.title + '</div><div class="auto-reference-domain"><i aria-hidden="true" class="fas fa-globe"></i>' + r.domain + '</div></div>';
        html += '<div class="auto-reference-right">';
        if (r.type === 'numbered') html += '<div class="auto-reference-numbers">' + formatReferenceNumbers(r.numbers) + '</div>';
        else if (r.displayText) html += '<div class="auto-reference-numbers auto-reference-label">' + r.displayText + '</div>';
        var autoRelAttr = getExternalRel(r.domain, '');
        html += '<a href="' + r.url + '" target="_blank" rel="' + autoRelAttr + '" class="auto-reference-button"><i aria-hidden="true" class="fas fa-external-link-alt"></i>View Source</a></div></div>';
      });
      html += '</div></div>';
      var transparency = document.querySelector('.pd-editorial-transparency');
      var nav = document.querySelector('.post-navigation');
      if (transparency) transparency.insertAdjacentHTML('beforebegin', html);
      else if (nav) nav.insertAdjacentHTML('beforebegin', html);
      else postContent.insertAdjacentHTML('afterend', html);
    }
  }

  function getTitleFromDomain(e) {
    var t = {"ncbi.nlm.nih.gov":"NCBI","pmc.ncbi.nlm.nih.gov":"PubMed Central","pubmed.ncbi.nlm.nih.gov":"PubMed","clevelandclinic.org":"Cleveland Clinic","webmd.com":"WebMD","medicalnewstoday.com":"Medical News Today","healthline.com":"Healthline","nature.com":"Nature","sciencedirect.com":"ScienceDirect","nejm.org":"NEJM","bmj.com":"The BMJ","thelancet.com":"The Lancet","nih.gov":"NIH","cdc.gov":"CDC","who.int":"WHO","mayoclinic.org":"Mayo Clinic","hopkinsmedicine.org":"Johns Hopkins Medicine","mdpi.com":"MDPI","wiley.com":"Wiley","wikipedia.org":"Wikipedia","en.wikipedia.org":"Wikipedia","frontiersin.org":"Frontiers","researchgate.net":"ResearchGate","journals.physiology.org":"Journal of Applied Physiology","examine.com":"Examine.com","jofem.org":"Journal of Endocrinology and Metabolism","fda.gov":"U.S. Food and Drug Administration","accessdata.fda.gov":"FDA Drug Labels","wada-ama.org":"World Anti-Doping Agency","icc-cricket.com":"ICC","globalrph.com":"GlobalRPH","rupahealth.com":"Rupa Health","academic.oup.com":"Oxford Academic","law.cornell.edu":"Cornell Law Institute","pi.lilly.com":"Eli Lilly Prescribing Info","emdserono.com":"EMD Serono","opss.org":"Operation Supplement Safety","federalregister.gov":"Federal Register"};
    var n = e.replace('www.','');
    return t[n] || n.charAt(0).toUpperCase() + n.slice(1).replace(/\.[a-z]+$/, '');
  }

  // ============================================================
  // New-format helpers are invoked only for data-plp-format="new" posts.
  // Defining them is harmless for legacy; the executor never calls them there.
  // ============================================================

  // Preserve native hash navigation, then move focus for keyboard and screen-reader users.
  function attachCitationScroll(link, num) {
    link.addEventListener('click', function() {
      var target = document.getElementById('ref-' + num);
      if (!target) return;
      target.setAttribute('tabindex', '-1');
      window.setTimeout(function() {
        target.focus({ preventScroll: true });
        target.classList.add('citation-target-highlight');
        window.setTimeout(function() {
          target.classList.remove('citation-target-highlight');
        }, 2000);
      }, 0);
    });
  }

  // First mention in the new format is a bare-number link <a href="http...">N</a>.
  // Convert to a superscript that jumps to #ref-N. PMIDs (3+ digits) won't match.
  function convertNumberLinkCitations() {
    var postContent = document.querySelector('.post-content');
    if (!postContent) return;
    postContent.querySelectorAll('a').forEach(function(link) {
      var text = (link.textContent || '').trim();
      if (!/^\d{1,2}$/.test(text)) return;
      var href = link.getAttribute('href') || '';
      if (!/^https?:\/\//i.test(href)) return;
      if (link.closest('.auto-references-section,.works-cited-section,h1,h2,h3,h4,h5,h6')) return;
      var num = text;
      if (!document.getElementById('ref-' + num)) return;
      link.href = '#ref-' + num;
      link.className = 'inline-citation';
      link.title = 'Jump to reference ' + num;
      link.removeAttribute('target');
      link.removeAttribute('rel');
      attachCitationScroll(link, num);
    });
  }

  // Repeat mentions in the new format are plain text [N] (no link), incl. in table
  // cells. Walk text nodes and convert each to a superscript jumping to #ref-N.
  function convertPlainBracketCitations() {
    var postContent = document.querySelector('.post-content');
    if (!postContent) return;
    var walker = document.createTreeWalker(postContent, NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        if (!node.nodeValue || node.nodeValue.indexOf('[') === -1) return NodeFilter.FILTER_REJECT;
        if (!/\[\d{1,3}\]/.test(node.nodeValue)) return NodeFilter.FILTER_REJECT;
        var p = node.parentNode;
        if (p && p.closest && p.closest('a,code,pre,h1,h2,h3,h4,h5,h6,.auto-references-section,.works-cited-section')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var targets = [], nd;
    while ((nd = walker.nextNode())) { targets.push(nd); }
    targets.forEach(function(node) {
      var parts = node.nodeValue.split(/(\[\d{1,3}\])/);
      if (parts.length < 2) return;
      var frag = document.createDocumentFragment();
      parts.forEach(function(part) {
        var m = part.match(/^\[(\d{1,3})\]$/);
        if (m && document.getElementById('ref-' + m[1])) {
          var num = m[1];
          var a = document.createElement('a');
          a.href = '#ref-' + num;
          a.className = 'inline-citation';
          a.textContent = num;
          a.title = 'Jump to reference ' + num;
          attachCitationScroll(a, num);
          frag.appendChild(a);
        } else if (part) {
          frag.appendChild(document.createTextNode(part));
        }
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  // Client safety net backing up the server-side strip (new-format posts only).
  // Removes each internal-section <h2> through the next <h2>.
  function stripInternalSections() {
    var postContent = document.querySelector('.post-content');
    if (!postContent) return;
    var INTERNAL = ['INFOGRAPHIC BRIEFS', 'PUBLISHING FIELDS', 'INTERNAL LINKING PLAN', 'EDITORIAL QA', 'INTERNAL KEYWORD HANDLING LOG'];
    Array.prototype.slice.call(postContent.querySelectorAll('h2')).forEach(function(h2) {
      var label = (h2.textContent || '').trim().toUpperCase();
      if (INTERNAL.indexOf(label) === -1) return;
      var sib = h2.nextElementSibling, toRemove = [];
      while (sib && sib.tagName !== 'H2') { toRemove.push(sib); sib = sib.nextElementSibling; }
      toRemove.forEach(function(el) { try { el.remove(); } catch(e) {} });
      try { h2.remove(); } catch(e) {}
    });
  }

  // ============================================================
  // EXECUTE IN ORDER (each step wrapped in try/catch to prevent
  // one failure from killing TOC, progress bar, etc.)
  // ============================================================

  // NEW: read the server-set format flag (absent on legacy posts).
  var plpPostContent = document.querySelector('.post-content');
  var plpIsNew = !!(plpPostContent && plpPostContent.getAttribute('data-plp-format') === 'new');

  // 0. New format only: retain the internal-section safety net.
  if (plpIsNew) {
    try { stripInternalSections(); } catch(e) { console.warn('stripInternalSections error:', e); }
  }

  // 1. Process "Works cited" <ol> if it exists (Format A)
  var hasWorksCited = false;
  try { hasWorksCited = processWorksCited(); } catch(e) { console.warn('processWorksCited error:', e); }

  // 2. Auto-generate reference cards from [N] links (Format B)
  //    Must run BEFORE cleanup so it can scan all links including flat citation block
  try { if (!hasWorksCited) { generateReferences(); } } catch(e) { console.warn('generateReferences error:', e); }

  // 3. Clean up PUBLISHING FIELDS + flat citation block (always, AFTER refs are built)
  try { cleanupBottomSections(); } catch(e) { console.warn('cleanupBottomSections error:', e); }

  // 3b. New format only: convert bare-number links and plain citations (Format C).
  if (plpIsNew) {
    try { convertNumberLinkCitations(); } catch(e) { console.warn('convertNumberLinkCitations error:', e); }
    try { convertPlainBracketCitations(); } catch(e) { console.warn('convertPlainBracketCitations error:', e); }
  }

  // 4. Convert [N] bracket links to scrollable superscripts (Format B)
  try { convertBracketCitations(); } catch(e) { console.warn('convertBracketCitations error:', e); }

  // 5. Convert plain <span> number citations to scrollable superscripts (Format A)
  try { convertInlineCitations(); } catch(e) { console.warn('convertInlineCitations error:', e); }

  document.querySelectorAll('.auto-references-section').forEach(function (section) {
    if (section.closest('details')) return;
    var heading = section.querySelector('h2');
    if (!heading) return;
    var details = document.createElement('details');
    details.className = 'oa-citations';
    var summary = document.createElement('summary');
    section.before(details);
    details.append(summary, section);
    summary.append(heading);
  });

  // 6. Follow editorial sources while retaining legitimate user-generated link labels.
  try {
    document.querySelectorAll('.post-content a[href^="http"], .auto-references-section a[href^="http"], .works-cited-section a[href^="http"]').forEach(function(link) {
      try {
        var linkHost = normalizeExternalHost(new URL(link.href).hostname);
        if (linkHost !== normalizeExternalHost(window.location.hostname)) {
          link.setAttribute('rel', getExternalRel(linkHost, link.getAttribute('rel')));
          if (!link.getAttribute('target')) link.setAttribute('target', '_blank');
        }
      } catch(e) {}
    });
  } catch(e) { console.warn('external link relationship pass error:', e); }

  // Checkbox list items
  document.querySelectorAll('.post-content ul li').forEach(function(item) {
    var html = item.innerHTML, text = item.textContent.trim();
    if (text.startsWith('[ ]') || text.startsWith('[x]') || text.startsWith('[X]')) {
      item.classList.add('checkbox-item');
      if (text.startsWith('[x]') || text.startsWith('[X]')) item.classList.add('checked');
      item.innerHTML = html.replace(/^\s*\[[\sx]\]\s*/i, '');
    }
  });

  // Accessible TOC, one consolidated viewport update, and table enhancements.
  var postContent = document.querySelector('.post-content');
  if (postContent) {
    postContent.querySelectorAll('i').forEach(function(icon) {
      icon.setAttribute('aria-hidden', 'true');
    });
  }
  var tocList = document.getElementById('toc');
  var tocNav = tocList ? tocList.closest('.toc-container') : null;
  var progressBar = document.getElementById('readingProgress');
  var article = document.querySelector('.single-post-content');
  var headings = postContent ? Array.prototype.slice.call(postContent.querySelectorAll('h1, h2, h3')) : [];
  var tocLinks = new Map();
  var desktopToc = window.matchMedia('(min-width: 1025px)');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var viewportTicking = false;

  function slugify(text) {
    var slug = (text || '').toLowerCase();
    if (slug.normalize) {
      slug = slug.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
    }
    return slug.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 64);
  }

  function assignUniqueHeadingIds(items) {
    var headingSet = new Set(items);
    var used = new Set();
    document.querySelectorAll('[id]').forEach(function(element) {
      if (!headingSet.has(element) && element.id) used.add(element.id);
    });

    items.forEach(function(heading, index) {
      var base = heading.id || slugify(heading.textContent) || 'article-section-' + (index + 1);
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

  function setCurrentTocItem(id, reveal) {
    tocLinks.forEach(function(link, headingId) {
      var current = headingId === id;
      link.classList.toggle('active', current);
      if (current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');

      if (current && reveal && desktopToc.matches) {
        var navWrapper = link.closest('.nav-list-wrapper');
        if (navWrapper) {
          var top = link.offsetTop;
          var bottom = top + link.offsetHeight;
          if (top < navWrapper.scrollTop || bottom > navWrapper.scrollTop + navWrapper.clientHeight) {
            navWrapper.scrollTo({
              top: Math.max(0, top - navWrapper.clientHeight / 2 + link.offsetHeight / 2),
              behavior: reduceMotion.matches ? 'auto' : 'smooth'
            });
          }
        }
      }
    });
  }

  function focusHashDestination() {
    if (!window.location.hash) return;
    var id;
    try {
      id = decodeURIComponent(window.location.hash.substring(1));
    } catch (error) {
      id = window.location.hash.substring(1);
    }
    var target = document.getElementById(id);
    if (target && target.matches('.post-content h1, .post-content h2, .post-content h3, .auto-reference-item, .citation-anchor')) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  }

  if (tocList && headings.length) {
    assignUniqueHeadingIds(headings);
    headings.forEach(function(heading) {
      var item = document.createElement('li');
      var link = document.createElement('a');
      var icon = document.createElement('i');
      link.href = '#' + heading.id;
      link.className = 'nav-link';
      if (heading.tagName === 'H3') link.classList.add('toc-subheading');
      icon.className = heading.tagName === 'H1'
        ? 'fas fa-chevron-right'
        : (heading.tagName === 'H3' ? 'fas fa-angle-double-right' : 'fas fa-angle-right');
      icon.setAttribute('aria-hidden', 'true');
      link.appendChild(icon);
      link.appendChild(document.createTextNode(heading.textContent.replace(/^[^\w]+/, '').trim()));
      link.addEventListener('click', function() {
        setCurrentTocItem(heading.id, false);
        window.setTimeout(focusHashDestination, 0);
      });
      item.appendChild(link);
      tocList.appendChild(item);
      tocLinks.set(heading.id, link);
    });
    setCurrentTocItem(headings[0].id, false);
    window.addEventListener('hashchange', focusHashDestination);
    window.setTimeout(focusHashDestination, 0);
  } else if (tocNav) {
    tocNav.hidden = true;
  }

  function setupMobileToc() {
    var toggle = tocNav ? tocNav.querySelector('.toc-toggle') : null;
    var panel = tocNav ? tocNav.querySelector('.nav-list-wrapper') : null;
    var mobileToc = window.matchMedia('(max-width: 1024px)');

    if (!tocNav || !toggle || !panel || tocNav.hidden) return;

    function setOpen(open) {
      tocNav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.setAttribute('aria-label', (open ? 'Hide' : 'Show') + ' on this page links');
      panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      panel.toggleAttribute('inert', !open);
    }

    function syncTocMode() {
      var isMobile = mobileToc.matches;
      toggle.tabIndex = isMobile ? 0 : -1;
      setOpen(!isMobile);
    }

    toggle.addEventListener('click', function() {
      if (!mobileToc.matches) return;
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    tocList.addEventListener('click', function(event) {
      if (mobileToc.matches && event.target.closest('a')) setOpen(false);
    });

    syncTocMode();
    if (mobileToc.addEventListener) mobileToc.addEventListener('change', syncTocMode);
    else if (mobileToc.addListener) mobileToc.addListener(syncTocMode);
  }

  setupMobileToc();

  function updateViewportFeatures() {
    viewportTicking = false;

    if (progressBar && article) {
      var articleTop = article.getBoundingClientRect().top + window.scrollY;
      var progress = Math.max(0, Math.min(1, ((window.scrollY - articleTop + window.innerHeight) / article.offsetHeight)));
      progressBar.style.transform = 'scaleX(' + progress + ')';
    }

    if (desktopToc.matches && headings.length) {
      var current = headings[0].id;
      headings.forEach(function(heading) {
        if (heading.getBoundingClientRect().top < 150) current = heading.id;
      });
      setCurrentTocItem(current, true);
    }
  }

  function requestViewportUpdate() {
    if (viewportTicking) return;
    viewportTicking = true;
    window.requestAnimationFrame(updateViewportFeatures);
  }

  window.addEventListener('scroll', requestViewportUpdate, { passive: true });
  window.addEventListener('resize', requestViewportUpdate);
  if (desktopToc.addEventListener) desktopToc.addEventListener('change', requestViewportUpdate);
  else if (desktopToc.addListener) desktopToc.addListener(requestViewportUpdate);
  requestViewportUpdate();

  function closestHeadingForTable(table) {
    var candidates = postContent ? postContent.querySelectorAll('h1, h2, h3, h4, h5, h6') : [];
    var closest = null;
    Array.prototype.forEach.call(candidates, function(heading) {
      if (heading.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING) closest = heading;
    });
    return closest;
  }

  function tableLabel(table, index) {
    var caption = table.querySelector('caption');
    if (caption && caption.textContent.trim()) return caption.textContent.trim();
    var heading = closestHeadingForTable(table);
    if (heading && heading.textContent.trim()) return heading.textContent.trim() + ' table';
    return 'Data table ' + (index + 1);
  }

  function prepareMobileCardTable(table, scrollRegion) {
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
    if (headers.length < 2 || headers.length > 6) return false;

    var labels = headers.map(function(header) {
      return header.textContent.replace(/\s+/g, ' ').trim();
    });
    if (labels.some(function(label) { return !label; })) return false;
    if (bodyRows.some(function(row) { return row.cells.length !== labels.length; })) return false;

    bodyRows.forEach(function(row) {
      Array.prototype.forEach.call(row.cells, function(cell, cellIndex) {
        if (cell.querySelector(':scope > .pd-mobile-cell-label')) return;
        var label = document.createElement('span');
        label.className = 'pd-mobile-cell-label';
        label.setAttribute('aria-hidden', 'true');
        label.textContent = labels[cellIndex];
        cell.insertBefore(label, cell.firstChild);
      });
    });

    table.classList.add('pd-mobile-card-table');
    scrollRegion.classList.add('pd-mobile-card-region');
    return true;
  }

  var tableDialog = null;
  var dialogTitle = null;
  var dialogTableContainer = null;
  var dialogDimensions = null;
  var dialogClose = null;
  var lastDialogTrigger = null;
  var backgroundState = [];
  var previousBodyOverflow = '';

  function createTableDialog() {
    var dialog = document.createElement('div');
    dialog.id = 'pd-table-dialog';
    dialog.className = 'table-lightbox';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'pd-table-dialog-title');
    dialog.setAttribute('aria-describedby', 'pd-table-dialog-info');
    dialog.setAttribute('tabindex', '-1');
    dialog.hidden = true;
    dialog.innerHTML =
      '<div class="lightbox-content" role="document">' +
        '<div class="lightbox-header">' +
          '<h2 class="lightbox-title" id="pd-table-dialog-title"><i class="fas fa-table" aria-hidden="true"></i><span>Table View</span></h2>' +
          '<button type="button" class="close-lightbox"><i class="fas fa-times" aria-hidden="true"></i> Close</button>' +
        '</div>' +
        '<div class="lightbox-table-container" role="region" tabindex="0" aria-label="Full table view"></div>' +
        '<div class="lightbox-info" id="pd-table-dialog-info">' +
          '<span><i class="fas fa-th" aria-hidden="true"></i><span class="table-dimensions"></span></span>' +
          '<span><i class="fas fa-keyboard" aria-hidden="true"></i>Use arrow keys or swipe to scroll</span>' +
        '</div>' +
      '</div>' +
      '<div class="keyboard-hint" aria-hidden="true">Press Escape to close</div>';

    document.body.appendChild(dialog);
    dialogTitle = dialog.querySelector('.lightbox-title span');
    dialogTableContainer = dialog.querySelector('.lightbox-table-container');
    dialogDimensions = dialog.querySelector('.table-dimensions');
    dialogClose = dialog.querySelector('.close-lightbox');

    dialogClose.addEventListener('click', closeTableDialog);
    dialog.addEventListener('click', function(event) {
      if (event.target === dialog) closeTableDialog();
    });
    dialog.addEventListener('keydown', trapDialogFocus);
    return dialog;
  }

  function setBackgroundInert(inert) {
    if (inert) {
      backgroundState = [];
      Array.prototype.forEach.call(document.body.children, function(element) {
        if (element === tableDialog) return;
        backgroundState.push({
          element: element,
          hadInert: element.hasAttribute('inert'),
          ariaHidden: element.getAttribute('aria-hidden')
        });
        element.setAttribute('inert', '');
        element.setAttribute('aria-hidden', 'true');
      });
      return;
    }

    backgroundState.forEach(function(state) {
      if (!state.hadInert) state.element.removeAttribute('inert');
      if (state.ariaHidden === null) state.element.removeAttribute('aria-hidden');
      else state.element.setAttribute('aria-hidden', state.ariaHidden);
    });
    backgroundState = [];
  }

  function dialogFocusableElements() {
    return Array.prototype.slice.call(tableDialog.querySelectorAll(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    )).filter(function(element) {
      return !element.hasAttribute('hidden');
    });
  }

  function trapDialogFocus(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeTableDialog();
      return;
    }
    if (event.key !== 'Tab') return;

    var focusable = dialogFocusableElements();
    if (!focusable.length) {
      event.preventDefault();
      tableDialog.focus();
      return;
    }

    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function cloneTableWithUniqueIds(table, index) {
    var clone = table.cloneNode(true);
    var idMap = {};
    var elements = [clone].concat(Array.prototype.slice.call(clone.querySelectorAll('[id]')));
    elements.forEach(function(element) {
      if (!element.id) return;
      var oldId = element.id;
      var newId = 'dialog-table-' + (index + 1) + '-' + oldId;
      idMap[oldId] = newId;
      element.id = newId;
    });

    clone.querySelectorAll('[headers], [aria-labelledby], [aria-describedby]').forEach(function(element) {
      ['headers', 'aria-labelledby', 'aria-describedby'].forEach(function(attribute) {
        if (!element.hasAttribute(attribute)) return;
        var updated = element.getAttribute(attribute).split(/\s+/).map(function(id) {
          return idMap[id] || id;
        }).join(' ');
        element.setAttribute(attribute, updated);
      });
    });
    return clone;
  }

  function openTableDialog(table, index, trigger) {
    if (!tableDialog) tableDialog = createTableDialog();
    lastDialogTrigger = trigger;
    var label = tableLabel(table, index);
    var clone = cloneTableWithUniqueIds(table, index);
    dialogTitle.textContent = label;
    dialogDimensions.textContent = table.rows.length + ' rows × ' + (table.rows[0] ? table.rows[0].cells.length : 0) + ' columns';
    dialogTableContainer.setAttribute('aria-label', label + ', full view');
    dialogTableContainer.replaceChildren(clone);
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    tableDialog.hidden = false;
    tableDialog.classList.add('active');
    dialogClose.focus();
    setBackgroundInert(true);
  }

  function closeTableDialog() {
    if (!tableDialog || tableDialog.hidden || tableDialog.classList.contains('closing')) return;
    tableDialog.classList.add('closing');

    var finish = function() {
      tableDialog.classList.remove('active', 'closing');
      setBackgroundInert(false);
      tableDialog.hidden = true;
      dialogTableContainer.replaceChildren();
      document.body.style.overflow = previousBodyOverflow;
      if (lastDialogTrigger && document.contains(lastDialogTrigger)) lastDialogTrigger.focus();
      lastDialogTrigger = null;
    };

    if (reduceMotion.matches) finish();
    else window.setTimeout(finish, 300);
  }

  function enhanceTables() {
    if (!postContent) return;
    var tables = postContent.querySelectorAll('table');
    tables.forEach(function(table, index) {
      table.querySelectorAll('thead th').forEach(function(header) {
        if (!header.hasAttribute('scope')) header.setAttribute('scope', header.colSpan > 1 ? 'colgroup' : 'col');
      });
      table.querySelectorAll('tbody th').forEach(function(header) {
        if (!header.hasAttribute('scope')) header.setAttribute('scope', header.rowSpan > 1 ? 'rowgroup' : 'row');
      });

      var label = tableLabel(table, index);
      var scrollRegion = table.closest('.table-scroll-wrapper, .table-responsive, .wp-block-table');
      if (!scrollRegion) {
        scrollRegion = document.createElement('div');
        scrollRegion.className = 'table-scroll-wrapper table-scroll-region';
        table.parentNode.insertBefore(scrollRegion, table);
        scrollRegion.appendChild(table);
      } else {
        scrollRegion.classList.add('table-scroll-region');
      }
      scrollRegion.setAttribute('role', 'region');
      scrollRegion.setAttribute('aria-label', label);
      prepareMobileCardTable(table, scrollRegion);

      var updateKeyboardAccess = function() {
        if (scrollRegion.scrollWidth > scrollRegion.clientWidth + 1) scrollRegion.setAttribute('tabindex', '0');
        else scrollRegion.removeAttribute('tabindex');
      };
      updateKeyboardAccess();
      if ('ResizeObserver' in window) new ResizeObserver(updateKeyboardAccess).observe(scrollRegion);

      if (table.rows.length < 3 && table.rows[0] && table.rows[0].cells.length < 3) return;
      if (!tableDialog) tableDialog = createTableDialog();
      var outer = document.createElement('div');
      outer.className = 'table-container-wrapper';
      scrollRegion.parentNode.insertBefore(outer, scrollRegion);
      outer.appendChild(scrollRegion);

      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'table-expand-btn';
      button.setAttribute('aria-haspopup', 'dialog');
      button.setAttribute('aria-controls', 'pd-table-dialog');
      button.setAttribute('aria-label', 'Open full view of ' + label);
      button.innerHTML = '<i class="fas fa-expand" aria-hidden="true"></i> Full View';
      button.addEventListener('click', function() {
        openTableDialog(table, index, button);
      });
      outer.appendChild(button);
    });
  }

  var imageDialog = null;
  var imageDialogPicture = null;
  var imageDialogCaption = null;
  var imageDialogClose = null;
  var imageDialogTrigger = null;
  var imageBackgroundState = [];
  var imageBodyOverflow = '';

  function setImageBackgroundInert(inert) {
    if (inert) {
      imageBackgroundState = [];
      Array.prototype.forEach.call(document.body.children, function(element) {
        if (element === imageDialog) return;
        imageBackgroundState.push({
          element: element,
          hadInert: element.hasAttribute('inert'),
          ariaHidden: element.getAttribute('aria-hidden')
        });
        element.setAttribute('inert', '');
        element.setAttribute('aria-hidden', 'true');
      });
      return;
    }

    imageBackgroundState.forEach(function(state) {
      if (!state.hadInert) state.element.removeAttribute('inert');
      if (state.ariaHidden === null) state.element.removeAttribute('aria-hidden');
      else state.element.setAttribute('aria-hidden', state.ariaHidden);
    });
    imageBackgroundState = [];
  }

  function closeImageDialog() {
    if (!imageDialog || imageDialog.hidden) return;
    imageDialog.classList.remove('active');
    setImageBackgroundInert(false);
    imageDialog.hidden = true;
    imageDialogPicture.removeAttribute('src');
    document.body.style.overflow = imageBodyOverflow;
    if (imageDialogTrigger && document.contains(imageDialogTrigger)) imageDialogTrigger.focus();
    imageDialogTrigger = null;
  }

  function createImageDialog() {
    var dialog = document.createElement('div');
    dialog.className = 'pd-image-lightbox';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-label', 'Expanded article image');
    dialog.setAttribute('aria-describedby', 'pd-image-lightbox-caption');
    dialog.setAttribute('tabindex', '-1');
    dialog.hidden = true;
    dialog.innerHTML =
      '<div class="pd-image-lightbox__content">' +
        '<button type="button" class="pd-image-lightbox__close"><i class="fas fa-times" aria-hidden="true"></i> Close</button>' +
        '<div class="oa-article-visual"><img class="pd-image-lightbox__image" alt=""></div>' +
        '<p class="pd-image-lightbox__caption" id="pd-image-lightbox-caption"></p>' +
      '</div>';

    document.body.appendChild(dialog);
    imageDialogPicture = dialog.querySelector('.pd-image-lightbox__image');
    imageDialogCaption = dialog.querySelector('.pd-image-lightbox__caption');
    imageDialogClose = dialog.querySelector('.pd-image-lightbox__close');
    imageDialogClose.addEventListener('click', closeImageDialog);
    dialog.addEventListener('click', function(event) {
      if (event.target === dialog) closeImageDialog();
    });
    dialog.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeImageDialog();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        imageDialogClose.focus();
      }
    });
    return dialog;
  }

  function openImageDialog(image, trigger) {
    if (!imageDialog) imageDialog = createImageDialog();
    imageDialogTrigger = trigger;
    var description = (image.getAttribute('alt') || '').trim() || 'Article infographic';
    var source = image.getAttribute('data-large-file') || image.getAttribute('data-orig-file') || image.currentSrc || image.src;
    imageDialogPicture.src = source;
    imageDialogPicture.alt = description;
    var illustration = image.closest('.oa-article-visual');
    var display = imageDialogPicture.parentElement;
    display.querySelectorAll('.oa-article-mark').forEach(function(mark) { mark.remove(); });
    if (illustration) {
      illustration.querySelectorAll('.oa-article-mark').forEach(function(mark) {
        display.appendChild(mark.cloneNode(true));
      });
    }
    imageDialogCaption.textContent = description;
    imageBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    imageDialog.hidden = false;
    imageDialog.classList.add('active');
    setImageBackgroundInert(true);
    imageDialogClose.focus();
  }

  function enhanceInfographics() {
    if (!postContent || !window.matchMedia('(max-width: 1024px)').matches) return;
    postContent.querySelectorAll('img').forEach(function(image) {
      var isArticleGraphic = image.closest('figure, .wp-block-image, .wp-caption') ||
        /(^|\s)wp-image-\d+(\s|$)/.test(image.className || '') ||
        image.parentElement === postContent;
      var declaredWidth = parseInt(image.getAttribute('width') || '0', 10);

      if (
        !isArticleGraphic ||
        (declaredWidth > 0 && declaredWidth < 480) ||
        image.closest('a, button, picture, table, .auto-references-section, .works-cited-section') ||
        image.classList.contains('emoji')
      ) {
        return;
      }

      var trigger = document.createElement('button');
      var description = (image.getAttribute('alt') || '').trim();
      trigger.type = 'button';
      trigger.className = 'pd-image-zoom-trigger';
      trigger.setAttribute('aria-label', description ? 'Enlarge image: ' + description : 'Enlarge article image');
      image.parentNode.insertBefore(trigger, image);
      trigger.appendChild(image);
      trigger.addEventListener('click', function() {
        openImageDialog(image, trigger);
      });
    });
  }

  enhanceTables();
  enhanceInfographics();
  document.querySelectorAll('.auto-references-section i, .works-cited-section i, .toc-container i, .post-navigation i').forEach(function(icon) {
    icon.setAttribute('aria-hidden', 'true');
  });
});
