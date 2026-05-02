import { auth, db, googleProvider } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---------- KONFIGURIMI TMDB ----------
const API_KEY = '7a98db423d6e3a5ee922a3e51a09d135';
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const BACKDROP = 'https://image.tmdb.org/t/p/original';

let swiper = null;
let activePreview = null;
let previewTimeout = null;
let currentCard = null;
let currentUser = null;

// ---------- STORAGE LOCAL ----------
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

function addFavorite(item) {
    if (!isFavorite(item.id, item.type)) {
        favorites.push({ id: item.id, type: item.type, title: item.title, poster: item.poster });
        saveFavorites();
        if (currentUser) pushToFirebase();
        showToast(`❤️ "${item.title}" added to favorites`);
        updateIcons(item.id, item.type);
        if (document.getElementById('favoritesSection').classList.contains('active')) displayFavorites();
    }
}
function removeFavorite(id, type) {
    const idx = favorites.findIndex(f => f.id == id && f.type === type);
    if (idx !== -1) {
        favorites.splice(idx,1);
        saveFavorites();
        if (currentUser) pushToFirebase();
        showToast(`💔 Removed from favorites`);
        updateIcons(id,type);
        if (document.getElementById('favoritesSection').classList.contains('active')) displayFavorites();
    }
}
function toggleFavorite(id,type,title,poster) {
    if (isFavorite(id,type)) removeFavorite(id,type);
    else addFavorite({ id,type,title,poster });
}

function addWatchlist(item) {
    if (!isWatchlist(item.id, item.type)) {
        watchlist.push({ id: item.id, type: item.type, title: item.title, poster: item.poster });
        saveWatchlist();
        if (currentUser) pushToFirebase();
        showToast(`⏰ "${item.title}" added to watch later`);
        updateIcons(item.id, item.type);
        if (document.getElementById('watchlistSection').classList.contains('active')) displayWatchlist();
    }
}
function removeWatchlist(id, type) {
    const idx = watchlist.findIndex(w => w.id == id && w.type === type);
    if (idx !== -1) {
        watchlist.splice(idx,1);
        saveWatchlist();
        if (currentUser) pushToFirebase();
        showToast(`⏰ Removed from watch later`);
        updateIcons(id,type);
        if (document.getElementById('watchlistSection').classList.contains('active')) displayWatchlist();
    }
}
function toggleWatchlist(id,type,title,poster) {
    if (isWatchlist(id,type)) removeWatchlist(id,type);
    else addWatchlist({ id,type,title,poster });
}

function addToContinueWatching(item, season=null, episode=null) {
    const existing = continueWatching.find(c => c.id === item.id && c.type === item.type);
    if (existing) {
        existing.timestamp = Date.now();
        if (season) existing.season = season;
        if (episode) existing.episode = episode;
    } else {
        continueWatching.unshift({ ...item, timestamp: Date.now(), season, episode });
        if (continueWatching.length > 20) continueWatching.pop();
    }
    saveContinueWatching();
    if (currentUser) pushToFirebase();
    displayContinueWatching();
}

