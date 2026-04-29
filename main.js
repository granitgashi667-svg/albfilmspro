const API_KEY = '7a98db423d6e3a5ee922a3e51a09d135';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';

let previewBox;
let timeout;

// LOAD TRENDING
async function loadMovies(){
const res = await fetch(`${BASE_URL}/trending/movie/week?api_key=${API_KEY}`);
const data = await res.json();

document.getElementById("movies").innerHTML =
data.results.map(m=>`
<div class="card"
onmouseenter="showPreview(${m.id}, this)"
onmouseleave="hidePreview()"
onclick="location.href='movie.html?id=${m.id}'">
<img src="${IMG+m.poster_path}">
</div>
`).join('');
}

// GENRE FILTER
async function loadGenre(id){
const res = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${id}`);
const data = await res.json();

document.getElementById("movies").innerHTML =
data.results.map(m=>`
<div class="card">
<img src="${IMG+m.poster_path}">
</div>
`).join('');
}

// SEARCH
document.getElementById("searchInput").addEventListener("keyup", async (e)=>{
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

// PREVIEW (FIXED)
function showPreview(id, el){

clearTimeout(timeout);

timeout = setTimeout(async ()=>{

const res = await fetch(`${BASE_URL}/movie/${id}?api_key=${API_KEY}`);
const data = await res.json();

if(previewBox) previewBox.remove();

previewBox = document.createElement("div");
previewBox.className = "preview";

previewBox.innerHTML = `
<h4>${data.title}</h4>
<p>${data.overview.slice(0,100)}...</p>
`;

document.body.appendChild(previewBox);

const rect = el.getBoundingClientRect();

previewBox.style.top = rect.top + window.scrollY + "px";
previewBox.style.left = rect.left + "px";

},300);
}

function hidePreview(){
clearTimeout(timeout);
if(previewBox) previewBox.remove();
}

// INIT
loadMovies();
