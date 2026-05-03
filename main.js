// main.js
import { auth, db, googleProvider } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const API_KEY = '7a98db423d6e3a5ee922a3e51a09d135';
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const BACKDROP = 'https://image.tmdb.org/t/p/original';

let swiper = null;
let activePreview = null;
let previewTimeout = null;
let currentCard = null;
let currentUser = null;

let favorites = JSON.parse(localStorage.getItem('alb_favorites')) || [];
let watchlist = JSON.parse(localStorage.getItem('alb_watchlist')) || [];
let continueWatching = JSON.parse(localStorage.getItem('alb_continueWatching')) || [];

function saveFavorites() { localStorage.setItem('alb_favorites', JSON.stringify(favorites)); }
function saveWatchlist() { localStorage.setItem('alb_watchlist', JSON.stringify(watchlist)); }
function saveContinueWatching() { localStorage.setItem('alb_continueWatching', JSON.stringify(continueWatching)); }

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function isFavorite(id, type) { return favorites.some(f => f.id == id && f.type === type); }
function isWatchlist(id, type) { return watchlist.some(w => w.id == id && w.type === type); }

function updateIcons(id, type) {
    const isFav = isFavorite(id, type);
    const isWatch = isWatchlist(id, type);
    document.querySelectorAll(`.favorite-btn[data-id="${id}"][data-type="${type}"]`).forEach(btn => {
        const icon = btn.querySelector('i');
        if (isFav) icon.className = 'fas fa-heart';
        else icon.className = 'far fa-heart';
    });
    document.querySelectorAll(`.watchlater-btn[data-id="${id}"][data-type="${type}"]`).forEach(btn => {
        const icon = btn.querySelector('i');
        if (isWatch) icon.className = 'fas fa-clock';
        else icon.className = 'far fa-clock';
    });
}

async function syncWithFirebase() {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
        const data = docSnap.data();
        favorites = data.favorites || [];
        watchlist = data.watchlist || [];
        continueWatching = data.continueWatching || [];
    } else {
        await setDoc(userRef, { favorites, watchlist, continueWatching, points: 0 });
    }
    saveFavorites(); saveWatchlist(); saveContinueWatching();
    refreshAllLists();
}

async function pushToFirebase() {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await setDoc(userRef, { favorites, watchlist, continueWatching }, { merge: true });
}

function addFavorite(item) { if (!isFavorite(item.id, item.type)) { favorites.push({ id: item.id, type: item.type, title: item.title, poster: item.poster }); saveFavorites(); if (currentUser) pushToFirebase(); showToast(`❤️ "${item.title}" added to favorites`); updateIcons(item.id, item.type); if (document.getElementById('favoritesSection').classList.contains('active')) displayFavorites(); } }
function removeFavorite(id, type) { const idx = favorites.findIndex(f => f.id == id && f.type === type); if (idx !== -1) { favorites.splice(idx,1); saveFavorites(); if (currentUser) pushToFirebase(); showToast(`💔 Removed from favorites`); updateIcons(id,type); if (document.getElementById('favoritesSection').classList.contains('active')) displayFavorites(); } }
function toggleFavorite(id,type,title,poster) { if (isFavorite(id,type)) removeFavorite(id,type); else addFavorite({ id,type,title,poster }); }

function addWatchlist(item) { if (!isWatchlist(item.id, item.type)) { watchlist.push({ id: item.id, type: item.type, title: item.title, poster: item.poster }); saveWatchlist(); if (currentUser) pushToFirebase(); showToast(`⏰ "${item.title}" added to watch later`); updateIcons(item.id, item.type); if (document.getElementById('watchlistSection').classList.contains('active')) displayWatchlist(); } }
function removeWatchlist(id, type) { const idx = watchlist.findIndex(w => w.id == id && w.type === type); if (idx !== -1) { watchlist.splice(idx,1); saveWatchlist(); if (currentUser) pushToFirebase(); showToast(`⏰ Removed from watch later`); updateIcons(id,type); if (document.getElementById('watchlistSection').classList.contains('active')) displayWatchlist(); } }
function toggleWatchlist(id,type,title,poster) { if (isWatchlist(id,type)) removeWatchlist(id,type); else addWatchlist({ id,type,title,poster }); }