function displayContinueWatching() {
    const section = document.getElementById('continueWatchingSection');
    const grid = document.getElementById('continueWatchingGrid');
    if (!continueWatching.length) {
        section.style.display = 'none';
        return;
    }
    section.style.display = 'block';
    section.classList.add('active');
    grid.innerHTML = '';
    continueWatching.sort((a,b) => b.timestamp - a.timestamp).forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <img class="poster" src="${item.poster ? IMG+item.poster : 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${item.title}" loading="lazy">
            <div class="card-info"><h4>${item.title}</h4><p>Continue watching</p></div>
        `;
        card.addEventListener('click', () => {
            if (item.type === 'tv') window.location.href = `tv.html?id=${item.id}&season=${item.season || 1}&episode=${item.episode || 1}`;
            else window.location.href = `watch.html?id=${item.id}&type=movie`;
        });
        grid.appendChild(card);
    });
}

function displayFavorites() {
    const grid = document.getElementById('favoritesGrid');
    if(!grid) return;
    grid.innerHTML = '';
    if(favorites.length === 0){
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">No favorites yet.</div>';
        return;
    }
    favorites.forEach(fav => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <div class="card-icons">
                <div class="favorite-btn" data-id="${fav.id}" data-type="${fav.type}" data-title="${fav.title.replace(/'/g,"\\'")}" data-poster="${fav.poster||''}"><i class="fas fa-heart"></i></div>
                <div class="watchlater-btn" data-id="${fav.id}" data-type="${fav.type}" data-title="${fav.title.replace(/'/g,"\\'")}" data-poster="${fav.poster||''}"><i class="${isWatchlist(fav.id,fav.type)?'fas':'far'} fa-clock"></i></div>
            </div>
            <img class="poster" src="${fav.poster?IMG+fav.poster:'https://via.placeholder.com/300x450?text=No+Image'}" alt="${fav.title}" loading="lazy">
            <div class="card-info"><h4>${fav.title}</h4><p>⭐ Favorite</p></div>
        `;
        card.addEventListener('click', (e) => {
            if(e.target.closest('.favorite-btn')||e.target.closest('.watchlater-btn')) return;
            if(fav.type === 'tv') window.location.href = `tv.html?id=${fav.id}`;
            else window.location.href = `watch.html?id=${fav.id}&type=movie`;
        });
        const favBtn = card.querySelector('.favorite-btn');
        const watchBtn = card.querySelector('.watchlater-btn');
        favBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(fav.id,fav.type,fav.title,fav.poster); });
        watchBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleWatchlist(fav.id,fav.type,fav.title,fav.poster); });
        grid.appendChild(card);
    });
}

