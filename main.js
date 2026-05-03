import { auth, db, googleProvider } from './firebase-config.js';
import { signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configuration
const API_KEY = '7a98db423d6e3a5ee922a3e51a09d135';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_URL = 'https://image.tmdb.org/t/p/original';

// Global variables
let swiper = null;
let currentUser = null;
let favorites = JSON.parse(localStorage.getItem('alb_favorites')) || [];
let watchlist = JSON.parse(localStorage.getItem('alb_watchlist')) || [];
let continueWatching = JSON.parse(localStorage.getItem('alb_continueWatching')) || [];

// Helper functions
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function saveToLocalStorage() {
    localStorage.setItem('alb_favorites', JSON.stringify(favorites));
    localStorage.setItem('alb_watchlist', JSON.stringify(watchlist));
    localStorage.setItem('alb_continueWatching', JSON.stringify(continueWatching));
}

// Firebase sync functions
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
    saveToLocalStorage();
    refreshAllLists();
}

async function pushToFirebase() {
    if (!currentUser) return;
    const userRef = doc(db, 'users', currentUser.uid);
    await setDoc(userRef, { favorites, watchlist, continueWatching }, { merge: true });
}

// Favorites and Watchlist functions
function isFavorite(id, type) {
    return favorites.some(f => f.id === id && f.type === type);
}

function isWatchlist(id, type) {
    return watchlist.some(w => w.id === id && w.type === type);
}

function addFavorite(item) {
    if (!isFavorite(item.id, item.type)) {
        favorites.push(item);
        saveToLocalStorage();
        if (currentUser) pushToFirebase();
        showToast(`❤️ "${item.title}" added to favorites`);
        updateFavoriteIcons(item.id, item.type);
        if (document.getElementById('favoritesSection').classList.contains('active')) {
            displayFavorites();
        }
    }
}

function removeFavorite(id, type) {
    const index = favorites.findIndex(f => f.id === id && f.type === type);
    if (index !== -1) {
        favorites.splice(index, 1);
        saveToLocalStorage();
        if (currentUser) pushToFirebase();
        showToast(`💔 Removed from favorites`);
        updateFavoriteIcons(id, type);
        if (document.getElementById('favoritesSection').classList.contains('active')) {
            displayFavorites();
        }
    }
}

function toggleFavorite(id, type, title, poster) {
    if (isFavorite(id, type)) {
        removeFavorite(id, type);
    } else {
        addFavorite({ id, type, title, poster });
    }
}

function addToWatchlist(item) {
    if (!isWatchlist(item.id, item.type)) {
        watchlist.push(item);
        saveToLocalStorage();
        if (currentUser) pushToFirebase();
        showToast(`⏰ "${item.title}" added to watch later`);
        updateWatchlistIcons(item.id, item.type);
        if (document.getElementById('watchlistSection').classList.contains('active')) {
            displayWatchlist();
        }
    }
}

function removeFromWatchlist(id, type) {
    const index = watchlist.findIndex(w => w.id === id && w.type === type);
    if (index !== -1) {
        watchlist.splice(index, 1);
        saveToLocalStorage();
        if (currentUser) pushToFirebase();
        showToast(`⏰ Removed from watch later`);
        updateWatchlistIcons(id, type);
        if (document.getElementById('watchlistSection').classList.contains('active')) {
            displayWatchlist();
        }
    }
}

function toggleWatchlist(id, type, title, poster) {
    if (isWatchlist(id, type)) {
        removeFromWatchlist(id, type);
    } else {
        addToWatchlist({ id, type, title, poster });
    }
}

function addToContinueWatching(item, season = null, episode = null) {
    const existing = continueWatching.find(c => c.id === item.id && c.type === item.type);
    if (existing) {
        existing.timestamp = Date.now();
        if (season) existing.season = season;
        if (episode) existing.episode = episode;
    } else {
        continueWatching.unshift({ ...item, timestamp: Date.now(), season, episode });
        if (continueWatching.length > 20) continueWatching.pop();
    }
    saveToLocalStorage();
    if (currentUser) pushToFirebase();
    displayContinueWatching();
}

