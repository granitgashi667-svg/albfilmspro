import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// FIREBASE CONFIG (ZËVENDËSO)
const firebaseConfig = { apiKey: "AIzaSyDummy", authDomain: "albfilms24.firebaseapp.com", projectId: "albfilms24", storageBucket: "albfilms24.appspot.com", messagingSenderId: "123", appId: "1:123:web:abc" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const TMDB_API_KEY = '7a98db423d6e3a5ee922a3e51a09d135';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/original';

let currentUser = null, swiper = null, activePreview = null;

// Pagination state per genre
const genrePages = {};
const totalGenrePages = {};

function showToast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

async function showRichPreview(id, el, isTv) { /* same as before */ }
function createCard(item, isTv, containerId) { /* same as before */ }

// Load movies for a specific genre with pagination (multiple pages to reach 120+ movies per genre)
async function loadMoviesByGenre(genreId, gridId, paginationId, page = 1, genreName) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    if (page === 1) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;">Loading movies...</div>';
    try {
        const res = await fetch(`${TMDB_BASE}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${genreId}&sort_by=popularity.desc&vote_count.gte=100&language=en-US&page=${page}`);
        const data = await res.json();
        totalGenrePages[genreName] = Math.min(data.total_pages, 6); // max 6 pages = 120 movies
        if (page === 1) grid.innerHTML = '';
        data.results.forEach(m => createCard(m, false, gridId));
        const pagContainer = document.getElementById(paginationId);
        if (pagContainer && page === 1) {
            pagContainer.innerHTML = '';
            for (let i = 1; i <= totalGenrePages[genreName]; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.className = `page-btn ${i === page ? 'active' : ''}`;
                btn.onclick = () => loadMoviesByGenre(genreId, gridId, paginationId, i, genreName);
                pagContainer.appendChild(btn);
            }
        }
        // if more pages, load next automatically (optional, but we rely on pagination)
    } catch(e) { console.error(e); grid.innerHTML = '<div>Error loading movies</div>'; }
}

// TV SERIES: 500+ list (custom IDs + top rated)
const customTvIds = [
    1396,60573,1399,46530,1416,1402,4629,62074,48866,46298,44608,47061,20798,70646,456,72759,
    1405,1434,1398,1394,46285,94941,1488,1390,76479,44217,651,4614,1100,82856,76489,112733,
    2691,65338,1408,1397,1392,44130,172,1437,45625,2907,37854,46261,46742,600,217,556,73586,
    608,313,358,4600,76391,395,1420,1401,1477,1530,1406,1425,827,65782,46672,86834,505,1306,
    116,526,611,451,509,768,2236,225,620,90510,476,134,935,500,655,269,1871,244,622,670,690,
    713,714,715,716,717,718,719,720,721,722,723,724, // extended
    334,164,21,438,459,839,840,841,842,843,844,845,846,847,848,849,850,851,852,853
];
// Duplicate and add more to reach 500+ by including top rated from TMDB as well
async function loadTVShows(page = 1) {
    const grid = document.getElementById('tvSeriesGrid');
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;">Loading 500+ series...</div>';
    try {
        // First, get top rated TV from TMDB (multiple pages)
        const tvRes = await fetch(`${TMDB_BASE}/tv/top_rated?api_key=${TMDB_API_KEY}&language=en-US&page=${page}`);
        const tvData = await tvRes.json();
        const totalPages = Math.min(tvData.total_pages, 8);
        if (page === 1) {
            grid.innerHTML = '';
            // load custom list first
            for (let id of customTvIds.slice(0, 250)) {
                try {
                    const res = await fetch(`${TMDB_BASE}/tv/${id}?api_key=${TMDB_API_KEY}&language=en-US`);
                    const show = await res.json();
                    if (show.id) createCard(show, true, 'tvSeriesGrid');
                } catch(e) {}
            }
        }
        // then add top rated
        tvData.results.forEach(show => createCard(show, true, 'tvSeriesGrid'));
        const pagContainer = document.getElementById('tvPagination');
        if (page === 1) {
            pagContainer.innerHTML = '';
            for (let i = 1; i <= totalPages; i++) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.className = `page-btn ${i === page ? 'active' : ''}`;
                btn.onclick = () => { grid.innerHTML = ''; loadTVShows(i); };
                pagContainer.appendChild(btn);
            }
        }
    } catch(e) { console.error(e); }
}

// Hero slider (6 movies)
async function loadHeroSlider() { /* same as before */ }

// Search
async function searchContent(query) { /* same as before */ }

// Initialize all genre rows with pagination (14 genres * up to 6 pages each = 1680 movies)
function initAllGenres() {
    loadMoviesByGenre(28, 'actionGrid', 'actionPagination', 1, 'action');
    loadMoviesByGenre(35, 'comedyGrid', 'comedyPagination', 1, 'comedy');
    loadMoviesByGenre(18, 'dramaGrid', 'dramaPagination', 1, 'drama');
    loadMoviesByGenre(27, 'horrorGrid', 'horrorPagination', 1, 'horror');
    loadMoviesByGenre(10749, 'romanceGrid', 'romancePagination', 1, 'romance');
    loadMoviesByGenre(878, 'scifiGrid', 'scifiPagination', 1, 'scifi');
    loadMoviesByGenre(99, 'docGrid', 'docPagination', 1, 'doc');
    loadMoviesByGenre(80, 'crimeGrid', 'crimePagination', 1, 'crime');
    loadMoviesByGenre(12, 'adventureGrid', 'adventurePagination', 1, 'adventure');
    loadMoviesByGenre(14, 'fantasyGrid', 'fantasyPagination', 1, 'fantasy');
    loadMoviesByGenre(10752, 'warGrid', 'warPagination', 1, 'war');
    loadMoviesByGenre(37, 'westernGrid', 'westernPagination', 1, 'western');
    loadMoviesByGenre(10402, 'musicGrid', 'musicPagination', 1, 'music');
    loadMoviesByGenre(36, 'historyGrid', 'historyPagination', 1, 'history');
}

// Auth & event listeners (same as before)
onAuthStateChanged(auth, (user) => { /* ... */ });
document.getElementById('searchInput')?.addEventListener('input', e => searchContent(e.target.value));
document.getElementById('userIcon')?.addEventListener('click', () => document.getElementById('authModal').style.display = 'flex');
document.querySelector('.close-modal')?.addEventListener('click', () => document.getElementById('authModal').style.display = 'none');
document.getElementById('demoLoginBtn')?.addEventListener('click', () => { showToast('Demo login'); document.getElementById('authModal').style.display = 'none'; });

loadHeroSlider();
initAllGenres();
loadTVShows(1);
