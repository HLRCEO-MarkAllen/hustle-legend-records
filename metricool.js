(()=>{
  if(window.__hlrMetricoolLoaded)return;
  window.__hlrMetricoolLoaded=true;

  const CAMPAIGN_KEY='hlr_campaign_context_v1';
  const readCampaign=()=>{
    try{return JSON.parse(sessionStorage.getItem(CAMPAIGN_KEY)||'null')}catch(e){return null}
  };
  const params=new URLSearchParams(location.search);
  const incoming={
    source:params.get('utm_source')||'',
    medium:params.get('utm_medium')||'',
    campaign:params.get('utm_campaign')||'',
    content:params.get('utm_content')||'',
    landingPage:location.pathname,
    capturedAt:new Date().toISOString()
  };
  if(incoming.source||incoming.campaign){
    try{sessionStorage.setItem(CAMPAIGN_KEY,JSON.stringify(incoming))}catch(e){}
  }

  const runMetricool=()=>{
    if(window.beTracker&&typeof window.beTracker.t==='function'){
      window.beTracker.t({hash:'602fb5c9ef62893a3890da732f3c91a5'});
      return;
    }
    const s=document.createElement('script');
    s.async=true;
    s.src='https://tracker.metricool.com/resources/be.js';
    s.onload=()=>{
      if(window.beTracker&&typeof window.beTracker.t==='function')window.beTracker.t({hash:'602fb5c9ef62893a3890da732f3c91a5'});
    };
    document.head.appendChild(s);
  };
  runMetricool();

  const campaign=readCampaign();
  if((incoming.source||incoming.campaign)&&typeof window.gtag==='function'){
    window.gtag('event','hlr_campaign_landing',{
      campaign_source:incoming.source,
      campaign_medium:incoming.medium,
      campaign_name:incoming.campaign,
      campaign_content:incoming.content,
      page_path:location.pathname
    });
  }

  document.addEventListener('click',e=>{
    const a=e.target.closest('a');
    if(!a)return;
    let u;
    try{u=new URL(a.href,location.href)}catch{return;}
    const label=(a.textContent||'').trim().slice(0,80);
    const ctx=readCampaign()||{};
    if(u.origin===location.origin){
      if(typeof window.gtag==='function'){
        window.gtag('event','hlr_internal_path_click',{
          from_path:location.pathname,
          to_path:u.pathname,
          link_text:label,
          campaign_source:ctx.source||'',
          campaign_name:ctx.campaign||'',
          campaign_content:ctx.content||''
        });
      }
      return;
    }
    if(typeof window.gtag==='function'){
      window.gtag('event','hlr_outbound_click',{
        destination_host:u.hostname,
        link_text:label,
        page_path:location.pathname,
        campaign_source:ctx.source||'',
        campaign_medium:ctx.medium||'',
        campaign_name:ctx.campaign||'',
        campaign_content:ctx.content||'',
        original_landing_page:ctx.landingPage||''
      });
    }
  });

  const enhanceHomepage=()=>{
    if(location.pathname!=='/'&&location.pathname!=='/index.html')return;
    document.querySelectorAll('.stat,.ledger-cell').forEach(box=>{
      const strong=box.querySelector('strong');
      const span=box.querySelector('span');
      if(strong&&strong.textContent.trim()==='13,580'){
        strong.textContent='14,452';
        if(span)span.textContent='Monthly listeners · Sep 2026 snapshot';
      }
    });
    const nav=document.querySelector('.navlinks');
    if(nav&&!nav.querySelector('a[href="now/"]')&&!nav.querySelector('a[href="/now/"]')){
      const a=document.createElement('a');
      a.href='now/';
      a.textContent='Now Moving';
      nav.prepend(a);
    }
    const heroCta=document.querySelector('.hero .cta');
    if(heroCta&&!heroCta.querySelector('a[href="now/"]')&&!heroCta.querySelector('a[href="/now/"]')){
      const a=document.createElement('a');
      a.className='btn';
      a.href='now/';
      a.textContent="WHAT'S MOVING NOW";
      heroCta.append(a);
    }
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhanceHomepage);
  else enhanceHomepage();
})();
