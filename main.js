const API_KEY = '7a98db423d6e3a5ee922a3e51a09d135';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';

let preview;
let timer;

// LOAD MOVIES
async function loadMovies(){
const res = await fetch(`${BASE_URL}/trending/movie/week?api_key=${API_KEY}`);
const data = await res.json();

document.getElementById("movies").innerHTML =
data.results.map(m=>`
<div class="card"
onmouseenter="showPreview(${m.id}, this)"
onmouseleave="hidePreview()">
<img src="${IMG+m.poster_path}">
</div>
`).join('');
}

// PREVIEW + TRAILER
async function showPreview(id, el){

clearTimeout(timer);

timer = setTimeout(async ()=>{

const res = await fetch(`${BASE_URL}/movie/${id}?api_key=${API_KEY}`);
const movie = await res.json();

const vidRes = await fetch(`${BASE_URL}/movie/${id}/videos?api_key=${API_KEY}`);
const vids = await vidRes.json();

const trailer = vids.results.find(v=>v.type==="Trailer");

if(preview) preview.remove();

preview = document.createElement("div");
preview.className = "preview";

preview.innerHTML = `
${trailer ? `<iframe src="https://www.youtube.com/embed/${trailer.key}?autoplay=1&mute=1"></iframe>` : ""}
<h3>${movie.title}</h3>
<p>${movie.overview.slice(0,120)}...</p>
`;

document.body.appendChild(preview);

const rect = el.getBoundingClientRect();

preview.style.top = rect.top + window.scrollY + "px";
preview.style.left = rect.left + "px";

},400);
}

// HIDE
function hidePreview(){
clearTimeout(timer);
if(preview) preview.remove();
}

// SCROLL
function scrollDown(){
window.scrollTo({top:600,behavior:"smooth"});
}

// SEARCH
document.getElementById("searchInput")?.addEventListener("keyup", async (e)=>{
const q = e.target.value;
if(q.length < 3) return;

const res = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${q}`);
const data = await res.json();

document.getElementById("movies").innerHTML =
data.results.map(m=>`
<div class="card">
<img src="${IMG+m.poster_path}">
</div>
`).join('');
});

// INIT
loadMovies();
