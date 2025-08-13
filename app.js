
const boardEl = document.getElementById('board');
const numpadEl = document.getElementById('numpad');
const statusEl = document.getElementById('status');
const timerEl = document.getElementById('timer');
const diffEl = document.getElementById('difficulty');
const btnNew = document.getElementById('btn-new');
const btnHint = document.getElementById('btn-hint');
const btnErase = document.getElementById('btn-erase');
const btnNotes = document.getElementById('btn-notes');
const btnCheck = document.getElementById('btn-check');
const btnUndo = document.getElementById('btn-undo');
const btnSettings = document.getElementById('btn-settings');

const dailyToggle = document.getElementById('dailyToggle');
const mistakeLimitToggle = document.getElementById('mistakeLimit');
const smartNotesToggle = document.getElementById('smartNotes');
const highlightPeersToggle = document.getElementById('highlightPeers');

const dialog = document.getElementById('settingsDialog');
const themeSelect = document.getElementById('themeSelect');
const sizeSelect = document.getElementById('sizeSelect');

const confetti = document.getElementById('confetti');
const ctx = confetti.getContext('2d');

let RNG = Math.random;
function mulberry32(a){ return function(){ var t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; } }
function seedFromDate(d, diff){
  const y = d.getFullYear(), m = d.getMonth()+1, day = d.getDate();
  const map = {easy: 1, medium: 2, hard: 3, expert: 4};
  return (y*10000 + m*100 + day) * 13 + (map[diff]||2);
}

let grid = Array(81).fill(0);
let given = Array(81).fill(false);
let notes = Array(81).fill(0).map(()=> new Set());
let solution = Array(81).fill(0);
let selected = -1;
let noteMode = false;
let undoStack = [];
let timer = { start: 0, elapsed: 0, int: null };
let mistakes = 0;
let mistakeLimited = false;

const ROW = (i)=> Math.floor(i/9);
const COL = (i)=> i%9;
const BOX = (i)=> Math.floor(ROW(i)/3)*3 + Math.floor(COL(i)/3);
function rcToIndex(r,c){ return r*9+c; }

function peers(i){
  const r=ROW(i), c=COL(i), b=BOX(i);
  const set = new Set();
  for(let k=0;k<9;k++){ set.add(rcToIndex(r,k)); set.add(rcToIndex(k,c)); }
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for(let rr=0; rr<3; rr++) for(let cc=0; cc<3; cc++) set.add(rcToIndex(br+rr, bc+cc));
  set.delete(i);
  return Array.from(set);
}

function isSafe(g, idx, val){
  const r=ROW(idx), c=COL(idx);
  for(let k=0;k<9;k++){
    if (g[rcToIndex(r,k)] === val) return false;
    if (g[rcToIndex(k,c)] === val) return false;
  }
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for(let rr=0; rr<3; rr++) for(let cc=0; cc<3; cc++){
    if (g[rcToIndex(br+rr, bc+cc)] === val) return false;
  }
  return true;
}

function solve(g){
  const arr = g.slice();
  function findEmpty(){
    for(let i=0;i<81;i++) if(arr[i]===0) return i;
    return -1;
  }
  function dfs(){
    const i = findEmpty();
    if (i === -1) return true;
    const options = [];
    for(let v=1;v<=9;v++) if (isSafe(arr, i, v)) options.push(v);
    for(let k=options.length-1;k>0;k--){ const j=Math.floor(RNG()*(k+1)); [options[k],options[j]]=[options[j],options[k]];}
    for(const v of options){
      arr[i]=v;
      if (dfs()) return true;
      arr[i]=0;
    }
    return false;
  }
  return dfs() ? arr : null;
}

function generateFull(){
  const g = Array(81).fill(0);
  for(let b=0;b<3;b++){
    const nums=[1,2,3,4,5,6,7,8,9];
    for(let i=nums.length-1;i>0;i--){ const j=Math.floor(RNG()*(i+1)); [nums[i],nums[j]]=[nums[j],nums[i]];}
    let idx=0;
    for(let r=b*3; r<b*3+3; r++){
      for(let c=b*3; c<b*3+3; c++){
        g[rcToIndex(r,c)] = nums[idx++];
      }
    }
  }
  const solved = solve(g);
  return solved ?? generateFull();
}

