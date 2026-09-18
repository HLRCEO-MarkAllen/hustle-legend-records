(() => {
  'use strict';

  const SUPABASE_URL = 'https://frkzkgmmcfexudikcdef.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_UlEz_-eBThXUgesLl036RQ_J_-Edto9';
  const STAFF_REDIRECT = 'https://hustlelegendrecords.com/radio/admin/';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const ALLOWED_RADIO_AUDIO_TYPES = new Set(['audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/flac','audio/ogg']);

  const $ = (id) => document.getElementById(id);
  const authPanel = $('authPanel');
  const pendingPanel = $('pendingPanel');
  const controlRoom = $('controlRoom');
  const authStatus = $('authStatus');
  let currentUser = null;
  let currentProfile = null;

  function setStatus(el, message, type = '') {
    if (!el) return;
    el.textContent = message;
    el.className = 'status' + (type ? ` ${type}` : '');
  }

  function ensureArtistReviewLink() {
    const toolbar = controlRoom?.querySelector(':scope > .panel .brandrow .toolbar');
    if (!toolbar || toolbar.querySelector('[data-artist-review-link]')) return;
    const link = document.createElement('a');
    link.className = 'btn';
    link.href = './artists/';
    link.textContent = 'ARTIST REVIEW QUEUE';
    link.dataset.artistReviewLink = '1';
    toolbar.prepend(link);
  }

  async function logAction(action, entityType, entityId = null, details = {}) {
    if (!currentUser) return;
    await supabase.from('audit_log').insert({
      user_id: currentUser.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details
    });
  }

  async function loadProfile(user) {
    const { data, error } = await supabase
      .from('staff_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    return data;
  }

  function showPending(profile) {
    authPanel.classList.add('hidden');
    controlRoom.classList.add('hidden');
    pendingPanel.classList.remove('hidden');
    currentProfile = profile;
  }

  function showControlRoom(profile) {
    currentProfile = profile;
    authPanel.classList.add('hidden');
    pendingPanel.classList.add('hidden');
    controlRoom.classList.remove('hidden');
    $('welcome').textContent = `Welcome, ${profile.display_name}`;
    $('roleBadge').textContent = profile.role.replace('_', ' ').toUpperCase();
    ensureArtistReviewLink();
    refreshAll();
  }

  async function routeSession(session) {
    currentUser = session?.user || null;
    if (!currentUser) {
      authPanel.classList.remove('hidden');
      pendingPanel.classList.add('hidden');
      controlRoom.classList.add('hidden');
      setStatus(authStatus, 'Not signed in.');
      return;
    }

    try {
      const profile = await loadProfile(currentUser);
      if (!profile || !profile.active) showPending(profile);
      else showControlRoom(profile);
    } catch (error) {
      setStatus(authStatus, error.message || 'Could not load staff profile.', 'bad');
    }
  }

  async function signIn() {
    const email = $('email').value.trim();
    const password = $('password').value;
    if (!email || !password) return setStatus(authStatus, 'Email and password are required.', 'bad');
    setStatus(authStatus, 'Signing in…');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return setStatus(authStatus, error.message, 'bad');
    setStatus(authStatus, 'Signed in.', 'good');
    await routeSession(data.session);
  }

  async function requestAccess() {
    const email = $('email').value.trim();
    const password = $('password').value;
    const display_name = $('displayName').value.trim() || email.split('@')[0];
    if (!email || !password) return setStatus(authStatus, 'Email and password are required.', 'bad');
    setStatus(authStatus, 'Creating staff access request…');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: STAFF_REDIRECT,
        data: { display_name, account_type: 'staff' }
      }
    });
    if (error) return setStatus(authStatus, error.message, 'bad');
    if (!data.session) {
      setStatus(authStatus, 'Account created. Confirm the email, then return here and sign in. HLR management will approve the staff role.', 'good');
      return;
    }
    await routeSession(data.session);
  }

  async function signOut() {
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    location.reload();
  }

  async function loadStationState() {
    const { data, error } = await supabase.from('station_state').select('*').eq('singleton', true).single();
    if (error) return setStatus($('stationStatus'), error.message, 'bad');
    const mode = (data.mode || 'automation').toUpperCase();
    const live = data.mode === 'live';
    $('liveTitle').value = data.live_title || '';
    $('liveHost').value = data.live_host || '';
    setStatus($('stationStatus'), `${mode}${live && data.live_title ? ` · ${data.live_title}` : ''}${live && data.live_host ? ` · ${data.live_host}` : ''}`, live ? 'bad' : 'good');
  }

  async function setStationMode(mode) {
    if (!['owner', 'station_manager'].includes(currentProfile?.role)) {
      return setStatus($('stationStatus'), 'Only an owner or station manager can change broadcast mode.', 'bad');
    }
    const payload = {
      mode,
      live_title: mode === 'live' ? ($('liveTitle').value.trim() || 'HLR Live') : null,
      live_host: mode === 'live' ? ($('liveHost').value.trim() || currentProfile.display_name) : null,
      live_started_at: mode === 'live' ? new Date().toISOString() : null,
      updated_by: currentUser.id,
      updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('station_state').update(payload).eq('singleton', true);
    if (error) return setStatus($('stationStatus'), error.message, 'bad');
    await logAction('station_mode_changed', 'station_state', 'singleton', payload);
    await loadStationState();
  }

  async function uploadMedia() {
    const file = $('mediaFile').files?.[0];
    const title = $('mediaTitle').value.trim();
    if (!file || !title) return setStatus($('mediaStatus'), 'Title and audio file are required.', 'bad');
    if (file.size > 50 * 1024 * 1024) return setStatus($('mediaStatus'), 'Audio upload exceeds the 50 MB limit.', 'bad');
    if (file.type && !ALLOWED_RADIO_AUDIO_TYPES.has(file.type)) {
      return setStatus($('mediaStatus'), 'Unsupported audio format. Use MP3, WAV, M4A/MP4, OGG, or FLAC.', 'bad');
    }

    setStatus($('mediaStatus'), 'Uploading private audio…');
    const safe = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const path = `${currentUser.id}/${Date.now()}-${safe}`;
    let uploaded = false;

    try {
      const { error: uploadError } = await supabase.storage.from('hlr-radio-private').upload(path, file, { upsert: false });
      if (uploadError) throw uploadError;
      uploaded = true;

      const row = {
        title,
        artist_or_host: $('mediaArtist').value.trim() || null,
        media_type: $('mediaType').value,
        storage_path: path,
        notes: $('mediaNotes').value.trim() || null,
        uploaded_by: currentUser.id
      };
      const { data, error } = await supabase.from('media_library').insert(row).select().single();
      if (error) throw error;

      await logAction('media_uploaded', 'media_library', data.id, { title, media_type: row.media_type });
      setStatus($('mediaStatus'), 'Audio added to the private HLR library.', 'good');
      $('mediaTitle').value = '';
      $('mediaArtist').value = '';
      $('mediaNotes').value = '';
      $('mediaFile').value = '';
      await loadMedia();
    } catch (error) {
      let cleanupFailed = false;
      if (uploaded) {
        try {
          const { error: cleanupError } = await supabase.storage.from('hlr-radio-private').remove([path]);
          if (cleanupError) cleanupFailed = true;
        } catch (_cleanup) {
          cleanupFailed = true;
        }
      }
      const message = error.message || 'Private audio upload failed.';
      setStatus($('mediaStatus'), cleanupFailed ? `${message} The uploaded file could not be cleaned up automatically; review private storage.` : message, 'bad');
    }
  }

  async function playPrivate(path) {
    const { data, error } = await supabase.storage.from('hlr-radio-private').createSignedUrl(path, 300);
    if (error) return alert(error.message);
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function loadMedia() {
    const { data, error } = await supabase.from('media_library').select('*').order('created_at', { ascending: false }).limit(50);
    const el = $('mediaList');
    if (error) return el.innerHTML = `<div class="card">${escapeHtml(error.message)}</div>`;
    el.innerHTML = data.length ? '' : '<div class="card">No Control Room uploads yet.</div>';
    data.forEach(item => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<strong>${escapeHtml(item.title)}</strong> <span class="badge">${escapeHtml(item.media_type)}</span><div class="meta">${escapeHtml(item.artist_or_host || 'HLR')} · ${new Date(item.created_at).toLocaleString()}</div><div class="toolbar"><button class="btn" data-play>PREVIEW</button></div>`;
      card.querySelector('[data-play]').onclick = () => playPrivate(item.storage_path);
      el.appendChild(card);
    });
  }

  async function createShow() {
    const title = $('showTitle').value.trim();
    if (!title) return setStatus($('showStatus'), 'Show title is required.', 'bad');
    const starts_at = $('showStart').value ? new Date($('showStart').value).toISOString() : null;
    const ends_at = $('showEnd').value ? new Date($('showEnd').value).toISOString() : null;
    if (starts_at && ends_at && new Date(ends_at) <= new Date(starts_at)) return setStatus($('showStatus'), 'End time must be after start time.', 'bad');
    const status = starts_at ? 'scheduled' : 'draft';
    const row = {
      title,
      host_name: $('showHost').value.trim() || currentProfile.display_name,
      description: $('showDescription').value.trim() || null,
      starts_at,
      ends_at,
      status,
      is_podcast: $('showPodcast').value === 'true',
      created_by: currentUser.id
    };
    const { data, error } = await supabase.from('shows').insert(row).select().single();
    if (error) return setStatus($('showStatus'), error.message, 'bad');
    await logAction('show_created', 'shows', data.id, { title, status, is_podcast: row.is_podcast });
    setStatus($('showStatus'), 'Show created.', 'good');
    $('showTitle').value = '';
    $('showDescription').value = '';
    await loadShows();
  }

  async function loadShows() {
    const { data, error } = await supabase.from('shows').select('*').order('starts_at', { ascending: true, nullsFirst: false }).limit(50);
    const el = $('showList');
    if (error) return el.innerHTML = `<div class="card">${escapeHtml(error.message)}</div>`;
    el.innerHTML = data.length ? '' : '<div class="card">No shows scheduled yet.</div>';
    data.forEach(show => {
      const card = document.createElement('div');
      card.className = 'card';
      const when = show.starts_at ? new Date(show.starts_at).toLocaleString() : 'Unscheduled';
      card.innerHTML = `<strong>${escapeHtml(show.title)}</strong> <span class="badge">${show.is_podcast ? 'PODCAST' : 'SHOW'}</span><div class="meta">${escapeHtml(show.host_name || 'HLR')} · ${when} · ${escapeHtml(show.status)}</div>${show.description ? `<p class="small">${escapeHtml(show.description)}</p>` : ''}`;
      el.appendChild(card);
    });
  }

  async function loadStaff() {
    const { data, error } = await supabase.from('staff_profiles').select('*').order('created_at', { ascending: true });
    const el = $('staffList');
    if (error) return el.innerHTML = `<div class="card">${escapeHtml(error.message)}</div>`;
    el.innerHTML = data.length ? '' : '<div class="card">No staff profiles found.</div>';
    data.forEach(profile => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<strong>${escapeHtml(profile.display_name)}</strong><div class="meta">${escapeHtml(profile.role)} · ${profile.active ? 'ACTIVE' : 'PENDING'}</div>`;
      if (currentProfile.role === 'owner' && profile.user_id !== currentUser.id) {
        const tools = document.createElement('div');
        tools.className = 'toolbar';
        tools.innerHTML = `<select data-role style="padding:9px;border-radius:8px;background:#0b0b0b;color:#fff;border:1px solid #43371f"><option value="station_manager">Station Manager</option><option value="a_and_r">A&amp;R</option><option value="artist_relations">Artist Relations</option><option value="dj">DJ</option><option value="contributor">Contributor</option></select><button class="btn primary" data-approve>${profile.active ? 'UPDATE ROLE' : 'APPROVE'}</button>`;
        tools.querySelector('[data-role]').value = profile.role === 'owner' ? 'station_manager' : profile.role;
        tools.querySelector('[data-approve]').onclick = async () => {
          const role = tools.querySelector('[data-role]').value;
          const { error: updateError } = await supabase.from('staff_profiles').update({ role, active: true, updated_at: new Date().toISOString() }).eq('user_id', profile.user_id);
          if (updateError) return alert(updateError.message);
          await logAction('staff_access_updated', 'staff_profiles', profile.user_id, { role, active: true });
          await loadStaff();
        };
        card.appendChild(tools);
      }
      el.appendChild(card);
    });
  }

  async function loadAudit() {
    const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(30);
    const el = $('auditList');
    if (error) return el.innerHTML = `<div class="card">${escapeHtml(error.message)}</div>`;
    el.innerHTML = data.length ? '' : '<div class="card">No logged operations yet.</div>';
    data.forEach(row => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `<strong>${escapeHtml(row.action)}</strong><div class="meta">${escapeHtml(row.entity_type)} · ${new Date(row.created_at).toLocaleString()}</div>`;
      el.appendChild(card);
    });
  }

  async function refreshAll() {
    await Promise.all([loadStationState(), loadMedia(), loadShows(), loadStaff(), loadAudit()]);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  }

  $('signIn').onclick = signIn;
  $('requestAccess').onclick = requestAccess;
  $('signOut').onclick = signOut;
  $('pendingSignOut').onclick = signOut;
  $('uploadMedia').onclick = uploadMedia;
  $('createShow').onclick = createShow;
  document.querySelectorAll('[data-mode]').forEach(btn => btn.addEventListener('click', () => setStationMode(btn.dataset.mode)));

  supabase.auth.getSession().then(({ data }) => routeSession(data.session));
  supabase.auth.onAuthStateChange((_event, session) => routeSession(session));
})();