function addToContinueWatching(item, season=null, episode=null) {
    const existing = continueWatching.find(c => c.id === item.id && c.type === item.type);
    if (existing) { existing.timestamp = Date.now(); if (season) existing.season = season; if (episode) existing.episode = episode; }
    else { continueWatching.unshift({ ...item, timestamp: Date.now(), season, episode }); if (continueWatching.length > 20) continueWatching.pop(); }
    saveContinueWatching(); if (currentUser) pushToFirebase(); displayContinueWatching();
}

function displayContinueWatching() {
    const section = document.getElementById('continueWatchingSection');
    const grid = document.getElementById('continueWatchingGrid');
    if (!continueWatching.length) { section.style.display = 'none'; return; }
    section.style.display = 'block'; section.classList.add('active'); grid.innerHTML = '';
    continueWatching.sort((a,b) => b.timestamp - a.timestamp).forEach(item => {
        const card = document.createElement('div'); card.className = 'movie-card';
        card.innerHTML = `<img class="poster" src="${item.poster ? IMG+item.poster : 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${item.title}" loading="lazy"><div class="card-info"><h4>${item.title}</h4><p>Continue watching</p></div>`;
        card.addEventListener('click', () => { if (item.type === 'tv') window.location.href = `tv.html?id=${item.id}&season=${item.season || 1}&episode=${item.episode || 1}`; else window.location.href = `watch.html?id=${item.id}&type=movie`; });
        grid.appendChild(card);
    });
}

