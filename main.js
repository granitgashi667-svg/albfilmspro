const API_KEY = '7a98db423d6e3a5ee922a3e51a09d135';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';

let previewBox;

// TRENDING
async function loadTrending(){
const res = await fetch(`${BASE_URL}/trending/movie/week?api_key=${API_KEY}`);
const data = await res.json();

document.getElementById("trendingRow").innerHTML =
data.results.map(m=>`
<div class="card"
onmouseover="showPreview(${m.id}, this)"
onmouseleave="hidePreview()"
onclick="location.href='movie.html?id=${m.id}'">
<img src="${IMG+m.poster_path}">
</div>
`).join('');
}

// GENRE
async function loadGenre(id){
const res = await fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&with_genres=${id}`);
const data = await res.json();

document.getElementById("trendingRow").innerHTML =
data.results.map(m=>`
<div class="card"
onmouseover="showPreview(${m.id}, this)"
onmouseleave="hidePreview()">
<img src="${IMG+m.poster_path}">
</div>
`).join('');
}

// SEARCH
document.getElementById("searchInput")?.addEventListener("keyup", async (e)=>{
const q = e.target.value;
if(q.length < 3) return;

const res = await fetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${q}`);
const data = await res.json();

document.getElementById("trendingRow").innerHTML =
data.results.map(m=>`
<div class="card">
<img src="${IMG+m.poster_path}">
</div>
`).join('');
});

// PREVIEW
async function showPreview(id, el){
const res = await fetch(`${BASE_URL}/movie/${id}?api_key=${API_KEY}`);
const data = await res.json();

previewBox = document.createElement("div");
previewBox.className = "preview";

previewBox.innerHTML = `
<h3>${data.title}</h3>
<p>${data.overview.slice(0,80)}...</p>
`;

document.body.appendChild(previewBox);

const rect = el.getBoundingClientRect();
previewBox.style.top = rect.top + "px";
previewBox.style.left = rect.left + "px";
}

function hidePreview(){
if(previewBox) previewBox.remove();
}

// INIT
loadTrending();
