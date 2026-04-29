const API_KEY = '7a98db423d6e3a5ee922a3e51a09d135';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const BG = 'https://image.tmdb.org/t/p/original';

const customMovies = [
{
id:"c1",
title:"Believe",
poster:"https://image.tmdb.org/t/p/w500/5Eip60UDiPLASyKjmH9ruTcTfL.jpg",
servers:[
{ name:"Abyss", url:"https://short.icu/44qkCuGWS" }
]
}
];

// HERO
async function loadHero(){
const res = await fetch(`${BASE_URL}/trending/movie/week?api_key=${API_KEY}`);
const data = await res.json();
const movie = data.results[0];

document.getElementById("hero").style.backgroundImage =
`url(${BG + movie.backdrop_path})`;
}

// TRENDING
async function loadTrending(){
const res = await fetch(`${BASE_URL}/trending/movie/week?api_key=${API_KEY}`);
const data = await res.json();

document.getElementById("trendingRow").innerHTML =
data.results.slice(0,10).map(m=>`
<div class="card" onclick="location.href='movie.html?id=${m.id}'">
<img src="${IMG+m.poster_path}">
</div>
`).join('');
}

// CUSTOM
function loadCustom(){
document.getElementById("customRow").innerHTML =
customMovies.map(m=>`
<div class="card" onclick="location.href='watch.html?id=${m.id}'">
<img src="${m.poster}">
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

// INIT
loadHero();
loadTrending();
loadCustom();