function updateFavoriteIcons(id, type) {
    const isFav = isFavorite(id, type);
    document.querySelectorAll(`.favorite-btn[data-id="${id}"][data-type="${type}"]`).forEach(btn => {
        const icon = btn.querySelector('i');
        if (isFav) {
            icon.className = 'fas fa-heart';
        } else {
            icon.className = 'far fa-heart';
        }
    });
}

function updateWatchlistIcons(id, type) {
    const isWatch = isWatchlist(id, type);
    document.querySelectorAll(`.watchlater-btn[data-id="${id}"][data-type="${type}"]`).forEach(btn => {
        const icon = btn.querySelector('i');
        if (isWatch) {
            icon.className = 'fas fa-clock';
        } else {
            icon.className = 'far fa-clock';
        }
    });
}

// Display functions
function displayFavorites() {
    const grid = document.getElementById('favoritesGrid');
    if (!grid) return;
    
    if (favorites.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">No favorites yet.</div>';
        return;
    }
    
    grid.innerHTML = '';
    favorites.forEach(fav => {
        const card = createCardElement({
            id: fav.id,
            title: fav.title,
            poster_path: fav.poster,
            type: fav.type,
            vote_average: 0,
            release_date: ''
        }, fav.type === 'tv');
        grid.appendChild(card);
    });
}

function displayWatchlist() {
    const grid = document.getElementById('watchlistGrid');
    if (!grid) return;
    
    if (watchlist.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">No watch later items.</div>';
        return;
    }
    
    grid.innerHTML = '';
    watchlist.forEach(item => {
        const card = createCardElement({
            id: item.id,
            title: item.title,
            poster_path: item.poster,
            type: item.type,
            vote_average: 0,
            release_date: ''
        }, item.type === 'tv');
        grid.appendChild(card);
    });
}

function displayContinueWatching() {
    const section = document.getElementById('continueWatchingSection');
    const grid = document.getElementById('continueWatchingGrid');
    
    if (continueWatching.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    grid.innerHTML = '';
    
    continueWatching.sort((a, b) => b.timestamp - a.timestamp).forEach(item => {
        const card = document.createElement('div');
        card.className = 'movie-card';
        card.innerHTML = `
            <img class="poster" src="${item.poster ? IMG_URL + item.poster : 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${item.title}" loading="lazy">
            <div class="card-info">
                <h4>${item.title}</h4>
                <p>Continue watching</p>
            </div>
        `;
        card.addEventListener('click', () => {
            if (item.type === 'tv') {
                window.location.href = `tv.html?id=${item.id}&season=${item.season || 1}&episode=${item.episode || 1}`;
            } else {
                window.location.href = `watch.html?id=${item.id}&type=movie`;
            }
        });
        grid.appendChild(card);
    });
}

function refreshAllLists() {
    displayFavorites();
    displayWatchlist();
    displayContinueWatching();
}

// Card creation with event listeners
function createCardElement(item, isTv) {
    const card = document.createElement('div');
    card.className = isTv ? 'tv-card' : 'movie-card';
    const id = item.id;
    const type = isTv ? 'tv' : 'movie';
    const title = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').split('-')[0] || 'N/A';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '?';
    const poster = item.poster_path || '';
    const isFav = isFavorite(id, type);
    const isWatch = isWatchlist(id, type);
    
    card.innerHTML = `
        <div class="card-icons">
            <div class="favorite-btn" data-id="${id}" data-type="${type}" data-title="${title.replace(/'/g, "\\'")}" data-poster="${poster}">
                <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
            </div>
            <div class="watchlater-btn" data-id="${id}" data-type="${type}" data-title="${title.replace(/'/g, "\\'")}" data-poster="${poster}">
                <i class="${isWatch ? 'fas' : 'far'} fa-clock"></i>
            </div>
        </div>
        <img class="poster" src="${poster ? IMG_URL + poster : 'https://via.placeholder.com/300x450?text=No+Image'}" alt="${title}" loading="lazy">
        <div class="card-info">
            <h4>${title}</h4>
            <p>${year} ⭐ ${rating}</p>
        </div>
    `;
    
    // Hover preview
    let hoverTimeout;
    card.addEventListener('mouseenter', () => {
        if (window.innerWidth > 768) {
            hoverTimeout = setTimeout(() => showRichPreview(item, card, isTv), 500);
        }
    });
    card.addEventListener('mouseleave', () => {
        clearTimeout(hoverTimeout);
        removePreview();
    });
    
    // Click to watch
    card.addEventListener('click', (e) => {
        if (e.target.closest('.favorite-btn') || e.target.closest('.watchlater-btn')) return;
        if (isTv) {
            window.location.href = `tv.html?id=${id}`;
        } else {
            window.location.href = `watch.html?id=${id}&type=movie`;
        }
    });
    
    // Favorite button
    const favBtn = card.querySelector('.favorite-btn');
    favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(id, type, title, poster);
    });
    
    // Watchlist button
    const watchBtn = card.querySelector('.watchlater-btn');
    watchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleWatchlist(id, type, title, poster);
    });
    
    return card;
}

