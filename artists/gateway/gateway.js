(() => {
  'use strict';
  const SUPABASE_URL='https://frkzkgmmcfexudikcdef.supabase.co';
  const SUPABASE_KEY='sb_publishable_UlEz_-eBThXUgesLl036RQ_J_-Edto9';
  const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  const $=id=>document.getElementById(id);
  let user=null,profile=null;
  const set=(el,msg,type='')=>{el.textContent=msg;el.className='status'+(type?` ${type}`:'')};
  const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function ensureTermsControl(){
    if($('termsAccepted')) return;
    const submitButton=$('submitTrack');
    const toolbar=submitButton?.closest('.toolbar');
    if(!toolbar) return;
    const wrap=document.createElement('div');
    wrap.className='checkgrid';
    wrap.style.marginTop='12px';
    wrap.innerHTML=`<label class="check"><input id="termsAccepted" type="checkbox"> I have read and accept the <a href="./terms.html" target="_blank" rel="noopener" style="color:#ffe39a">HLR Artist Gateway Submission Terms</a>.</label>`;
    toolbar.parentNode.insertBefore(wrap,toolbar);
  }

  async function loadProfile(){
    const {data,error}=await sb.from('artist_profiles').select('*').eq('user_id',user.id).maybeSingle();
    if(error) throw error;
    profile=data;
    if(!profile){
      const stage=user.user_metadata?.stage_name||user.email.split('@')[0];
      const {data:created,error:createError}=await sb.from('artist_profiles').insert({user_id:user.id,stage_name:stage,contact_name:user.user_metadata?.contact_name||null}).select().single();
      if(createError) throw createError;
      profile=created;
    }
    $('welcome').textContent=`Welcome, ${profile.stage_name}`;
    $('profileStage').value=profile.stage_name||'';
    $('profileRegion').value=profile.city_region||'';
    $('profileBio').value=profile.bio||'';
    $('profileWebsite').value=profile.website_url||'';
    $('profileSpotify').value=profile.spotify_url||'';
    $('profileInstagram').value=profile.instagram_url||'';
    $('directoryOptIn').checked=!!profile.directory_opt_in;
    ensureTermsControl();
  }

  async function route(session){
    user=session?.user||null;
    if(!user){$('authPanel').classList.remove('hidden');$('dashboard').classList.add('hidden');return;}
    $('authPanel').classList.add('hidden');$('dashboard').classList.remove('hidden');
    try{await loadProfile();await Promise.all([loadSubmissions(),loadOpportunities()]);}catch(e){alert(e.message||'Could not load artist dashboard.');}
  }

  async function signIn(){
    set($('authStatus'),'Signing in…');
    const {data,error}=await sb.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});
    if(error)return set($('authStatus'),error.message,'bad');
    set($('authStatus'),'Signed in.','good');
    await route(data.session);
  }

  async function signUp(){
    const email=$('email').value.trim(),password=$('password').value,stage_name=$('stageName').value.trim(),contact_name=$('contactName').value.trim();
    if(!email||!password||!stage_name)return set($('authStatus'),'Email, password and artist name are required.','bad');
    set($('authStatus'),'Creating artist account…');
    const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:'https://hustlelegendrecords.com/artists/gateway/',data:{account_type:'artist',stage_name,contact_name}}});
    if(error)return set($('authStatus'),error.message,'bad');
    if(!data.session)return set($('authStatus'),'Account created. Confirm the email, then return here and sign in.','good');
    await route(data.session);
  }

  async function saveProfile(){
    const payload={stage_name:$('profileStage').value.trim(),city_region:$('profileRegion').value.trim()||null,bio:$('profileBio').value.trim()||null,website_url:$('profileWebsite').value.trim()||null,spotify_url:$('profileSpotify').value.trim()||null,instagram_url:$('profileInstagram').value.trim()||null,directory_opt_in:$('directoryOptIn').checked,updated_at:new Date().toISOString()};
    const {error}=await sb.from('artist_profiles').update(payload).eq('user_id',user.id);
    if(error)return set($('profileStatus'),error.message,'bad');
    profile={...profile,...payload};$('welcome').textContent=`Welcome, ${profile.stage_name}`;set($('profileStatus'),'Profile saved.','good');
  }

  async function submitTrack(){
    const title=$('trackTitle').value.trim(),url=$('trackUrl').value.trim(),file=$('trackFile').files?.[0];
    if(!title)return set($('submissionStatus'),'Track title is required.','bad');
    if(!url&&!file)return set($('submissionStatus'),'Add a review link or upload an audio file.','bad');
    if(!$('authorized').checked)return set($('submissionStatus'),'You must confirm that you are authorized to submit this recording.','bad');
    if(!$('termsAccepted')?.checked)return set($('submissionStatus'),'You must accept the HLR Artist Gateway Submission Terms before submitting.','bad');
    let storage_path=null;
    try{
      set($('submissionStatus'),'Preparing submission…');
      if(file){
        if(file.size>50*1024*1024)throw new Error('Audio upload exceeds the 50 MB limit.');
        const safe=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,'-');
        storage_path=`${user.id}/${Date.now()}-${safe}`;
        const {error:upErr}=await sb.storage.from('hlr-artist-submissions').upload(storage_path,file,{upsert:false});
        if(upErr)throw upErr;
      }
      const row={artist_user_id:user.id,artist_name:profile.stage_name,track_title:title,release_title:$('releaseTitle').value.trim()||null,track_url:url||null,genre:$('genre').value.trim()||null,explicit:$('explicit').checked,notes:$('submissionNotes').value.trim()||null,wants_radio:$('wantRadio').checked,wants_editorial:$('wantEditorial').checked,wants_interview:$('wantInterview').checked,wants_licensing:$('wantLicensing').checked,master_controlled:$('masterControlled').checked,publishing_controlled:$('publishingControlled').checked,samples_cleared:$('samplesCleared').checked,authorized_to_submit:true,clean_available:$('cleanAvailable').checked,instrumental_available:$('instrumentalAvailable').checked,storage_path,status:'submitted',terms_version:'2026-09-17',terms_accepted_at:new Date().toISOString()};
      const {error}=await sb.from('artist_submissions').insert(row);
      if(error)throw error;
      set($('submissionStatus'),'Submitted to HLR. Your dashboard will show each status change.','good');
      ['trackTitle','releaseTitle','genre','trackUrl','submissionNotes'].forEach(id=>$(id).value='');$('trackFile').value='';$('termsAccepted').checked=false;
      await loadSubmissions();
    }catch(e){set($('submissionStatus'),e.message||'Submission failed.','bad');}
  }

  async function loadSubmissions(){
    const {data,error}=await sb.from('artist_submissions').select('id,track_title,release_title,status,decision_note,created_at,wants_radio,wants_editorial,wants_interview,wants_licensing').order('created_at',{ascending:false});
    const el=$('submissionList');if(error)return el.innerHTML=`<div class="card">${esc(error.message)}</div>`;
    el.innerHTML=data.length?'':'<div class="card">No submissions yet.</div>';
    data.forEach(s=>{const routes=[s.wants_radio&&'Radio',s.wants_editorial&&'Editorial',s.wants_interview&&'Interview',s.wants_licensing&&'Licensing'].filter(Boolean).join(' · ');const c=document.createElement('div');c.className='card';c.innerHTML=`<strong>${esc(s.track_title)}</strong> <span class="badge">${esc(String(s.status).replaceAll('_',' ').toUpperCase())}</span><div class="meta">${esc(routes||'General review')} · ${new Date(s.created_at).toLocaleString()}</div>${s.decision_note?`<p class="small">${esc(s.decision_note)}</p>`:''}`;el.appendChild(c);});
  }

  async function loadOpportunities(){
    const {data,error}=await sb.from('artist_opportunities').select('*').eq('is_open',true).order('created_at',{ascending:false});
    const el=$('opportunityList');if(error)return el.innerHTML=`<div class="card">${esc(error.message)}</div>`;
    el.innerHTML=data.length?'':'<div class="card">No open opportunities right now.</div>';
    data.forEach(o=>{const c=document.createElement('div');c.className='card';c.innerHTML=`<strong>${esc(o.title)}</strong> <span class="badge">${esc(o.opportunity_type.toUpperCase())}</span><p class="small">${esc(o.description)}</p>${o.eligibility?`<div class="meta">Eligibility: ${esc(o.eligibility)}</div>`:''}`;el.appendChild(c);});
  }

  $('signIn').onclick=signIn;$('signUp').onclick=signUp;$('signOut').onclick=()=>sb.auth.signOut();$('saveProfile').onclick=saveProfile;$('submitTrack').onclick=submitTrack;
  sb.auth.getSession().then(({data})=>route(data.session));sb.auth.onAuthStateChange((_e,s)=>route(s));
})();