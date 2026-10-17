export function initializeGuide(onViewChange = () => {}) {
  const page = document.getElementById('guide-page');
  if (!page) return;
  const mixer = document.querySelector('.app-shell');
  const title = document.title;
  let open = false, mixerScroll = 0;
  const navigate = () => {
    let anchor;
    try { anchor = decodeURIComponent(location.hash.slice(1)); } catch { anchor = ''; }
    const target = document.getElementById(anchor);
    const show = anchor === 'guide' || Boolean(target && page.contains(target));
    if (show !== open) {
      if (show) mixerScroll = window.scrollY;
      page.hidden = !show;
      mixer.hidden = show;
      document.documentElement.toggleAttribute('data-guide-open', show);
      document.title = show ? 'Hz Mixer Guide' : title;
      open = show;
      onViewChange(show);
      if (!show) {
        window.scrollTo(0, mixerScroll);
        document.getElementById('info-open').focus({ preventScroll: true });
      }
    }
    if (show) {
      const heading = target && page.contains(target) ? target : document.getElementById('guide-title');
      heading.focus({ preventScroll: true });
      if (anchor === 'guide') window.scrollTo(0, 0); else heading.scrollIntoView();
    }
  };
  window.addEventListener('hashchange', navigate);
  navigate();
}
