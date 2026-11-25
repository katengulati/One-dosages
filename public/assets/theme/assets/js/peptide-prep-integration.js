(() => {
  'use strict';

  const mobileQuery = window.matchMedia('(max-width: 782px)');
  const launcherMobileQuery = window.matchMedia('(max-width: 760px)');

  const frameBody = (embed) => {
    try {
      return embed.querySelector('.pd-prep-embed__frame')?.contentDocument?.body || null;
    } catch (error) {
      return null;
    }
  };

  const syncFrameState = (embed) => {
    const body = frameBody(embed);
    const active = embed.classList.contains('is-immersive');
    const homeMobile = embed.dataset.peptidePrepMode === 'home' && launcherMobileQuery.matches;
    if (body) {
      body.classList.toggle('pd-prep-immersive', active);
      body.classList.toggle('pd-prep-home-mobile', homeMobile);
    }
    // Opaque nested previews cannot use contentDocument. Send UI state only;
    // the runtime validates the exact parent window, never a credential/token.
    try { embed.querySelector('.pd-prep-embed__frame')?.contentWindow?.postMessage({ source: 'pd-peptide-prep-host', event: 'immersive', active, homeMobile }, '*'); } catch (error) {}
  };

  const leaveImmersive = (embed, restoreFocus = true) => {
    if (!embed?.classList.contains('is-immersive')) return;
    embed.classList.remove('is-immersive');
    document.body.classList.remove('pd-prep-page-immersive');
    syncFrameState(embed);
    if (restoreFocus) {
      const frame = embed.querySelector('.pd-prep-embed__frame');
      frame?.focus({ preventScroll: true });
    }
  };

  const enterImmersive = (embed) => {
    if (!mobileQuery.matches || !embed) return;
    document.querySelectorAll('.pd-prep-embed.is-immersive').forEach((current) => {
      if (current !== embed) leaveImmersive(current, false);
    });
    embed.classList.add('is-immersive');
    document.body.classList.add('pd-prep-page-immersive');
    syncFrameState(embed);
    embed.querySelector('.pd-prep-embed__exit')?.focus({ preventScroll: true });
  };

  const prepareFrame = (embed) => {
    const frame = embed.querySelector('.pd-prep-embed__frame');
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      const mode = embed.dataset.peptidePrepMode || 'catalog';
      if (!doc?.head || !doc.body) {
        syncFrameState(embed);
        if (mode === 'catalog' && embed.closest('.pd-prep-page') && mobileQuery.matches && embed.dataset.pdPrepAutoImmersive !== 'done') {
          embed.dataset.pdPrepAutoImmersive = 'done'; enterImmersive(embed);
        }
        return;
      }
      doc.body.classList.add('pd-prep-runtime', `pd-prep-mode-${mode}`);
      const href = frame.dataset.runtimeCss;
      if (href && !doc.getElementById('pd-prep-theme-runtime')) {
        const link = doc.createElement('link');
        link.id = 'pd-prep-theme-runtime';
        link.rel = 'stylesheet';
        link.href = href;
        doc.head.appendChild(link);
      }
      syncFrameState(embed);
      if (doc.documentElement.dataset.pdPrepParentBound !== '1') {
        doc.documentElement.dataset.pdPrepParentBound = '1';
        doc.addEventListener('click', (event) => {
          if (event.target.closest('.vbtn')) enterImmersive(embed);
        }, true);
        doc.addEventListener('wheel', (event) => {
          if (mobileQuery.matches || embed.classList.contains('is-immersive') || event.ctrlKey || !event.deltaY) return;

          let current = event.target instanceof frame.contentWindow.Element ? event.target : null;
          let canScrollInside = false;
          while (current && current !== doc.body) {
            const style = frame.contentWindow.getComputedStyle(current);
            if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight + 1) {
              const hasRoom = event.deltaY > 0
                ? current.scrollTop + current.clientHeight < current.scrollHeight - 1
                : current.scrollTop > 1;
              if (hasRoom) {
                canScrollInside = true;
                break;
              }
            }
            current = current.parentElement;
          }

          if (!canScrollInside) {
            event.preventDefault();
            window.scrollBy({ top: event.deltaY, left: 0, behavior: 'auto' });
          }
        }, { passive: false });
      }

      const isStandaloneCatalog = mode === 'catalog' && Boolean(embed.closest('.pd-prep-page'));
      if (isStandaloneCatalog && mobileQuery.matches && embed.dataset.pdPrepAutoImmersive !== 'done') {
        embed.dataset.pdPrepAutoImmersive = 'done';
        enterImmersive(embed);
      }
    } catch (error) {
      /* The simulator is same-origin; fail quietly if a browser blocks frame access. */
    }
  };

  document.querySelectorAll('.pd-prep-embed').forEach((embed) => {
    const frame = embed.querySelector('.pd-prep-embed__frame');
    const exit = embed.querySelector('.pd-prep-embed__exit');
    frame?.addEventListener('load', () => prepareFrame(embed));
    if (frame?.contentDocument?.readyState === 'complete') prepareFrame(embed);
    exit?.addEventListener('click', () => leaveImmersive(embed));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const active = document.querySelector('.pd-prep-embed.is-immersive');
    if (active) {
      event.preventDefault();
      leaveImmersive(active);
    }
  });

  mobileQuery.addEventListener('change', (event) => {
    if (!event.matches) {
      document.querySelectorAll('.pd-prep-embed.is-immersive').forEach((embed) => leaveImmersive(embed, false));
    }
  });

  launcherMobileQuery.addEventListener('change', () => {
    document.querySelectorAll('.pd-prep-embed[data-peptide-prep-mode="home"]').forEach(syncFrameState);
  });

  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== 'pd-peptide-prep') return;
    document.querySelectorAll('.pd-prep-embed__frame').forEach((frame) => {
      if (frame.contentWindow !== event.source) return;
      const url = new URL(frame.src, window.location.href);
      if (url.origin !== window.location.origin || (event.origin !== url.origin && !(event.origin === 'null' && url.searchParams.get('pd_embed') === '1'))) return;
      if (event.data.event === 'launcher_layout') {
        const embed = frame.closest('.pd-prep-embed');
        const height = event.data.data?.height;
        if (embed?.dataset.peptidePrepMode !== 'home' || !Number.isFinite(height) || height < 0 || height > 6000) return;
        if (height && window.matchMedia('(max-width: 760px)').matches) {
          embed.style.setProperty('--pd-prep-launcher-height', `${Math.max(480, Math.ceil(height))}px`);
        } else {
          embed.style.removeProperty('--pd-prep-launcher-height');
        }
      }
      if (event.data.event === 'sim_start') enterImmersive(frame.closest('.pd-prep-embed'));
      if (event.data.event === 'frame_ready') syncFrameState(frame.closest('.pd-prep-embed'));
      if (event.data.event === 'sim_complete') frame.closest('.pd-prep-embed')?.classList.add('has-completed');
    });
  });
})();