// Rich preview on hover
let activePreview = null;
let previewTimeout = null;

async function showRichPreview(item, cardEl, isTv) {
    if (window.innerWidth <= 768) return;
    removePreview();
    
    const id = item.id;
    const type = isTv ? 'tv' : 'movie';
    
    try {
        const [details, videos] = await Promise.all([
            fetch(`${BASE_URL}/${type}/${id}?api_key=${API_KEY}&language=en-US`).then(r => r.json()),
            fetch(`${BASE_URL}/${type}/${id}/videos?api_key=${API_KEY}`).then(r => r.json())
        ]);
        
        const trailer = videos.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube');
        const title = details.title || details.name;
        const year = (details.release_date || details.first_air_date || '').split('-')[0] || 'N/A';
        const rating = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';
        const overview = details.overview ? details.overview.substring(0, 180) : 'No description';
        
        const preview = document.createElement('div');
        preview.className = 'preview-rich';
        preview.innerHTML = `
            <div class="preview-trailer">
                ${trailer ? `<iframe src="https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>` : '<div style="height:270px; background:#111; display:flex; align-items:center; justify-content:center;">🎬 No trailer available</div>'}
            </div>
            <div class="preview-info">
                <h4>${title} (${year})</h4>
                <p>⭐ ${rating}/10</p>
                <p>${overview}...</p>
            </div>
        `;
        
        document.body.appendChild(preview);
        activePreview = preview;
        
        // Position preview
        const rect = cardEl.getBoundingClientRect();
        let left = rect.left + rect.width + 15;
        let top = rect.top + window.scrollY;
        
        if (left + 480 > window.innerWidth) {
            left = rect.left - 490;
        }
        if (top + 450 > window.scrollY + window.innerHeight) {
            top = window.scrollY + window.innerHeight - 460;
        }
        if (top < window.scrollY) {
            top = window.scrollY + 10;
        }
        
        preview.style.top = top + 'px';
        preview.style.left = left + 'px';
        
        preview.addEventListener('mouseenter', () => {
            if (previewTimeout) clearTimeout(previewTimeout);
        });
        preview.addEventListener('mouseleave', () => {
            previewTimeout = setTimeout(() => {
                removePreview();
            }, 300);
        });
    } catch (error) {
        console.error('Error loading preview:', error);
    }
}

function removePreview() {
    if (activePreview) {
        activePreview.remove();
        activePreview = null;
    }
    if (previewTimeout) {
        clearTimeout(previewTimeout);
    }
}

// API data loading functions
async function loadGenreMovies(genreId, gridId, paginationId, page = 1) {
    const grid = document.getElementById(gridId);
    const pagination = document.getElementById(paginationId);
    if (!grid) return;
    
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Loading...</div>';
    
    try {
        const response = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&vote_count.gte=100&page=${page}`);
        const data = await response.json();
        const totalPages = Math.min(data.total_pages, 6);
        
        grid.innerHTML = '';
        data.results.forEach(movie => {
            grid.appendChild(createCardElement(movie, false));
        });
        
        // Update pagination
        pagination.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `page-btn ${i === page ? 'active' : ''}`;
            btn.onclick = () => loadGenreMovies(genreId, gridId, paginationId, i);
            pagination.appendChild(btn);
        }
    } catch (error) {
        console.error('Error loading genre movies:', error);
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Error loading movies. Please try again later.</div>';
    }
}