function displayFavorites() { const grid = document.getElementById('favoritesGrid'); if(!grid) return; grid.innerHTML = ''; if(favorites.length === 0){ grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">No favorites yet.</div>'; return; } favorites.forEach(fav => { const card = document.createElement('div'); card.className = 'movie-card'; card.innerHTML = `<div class="card-icons"><div class="favorite-btn" data-id="${fav.id}" data-type="${fav.type}" data-title="${fav.title.replace(/'/g,"\\'")}" data-poster="${fav.poster||''}"><i class="fas fa-heart"></i></div><div class="watchlater-btn" data-id="${fav.id}" data-type="${fav.type}" data-title="${fav.title.replace(/'/g,"\\'")}" data-poster="${fav.poster||''}"><i class="${isWatchlist(fav.id,fav.type)?'fas':'far'} fa-clock"></i></div></div><img class="poster" src="${fav.poster?IMG+fav.poster:'https://via.placeholder.com/300x450?text=No+Image'}" alt="${fav.title}" loading="lazy"><div class="card-info"><h4>${fav.title}</h4><p>⭐ Favorite</p></div>`; card.addEventListener('click', (e) => { if(e.target.closest('.favorite-btn')||e.target.closest('.watchlater-btn')) return; if(fav.type === 'tv') window.location.href = `tv.html?id=${fav.id}`; else window.location.href = `watch.html?id=${fav.id}&type=movie`; }); const favBtn = card.querySelector('.favorite-btn'); const watchBtn = card.querySelector('.watchlater-btn'); favBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(fav.id,fav.type,fav.title,fav.poster); }); watchBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleWatchlist(fav.id,fav.type,fav.title,fav.poster); }); grid.appendChild(card); }); }

function displayWatchlist() { const grid = document.getElementById('watchlistGrid'); if(!grid) return; grid.innerHTML = ''; if(watchlist.length === 0){ grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">No watch later items.</div>'; return; } watchlist.forEach(item => { const card = document.createElement('div'); card.className = 'movie-card'; card.innerHTML = `<div class="card-icons"><div class="favorite-btn" data-id="${item.id}" data-type="${item.type}" data-title="${item.title.replace(/'/g,"\\'")}" data-poster="${item.poster||''}"><i class="${isFavorite(item.id,item.type)?'fas':'far'} fa-heart"></i></div><div class="watchlater-btn" data-id="${item.id}" data-type="${item.type}" data-title="${item.title.replace(/'/g,"\\'")}" data-poster="${item.poster||''}"><i class="fas fa-clock"></i></div></div><img class="poster" src="${item.poster?IMG+item.poster:'https://via.placeholder.com/300x450?text=No+Image'}" alt="${item.title}" loading="lazy"><div class="card-info"><h4>${item.title}</h4><p>⏰ Watch Later</p></div>`; card.addEventListener('click', (e) => { if(e.target.closest('.favorite-btn')||e.target.closest('.watchlater-btn')) return; if(item.type === 'tv') window.location.href = `tv.html?id=${item.id}`; else window.location.href = `watch.html?id=${item.id}&type=movie`; }); const favBtn = card.querySelector('.favorite-btn'); const watchBtn = card.querySelector('.watchlater-btn'); favBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(item.id,item.type,item.title,item.poster); }); watchBtn.addEventListener('click', (e) => { e.stopPropagation(); removeWatchlist(item.id,item.type); }); grid.appendChild(card); }); }

function createCard(item, isTv, containerId, append=true) {
    const card = document.createElement('div'); card.className = isTv ? 'tv-card' : 'movie-card';
    const id = item.id, type = isTv ? 'tv' : 'movie';
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '?';
    const poster = item.poster_path || '';
    const isFav = isFavorite(id, type);
    const isWatch = isWatchlist(id, type);
    card.innerHTML = `<div class="card-icons"><div class="favorite-btn" data-id="${id}" data-type="${type}" data-title="${title.replace(/'/g,"\\'")}" data-poster="${poster}"><i class="${isFav?'fas':'far'} fa-heart"></i></div><div class="watchlater-btn" data-id="${id}" data-type="${type}" data-title="${title.replace(/'/g,"\\'")}" data-poster="${poster}"><i class="${isWatch?'fas':'far'} fa-clock"></i></div></div><img class="poster" src="${poster?IMG+poster:'https://via.placeholder.com/300x450?text=No+Image'}" alt="${title}" loading="lazy"><div class="card-info"><h4>${title}</h4><p>${year} ⭐ ${rating}</p></div>`;
    let hoverTimeout;
    card.addEventListener('mouseenter', () => { if(window.innerWidth>768) hoverTimeout = setTimeout(() => showRichPreview(item, card, isTv), 400); });
    card.addEventListener('mouseleave', () => { clearTimeout(hoverTimeout); if(window.innerWidth>768) setTimeout(() => { if(activePreview && !activePreview.matches(':hover') && !card.matches(':hover')) removePreview(); }, 100); });
    card.addEventListener('click', (e) => { if(e.target.closest('.favorite-btn')||e.target.closest('.watchlater-btn')) return; if(isTv) window.location.href = `tv.html?id=${id}`; else window.location.href = `watch.html?id=${id}&type=movie`; });
    const favBtn = card.querySelector('.favorite-btn'); const watchBtn = card.querySelector('.watchlater-btn');
    favBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(id,type,title,poster); });
    watchBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleWatchlist(id,type,title,poster); });
    if(append) document.getElementById(containerId).appendChild(card);
    return card;
}

async function showRichPreview(item, cardEl, isTv) { if(window.innerWidth<=768) return; if(activePreview && currentCard===cardEl) return; removePreview(); currentCard=cardEl; const id=item.id, type=isTv?'tv':'movie'; try{ const details=await (await fetch(`${BASE}/${type}/${id}?api_key=${API_KEY}&language=en-US`)).json(); const videos=await (await fetch(`${BASE}/${type}/${id}/videos?api_key=${API_KEY}`)).json(); const trailer=videos.results?.find(v=>v.type==='Trailer' && v.site==='YouTube'); const title=details.title||details.name; const year=(details.release_date||details.first_air_date||'').split('-')[0]||'N/A'; const rating=details.vote_average?.toFixed(1)||'N/A'; const overview=details.overview?.substring(0,180)||'No description'; const preview=document.createElement('div'); preview.className='preview-rich'; preview.innerHTML=`<div class="preview-trailer">${trailer?`<iframe src="https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`:'<div style="height:270px; background:#111; display:flex; align-items:center; justify-content:center;">🎬 No trailer</div>'}</div><div class="preview-info"><h4>${title} (${year})</h4><p>⭐ ${rating}/10</p><p>${overview}...</p></div>`; document.body.appendChild(preview); activePreview=preview; const rect=cardEl.getBoundingClientRect(); let left=rect.left+rect.width+15, top=rect.top+window.scrollY; if(left+480>window.innerWidth) left=rect.left-490; if(top+450>window.scrollY+window.innerHeight) top=window.scrollY+window.innerHeight-460; if(top<window.scrollY) top=window.scrollY+10; preview.style.top=top+'px'; preview.style.left=left+'px'; preview.addEventListener('mouseenter',()=>{if(previewTimeout)clearTimeout(previewTimeout);}); preview.addEventListener('mouseleave',()=>{previewTimeout=setTimeout(()=>{removePreview();currentCard=null;},300);}); }catch(e){console.error(e);} }

function removePreview(){ if(activePreview){ activePreview.remove(); activePreview=null; } if(previewTimeout)clearTimeout(previewTimeout); }

async function loadGenreMovies(genreId, gridId, pagId, page=1) { const grid = document.getElementById(gridId); const pag = document.getElementById(pagId); if(!grid) return; grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Loading...</div>'; try { const res = await fetch(`${BASE}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&vote_count.gte=100&language=en-US&page=${page}`); const data = await res.json(); const totalPages = Math.min(data.total_pages, 6); grid.innerHTML = ''; data.results.forEach(m => createCard(m, false, gridId)); pag.innerHTML = ''; for (let i = 1; i <= totalPages; i++) { const btn = document.createElement('button'); btn.textContent = i; btn.className = `page-btn ${i === page ? 'active' : ''}`; btn.onclick = () => loadGenreMovies(genreId, gridId, pagId, i); pag.appendChild(btn); } } catch(e) { console.error(e); grid.innerHTML = '<div>Error</div>'; } }

async function loadTVShows(page = 1) { const grid = document.getElementById('tvSeriesGrid'); const pag = document.getElementById('tvPagination'); if (!grid) return; grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px;">Loading series...</div>'; try { const topRatedRes = await fetch(`${BASE}/tv/top_rated?api_key=${API_KEY}&language=en-US&page=${page}`); const topRatedData = await topRatedRes.json(); const totalPages = Math.min(topRatedData.total_pages, 8); if (page === 1) { grid.innerHTML = ''; } else { grid.innerHTML = ''; } topRatedData.results.forEach(show => createCard(show, true, 'tvSeriesGrid')); pag.innerHTML = ''; for (let i = 1; i <= totalPages; i++) { const btn = document.createElement('button'); btn.textContent = i; btn.className = `page-btn ${i === page ? 'active' : ''}`; btn.onclick = () => loadTVShows(i); pag.appendChild(btn); } } catch(e) { console.error(e); grid.innerHTML = '<div>Error loading series</div>'; } }

async function loadHeroSlider() { const res = await fetch(`${BASE}/trending/movie/day?api_key=${API_KEY}&language=en-US`); const data = await res.json(); const slides = data.results.slice(0, 6); const wrapper = document.getElementById('heroSlider'); wrapper.innerHTML = ''; for (const m of slides) { const [det, credit] = await Promise.all([fetch(`${BASE}/movie/${m.id}?api_key=${API_KEY}&language=en-US`).then(r=>r.json()), fetch(`${BASE}/movie/${m.id}/credits?api_key=${API_KEY}&language=en-US`).then(r=>r.json())]); const rating = det.vote_average ? det.vote_average.toFixed(1) : 'N/A'; const castList = credit.cast ? credit.cast.slice(0,3).map(c=>c.name).join(', ') : 'N/A'; const overview = det.overview ? det.overview.substring(0,150) : 'No description'; const div = document.createElement('div'); div.className = 'swiper-slide'; div.innerHTML = `<img class="slide-bg" src="${BACKDROP + m.backdrop_path}" alt="${m.title}"><div class="slide-overlay"></div><div class="slide-description-card"><h2>${m.title}</h2><div class="slide-meta"><span class="rating"><i class="fas fa-star"></i> ${rating}/10</span><span><i class="fas fa-calendar-alt"></i> ${det.release_date?.split('-')[0] || 'N/A'}</span><span><i class="fas fa-clock"></i> ${det.runtime || '?'} min</span></div><p>${overview}...</p><div class="slide-cast"><i class="fas fa-users"></i> <strong>Cast:</strong> ${castList}</div><button class="btn-watch" onclick="location.href='watch.html?id=${m.id}&type=movie'"><i class="fas fa-play"></i> Watch Now</button></div>`; wrapper.appendChild(div); } if (swiper) swiper.destroy(); swiper = new Swiper('.heroSwiper', { loop: true, autoplay: { delay: 6000, disableOnInteraction: false }, navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' }, pagination: { el: '.swiper-pagination', clickable: true }, speed: 800 }); }

async function searchContent(query) { const container = document.getElementById('searchResultsContainer'); const grid = document.getElementById('searchGrid'); if (!query || query.length < 3) { container.style.display = 'none'; return; } try { const res = await fetch(`${BASE}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=en-US`); const data = await res.json(); const results = data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 24); grid.innerHTML = ''; if (results.length === 0) { grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">No results found.</div>'; container.style.display = 'block'; return; } results.forEach(item => createCard(item, item.media_type === 'tv', 'searchGrid')); container.style.display = 'block'; } catch(e) { console.error(e); } }

// Special lists
async function loadTopRatedMovies(page=1){ const grid=document.getElementById('topMoviesGrid'); const pag=document.getElementById('topMoviesPagination'); if(!grid) return; grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;">Loading 100 Best Movies...</div>'; try{ const res=await fetch(`${BASE}/movie/top_rated?api_key=${API_KEY}&page=${page}`); const data=await res.json(); const totalPages=Math.min(data.total_pages,5); grid.innerHTML=''; data.results.forEach(m=>createCard(m,false,'topMoviesGrid')); pag.innerHTML=''; for(let i=1;i<=totalPages;i++){ const btn=document.createElement('button'); btn.textContent=i; btn.className=`page-btn ${i===page?'active':''}`; btn.onclick=()=>loadTopRatedMovies(i); pag.appendChild(btn); } }catch(e){console.error(e);} }

async function loadTopRatedTv(page=1){ const grid=document.getElementById('topTvGrid'); const pag=document.getElementById('topTvPagination'); if(!grid) return; grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;">Loading 100 Greatest TV Shows...</div>'; try{ const res=await fetch(`${BASE}/tv/top_rated?api_key=${API_KEY}&page=${page}`); const data=await res.json(); const totalPages=Math.min(data.total_pages,5); grid.innerHTML=''; data.results.forEach(show=>createCard(show,true,'topTvGrid')); pag.innerHTML=''; for(let i=1;i<=totalPages;i++){ const btn=document.createElement('button'); btn.textContent=i; btn.className=`page-btn ${i===page?'active':''}`; btn.onclick=()=>loadTopRatedTv(i); pag.appendChild(btn); } }catch(e){console.error(e);} }

async function loadMoviesByYear(year, page=1, gridId, pagId){ const grid=document.getElementById(gridId); const pag=document.getElementById(pagId); if(!grid) return; grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:40px;">Loading...</div>'; try{ const res=await fetch(`${BASE}/discover/movie?api_key=${API_KEY}&sort_by=popularity.desc&primary_release_year=${year}&vote_count.gte=100&page=${page}`); const data=await res.json(); const totalPages=Math.min(data.total_pages,4); grid.innerHTML=''; data.results.forEach(m=>createCard(m,false,gridId)); pag.innerHTML=''; for(let i=1;i<=totalPages;i++){ const btn=document.createElement('button'); btn.textContent=i; btn.className=`page-btn ${i===page?'active':''}`; btn.onclick=()=>loadMoviesByYear(year,i,gridId,pagId); pag.appendChild(btn); } }catch(e){console.error(e);} }

// Provider logic
const PROVIDER_IDS = { netflix:8, prime:9, disney:337 };
let currentProviderId = null, currentProviderType = 'movie', currentProviderPage = 1, currentProviderSearch = '', currentProviderGenre = '';
const providerGenreMap = { movie:[{id:28,name:'Action'},{id:35,name:'Comedy'},{id:18,name:'Drama'},{id:27,name:'Horror'},{id:10749,name:'Romance'},{id:878,name:'Sci-Fi'},{id:99,name:'Documentary'},{id:80,name:'Crime'},{id:12,name:'Adventure'},{id:14,name:'Fantasy'},{id:10752,name:'War'},{id:37,name:'Western'}], tv:[{id:28,name:'Action'},{id:35,name:'Comedy'},{id:18,name:'Drama'},{id:80,name:'Crime'},{id:99,name:'Documentary'},{id:16,name:'Animation'},{id:10765,name:'Sci-Fi & Fantasy'},{id:10759,name:'Action & Adventure'}] };
function renderProviderGenres() { const container = document.getElementById('providerGenres'); if (!container) return; const genres = providerGenreMap[currentProviderType]; container.innerHTML = '<button class="provider-genre-btn active" data-genre="">All</button>'; genres.forEach(g => { const btn = document.createElement('button'); btn.textContent = g.name; btn.className = 'provider-genre-btn'; btn.dataset.genre = g.id; if (currentProviderGenre == g.id) btn.classList.add('active'); btn.onclick = () => { document.querySelectorAll('.provider-genre-btn').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); currentProviderGenre = g.id; currentProviderPage = 1; loadProviderContent(); }; container.appendChild(btn); }); }
async function loadProviderContent() { if (!currentProviderId) return; const grid = document.getElementById('providerGrid'); const pag = document.getElementById('providerPagination'); grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px;">Loading...</div>'; let url = ''; const endpoint = currentProviderType === 'movie' ? 'movie' : 'tv'; if (currentProviderSearch && currentProviderSearch.length >= 3) url = `${BASE}/search/${endpoint}?api_key=${API_KEY}&query=${encodeURIComponent(currentProviderSearch)}&language=en-US&page=${currentProviderPage}`; else { let genreParam = currentProviderGenre ? `&with_genres=${currentProviderGenre}` : ''; url = `${BASE}/discover/${endpoint}?api_key=${API_KEY}&with_watch_providers=${currentProviderId}&watch_region=US&sort_by=popularity.desc${genreParam}&language=en-US&page=${currentProviderPage}`; } try { const res = await fetch(url); const data = await res.json(); const totalPages = Math.min(data.total_pages, 10); grid.innerHTML = ''; data.results.forEach(item => createCard(item, currentProviderType === 'tv', 'providerGrid')); pag.innerHTML = ''; for (let i = 1; i <= totalPages; i++) { const btn = document.createElement('button'); btn.textContent = i; btn.className = `page-btn ${i === currentProviderPage ? 'active' : ''}`; btn.onclick = () => { currentProviderPage = i; loadProviderContent(); }; pag.appendChild(btn); } if (data.results.length === 0) grid.innerHTML = '<div style="grid-column:1/-1; text-align:center;">No results found.</div>'; } catch(e) { console.error(e); grid.innerHTML = '<div>Error loading content</div>'; } }
function showProvider(providerName, providerId) { document.getElementById('mainContent').style.display = 'none'; document.getElementById('favoritesSection').classList.remove('active'); document.getElementById('watchlistSection').classList.remove('active'); document.getElementById('searchResultsContainer').style.display = 'none'; const provSec = document.getElementById('providerSection'); provSec.style.display = 'block'; document.getElementById('providerTitle').innerHTML = `<i class="fab fa-${providerName.toLowerCase()}"></i> ${providerName}`; currentProviderId = providerId; currentProviderType = 'movie'; currentProviderPage = 1; currentProviderSearch = ''; currentProviderGenre = ''; document.getElementById('providerSearch').value = ''; document.querySelectorAll('.provider-tab').forEach(tab => { if (tab.dataset.type === 'movie') tab.classList.add('active'); else tab.classList.remove('active'); }); renderProviderGenres(); loadProviderContent(); }

// Genres hover window
function initGenresHoverWindow() { const genresList = [{id:28,name:"Action"},{id:12,name:"Adventure"},{id:16,name:"Animation"},{id:35,name:"Comedy"},{id:80,name:"Crime"},{id:99,name:"Documentary"},{id:18,name:"Drama"},{id:10751,name:"Family"},{id:14,name:"Fantasy"},{id:36,name:"History"},{id:27,name:"Horror"},{id:10402,name:"Music"},{id:9648,name:"Mystery"},{id:10749,name:"Romance"},{id:878,name:"Sci-Fi"},{id:10770,name:"TV Movie"},{id:53,name:"Thriller"},{id:10752,name:"War"},{id:37,name:"Western"}]; const container = document.getElementById('genresWindowContent'); if (!container) return; container.innerHTML = ''; genresList.forEach(genre => { const btn = document.createElement('button'); btn.textContent = genre.name; btn.className = 'genre-window-btn'; btn.onclick = () => { const targetSection = document.querySelector(`.genre-section[data-genre-id="${genre.id}"]`); if(targetSection) targetSection.scrollIntoView({behavior:'smooth'}); else showToast(`Genre "${genre.name}" will load soon`); }; container.appendChild(btn); }); }

function initSidebarSearch() { const searchInput = document.getElementById('sidebarSearchInput'); if(!searchInput) return; let debounce; searchInput.addEventListener('input',(e)=>{ clearTimeout(debounce); const val = e.target.value.trim(); if(val.length >= 3){ debounce = setTimeout(()=>{ searchContent(val); document.getElementById('mainContent').style.display='none'; document.getElementById('searchResultsContainer').style.display='block'; },500); } else if(val.length === 0){ document.getElementById('searchResultsContainer').style.display='none'; document.getElementById('mainContent').style.display='block'; } }); }

function showMainContent() { document.getElementById('mainContent').style.display = 'block'; document.getElementById('favoritesSection').classList.remove('active'); document.getElementById('watchlistSection').classList.remove('active'); document.getElementById('searchResultsContainer').style.display = 'none'; document.getElementById('providerSection').style.display = 'none'; displayContinueWatching(); }
function showFavorites() { document.getElementById('mainContent').style.display = 'none'; document.getElementById('searchResultsContainer').style.display = 'none'; document.getElementById('watchlistSection').classList.remove('active'); document.getElementById('providerSection').style.display = 'none'; document.getElementById('favoritesSection').classList.add('active'); displayFavorites(); }
function showWatchlist() { document.getElementById('mainContent').style.display = 'none'; document.getElementById('searchResultsContainer').style.display = 'none'; document.getElementById('favoritesSection').classList.remove('active'); document.getElementById('providerSection').style.display = 'none'; document.getElementById('watchlistSection').classList.add('active'); displayWatchlist(); }

document.getElementById('searchInputSlider').addEventListener('input', e => searchContent(e.target.value));
document.getElementById('userIconSidebar').onclick = () => document.getElementById('authModal').style.display = 'flex';
document.querySelector('.close-modal').onclick = () => document.getElementById('authModal').style.display = 'none';
document.getElementById('demoLoginBtn').onclick = () => { showToast('Demo login'); document.getElementById('authModal').style.display = 'none'; };
document.getElementById('googleSignInBtn').onclick = async () => { try { await signInWithPopup(auth, googleProvider); showToast('Welcome'); document.getElementById('authModal').style.display = 'none'; } catch(e) { showToast('Google error'); } };
document.getElementById('homeLink').addEventListener('click', (e) => { e.preventDefault(); showMainContent(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
document.getElementById('moviesLink').addEventListener('click', (e) => { e.preventDefault(); showMainContent(); document.querySelector('.genre-section')?.scrollIntoView({ behavior: 'smooth' }); });
document.getElementById('favoritesLink').addEventListener('click', (e) => { e.preventDefault(); showFavorites(); });
document.getElementById('watchlistLink').addEventListener('click', (e) => { e.preventDefault(); showWatchlist(); });
document.getElementById('backToHomeBtnFav').addEventListener('click', () => showMainContent());
document.getElementById('backToHomeBtnWatch').addEventListener('click', () => showMainContent());
document.getElementById('backFromProviderBtn').addEventListener('click', () => showMainContent());
document.getElementById('netflixLink').addEventListener('click', (e) => { e.preventDefault(); showProvider('Netflix', PROVIDER_IDS.netflix); });
document.getElementById('primeLink').addEventListener('click', (e) => { e.preventDefault(); showProvider('Prime', PROVIDER_IDS.prime); });
document.getElementById('disneyLink').addEventListener('click', (e) => { e.preventDefault(); showProvider('Disney+', PROVIDER_IDS.disney); });
document.getElementById('providerSearch').addEventListener('input', (e) => { currentProviderSearch = e.target.value; if (currentProviderSearch.length >= 3 || currentProviderSearch.length === 0) { currentProviderPage = 1; loadProviderContent(); } });
document.querySelectorAll('.provider-tab').forEach(tab => { tab.addEventListener('click', () => { document.querySelectorAll('.provider-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); currentProviderType = tab.dataset.type; currentProviderPage = 1; currentProviderSearch = ''; currentProviderGenre = ''; document.getElementById('providerSearch').value = ''; renderProviderGenres(); loadProviderContent(); }); });

const scrollBtn = document.getElementById('scrollToTopBtn');
window.addEventListener('scroll', () => { scrollBtn.style.display = window.scrollY > 300 ? 'block' : 'none'; });
scrollBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

onAuthStateChanged(auth, (user) => { currentUser = user; if (user) { syncWithFirebase(); document.getElementById('userIconSidebar').innerHTML = '<i class="fas fa-user-check"></i><span>Logout</span>'; document.getElementById('userIconSidebar').onclick = () => signOut(auth); } else { document.getElementById('userIconSidebar').innerHTML = '<i class="fas fa-user-circle"></i><span>Login</span>'; document.getElementById('userIconSidebar').onclick = () => document.getElementById('authModal').style.display = 'flex'; favorites = JSON.parse(localStorage.getItem('alb_favorites')) || []; watchlist = JSON.parse(localStorage.getItem('alb_watchlist')) || []; continueWatching = JSON.parse(localStorage.getItem('alb_continueWatching')) || []; refreshAllLists(); } });

const genreIds = [28,35,18,27,10749,878,99,80,12,14,10752,37,10402,36];
genreIds.forEach(id => { loadGenreMovies(id, `${id === 28 ? 'action' : id === 35 ? 'comedy' : id === 18 ? 'drama' : id === 27 ? 'horror' : id === 10749 ? 'romance' : id === 878 ? 'scifi' : id === 99 ? 'doc' : id === 80 ? 'crime' : id === 12 ? 'adventure' : id === 14 ? 'fantasy' : id === 10752 ? 'war' : id === 37 ? 'western' : id === 10402 ? 'music' : 'history'}Grid`, `${id === 28 ? 'action' : id === 35 ? 'comedy' : id === 18 ? 'drama' : id === 27 ? 'horror' : id === 10749 ? 'romance' : id === 878 ? 'scifi' : id === 99 ? 'doc' : id === 80 ? 'crime' : id === 12 ? 'adventure' : id === 14 ? 'fantasy' : id === 10752 ? 'war' : id === 37 ? 'western' : id === 10402 ? 'music' : 'history'}Pagination`, 1); });
loadTVShows(1);
loadTopRatedMovies(1);
loadTopRatedTv(1);
loadMoviesByYear(2020, 1, 'year2020Grid', 'year2020Pagination');
loadMoviesByYear(2010, 1, 'year2010Grid', 'year2010Pagination');
loadMoviesByYear(2000, 1, 'year2000Grid', 'year2000Pagination');
loadMoviesByYear(1990, 1, 'year1990Grid', 'year1990Pagination');
loadMoviesByYear(1980, 1, 'year1980Grid', 'year1980Pagination');
initGenresHoverWindow();
initSidebarSearch();
loadHeroSlider();
