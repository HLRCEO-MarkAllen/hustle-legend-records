let deferredPrompt = null;
const installBtn = document.getElementById('installBtn');
const recentLinks = document.getElementById('recentLinks');
const recentEmpty = document.getElementById('recentEmpty');

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  installBtn.hidden = false;
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  if (installBtn) installBtn.hidden = true;
});

const destinationLinks = [...document.querySelectorAll('a[href]')].filter((link) => {
  const href = link.getAttribute('href') || '';
  return href.startsWith('../') && !href.startsWith('../app');
});

destinationLinks.forEach((link) => {
  link.addEventListener('click', () => {
    const label = (link.querySelector('strong')?.textContent || link.textContent || 'HLR').trim().replace(/\s+/g, ' ');
    const href = new URL(link.href, window.location.href).pathname;
    const existing = JSON.parse(localStorage.getItem('hlr-app-recent') || '[]');
    const next = [{label, href, at: Date.now()}, ...existing.filter((item) => item.href !== href)].slice(0, 3);
    localStorage.setItem('hlr-app-recent', JSON.stringify(next));
  });
});

function renderRecent() {
  const recent = JSON.parse(localStorage.getItem('hlr-app-recent') || '[]');
  if (!recent.length) return;
  recentEmpty.hidden = true;
  recentLinks.innerHTML = recent.map((item) => `
    <a class="mini" href="${item.href}">
      <b>${escapeHtml(item.label)}</b>
      <span>Open again</span>
    </a>
  `).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[char]));
}

renderRecent();