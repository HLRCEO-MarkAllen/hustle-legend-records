const HLR_STATION = {
  stationName: "HLR Radio",
  timezone: "America/Chicago",
  rotation: [
    {
      title: "Karma",
      artist: "Mark Allen · Born 2 Be A Legend",
      role: "Relationship / retention record",
      note: "A deeper relationship record in the B2BAL catalog and one of the songs HLR consistently routes new listeners toward.",
      story: "../songs/karma/",
      audioUrl: null
    },
    {
      title: "Rowdy",
      artist: "Mark Allen · Born 2 Be A Legend",
      role: "Independent / anti-industry statement",
      note: "An HLR identity record built around independence, ownership and the declaration that Hustle Legend Records is in business.",
      story: "../songs/rowdy/",
      audioUrl: null
    },
    {
      title: "Rare Breed",
      artist: "Mark Allen · Born 2 Be A Legend",
      role: "Identity / discovery record",
      note: "A catalog record that reinforces the independent, wordsmith-first identity at the center of the B2BAL era.",
      story: "../songs/rare-breed/",
      audioUrl: null
    },
    {
      title: "5 Years Later…",
      artist: "Mark Allen · Born 2 Be A Legend",
      role: "Origin / comeback chapter",
      note: "The return point. This is where the five-year interruption turns into the opening chapter of the album story.",
      story: "../songs/5-years-later/",
      audioUrl: null
    },
    {
      title: "King Cobra",
      artist: "Mark Allen · Born 2 Be A Legend",
      role: "Conflict / pressure record",
      note: "Conflict became an artifact instead of an endless argument. The song preserves the chapter without requiring the drama to stay alive forever.",
      story: "../songs/king-cobra/",
      audioUrl: null
    },
    {
      title: "Loser",
      artist: "Mark Allen · Born 2 Be A Legend",
      role: "Listener conversion record",
      note: "One of the recurring priority records in the B2BAL campaign and a natural next stop for listeners entering through replay-heavy songs.",
      story: "../songs/loser/",
      audioUrl: null
    },
    {
      title: "Deja Vu",
      artist: "Mark Allen · Born 2 Be A Legend",
      role: "Replay / save behavior",
      note: "A replay doorway into the album, paired in HLR listener paths with Loser and Rare Breed.",
      story: "../songs/deja-vu/",
      audioUrl: null
    },
    {
      title: "Truth Bomb",
      artist: "Mark Allen · Born 2 Be A Legend",
      role: "Late-album sequence",
      note: "Track 19 works best as a late-album chapter that routes directly into the closing record, S.O.S.",
      story: "../songs/truth-bomb/",
      audioUrl: null
    },
    {
      title: "S.O.S.",
      artist: "Mark Allen · Born 2 Be A Legend",
      role: "Album closer / reaction favorite",
      note: "The closing chapter of B2BAL and a strong reaction-video record in the campaign archive.",
      story: "../songs/sos/",
      audioUrl: null
    }
  ]
};

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

const savedIndex = Number(localStorage.getItem('hlr-radio-index'));
let currentIndex = Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex < HLR_STATION.rotation.length ? savedIndex : 0;
const queueEl = document.getElementById("queue");
const nowTitle = document.getElementById("nowTitle");
const nowArtist = document.getElementById("nowArtist");
const nowNote = document.getElementById("nowNote");
const storyLink = document.getElementById("storyLink");
const nextTrack = document.getElementById("nextTrack");
const clock = document.getElementById("clock");
const copyLink = document.getElementById("copyLink");

function renderQueue(){
  queueEl.innerHTML = "";
  HLR_STATION.rotation.forEach((track,index)=>{
    const card = document.createElement("button");
    card.type = "button";
    card.className = "track" + (index === currentIndex ? " active" : "");
    card.setAttribute("aria-label", `Program ${track.title}`);
    card.innerHTML = `<div class="trackIndex">ROTATION ${String(index+1).padStart(2,"0")}</div><div class="trackName">${track.title}</div><div class="trackRole">${track.role}</div>`;
    card.addEventListener("click",()=>setTrack(index));
    queueEl.appendChild(card);
  });
}

function setTrack(index){
  currentIndex = (index + HLR_STATION.rotation.length) % HLR_STATION.rotation.length;
  const track = HLR_STATION.rotation[currentIndex];
  nowTitle.textContent = track.title;
  nowArtist.textContent = track.artist;
  nowNote.textContent = track.note;
  storyLink.href = track.story;
  localStorage.setItem('hlr-radio-index', String(currentIndex));
  const history = JSON.parse(localStorage.getItem('hlr-radio-history') || '[]');
  const nextHistory = [{title:track.title, story:track.story, at:Date.now()}, ...history.filter((item)=>item.title !== track.title)].slice(0,5);
  localStorage.setItem('hlr-radio-history', JSON.stringify(nextHistory));
  renderQueue();
}

nextTrack.addEventListener("click",()=>setTrack(currentIndex + 1));

function updateClock(){
  clock.textContent = new Intl.DateTimeFormat("en-US",{
    timeZone: HLR_STATION.timezone,
    hour:"2-digit",minute:"2-digit",second:"2-digit"
  }).format(new Date());
}
setInterval(updateClock,1000);
updateClock();

copyLink.addEventListener("click",async()=>{
  try{
    await navigator.clipboard.writeText("https://hustlelegendrecords.com/radio/");
    const original = copyLink.textContent;
    copyLink.textContent = "COPIED";
    setTimeout(()=>copyLink.textContent = original,1400);
  }catch{
    window.prompt("Copy HLR Radio link:","https://hustlelegendrecords.com/radio/");
  }
});

setTrack(currentIndex);
