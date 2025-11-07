/* tic-tac-toe hybrid: MCTS + Minimax (unbeatable)
   - drop into index.html and host on GitHub Pages
*/

const HUMAN = "X";
const BOT = "O";

let board = Array(9).fill(null);
let currentPlayer = HUMAN;
let gameOver = false;
let wins=0, losses=0, draws=0;

const boardEl = document.getElementById("board");
const infoEl = document.getElementById("info");
const simRange = document.getElementById("simCount");
const simValue = document.getElementById("simValue");
const minimaxThreshInput = document.getElementById("minimaxThresh");
const winsEl = document.getElementById("wins");
const lossesEl = document.getElementById("losses");
const drawsEl = document.getElementById("draws");
// --- DIFFICULTY HANDLING ---
const difficultySelect = document.getElementById("difficulty");

// Default difficulty
let difficulty = "medium";

// Difficulty presets
const difficultySettings = {
  easy: { sims: 200, depth: 2 },
  medium: { sims: 1000, depth: 5 },
  hard: { sims: 4000, depth: 9 }
};

difficultySelect.addEventListener("change", () => {
  difficulty = difficultySelect.value;
  const settings = difficultySettings[difficulty];
  document.getElementById("simCount").value = settings.sims;
  document.getElementById("simValue").textContent = settings.sims;
  document.getElementById("minimaxThresh").value = settings.depth;
});

simValue.textContent = simRange.value;

// UI init
function initBoard(){
  boardEl.innerHTML = "";
  for(let i=0;i<9;i++){
    const cell = document.createElement("div");
    cell.className = "cell";
    cell.dataset.index = i;
    cell.addEventListener("click", () => humanMove(i));
    boardEl.appendChild(cell);
  }
  render();
}

function render(){
  board.forEach((v,i) => {
    boardEl.children[i].textContent = v ? v : "";
  });
}

function winner(b){
  const lines = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];
  for (let [a,b1,c] of lines){
    if (b[a] && b[a] === b[b1] && b[a] === b[c]) return b[a];
  }
  if (b.every(x => x !== null)) return "draw";
  return null;
}

function availableMoves(b){
  return b.map((v,i) => v===null ? i : null).filter(x => x!==null);
}

function humanMove(i){
  if (gameOver || currentPlayer !== HUMAN || board[i]) return;
  board[i] = HUMAN;
  render();
  const w = winner(board);
  if (w) return finish(w);
  currentPlayer = BOT;
  infoEl.textContent = "Bot thinking...";
  // slight delay so UI updates
  setTimeout(botMove, 60);
}

function finish(w){
  gameOver = true;
  if (w === "draw"){ infoEl.textContent = "Draw."; draws++; }
  else if (w === HUMAN){ infoEl.textContent = "You win! 🎉"; losses++; } // from bot perspective
  else { infoEl.textContent = "Bot wins 🤖"; wins++; }
  updateStats();
}

function updateStats(){
  winsEl.textContent = wins;
  lossesEl.textContent = losses;
  drawsEl.textContent = draws;
}

// ---------- Minimax (alpha-beta) ----------
const memo = new Map(); // cache minimax results by board key

function boardKey(b){
  return b.map(x => x? x : "_").join("");
}

// score: +1 if BOT win, -1 human win, 0 draw
function minimax(b, player, alpha, beta){
  const k = boardKey(b) + player;
  if (memo.has(k)) return memo.get(k);

  const w = winner(b);
  if (w === BOT) return {score: 1};
  if (w === HUMAN) return {score: -1};
  if (w === "draw") return {score: 0};

  const moves = availableMoves(b);
  let bestMove = null;
  if (player === BOT){
    let bestScore = -Infinity;
    for (let m of moves){
      b[m] = BOT;
      const res = minimax(b, HUMAN, alpha, beta);
      b[m] = null;
      if (res.score > bestScore){
        bestScore = res.score;
        bestMove = m;
      }
      alpha = Math.max(alpha, bestScore);
      if (beta <= alpha) break;
    }
    const out = {score: bestScore, move: bestMove};
    memo.set(k, out);
    return out;
  } else {
    let bestScore = +Infinity;
    for (let m of moves){
      b[m] = HUMAN;
      const res = minimax(b, BOT, alpha, beta);
      b[m] = null;
      if (res.score < bestScore){
        bestScore = res.score;
        bestMove = m;
      }
      beta = Math.min(beta, bestScore);
      if (beta <= alpha) break;
    }
    const out = {score: bestScore, move: bestMove};
    memo.set(k, out);
    return out;
  }
}