function carve(solution, difficulty){
  const diffMap = { easy: 45, medium: 36, hard: 30, expert: 26 };
  const clues = diffMap[difficulty] ?? 36;
  const indices=[...Array(81).keys()];
  for(let i=indices.length-1;i>0;i--){ const j=Math.floor(RNG()*(i+1)); [indices[i],indices[j]]=[indices[j],indices[i]];}
  const puzzle = solution.slice();
  let removed = 0;
  for(const i of indices){
    const backup = puzzle[i];
    puzzle[i]=0;
    if (!hasUniqueSolution(puzzle)) { puzzle[i]=backup; } else { removed++; }
    if (81 - removed <= clues) break;
  }
  return puzzle;
}

function hasUniqueSolution(g){
  const arr = g.slice();
  let count = 0;
  function findEmpty(){ for(let i=0;i<81;i++) if(arr[i]===0) return i; return -1; }
  function dfs(){
    if (count>1) return;
    const i = findEmpty();
    if (i===-1){ count++; return; }
    for(let v=1; v<=9; v++){
      if (isSafe(arr,i,v)){
        arr[i]=v; dfs(); arr[i]=0;
        if (count>1) return;
      }
    }
  }
  dfs();
  return count===1;
}

function buildBoard(){
  boardEl.innerHTML='';
  for(let i=0;i<81;i++){
    const d=document.createElement('div');
    d.className='cell';
    d.setAttribute('role','gridcell');
    d.dataset.index = i;
    d.addEventListener('click', ()=> selectCell(i));
    boardEl.appendChild(d);
  }
  const rect = boardEl.getBoundingClientRect();
  confetti.width = rect.width;
  confetti.height = rect.height;
  confetti.style.width = rect.width+'px';
  confetti.style.height = rect.height+'px';
}

function render(){
  const size = document.documentElement.dataset.size || 'cozy';
  boardEl.style.width = size==='compact' ? '88vw' : (size==='spacious' ? '96vw' : '94vw');

  const cells = boardEl.children;
  for(let i=0;i<81;i++){
    const el = cells[i];
    el.className='cell';
    if (given[i]) el.classList.add('given');
    if (i===selected) el.classList.add('selected');
    if (highlightPeersToggle.checked && selected>=0){
      if (ROW(i)===ROW(selected) || COL(i)===COL(selected) || BOX(i)===BOX(selected)) el.classList.add('peer');
      if (grid[i]!==0 && grid[i]===grid[selected]) el.classList.add('same');
    }
    if (grid[i]!==0){
      const span = document.createElement('div'); span.className='val'; span.textContent=grid[i]; el.appendChild(span);
    }else if (notes[i].size){
      const ns = document.createElement('div'); ns.className='notes';
      for(let v=1; v<=9; v++){
        const s = document.createElement('span');
        s.textContent = notes[i].has(v) ? v : '';
        ns.appendChild(s);
      }
      el.appendChild(ns);
    }
  }
}

function buildNumpad(){
  numpadEl.innerHTML='';
  for(let n=1;n<=9;n++){
    const b=document.createElement('button');
    b.textContent=n;
    b.addEventListener('click', ()=> handleNumber(n));
    numpadEl.appendChild(b);
  }
}

function selectCell(i){ selected = i; render(); }

function pushUndo(){
  undoStack.push({
    grid: grid.slice(),
    notes: notes.map(s => new Set([...s])),
    selected,
    mistakes
  });
  if (undoStack.length>300) undoStack.shift();
}

function autoRemoveNotes(idx, val){
  if (!smartNotesToggle.checked) return;
  const ps = peers(idx);
  for(const j of ps){ if (notes[j].has(val)) notes[j].delete(val); }
}

