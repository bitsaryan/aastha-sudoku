
// Aastha's Sudoku - PWA
// Features: generator, solver, notes mode, undo, hint, check, timer, persistence.

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

// --- State ---
let grid = Array(81).fill(0);          // current values
let given = Array(81).fill(false);     // fixed cells
let notes = Array(81).fill(0).map(()=> new Set());
let solution = Array(81).fill(0);
let selected = -1;
let noteMode = false;
let undoStack = [];
let timer = { start: 0, elapsed: 0, int: null };

// ---- Helpers ----
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

// Backtracking solver (returns copy)
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
    // randomize for nicer generation
    for(let k=options.length-1;k>0;k--){ const j=Math.floor(Math.random()*(k+1)); [options[k],options[j]]=[options[j],options[k]];}
    for(const v of options){
      arr[i]=v;
      if (dfs()) return true;
      arr[i]=0;
    }
    return false;
  }
  return dfs() ? arr : null;
}

// Generate a full valid solution
function generateFull(){
  const g = Array(81).fill(0);
  // seed diagonal 3x3 boxes
  for(let b=0;b<3;b++){
    const nums=[1,2,3,4,5,6,7,8,9];
    for(let i=nums.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [nums[i],nums[j]]=[nums[j],nums[i]];}
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

// Remove cells to create puzzle with target clues by difficulty
function carve(solution, difficulty){
  const diffMap = { easy: 45, medium: 36, hard: 30, expert: 26 }; // number of clues
  const clues = diffMap[difficulty] ?? 36;
  const indices=[...Array(81).keys()];
  // Shuffle indices
  for(let i=indices.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [indices[i],indices[j]]=[indices[j],indices[i]];}
  const puzzle = solution.slice();
  let removed = 0;
  for(const i of indices){
    const backup = puzzle[i];
    puzzle[i]=0;
    // ensure unique
    if (!hasUniqueSolution(puzzle)) { puzzle[i]=backup; } else { removed++; }
    if (81 - removed <= clues) break;
  }
  return puzzle;
}

// Quick uniqueness check (counts up to 2 solutions)
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

// ---- UI Build ----
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
  // bold borders via CSS gradients could be added; we keep simple for now
}

function render(){
  const cells = boardEl.children;
  for(let i=0;i<81;i++){
    const el = cells[i];
    el.classList.remove('given','selected','peer','same','error');
    el.innerHTML='';
    if (given[i]) el.classList.add('given');
    if (i===selected) el.classList.add('selected');
    if (selected>=0){
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
    selected
  });
  if (undoStack.length>200) undoStack.shift();
}

function handleNumber(n){
  if (selected<0 || given[selected]) return;
  pushUndo();
  if (noteMode){
    if (notes[selected].has(n)) notes[selected].delete(n);
    else notes[selected].add(n);
  }else{
    grid[selected] = (grid[selected]===n ? 0 : n);
    notes[selected].clear();
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
  render(); save();
});

btnHint.addEventListener('click', ()=>{
  if (selected<0 || given[selected]) return;
  if (grid[selected]!==0) return;
  pushUndo();
  grid[selected] = solution[selected];
  notes[selected].clear();
  render(); save(); checkWin();
});

btnCheck.addEventListener('click', ()=>{
  // highlight wrong cells
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
  newGame(diffEl.value);
});

diffEl.addEventListener('change', ()=>{
  newGame(diffEl.value);
});

function checkWin(){
  if (grid.every((v,i)=> v!==0 && v===solution[i])){
    stopTimer();
    statusEl.textContent = `Completed in ${timerEl.textContent}! 🎉`;
    localStorage.removeItem('aastha_sudoku_state');
  }
}

// ---- Timer ----
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

// ---- Persistence ----
function save(){
  const data = {
    grid, given, solution,
    notes: notes.map(s=> [...s]),
    selected, noteMode,
    diff: diffEl.value,
    timerElapsed: timer.elapsed
  };
  localStorage.setItem('aastha_sudoku_state', JSON.stringify(data));
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
    btnNotes.classList.toggle('active', noteMode);
    return true;
  }catch(e){ console.warn(e); return false; }
}

// ---- Game setup ----
function newGame(difficulty='medium'){
  // Generate new board
  undoStack = [];
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

// Initialize
buildBoard(); buildNumpad();
if (!loadSaved()) newGame('medium');
else { render(); startTimer(); }