// ---------- MCTS Node ----------
class Node {
  constructor(state, parent=null, move=null, playerToMove=BOT){
    this.state = state; // board array
    this.parent = parent;
    this.move = move; // move that produced this node (index)
    this.playerToMove = playerToMove; // who will play on this node
    this.children = [];
    this.wins = 0; // wins from BOT perspective
    this.visits = 0;
  }

  uct(totalVisits){
    if (this.visits === 0) return Infinity;
    const C = Math.sqrt(2);
    return (this.wins / this.visits) + C * Math.sqrt(Math.log(totalVisits) / this.visits);
  }
}

// simulate to termination with random play; return winner string
function randomPlayout(state, player){
  const st = state.slice();
  let cur = player;
  while (true){
    const w = winner(st);
    if (w) return w;
    const moves = availableMoves(st);
    const m = moves[Math.floor(Math.random() * moves.length)];
    st[m] = cur;
    cur = cur === HUMAN ? BOT : HUMAN;
  }
}

function expandNode(node){
  const moves = availableMoves(node.state);
  const tried = node.children.map(c => c.move);
  const untried = moves.filter(m => !tried.includes(m));
  const move = untried[Math.floor(Math.random() * untried.length)];
  const newState = node.state.slice();
  newState[move] = node.playerToMove;
  const child = new Node(newState, node, move, node.playerToMove === HUMAN ? BOT : HUMAN);
  node.children.push(child);
  return child;
}

function bestUCT(node){
  let best = null;
  let bestVal = -Infinity;
  for (let c of node.children){
    const val = c.uct(node.visits);
    if (val > bestVal){
      bestVal = val;
      best = c;
    }
  }
  return best;
}

// choose best by visits (deterministic)
function bestByVisits(node){
  let best = null;
  let bestVisits = -1;
  for (let c of node.children){
    if (c.visits > bestVisits){
      bestVisits = c.visits;
      best = c;
    }
  }
  return best;
}

// ---------- Hybrid decision ----------
function findImmediateWinningMove(b, player){
  for (let m of availableMoves(b)){
    b[m] = player;
    const w = winner(b);
    b[m] = null;
    if (w === player) return m;
  }
  return null;
}

function chooseMoveHybrid(rootState, sims, minimaxThreshold){
  // 1) immediate win
  const winMove = findImmediateWinningMove(rootState, BOT);
  if (winMove !== null) return winMove;
  // 2) immediate block
  const block = findImmediateWinningMove(rootState, HUMAN);
  if (block !== null) return block;
  // 3) if few moves left -> minimax for perfect play
  const empties = availableMoves(rootState).length;
  if (empties <= minimaxThreshold){
    const res = minimax(rootState, BOT, -Infinity, Infinity);
    return res.move;
  }
  // 4) MCTS with root as current state
  return mcts(rootState, sims);
}

// MCTS implementation
function mcts(rootState, iterations){
  const root = new Node(rootState.slice(), null, null, BOT);
  // expand root children initially (optional)
  for (let i=0;i<iterations;i++){
    let node = root;
    // selection
    while (node.children.length > 0 && node.children.length === availableMoves(node.state).length){
      node = bestUCT(node);
    }
    // expansion
    if (winner(node.state) === null && availableMoves(node.state).length > 0){
      node = expandNode(node);
    }
    // simulation
    const w = winner(node.state) || randomPlayout(node.state, node.playerToMove);
    // backpropagate
    let n = node;
    while (n){
      n.visits++;
      if (w === BOT) n.wins += 1;
      else if (w === "draw") n.wins += 0.5;
      // else human win => add 0
      n = n.parent;
    }
  }
  const best = bestByVisits(root);
  return best.move;
}