function handleNumber(n){
  if (selected<0 || given[selected]) return;
  if (mistakeLimited && mistakes>=3) return;
  pushUndo();
  if (noteMode){
    if (notes[selected].has(n)) notes[selected].delete(n);
    else notes[selected].add(n);
  }else{
    const prev = grid[selected];
    grid[selected] = (grid[selected]===n ? 0 : n);
    notes[selected].clear();
    if (grid[selected]!==0 && grid[selected]!==solution[selected]){
      mistakes++;
      pulseStatus(`Oops! Mistakes: ${mistakes}/3`);
      if (mistakeLimited && mistakes>=3){
        gameOver();
      }
    }else if (grid[selected]!==0){
      autoRemoveNotes(selected, grid[selected]);
    }
  }
  render(); save(); checkWin();
}

btnErase.addEventListener('click', ()=>{
  if (selected<0 || given[selected]) return;
  pushUndo();
  grid[selected]=0;
  notes[selected].clear();
  render(); save();
});

btnNotes.addEventListener('click', ()=>{
  noteMode = !noteMode;
  btnNotes.classList.toggle('active', noteMode);
});

btnUndo.addEventListener('click', ()=>{
  const last = undoStack.pop(); if (!last) return;
  grid = last.grid.slice();
  notes = last.notes.map(s=> new Set([...s]));
  selected = last.selected;
  mistakes = last.mistakes || 0;
  render(); save();
});

btnHint.addEventListener('click', ()=>{
  if (selected<0 || given[selected]) return;
  if (grid[selected]!==0) return;
  pushUndo();
  grid[selected] = solution[selected];
  notes[selected].clear();
  autoRemoveNotes(selected, grid[selected]);
  render(); save(); checkWin();
});

btnCheck.addEventListener('click', ()=>{
  const cells = boardEl.children;
  let errors = 0;
  for(let i=0;i<81;i++){
    const el = cells[i];
    el.classList.remove('error');
    if (grid[i]!==0 && grid[i]!==solution[i]){
      el.classList.add('error'); errors++;
    }
  }
  statusEl.textContent = errors ? `${errors} mistake${errors>1?'s':''} highlighted` : 'So far so good!';
  setTimeout(()=>statusEl.textContent='', 2000);
});

btnNew.addEventListener('click', ()=>{
  newGame(diffEl.value, dailyToggle.checked);
});

btnSettings.addEventListener('click', ()=>{
  dialog.showModal();
});

themeSelect.addEventListener('change', ()=>{
  document.documentElement.dataset.theme = themeSelect.value;
  savePrefs();
});
sizeSelect.addEventListener('change', ()=>{
  document.documentElement.dataset.size = sizeSelect.value;
  savePrefs();
});
dailyToggle.addEventListener('change', ()=> savePrefs());
mistakeLimitToggle.addEventListener('change', ()=>{ mistakeLimited = mistakeLimitToggle.checked; savePrefs(); });
smartNotesToggle.addEventListener('change', ()=> savePrefs());
highlightPeersToggle.addEventListener('change', ()=> render());

function pulseStatus(msg){
  statusEl.textContent = msg;
  statusEl.style.opacity = 1;
  setTimeout(()=> statusEl.style.opacity = '', 300);
}

function gameOver(){
  stopTimer();
  pulseStatus('Reached 3 mistakes. Try again!');
}

function startTimer(){
  stopTimer();
  timer.start = Date.now() - timer.elapsed;
  timer.int = setInterval(()=>{
    timer.elapsed = Date.now() - timer.start;
    const s = Math.floor(timer.elapsed/1000);
    const mm = String(Math.floor(s/60)).padStart(2,'0');
    const ss = String(s%60).padStart(2,'0');
    timerEl.textContent = `${mm}:${ss}`;
  }, 1000);
}
function stopTimer(){ if (timer.int) clearInterval(timer.int); timer.int = null; }
function resetTimer(){ timer.elapsed = 0; timerEl.textContent = "00:00"; }

