
// Simple, robust Sudoku (pink) — minimal features, focus on reliability.

const boardEl = document.getElementById('board');
const numpadEl = document.getElementById('numpad');
const diffEl = document.getElementById('difficulty');
const newBtn = document.getElementById('newBtn');
const hintBtn = document.getElementById('hintBtn');

let grid = Array(81).fill(0);
let given = Array(81).fill(false);
let solution = Array(81).fill(0);
let selected = -1;

// --- Helpers ---
const ROW = (i)=> Math.floor(i/9);
const COL = (i)=> i%9;
const BOX = (i)=> Math.floor(ROW(i)/3)*3 + Math.floor(COL(i)/3);
const idx = (r,c)=> r*9+c;

function peers(i){
  const r=ROW(i), c=COL(i);
  const set = new Set();
  for(let k=0;k<9;k++){ set.add(idx(r,k)); set.add(idx(k,c)); }
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for(let rr=0; rr<3; rr++) for(let cc=0; cc<3; cc++) set.add(idx(br+rr, bc+cc));
  set.delete(i);
  return Array.from(set);
}

function isSafe(g, i, v){
  const r=ROW(i), c=COL(i);
  for(let k=0;k<9;k++){
    if (g[idx(r,k)]===v || g[idx(k,c)]===v) return false;
  }
  const br = Math.floor(r/3)*3, bc = Math.floor(c/3)*3;
  for(let rr=0; rr<3; rr++) for(let cc=0; cc<3; cc++){
    if (g[idx(br+rr, bc+cc)]===v) return false;
  }
  return true;
}

// Solver (counts up to 2 solutions for uniqueness check)
function solveCount(g, limit=2){
  const a=g.slice();
  function findEmpty(){ for(let i=0;i<81;i++) if(a[i]===0) return i; return -1; }
  let count=0;
  function dfs(){
    if (count>=limit) return;
    const i=findEmpty();
    if (i===-1){ count++; return; }
    for(let v=1; v<=9; v++){
      if (isSafe(a,i,v)){
        a[i]=v; dfs(); a[i]=0;
        if (count>=limit) return;
      }
    }
  }
  dfs(); return count;
}

function solveGrid(g){
  const a=g.slice();
  function findEmpty(){ for(let i=0;i<81;i++) if(a[i]===0) return i; return -1; }
  function dfs(){
    const i=findEmpty();
    if (i===-1) return true;
    const nums=[1,2,3,4,5,6,7,8,9];
    for(let k=nums.length-1;k>0;k--){ const j=(Math.random()* (k+1))|0; [nums[k],nums[j]]=[nums[j],nums[k]]; }
    for(const v of nums){
      if (isSafe(a,i,v)){ a[i]=v; if (dfs()) return true; a[i]=0; }
    }
    return false;
  }
  return dfs()? a : null;
}

// Generate a full solution then carve a unique puzzle
function generatePuzzle(diff='medium'){
  const full = generateFullSolution();
  solution = full.slice();
  grid = full.slice();

  const cluesMap = { easy: 45, medium: 36, hard: 30 };
  const clues = cluesMap[diff] ?? 36;

  const positions = [...Array(81).keys()];
  for(let k=positions.length-1;k>0;k--){ const j=(Math.random()*(k+1))|0; [positions[k],positions[j]]=[positions[j],positions[k]]; }

  let removed = 0;
  for(const i of positions){
    const backup = grid[i];
    grid[i]=0;
    // Ensure unique solution remains
    if (solveCount(grid, 2)!==1){
      grid[i]=backup; // revert
    }else{
      removed++;
      if (81 - removed <= clues) break;
    }
  }
  given = grid.map(v=> v!==0);
}

function generateFullSolution(){
  const g = Array(81).fill(0);
  // seed diagonal boxes with shuffled 1..9 to speed up
  for(let b=0;b<3;b++){
    const nums=[1,2,3,4,5,6,7,8,9];
    for(let i=nums.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [nums[i],nums[j]]=[nums[j],nums[i]]; }
    let t=0;
    for(let r=b*3;r<b*3+3;r++) for(let c=b*3;c<b*3+3;c++) g[idx(r,c)] = nums[t++];
  }
  const solved = solveGrid(g);
  return solved || generateFullSolution();
}

// --- UI ---
function buildBoard(){
  boardEl.innerHTML='';
  for(let i=0;i<81;i++){
    const d=document.createElement('div');
    d.className='cell';
    d.dataset.i=i;
    // thick 3x3 borders
    const r=ROW(i), c=COL(i);
    const style = [];
    if (c===0) style.push('border-left:2px solid #4a2431');
    if (r===0) style.push('border-top:2px solid #4a2431');
    if (c===8) style.push('border-right:2px solid #4a2431');
    if (r===8) style.push('border-bottom:2px solid #4a2431');
    if (c===2 || c===5) style.push('border-right:2px solid #4a2431');
    if (r===2 || r===5) style.push('border-bottom:2px solid #4a2431');
    d.style.cssText = style.join(';');
    d.addEventListener('click', ()=> selectCell(i));
    boardEl.appendChild(d);
  }
}

function render(){
  const cells = boardEl.children;
  for(let i=0;i<81;i++){
    const el = cells[i];
    el.classList.remove('given','selected','peer','same','error');
    el.textContent = '';
    if (given[i]) el.classList.add('given');
    if (i===selected) el.classList.add('selected');
    if (selected>=0){
      if (ROW(i)===ROW(selected) || COL(i)===COL(selected) || BOX(i)===BOX(selected)) el.classList.add('peer');
      if (grid[i]!==0 && grid[i]===grid[selected]) el.classList.add('same');
    }
    if (grid[i]!==0){
      el.textContent = grid[i];
    }
  }
}

function buildNumpad(){
  numpadEl.innerHTML='';
  for(let n=1;n<=9;n++){
    const b=document.createElement('button');
    b.textContent=n;
    b.addEventListener('click', ()=> placeNumber(n));
    numpadEl.appendChild(b);
  }
  const erase=document.createElement('button');
  erase.textContent='⌫';
  erase.addEventListener('click', eraseCell);
  numpadEl.appendChild(erase);
}

function selectCell(i){ selected = i; render(); }

function placeNumber(n){
  if (selected<0 || given[selected]) return;
  // toggle
  grid[selected] = (grid[selected]===n? 0 : n);
  render();
  checkWin();
}

function eraseCell(){
  if (selected<0 || given[selected]) return;
  grid[selected]=0; render();
}

function hint(){
  if (selected<0 || given[selected]) return;
  if (grid[selected]!==0) return;
  grid[selected] = solution[selected];
  render();
  checkWin();
}

function checkWin(){
  for(let i=0;i<81;i++) if (grid[i]===0) return;
  for(let i=0;i<81;i++) if (grid[i]!==solution[i]) return;
  setTimeout(()=> alert("Yay! Completed 💗"), 50);
}

// --- Events ---
newBtn.addEventListener('click', ()=>{
  generatePuzzle(diffEl.value);
  buildBoard(); render();
});
hintBtn.addEventListener('click', hint);
diffEl.addEventListener('change', ()=>{
  generatePuzzle(diffEl.value);
  buildBoard(); render();
});

// Init
buildBoard();
buildNumpad();
generatePuzzle('medium');
render();
