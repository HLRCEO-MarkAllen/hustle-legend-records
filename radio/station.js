(() => {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  const $ = (id) => document.getElementById(id);
  const queueEl = $('queue');
  const nowTitle = $('nowTitle');
  const nowArtist = $('nowArtist');
  const nowNote = $('nowNote');
  const storyLink = $('storyLink');
  const nextTrack = $('nextTrack');
  const playDirect = $('playDirect');
  const directWrap = $('directWrap');
  const directPlayer = $('directPlayer');
  const spotifyFallback = $('spotifyFallback');
  const sourceBadge = $('sourceBadge');
  const sourceNote = $('sourceNote');
  const rotationLabel = $('rotationLabel');
  const clock = $('clock');
  const blockName = $('blockName');
  const copyLink = $('copyLink');

  const state = {
    config: null,
    catalog: null,
    tracks: [],
    currentIndex: 0,
    directReady: false,
    directPlaying: false
  };

  const notes = {
    '5-years-later': 'The comeback opens here: five missing years become the first chapter of the record.',
    karma: 'Separation, fatherhood and closure make this one of the catalog’s deepest relationship records.',
    'rare-breed': 'A survivor-identity record built around independence, resilience and wordplay.',
    'hood-fam': 'Loyalty, chosen family and belonging when home has never been simple.',
    'blacked-out-memories': 'Memory, alcohol and the attempt to numb what still follows you.',
    'bite-my-tongue': 'The point where self-censorship stops being part of the deal.',
    'got-a-problem': 'Confrontation and feature chemistry turn pressure into an answer record.',
    'deja-vu': 'A memory-loop record that works as a replay doorway deeper into B2BAL.',
    loser: 'A challenge over who gets to define value when a label sticks long enough to become a fight.',
    'king-cobra': 'Battle rap used as confrontation, boundary and ownership argument.',
    'kiss-my-ass': 'An early influence circles back into the comeback era.',
    'all-alone': 'Isolation and scars become documentation instead of background noise.',
    rowdy: 'The HLR manifesto: independence and ownership turned into swagger.',
    'started-this-war': 'Conflict meets team history and collaboration.',
    'told-u': 'A delayed collaboration finally becomes part of the catalog.',
    'my-angel': 'Fatherhood and vulnerability change the emotional temperature.',
    dreams: 'Peace, ambition and ownership become a future-facing chapter.',
    'who-i-am': 'Self-definition without asking permission.',
    'truth-bomb': 'The late-album pressure release that leads directly into the closer.',
    sos: 'The closing chapter of Born 2 Be A Legend and a reaction-video favorite.'
  };

  const roles = {
    '5-years-later': 'Origin / comeback', karma: 'Relationship / retention', 'rare-breed': 'Identity / discovery',
    'hood-fam': 'Family / loyalty', 'blacked-out-memories': 'Memory / survival', 'bite-my-tongue': 'Expression / conflict',
    'got-a-problem': 'Confrontation', 'deja-vu': 'Replay / memory', loser: 'Value / identity', 'king-cobra': 'Battle / boundary',
    'kiss-my-ass': 'Full-circle feature', 'all-alone': 'Isolation / survival', rowdy: 'Ownership / manifesto',
    'started-this-war': 'Conflict / team', 'told-u': 'Collaboration', 'my-angel': 'Fatherhood / vulnerability',
    dreams: 'Future / ownership', 'who-i-am': 'Self-definition', 'truth-bomb': 'Late-album sequence', sos: 'Album closer'
  };

  function getSavedIndex(length) {
    const saved = Number(localStorage.getItem('hlr-radio-index'));
    return Number.isInteger(saved) && saved >= 0 && saved < length ? saved : 0;
  }

  function getCentralHour() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: state.config?.timezone || 'America/Chicago', hour: '2-digit', hour12: false
    }).formatToParts(new Date());
    return Number(parts.find((p) => p.type === 'hour')?.value || 0);
  }

  function currentBlock() {
    const hour = getCentralHour();
    if (hour < 8) return 'After Hours';
    if (hour < 16) return 'Legend Rotation';
    if (hour < 21) return 'Independent Drive';
    return 'DJ / Story Hours';
  }

  function updateClock() {
    const timezone = state.config?.timezone || 'America/Chicago';
    if (clock) {
      clock.textContent = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit'
      }).format(new Date());
    }
    const block = currentBlock();
    if (blockName) blockName.textContent = block;
    if (rotationLabel) rotationLabel.textContent = block.toUpperCase();
  }

  function sourceUrl(track) {
    if (!state.config?.directFeedEnabled) return null;
    if (!track?.streamPath) return null;
    return track.streamPath;
  }

  async function probeDirectSource(track) {
    const url = sourceUrl(track);
    if (!url) return false;
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      return response.ok;
    } catch {
      return false;
    }
  }

  function logHistory(track) {
    try {
      const history = JSON.parse(localStorage.getItem('hlr-radio-history') || '[]');
      const next = [{ title: track.title, slug: track.slug, story: track.story, at: Date.now() },
        ...history.filter((item) => item.slug !== track.slug)].slice(0, 10);
      localStorage.setItem('hlr-radio-history', JSON.stringify(next));
    } catch {}
  }

  function renderQueue() {
    if (!queueEl) return;
    queueEl.innerHTML = '';
    state.tracks.forEach((track, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'track' + (index === state.currentIndex ? ' active' : '');
      card.setAttribute('aria-label', `Program ${track.title}`);
      card.innerHTML = `<div class="trackIndex">TRACK ${String(track.position).padStart(2, '0')}</div><div class="trackName">${track.title}</div><div class="trackRole">${roles[track.slug] || 'B2BAL rotation'}</div>`;
      card.addEventListener('click', () => setTrack(index, true));
      queueEl.appendChild(card);
    });
  }

  async function setTrack(index, userInitiated = false) {
    if (!state.tracks.length) return;
    state.currentIndex = (index + state.tracks.length) % state.tracks.length;
    const track = state.tracks[state.currentIndex];
    localStorage.setItem('hlr-radio-index', String(state.currentIndex));
    logHistory(track);

    if (nowTitle) nowTitle.textContent = track.title;
    if (nowArtist) nowArtist.textContent = `${state.catalog.artist} · ${state.catalog.album}`;
    if (nowNote) nowNote.textContent = notes[track.slug] || 'Part of the Born 2 Be A Legend station rotation.';
    if (storyLink) storyLink.href = track.story;
    renderQueue();

    state.directReady = await probeDirectSource(track);
    const url = sourceUrl(track);
    if (state.directReady && url) {
      if (directPlayer) directPlayer.src = url;
      if (directWrap) directWrap.hidden = false;
      if (playDirect) playDirect.hidden = false;
      if (sourceBadge) {
        sourceBadge.textContent = 'HLR DIRECT';
        sourceBadge.classList.add('ready');
      }
      if (sourceNote) sourceNote.textContent = 'Direct HLR-hosted radio copy available. Sales-quality files and masters remain private.';
      if (spotifyFallback) spotifyFallback.hidden = true;
      if (userInitiated && state.directPlaying) {
        directPlayer.play().catch(() => {});
      }
    } else {
      state.directPlaying = false;
      if (directPlayer) {
        directPlayer.pause();
        directPlayer.removeAttribute('src');
        directPlayer.load();
      }
      if (directWrap) directWrap.hidden = true;
      if (playDirect) playDirect.hidden = true;
      if (sourceBadge) {
        sourceBadge.textContent = 'SPOTIFY FALLBACK';
        sourceBadge.classList.remove('ready');
      }
      if (sourceNote) sourceNote.textContent = state.config?.sourceNote || 'Distributed catalog playback is active while the HLR direct feed is staged.';
      if (spotifyFallback) spotifyFallback.hidden = false;
    }
  }

  async function init() {
    try {
      const [configResponse, catalogResponse] = await Promise.all([
        fetch('./config.json', { cache: 'no-store' }),
        fetch('./catalog.json', { cache: 'no-store' })
      ]);
      if (!configResponse.ok || !catalogResponse.ok) throw new Error('Station manifest unavailable');
      state.config = await configResponse.json();
      state.catalog = await catalogResponse.json();
      state.tracks = state.catalog.tracks || [];
      state.currentIndex = getSavedIndex(state.tracks.length);
      await setTrack(state.currentIndex, false);
      updateClock();
    } catch (error) {
      if (nowTitle) nowTitle.textContent = 'HLR Radio';
      if (nowNote) nowNote.textContent = 'The station manifest could not load. Refresh the page to retry.';
      if (sourceBadge) sourceBadge.textContent = 'SOURCE ERROR';
      console.error(error);
    }
  }

  if (nextTrack) nextTrack.addEventListener('click', () => setTrack(state.currentIndex + 1, true));
  if (playDirect) playDirect.addEventListener('click', async () => {
    if (!state.directReady || !directPlayer) return;
    if (directPlayer.paused) {
      await directPlayer.play().catch(() => {});
      state.directPlaying = !directPlayer.paused;
      playDirect.textContent = state.directPlaying ? 'PAUSE HLR FEED' : 'PLAY HLR FEED';
    } else {
      directPlayer.pause();
      state.directPlaying = false;
      playDirect.textContent = 'PLAY HLR FEED';
    }
  });

  if (directPlayer) {
    directPlayer.addEventListener('play', () => {
      state.directPlaying = true;
      if (playDirect) playDirect.textContent = 'PAUSE HLR FEED';
    });
    directPlayer.addEventListener('pause', () => {
      state.directPlaying = false;
      if (playDirect) playDirect.textContent = 'PLAY HLR FEED';
    });
    directPlayer.addEventListener('ended', () => setTrack(state.currentIndex + 1, true));
  }

  if (copyLink) copyLink.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('https://hustlelegendrecords.com/radio/');
      const original = copyLink.textContent;
      copyLink.textContent = 'COPIED';
      setTimeout(() => { copyLink.textContent = original; }, 1400);
    } catch {
      window.prompt('Copy HLR Radio link:', 'https://hustlelegendrecords.com/radio/');
    }
  });

  setInterval(updateClock, 1000);
  init();
})();