function save(){
  const data = {
    grid, given, solution,
    notes: notes.map(s=> [...s]),
    selected, noteMode,
    diff: diffEl.value,
    timerElapsed: timer.elapsed,
    mistakes
  };
  localStorage.setItem('aastha_sudoku_state', JSON.stringify(data));
}
function savePrefs(){
  const prefs = {
    theme: themeSelect.value,
    size: sizeSelect.value,
    daily: dailyToggle.checked,
    mistakeLimit: mistakeLimitToggle.checked,
    smartNotes: smartNotesToggle.checked,
    highlight: highlightPeersToggle.checked
  };
  localStorage.setItem('aastha_sudoku_prefs', JSON.stringify(prefs));
}
function loadSaved(){
  try{
    const raw = localStorage.getItem('aastha_sudoku_state');
    if (!raw) return false;
    const d = JSON.parse(raw);
    grid = d.grid;
    given = d.given;
    solution = d.solution;
    notes = d.notes.map(arr => new Set(arr));
    selected = d.selected ?? -1;
    noteMode = !!d.noteMode;
    diffEl.value = d.diff ?? 'medium';
    timer.elapsed = d.timerElapsed ?? 0;
    mistakes = d.mistakes || 0;
    btnNotes.classList.toggle('active', noteMode);
    return true;
  }catch(e){ console.warn(e); return false; }
}
function loadPrefs(){
  try{
    const raw = localStorage.getItem('aastha_sudoku_prefs');
    if (!raw) return;
    const p = JSON.parse(raw);
    themeSelect.value = p.theme || 'pink';
    sizeSelect.value = p.size || 'cozy';
    dailyToggle.checked = !!p.daily;
    mistakeLimitToggle.checked = !!p.mistakeLimit;
    smartNotesToggle.checked = p.smartNotes!==false;
    highlightPeersToggle.checked = p.highlight!==false;
    document.documentElement.dataset.theme = themeSelect.value;
    document.documentElement.dataset.size = sizeSelect.value;
    mistakeLimited = mistakeLimitToggle.checked;
  }catch(e){}
}

function newGame(difficulty='medium', daily=false){
  if (daily){
    RNG = mulberry32(seedFromDate(new Date(), difficulty));
  }else{
    RNG = Math.random;
  }

  undoStack = [];
  mistakes = 0;
  noteMode = false;
  btnNotes.classList.remove('active');

  solution = generateFull();
  const puzzle = carve(solution, difficulty);

  grid = puzzle.slice();
  given = grid.map(v => v!==0);
  notes = Array(81).fill(0).map(()=> new Set());
  selected = grid.findIndex(v=>v===0);
  resetTimer(); startTimer();
  buildBoard(); buildNumpad(); render(); save();
}

function checkWin(){
  if (grid.every((v,i)=> v!==0 && v===solution[i])){
    stopTimer();
    celebrate();
    statusEl.textContent = `Completed in ${timerEl.textContent}! 🎉`;
    localStorage.removeItem('aastha_sudoku_state');
  }
}

let confettiAnim = null;
function celebrate(){
  const rect = boardEl.getBoundingClientRect();
  confetti.width = rect.width; confetti.height = rect.height;
  const parts = [];
  for(let i=0;i<120;i++){
    parts.push({
      x: Math.random()*rect.width,
      y: -10 - Math.random()*50,
      r: 4 + Math.random()*6,
      vy: 1 + Math.random()*2,
      vx: (Math.random()-0.5)*1.5,
      color: i%3===0 ? '#ff7ab6' : (i%3===1 ? '#ffa8d6' : '#ffc1e6'),
      a: Math.random()*Math.PI
    });
  }
  const start = performance.now();
  function step(t){
    ctx.clearRect(0,0,confetti.width, confetti.height);
    for(const p of parts){
      p.x += p.vx;
      p.y += p.vy;
      p.a += 0.1;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.a);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r/2, -p.r/2, p.r, p.r*0.6);
      ctx.restore();
    }
    if (t-start < 4000) confettiAnim = requestAnimationFrame(step);
    else ctx.clearRect(0,0,confetti.width, confetti.height);
  }
  if (confettiAnim) cancelAnimationFrame(confettiAnim);
  confettiAnim = requestAnimationFrame(step);
}

buildBoard(); buildNumpad(); loadPrefs();
if (!loadSaved()) newGame('medium', dailyToggle.checked);
else { render(); startTimer(); }