async function loadTVShows(page = 1) {
    const grid = document.getElementById('tvSeriesGrid');
    const pagination = document.getElementById('tvPagination');
    if (!grid) return;
    
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Loading TV shows...</div>';
    
    try {
        const response = await fetch(`${BASE_URL}/tv/top_rated?api_key=${API_KEY}&page=${page}`);
        const data = await response.json();
        const totalPages = Math.min(data.total_pages, 8);
        
        grid.innerHTML = '';
        data.results.forEach(show => {
            grid.appendChild(createCardElement(show, true));
        });
        
        // Update pagination
        pagination.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `page-btn ${i === page ? 'active' : ''}`;
            btn.onclick = () => loadTVShows(i);
            pagination.appendChild(btn);
        }
    } catch (error) {
        console.error('Error loading TV shows:', error);
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Error loading TV shows. Please try again later.</div>';
    }
}

async function loadHeroSlider() {
    try {
        const response = await fetch(`${BASE_URL}/trending/movie/day?api_key=${API_KEY}`);
        const data = await response.json();
        const slides = data.results.slice(0, 6);
        const wrapper = document.getElementById('heroSlider');
        wrapper.innerHTML = '';
        
        for (const movie of slides) {
            const [details, credits] = await Promise.all([
                fetch(`${BASE_URL}/movie/${movie.id}?api_key=${API_KEY}`).then(r => r.json()),
                fetch(`${BASE_URL}/movie/${movie.id}/credits?api_key=${API_KEY}`).then(r => r.json())
            ]);
            
            const rating = details.vote_average ? details.vote_average.toFixed(1) : 'N/A';
            const cast = credits.cast ? credits.cast.slice(0, 3).map(c => c.name).join(', ') : 'Information not available';
            const overview = details.overview ? details.overview.substring(0, 150) : 'No description available.';
            
            const slide = document.createElement('div');
            slide.className = 'swiper-slide';
            slide.innerHTML = `
                <img class="slide-bg" src="${BACKDROP_URL + movie.backdrop_path}" alt="${movie.title}">
                <div class="slide-overlay"></div>
                <div class="slide-description-card">
                    <h2>${movie.title}</h2>
                    <div class="slide-meta">
                        <span class="rating"><i class="fas fa-star"></i> ${rating}/10</span>
                        <span><i class="fas fa-calendar-alt"></i> ${details.release_date?.split('-')[0] || 'N/A'}</span>
                        <span><i class="fas fa-clock"></i> ${details.runtime || '?'} min</span>
                    </div>
                    <p>${overview}...</p>
                    <div class="slide-cast"><i class="fas fa-users"></i> <strong>Cast:</strong> ${cast}</div>
                    <button class="btn-watch" onclick="location.href='watch.html?id=${movie.id}&type=movie'"><i class="fas fa-play"></i> Watch Now</button>
                </div>
            `;
            wrapper.appendChild(slide);
        }
        
        // Initialize Swiper
        if (swiper) swiper.destroy();
        swiper = new Swiper('.heroSwiper', {
            loop: true,
            autoplay: { delay: 6000, disableOnInteraction: false },
            navigation: { nextEl: '.swiper-button-next', prevEl: '.swiper-button-prev' },
            pagination: { el: '.swiper-pagination', clickable: true },
            speed: 800
        });
    } catch (error) {
        console.error('Error loading hero slider:', error);
    }
}

async function searchContent(query) {
    const container = document.getElementById('searchResultsContainer');
    const grid = document.getElementById('searchGrid');
    
    if (!query || query.length < 3) {
        container.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`${BASE_URL}/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(query)}`);
        const data = await response.json();
        const results = data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 24);
        
        grid.innerHTML = '';
        if (results.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">No results found.</div>';
        } else {
            results.forEach(item => {
                grid.appendChild(createCardElement(item, item.media_type === 'tv'));
            });
        }
        container.style.display = 'block';
    } catch (error) {
        console.error('Error searching:', error);
    }
}