function displayWatchlist() {
    const grid = document.getElementById('watchlistGrid');
    if(!grid) return;
    grid.innerHTML = '';
    if(watchlist.length === 0){
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">No watch later items.</div>';
        return;
    }
    watchlist.forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <div class="card-icons">
                <div class="favorite-btn" data-id="${item.id}" data-type="${item.type}" data-title="${item.title.replace(/'/g,"\\'")}" data-poster="${item.poster||''}"><i class="${isFavorite(item.id,item.type)?'fas':'far'} fa-heart"></i></div>
                <div class="watchlater-btn" data-id="${item.id}" data-type="${item.type}" data-title="${item.title.replace(/'/g,"\\'")}" data-poster="${item.poster||''}"><i class="fas fa-clock"></i></div>
            </div>
            <img class="poster" src="${item.poster?IMG+item.poster:'https://via.placeholder.com/300x450?text=No+Image'}" alt="${item.title}" loading="lazy">
            <div class="card-info"><h4>${item.title}</h4><p>⏰ Watch Later</p></div>
        `;
        card.addEventListener('click', (e) => {
            if(e.target.closest('.favorite-btn')||e.target.closest('.watchlater-btn')) return;
            if(item.type === 'tv') window.location.href = `tv.html?id=${item.id}`;
            else window.location.href = `watch.html?id=${item.id}&type=movie`;
        });
        const favBtn = card.querySelector('.favorite-btn');
        const watchBtn = card.querySelector('.watchlater-btn');
        favBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(item.id,item.type,item.title,item.poster); });
        watchBtn.addEventListener('click', (e) => { e.stopPropagation(); removeWatchlist(item.id,item.type); });
        grid.appendChild(card);
    });
}

// ---------- KRIJIMI I KARTELAVE ----------
function createCard(item, isTv, containerId, append=true) {
    const card = document.createElement('div');
    card.className = isTv ? 'tv-card' : 'movie-card';
    const id = item.id, type = isTv ? 'tv' : 'movie';
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '?';
    const poster = item.poster_path || '';
    const isFav = isFavorite(id, type);
    const isWatch = isWatchlist(id, type);
    card.innerHTML = `
        <div class="card-icons">
            <div class="favorite-btn" data-id="${id}" data-type="${type}" data-title="${title.replace(/'/g,"\\'")}" data-poster="${poster}"><i class="${isFav ? 'fas' : 'far'} fa-heart"></i></div>
            <div class="watchlater-btn" data-id="${id}" data-type="${type}" data-title="${title.replace(/'/g,"\\'")}" data-poster="${poster}"><i class="${isWatch ? 'fas' : 'far'} fa-clock"></i></div>
        </div>
        <img class="poster" src="${poster ? IMG+poster : 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${title}" loading="lazy">
        <div class="card-info"><h4>${title}</h4><p>${year} ⭐ ${rating}</p></div>
    `;
    let hoverTimeout;
    card.addEventListener('mouseenter', () => { if(window.innerWidth>768) hoverTimeout = setTimeout(() => showRichPreview(item, card, isTv), 400); });
    card.addEventListener('mouseleave', () => { clearTimeout(hoverTimeout); if(window.innerWidth>768) setTimeout(() => { if(activePreview && !activePreview.matches(':hover') && !card.matches(':hover')) removePreview(); }, 100); });
    card.addEventListener('click', (e) => {
        if(e.target.closest('.favorite-btn') || e.target.closest('.watchlater-btn')) return;
        if(isTv) window.location.href = `tv.html?id=${id}`;
        else window.location.href = `watch.html?id=${id}&type=movie`;
    });
    const favBtn = card.querySelector('.favorite-btn');
    const watchBtn = card.querySelector('.watchlater-btn');
    favBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(id, type, title, poster); });
    watchBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleWatchlist(id, type, title, poster); });
    if(append) document.getElementById(containerId).appendChild(card);
    return card;
}

async function showRichPreview(item, cardEl, isTv) {
    if (window.innerWidth <= 768) return;
    if (activePreview && currentCard === cardEl) return;
    removePreview();
    currentCard = cardEl;
    const id = item.id;
    const type = isTv ? 'tv' : 'movie';
    try {
        const detailsRes = await fetch(`${BASE}/${type}/${id}?api_key=${API_KEY}&language=en-US`);
        const details = await detailsRes.json();
        const videosRes = await fetch(`${BASE}/${type}/${id}/videos?api_key=${API_KEY}`);
        const videos = await videosRes.json();
        const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        const title = details.title || details.name;
        const year = (details.release_date || details.first_air_date || '').split('-')[0] || 'N/A';
        const rating = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';
        const overview = details.overview ? details.overview.substring(0, 180) : 'No description';
        const preview = document.createElement('div');
        preview.className = 'preview-rich';
        preview.innerHTML = `
            <div class="preview-trailer">
                ${trailer ? `<iframe src="https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>` : '<div style="height:270px; background:#111; display:flex; align-items:center; justify-content:center;">🎬 No trailer</div>'}
            </div>
            <div class="preview-info">
                <h4>${title} (${year})</h4>
                <p>⭐ ${rating}/10</p>
                <p>${overview}...</p>
            </div>
        `;
        document.body.appendChild(preview);
        activePreview = preview;
        const rect = cardEl.getBoundingClientRect();
        let left = rect.left + rect.width + 15;
        let top = rect.top + window.scrollY;
        if (left + 480 > window.innerWidth) left = rect.left - 490;
        if (top + 450 > window.scrollY + window.innerHeight) top = window.scrollY + window.innerHeight - 460;
        if (top < window.scrollY) top = window.scrollY + 10;
        preview.style.top = top + 'px';
        preview.style.left = left + 'px';
        preview.addEventListener('mouseenter', () => { if (previewTimeout) clearTimeout(previewTimeout); });
        preview.addEventListener('mouseleave', () => { previewTimeout = setTimeout(() => { removePreview(); currentCard = null; }, 300); });
    } catch(e) { console.error(e); }
}

function removePreview() {
    if (activePreview) { activePreview.remove(); activePreview = null; }
    if (previewTimeout) clearTimeout(previewTimeout);
}

// ---------- FUNKSIONET E REJA PËR LISTAT E VEÇANTA ----------
async function loadTopRatedMovies(page = 1, containerGrid, paginationContainer) {
    const grid = document.getElementById(containerGrid);
    const pag = document.getElementById(paginationContainer);
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Loading 100 Best Movies...</div>';
    try {
        const res = await fetch(`${BASE}/movie/top_rated?api_key=${API_KEY}&language=en-US&page=${page}`);
        const data = await res.json();
        const totalPages = Math.min(data.total_pages, 5); // 100 movies (20 per page *5)
        grid.innerHTML = '';
        data.results.forEach(m => createCard(m, false, containerGrid));
        if (pag) {
            pag.innerHTML = '';
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.className = `page-btn ${i === page ? 'active' : ''}`;
                btn.onclick = () => loadTopRatedMovies(i, containerGrid, paginationContainer);
                pag.appendChild(btn);
            }
        }
    } catch(e) { console.error(e); grid.innerHTML = '<div>Error</div>'; }
}

async function loadTopRatedTv(page = 1, containerGrid, paginationContainer) {
    const grid = document.getElementById(containerGrid);
    const pag = document.getElementById(paginationContainer);
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Loading 100 Greatest TV Shows...</div>';
    try {
        const res = await fetch(`${BASE}/tv/top_rated?api_key=${API_KEY}&language=en-US&page=${page}`);
        const data = await res.json();
        const totalPages = Math.min(data.total_pages, 5);
        grid.innerHTML = '';
        data.results.forEach(show => createCard(show, true, containerGrid));
        if (pag) {
            pag.innerHTML = '';
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.className = `page-btn ${i === page ? 'active' : ''}`;
                btn.onclick = () => loadTopRatedTv(i, containerGrid, paginationContainer);
                pag.appendChild(btn);
            }
        }
    } catch(e) { console.error(e); grid.innerHTML = '<div>Error</div>'; }
}

async function loadMoviesByYear(year, page = 1, containerGrid, paginationContainer) {
    const grid = document.getElementById(containerGrid);
    const pag = document.getElementById(paginationContainer);
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Loading...</div>';
    try {
        const res = await fetch(`${BASE}/discover/movie?api_key=${API_KEY}&sort_by=popularity.desc&primary_release_year=${year}&vote_count.gte=100&page=${page}`);
        const data = await res.json();
        const totalPages = Math.min(data.total_pages, 4);
        grid.innerHTML = '';
        data.results.forEach(m => createCard(m, false, containerGrid));
        if (pag) {
            pag.innerHTML = '';
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.className = `page-btn ${i === page ? 'active' : ''}`;
                btn.onclick = () => loadMoviesByYear(year, i, containerGrid, paginationContainer);
                pag.appendChild(btn);
            }
        }
    } catch(e) { console.error(e); grid.innerHTML = '<div>Error</div>'; }
}

// Ngarkimi i zhanreve (i njëjti si më parë, por me renditje sipas popullaritetit)
async function loadGenreMovies(genreId, gridId, pagId, page = 1) {
    const grid = document.getElementById(gridId);
    const pagContainer = document.getElementById(pagId);
    if (!grid) return;
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px;">Loading...</div>';
    try {
        const res = await fetch(`${BASE}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&vote_count.gte=100&language=en-US&page=${page}`);
        const data = await res.json();
        const totalPages = Math.min(data.total_pages, 6);
        grid.innerHTML = '';
        data.results.forEach(m => createCard(m, false, gridId));
        pagContainer.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `page-btn ${i === page ? 'active' : ''}`;
            btn.onclick = () => loadGenreMovies(genreId, gridId, pagId, i);
            pagContainer.appendChild(btn);
        }
        if (data.results.length === 0) grid.innerHTML = '<div style="grid-column:1/-1; text-align:center;">No movies found.</div>';
    } catch(e) { console.error(e); grid.innerHTML = '<div>Error loading movies</div>'; }
}

// Hero slider, search, tvshows (i pandryshuar)
async function loadHeroSlider() { /* si më parë - ruajeni nga versioni i mëparshëm, po e shkruaj shkurt por në kodin final duhet të jetë i plotë */ }
async function searchContent(query) { /* si më parë */ }

// ---------- DRITARJA E ZHANREVE (Genres Window) ----------
function initGenresWindow() {
    const genresList = [
        { id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 16, name: "Animation" },
        { id: 35, name: "Comedy" }, { id: 80, name: "Crime" }, { id: 99, name: "Documentary" },
        { id: 18, name: "Drama" }, { id: 10751, name: "Family" }, { id: 14, name: "Fantasy" },
        { id: 36, name: "History" }, { id: 27, name: "Horror" }, { id: 10402, name: "Music" },
        { id: 9648, name: "Mystery" }, { id: 10749, name: "Romance" }, { id: 878, name: "Sci-Fi" },
        { id: 10770, name: "TV Movie" }, { id: 53, name: "Thriller" }, { id: 10752, name: "War" },
        { id: 37, name: "Western" }
    ];
    const container = document.getElementById('genresWindowContent');
    if (!container) return;
    container.innerHTML = '';
    genresList.forEach(genre => {
        const btn = document.createElement('button');
        btn.textContent = genre.name;
        btn.className = 'genre-window-btn';
        btn.onclick = () => {
            // Klikimi e mbyll dritaren dhe lëviz te zhanri përkatës në faqe
            document.getElementById('genresWindow').style.display = 'none';
            const targetSection = document.querySelector(`.genre-section[data-genre-id="${genre.id}"]`);
            if (targetSection) {
                targetSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                showToast(`Genre "${genre.name}" is loading...`);
                // Nëse nuk ekziston, mund ta shtojmë dinamikisht, por për thjeshtësi këshillohet të jetë prezent në HTML
            }
        };
        container.appendChild(btn);
    });
    // Shfaq/dhe fshih dritaren
    const genresLink = document.getElementById('genresLink');
    const genresWindow = document.getElementById('genresWindow');
    const closeBtn = document.getElementById('closeGenresWindowBtn');
    genresLink.onclick = (e) => {
        e.preventDefault();
        genresWindow.style.display = 'flex';
    };
    closeBtn.onclick = () => { genresWindow.style.display = 'none'; };
    // Dritarja nuk mbyllet kur largohet mouse-i, por vetëm me butonin X ose klikim jashtë (opsionale)
    window.onclick = (e) => { if (e.target === genresWindow) genresWindow.style.display = 'none'; };
}

// ---------- SIDEBAR SEARCH ----------
function initSidebarSearch() {
    const searchInput = document.getElementById('sidebarSearchInput');
    if (!searchInput) return;
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        if (query.length >= 3) {
            debounceTimer = setTimeout(() => {
                searchContent(query);
                // Pasi shfaqen rezultatet, fshih mainContent dhe shfaq searchResultsContainer
                document.getElementById('mainContent').style.display = 'none';
                document.getElementById('searchResultsContainer').style.display = 'block';
            }, 500);
        } else if (query.length === 0) {
            document.getElementById('searchResultsContainer').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
        }
    });
}

// ---------- INICIALIZIMI I SEKSIONEVE TË REJA ----------
function initSpecialLists() {
    loadTopRatedMovies(1, 'topMoviesGrid', 'topMoviesPagination');
    loadTopRatedTv(1, 'topTvGrid', 'topTvPagination');
    loadMoviesByYear(2020, 1, 'year2020Grid', 'year2020Pagination');
    loadMoviesByYear(2010, 1, 'year2010Grid', 'year2010Pagination');
    loadMoviesByYear(2000, 1, 'year2000Grid', 'year2000Pagination');
    loadMoviesByYear(1990, 1, 'year1990Grid', 'year1990Pagination');
    loadMoviesByYear(1980, 1, 'year1980Grid', 'year1980Pagination');
}

// ---------- LAZY LOADING PËR ZHANRET E ZAKONSHME ----------
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const section = entry.target;
            const genreId = section.dataset.genreId;
            const grid = section.querySelector('.movies-grid');
            const pag = section.querySelector('.pagination-controls');
            if (genreId && grid && !section.dataset.loaded) {
                section.dataset.loaded = 'true';
                loadGenreMovies(parseInt(genreId), grid.id, pag.id, 1);
            }
            observer.unobserve(section);
        }
    });
}, { threshold: 0.1 });
document.querySelectorAll('.genre-section[data-genre-id]').forEach(s => observer.observe(s));

// ---------- PROVIDER LOGJIKA (i pandryshuar) ----------
const PROVIDER_IDS = { netflix:8, prime:9, disney:337 };
let currentProviderId = null, currentProviderType = 'movie', currentProviderPage = 1, currentProviderSearch = '', currentProviderGenre = '';
function showProvider(providerName, providerId) { /* si më parë */ }
function loadProviderContent() { /* si më parë */ }
function renderProviderGenres() { /* si më parë */ }

// ---------- NAVIGIMI DHE UI ----------
function showMainContent() {
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('favoritesSection').classList.remove('active');
    document.getElementById('watchlistSection').classList.remove('active');
    document.getElementById('searchResultsContainer').style.display = 'none';
    document.getElementById('providerSection').style.display = 'none';
    displayContinueWatching();
}
function showFavorites() { /* ... */ }
function showWatchlist() { /* ... */ }
function refreshAllLists() { displayFavorites(); displayWatchlist(); displayContinueWatching(); }

// Event listeners për linkjet
document.getElementById('homeLink').onclick = (e) => { e.preventDefault(); showMainContent(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
document.getElementById('moviesLink').onclick = (e) => { e.preventDefault(); showMainContent(); document.querySelector('.genre-section')?.scrollIntoView({ behavior: 'smooth' }); };
document.getElementById('favoritesLink').onclick = (e) => { e.preventDefault(); showFavorites(); };
document.getElementById('watchlistLink').onclick = (e) => { e.preventDefault(); showWatchlist(); };
document.getElementById('netflixLink').onclick = (e) => { e.preventDefault(); showProvider('Netflix', PROVIDER_IDS.netflix); };
document.getElementById('primeLink').onclick = (e) => { e.preventDefault(); showProvider('Prime', PROVIDER_IDS.prime); };
document.getElementById('disneyLink').onclick = (e) => { e.preventDefault(); showProvider('Disney+', PROVIDER_IDS.disney); };
document.getElementById('backToHomeBtnFav').onclick = () => showMainContent();
document.getElementById('backToHomeBtnWatch').onclick = () => showMainContent();
document.getElementById('backFromProviderBtn').onclick = () => showMainContent();
document.getElementById('providerSearch').addEventListener('input', (e) => { currentProviderSearch = e.target.value; if (currentProviderSearch.length >= 3 || currentProviderSearch.length === 0) { currentProviderPage = 1; loadProviderContent(); } });
document.querySelectorAll('.provider-tab').forEach(tab => { tab.addEventListener('click', () => { /* ... */ }); });

document.getElementById('userIconSidebar').onclick = () => document.getElementById('authModal').style.display = 'flex';
document.querySelector('.close-modal').onclick = () => document.getElementById('authModal').style.display = 'none';
document.getElementById('demoLoginBtn').onclick = () => { showToast('Demo login'); document.getElementById('authModal').style.display = 'none'; };
document.getElementById('googleSignInBtn').onclick = async () => { try { await signInWithPopup(auth, googleProvider); showToast('Welcome'); document.getElementById('authModal').style.display = 'none'; } catch(e) { showToast('Google error'); } };

const scrollBtn = document.getElementById('scrollToTopBtn');
window.addEventListener('scroll', () => { scrollBtn.style.display = window.scrollY > 300 ? 'block' : 'none'; });
scrollBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) { syncWithFirebase(); document.getElementById('userIconSidebar').innerHTML = '<i class="fas fa-user-check"></i><span>Logout</span>'; document.getElementById('userIconSidebar').onclick = () => signOut(auth); }
    else { document.getElementById('userIconSidebar').innerHTML = '<i class="fas fa-user-circle"></i><span>Login</span>'; document.getElementById('userIconSidebar').onclick = () => document.getElementById('authModal').style.display = 'flex'; favorites = JSON.parse(localStorage.getItem('alb_favorites')) || []; watchlist = JSON.parse(localStorage.getItem('alb_watchlist')) || []; continueWatching = JSON.parse(localStorage.getItem('alb_continueWatching')) || []; refreshAllLists(); }
});

// Ngarkimi fillestar
loadHeroSlider();
initSpecialLists();
initGenresWindow();
initSidebarSearch();
// Zhanret e zakonshme do të ngarkohen nga lazy observer