// ---------- Bot move ----------
function botMove() {
  if (gameOver) return;

  // --- Difficulty-based behavior ---
  const diff = difficultySelect.value; // read from dropdown
  let sims = parseInt(simRange.value, 10);
  let minimaxThreshold = Math.max(1, parseInt(minimaxThreshInput.value, 10));
  const moves = availableMoves(board);
  let finalMove;

  if (diff === "easy") {
    // Easy: play random most of the time (70–90%)
    if (Math.random() < 0.8) {
      finalMove = moves[Math.floor(Math.random() * moves.length)];
    } else {
      finalMove = chooseMoveHybrid(board.slice(), 200, 2);
    }
  } 
  else if (diff === "medium") {
    // Medium: lower settings for hybrid algorithm
    sims = Math.min(1000, sims);
    minimaxThreshold = Math.min(5, minimaxThreshold);
    finalMove = chooseMoveHybrid(board.slice(), sims, minimaxThreshold);
  } 
  else {
    // Hard: full hybrid (your existing logic)
    finalMove = chooseMoveHybrid(board.slice(), sims, minimaxThreshold);
  }

  // If hybrid fails (shouldn't happen), pick a random move
  if (finalMove === undefined || finalMove === null) {
    finalMove = moves[Math.floor(Math.random() * moves.length)];
  }

  // --- Apply move ---
  board[finalMove] = BOT;
  render();

  const w = winner(board);
  if (w) return finish(w);

  currentPlayer = HUMAN;
  infoEl.textContent = "Your move.";
}


// ---------- Buttons ----------
document.getElementById("newHuman").addEventListener("click", () => {
  board = Array(9).fill(null);
  currentPlayer = HUMAN;
  gameOver = false;
  infoEl.textContent = "Your move.";
  render();
});

document.getElementById("newBot").addEventListener("click", () => {
  board = Array(9).fill(null);
  currentPlayer = BOT;
  gameOver = false;
  infoEl.textContent = "Bot starts...";
  render();
  setTimeout(botMove, 80);
});

document.getElementById("reset").addEventListener("click", () => {
  wins=losses=draws=0;
  updateStats();
});

// update sim display
simRange.addEventListener("input", () => simValue.textContent = simRange.value);

// keyboard / accessibility: allow Enter to restart if game over (optional)
document.addEventListener("keydown", (e) => {
  if (e.key === "r") {
    board = Array(9).fill(null);
    gameOver = false;
    currentPlayer = HUMAN;
    infoEl.textContent = "Your move.";
    render();
  }
});
// --- THEME TOGGLE ---
const themeSwitch = document.getElementById("themeSwitch");
const savedTheme = localStorage.getItem("theme");
if (savedTheme === "dark") {
  document.body.classList.add("dark");
  themeSwitch.checked = true;
}
themeSwitch.addEventListener("change", () => {
  document.body.classList.toggle("dark", themeSwitch.checked);
  localStorage.setItem("theme", themeSwitch.checked ? "dark" : "light");
});

// --- POPUP HANDLING ---
const popup = document.getElementById("popup");
const popupMsg = document.getElementById("popup-message");
const playAgainBtn = document.getElementById("playAgain");
const closePopupBtn = document.getElementById("closePopup");

function showPopup(message) {
  popupMsg.textContent = message;
  popup.classList.remove("hidden");
}

function hidePopup() {
  popup.classList.add("hidden");
}

playAgainBtn.addEventListener("click", () => {
  hidePopup();
  board = Array(9).fill(null);
  gameOver = false;
  currentPlayer = HUMAN;
  infoEl.textContent = "Your move.";
  render();
});
closePopupBtn.addEventListener("click", hidePopup);

// Replace your old endGame / finish function:
function finish(winnerSymbol) {
  gameOver = true;
  let msg = "";
  if (winnerSymbol === "draw") {
    msg = "It's a draw 😐";
    draws++;
  } else if (winnerSymbol === HUMAN) {
    msg = "You win 🎉";
    losses++;
  } else {
    msg = "Bot wins 🤖";
    wins++;
  }
  updateStats();
  showPopup(msg);
}


// init
initBoard();
updateStats();