// Special lists
async function loadTopRatedMovies(page = 1) {
    const grid = document.getElementById('topMoviesGrid');
    const pagination = document.getElementById('topMoviesPagination');
    if (!grid) return;
    
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Loading 100 Best Movies...</div>';
    
    try {
        const response = await fetch(`${BASE_URL}/movie/top_rated?api_key=${API_KEY}&page=${page}`);
        const data = await response.json();
        const totalPages = Math.min(data.total_pages, 5);
        
        grid.innerHTML = '';
        data.results.forEach(movie => {
            grid.appendChild(createCardElement(movie, false));
        });
        
        pagination.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `page-btn ${i === page ? 'active' : ''}`;
            btn.onclick = () => loadTopRatedMovies(i);
            pagination.appendChild(btn);
        }
    } catch (error) {
        console.error('Error loading top rated movies:', error);
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Error loading movies.</div>';
    }
}

async function loadTopRatedTv(page = 1) {
    const grid = document.getElementById('topTvGrid');
    const pagination = document.getElementById('topTvPagination');
    if (!grid) return;
    
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Loading 100 Greatest TV Shows...</div>';
    
    try {
        const response = await fetch(`${BASE_URL}/tv/top_rated?api_key=${API_KEY}&page=${page}`);
        const data = await response.json();
        const totalPages = Math.min(data.total_pages, 5);
        
        grid.innerHTML = '';
        data.results.forEach(show => {
            grid.appendChild(createCardElement(show, true));
        });
        
        pagination.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `page-btn ${i === page ? 'active' : ''}`;
            btn.onclick = () => loadTopRatedTv(i);
            pagination.appendChild(btn);
        }
    } catch (error) {
        console.error('Error loading top rated TV shows:', error);
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Error loading TV shows.</div>';
    }
}

async function loadMoviesByYear(year, page = 1, gridId, paginationId) {
    const grid = document.getElementById(gridId);
    const pagination = document.getElementById(paginationId);
    if (!grid) return;
    
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Loading...</div>';
    
    try {
        const response = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=popularity.desc&primary_release_year=${year}&vote_count.gte=100&page=${page}`);
        const data = await response.json();
        const totalPages = Math.min(data.total_pages, 4);
        
        grid.innerHTML = '';
        data.results.forEach(movie => {
            grid.appendChild(createCardElement(movie, false));
        });
        
        pagination.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `page-btn ${i === page ? 'active' : ''}`;
            btn.onclick = () => loadMoviesByYear(year, i, gridId, paginationId);
            pagination.appendChild(btn);
        }
    } catch (error) {
        console.error(`Error loading movies from ${year}:`, error);
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Error loading movies.</div>';
    }
}

// Provider functions (Netflix, Prime, Disney+)
const PROVIDER_IDS = { netflix: 8, prime: 9, disney: 337 };
let currentProvider = null;
let currentProviderType = 'movie';
let currentProviderPage = 1;
let currentProviderSearch = '';
let currentProviderGenre = '';

const providerGenres = {
    movie: [
        { id: 28, name: 'Action' }, { id: 35, name: 'Comedy' }, { id: 18, name: 'Drama' },
        { id: 27, name: 'Horror' }, { id: 10749, name: 'Romance' }, { id: 878, name: 'Sci-Fi' },
        { id: 99, name: 'Documentary' }, { id: 80, name: 'Crime' }, { id: 12, name: 'Adventure' },
        { id: 14, name: 'Fantasy' }, { id: 10752, name: 'War' }, { id: 37, name: 'Western' }
    ],
    tv: [
        { id: 28, name: 'Action' }, { id: 35, name: 'Comedy' }, { id: 18, name: 'Drama' },
        { id: 80, name: 'Crime' }, { id: 99, name: 'Documentary' }, { id: 16, name: 'Animation' },
        { id: 10765, name: 'Sci-Fi & Fantasy' }, { id: 10759, name: 'Action & Adventure' }
    ]
};

function renderProviderGenres() {
    const container = document.getElementById('providerGenres');
    if (!container) return;
    
    const genres = providerGenres[currentProviderType];
    container.innerHTML = '<button class="provider-genre-btn active" data-genre="">All</button>';
    
    genres.forEach(genre => {
        const btn = document.createElement('button');
        btn.textContent = genre.name;
        btn.className = 'provider-genre-btn';
        btn.dataset.genre = genre.id;
        if (currentProviderGenre == genre.id) btn.classList.add('active');
        btn.onclick = () => {
            document.querySelectorAll('.provider-genre-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentProviderGenre = genre.id;
            currentProviderPage = 1;
            loadProviderContent();
        };
        container.appendChild(btn);
    });
}

async function loadProviderContent() {
    if (!currentProvider) return;
    
    const grid = document.getElementById('providerGrid');
    const pagination = document.getElementById('providerPagination');
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Loading...</div>';
    
    let url = '';
    const endpoint = currentProviderType === 'movie' ? 'movie' : 'tv';
    
    if (currentProviderSearch && currentProviderSearch.length >= 3) {
        url = `${BASE_URL}/search/${endpoint}?api_key=${API_KEY}&query=${encodeURIComponent(currentProviderSearch)}&page=${currentProviderPage}`;
    } else {
        let genreParam = currentProviderGenre ? `&with_genres=${currentProviderGenre}` : '';
        url = `${BASE_URL}/discover/${endpoint}?api_key=${API_KEY}&with_watch_providers=${currentProvider}&watch_region=US&sort_by=popularity.desc${genreParam}&page=${currentProviderPage}`;
    }
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        const totalPages = Math.min(data.total_pages, 10);
        
        grid.innerHTML = '';
        data.results.forEach(item => {
            grid.appendChild(createCardElement(item, currentProviderType === 'tv'));
        });
        
        pagination.innerHTML = '';
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = `page-btn ${i === currentProviderPage ? 'active' : ''}`;
            btn.onclick = () => {
                currentProviderPage = i;
                loadProviderContent();
            };
            pagination.appendChild(btn);
        }
        
        if (data.results.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">No results found.</div>';
        }
    } catch (error) {
        console.error('Error loading provider content:', error);
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">Error loading content.</div>';
    }
}

function showProvider(providerName, providerId) {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('favoritesSection').classList.remove('active');
    document.getElementById('watchlistSection').classList.remove('active');
    document.getElementById('searchResultsContainer').style.display = 'none';
    document.getElementById('continueWatchingSection').style.display = 'none';
    
    const providerSection = document.getElementById('providerSection');
    providerSection.style.display = 'block';
    document.getElementById('providerTitle').innerHTML = `<i class="fab fa-${providerName.toLowerCase()}"></i> ${providerName}`;
    
    currentProvider = providerId;
    currentProviderType = 'movie';
    currentProviderPage = 1;
    currentProviderSearch = '';
    currentProviderGenre = '';
    document.getElementById('providerSearch').value = '';
    
    document.querySelectorAll('.provider-tab').forEach(tab => {
        if (tab.dataset.type === 'movie') {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    renderProviderGenres();
    loadProviderContent();
}

// Genres dropdown
function initGenresDropdown() {
    const genres = [
        { id: 28, name: "Action" }, { id: 12, name: "Adventure" }, { id: 16, name: "Animation" },
        { id: 35, name: "Comedy" }, { id: 80, name: "Crime" }, { id: 99, name: "Documentary" },
        { id: 18, name: "Drama" }, { id: 10751, name: "Family" }, { id: 14, name: "Fantasy" },
        { id: 36, name: "History" }, { id: 27, name: "Horror" }, { id: 10402, name: "Music" },
        { id: 9648, name: "Mystery" }, { id: 10749, name: "Romance" }, { id: 878, name: "Sci-Fi" },
        { id: 10770, name: "TV Movie" }, { id: 53, name: "Thriller" }, { id: 10752, name: "War" },
        { id: 37, name: "Western" }
    ];
    
    const container = document.getElementById('genresDropdownContent');
    if (!container) return;
    
    container.innerHTML = '';
    genres.forEach(genre => {
        const btn = document.createElement('button');
        btn.textContent = genre.name;
        btn.className = 'genre-btn-dropdown';
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Find the genre section and scroll to it
            let targetId = '';
            switch (genre.id) {
                case 28: targetId = 'actionGrid'; break;
                case 35: targetId = 'comedyGrid'; break;
                case 18: targetId = 'dramaGrid'; break;
                case 27: targetId = 'horrorGrid'; break;
                case 10749: targetId = 'romanceGrid'; break;
                case 878: targetId = 'scifiGrid'; break;
                case 99: targetId = 'docGrid'; break;
                case 80: targetId = 'crimeGrid'; break;
                case 12: targetId = 'adventureGrid'; break;
                case 14: targetId = 'fantasyGrid'; break;
                case 10752: targetId = 'warGrid'; break;
                case 37: targetId = 'westernGrid'; break;
                case 10402: targetId = 'musicGrid'; break;
                case 36: targetId = 'historyGrid'; break;
                default: return;
            }
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        };
        container.appendChild(btn);
    });
}

// Navigation functions
function showMainContent() {
    document.getElementById('mainContent').style.display = 'block';
    document.getElementById('favoritesSection').classList.remove('active');
    document.getElementById('watchlistSection').classList.remove('active');
    document.getElementById('searchResultsContainer').style.display = 'none';
    document.getElementById('providerSection').style.display = 'none';
    displayContinueWatching();
}

function showFavorites() {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('searchResultsContainer').style.display = 'none';
    document.getElementById('watchlistSection').classList.remove('active');
    document.getElementById('providerSection').style.display = 'none';
    document.getElementById('continueWatchingSection').style.display = 'none';
    document.getElementById('favoritesSection').classList.add('active');
    displayFavorites();
}

function showWatchlist() {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('searchResultsContainer').style.display = 'none';
    document.getElementById('favoritesSection').classList.remove('active');
    document.getElementById('providerSection').style.display = 'none';
    document.getElementById('continueWatchingSection').style.display = 'none';
    document.getElementById('watchlistSection').classList.add('active');
    displayWatchlist();
}

// Initialize all genre loads
function initializeGenreLoads() {
    loadGenreMovies(28, 'actionGrid', 'actionPagination', 1);
    loadGenreMovies(35, 'comedyGrid', 'comedyPagination', 1);
    loadGenreMovies(18, 'dramaGrid', 'dramaPagination', 1);
    loadGenreMovies(27, 'horrorGrid', 'horrorPagination', 1);
    loadGenreMovies(10749, 'romanceGrid', 'romancePagination', 1);
    loadGenreMovies(878, 'scifiGrid', 'scifiPagination', 1);
    loadGenreMovies(99, 'docGrid', 'docPagination', 1);
    loadGenreMovies(80, 'crimeGrid', 'crimePagination', 1);
    loadGenreMovies(12, 'adventureGrid', 'adventurePagination', 1);
    loadGenreMovies(14, 'fantasyGrid', 'fantasyPagination', 1);
    loadGenreMovies(10752, 'warGrid', 'warPagination', 1);
    loadGenreMovies(37, 'westernGrid', 'westernPagination', 1);
    loadGenreMovies(10402, 'musicGrid', 'musicPagination', 1);
    loadGenreMovies(36, 'historyGrid', 'historyPagination', 1);
}

// Initialize all event listeners
function initEventListeners() {
    document.getElementById('searchInputSlider').addEventListener('input', e => searchContent(e.target.value));
    document.getElementById('sidebarSearchInput').addEventListener('input', e => {
        const query = e.target.value.trim();
        if (query.length >= 3) {
            searchContent(query);
            document.getElementById('mainContent').style.display = 'none';
            document.getElementById('searchResultsContainer').style.display = 'block';
        } else if (query.length === 0) {
            document.getElementById('searchResultsContainer').style.display = 'none';
            document.getElementById('mainContent').style.display = 'block';
        }
    });
    
    document.getElementById('userIconSidebar').onclick = () => document.getElementById('authModal').style.display = 'flex';
    document.querySelector('.close-modal').onclick = () => document.getElementById('authModal').style.display = 'none';
    document.getElementById('googleSignInBtn').onclick = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            showToast(`Welcome ${result.user.displayName}`);
            document.getElementById('authModal').style.display = 'none';
        } catch (error) {
            console.error('Google sign-in error:', error);
            showToast('Google sign-in failed. Please try again.');
        }
    };
    
    document.getElementById('homeLink').addEventListener('click', (e) => {
        e.preventDefault();
        showMainContent();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    document.getElementById('moviesLink').addEventListener('click', (e) => {
        e.preventDefault();
        showMainContent();
        document.querySelector('.genre-section')?.scrollIntoView({ behavior: 'smooth' });
    });
    
    document.getElementById('favoritesLink').addEventListener('click', (e) => {
        e.preventDefault();
        showFavorites();
    });
    
    document.getElementById('watchlistLink').addEventListener('click', (e) => {
        e.preventDefault();
        showWatchlist();
    });
    
    document.getElementById('netflixLink').addEventListener('click', (e) => {
        e.preventDefault();
        showProvider('Netflix', PROVIDER_IDS.netflix);
    });
    
    document.getElementById('primeLink').addEventListener('click', (e) => {
        e.preventDefault();
        showProvider('Prime', PROVIDER_IDS.prime);
    });
    
    document.getElementById('disneyLink').addEventListener('click', (e) => {
        e.preventDefault();
        showProvider('Disney+', PROVIDER_IDS.disney);
    });
    
    document.getElementById('backToHomeBtnFav').addEventListener('click', () => showMainContent());
    document.getElementById('backToHomeBtnWatch').addEventListener('click', () => showMainContent());
    document.getElementById('backFromProviderBtn').addEventListener('click', () => showMainContent());
    
    document.getElementById('providerSearch').addEventListener('input', (e) => {
        currentProviderSearch = e.target.value;
        if (currentProviderSearch.length >= 3 || currentProviderSearch.length === 0) {
            currentProviderPage = 1;
            loadProviderContent();
        }
    });
    
    document.querySelectorAll('.provider-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.provider-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentProviderType = tab.dataset.type;
            currentProviderPage = 1;
            currentProviderSearch = '';
            currentProviderGenre = '';
            document.getElementById('providerSearch').value = '';
            renderProviderGenres();
            loadProviderContent();
        });
    });
    
    // Scroll to top button
    const scrollBtn = document.getElementById('scrollToTopBtn');
    window.addEventListener('scroll', () => {
        scrollBtn.style.display = window.scrollY > 300 ? 'block' : 'none';
    });
    scrollBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Auth state listener
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (user) {
        syncWithFirebase();
        document.getElementById('userIconSidebar').innerHTML = '<i class="fas fa-user-check"></i><span>Logout</span>';
        document.getElementById('userIconSidebar').onclick = () => signOut(auth);
    } else {
        document.getElementById('userIconSidebar').innerHTML = '<i class="fas fa-user-circle"></i><span>Login</span>';
        document.getElementById('userIconSidebar').onclick = () => document.getElementById('authModal').style.display = 'flex';
        favorites = JSON.parse(localStorage.getItem('alb_favorites')) || [];
        watchlist = JSON.parse(localStorage.getItem('alb_watchlist')) || [];
        continueWatching = JSON.parse(localStorage.getItem('alb_continueWatching')) || [];
        refreshAllLists();
    }
});

// Initialization
async function init() {
    showToast('Loading content...');
    await loadHeroSlider();
    initializeGenreLoads();
    await loadTVShows(1);
    await loadTopRatedMovies(1);
    await loadTopRatedTv(1);
    await loadMoviesByYear(2020, 1, 'year2020Grid', 'year2020Pagination');
    await loadMoviesByYear(2010, 1, 'year2010Grid', 'year2010Pagination');
    await loadMoviesByYear(2000, 1, 'year2000Grid', 'year2000Pagination');
    await loadMoviesByYear(1990, 1, 'year1990Grid', 'year1990Pagination');
    await loadMoviesByYear(1980, 1, 'year1980Grid', 'year1980Pagination');
    initGenresDropdown();
    initEventListeners();
    showToast('Welcome to AlbFilms24!');
}

// Start the app
init();
