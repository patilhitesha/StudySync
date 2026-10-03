/* =========================================================================
   StudySync — fully self-contained client-side prototype.
   No network calls: all "backend" logic runs in the browser and state is
   kept in localStorage (per-browser, private to this device). This means
   the app works the moment the page opens - no server to start, so there is
   nothing that can produce a "failed to fetch" error.

   Nothing beyond the login/signup screen (#authScreen) is ever shown until
   state.currentUserId is set - see renderAuthGate().
   ========================================================================= */

const STORAGE_KEY = 'studysync:v1';

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  }catch(e){
    console.error('Could not read saved data, starting fresh.', e);
    return defaultState();
  }
}
function defaultState(){
  return { users: [], currentUserId: null, rooms: [], notes: [], attendance: [], tests: [], attempts: [] };
}
let state = loadState();
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch(e){ console.error('Could not save data', e); toast('Could not save — storage may be full or blocked.', 'err'); }
}

function nextId(prefix){ return prefix + '_' + Math.random().toString(36).slice(2,10); }

function toast(msg, kind){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>el.remove(), 3200);
}

/* ---------------- crypto helpers (Web Crypto, no deps) ---------------- */
function randomHex(bytes){
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function sha256Hex(text){
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function hashPassword(password, salt){
  salt = salt || randomHex(16);
  const hash = await sha256Hex(salt + ':' + password);
  return { salt, hash };
}

/* ---------------- validators (ported from the backend service) ---------------- */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function validateEmail(email){
  if(typeof email !== 'string' || email.trim().length===0) return { valid:false, reason:'Email is required' };
  if(!EMAIL_REGEX.test(email)) return { valid:false, reason:'Enter a valid email address' };
  return { valid:true, reason:null };
}
function passwordRuleStatus(password){
  password = password || '';
  return {
    len: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}
function validatePassword(password){
  const s = passwordRuleStatus(password);
  const valid = Object.values(s).every(Boolean);
  return { valid, status:s };
}

/* ---------------- GPA engine (ported) ---------------- */
const GRADING_SCALE = [
  { min:90, grade:'A+', point:10 }, { min:80, grade:'A', point:9 },
  { min:70, grade:'B+', point:8 }, { min:60, grade:'B', point:7 },
  { min:50, grade:'C', point:6 }, { min:40, grade:'D', point:5 },
  { min:0, grade:'F', point:0 },
];
function marksToGrade(marks){
  if(typeof marks !== 'number' || Number.isNaN(marks)) throw new TypeError('marks must be a number');
  if(marks<0 || marks>100) throw new RangeError('marks must be between 0 and 100');
  for(const band of GRADING_SCALE){ if(marks >= band.min) return band; }
  throw new Error('No grade band matched');
}
function calculateSGPA(subjects){
  if(!Array.isArray(subjects) || subjects.length===0) throw new Error('Add at least one subject');
  let totalCredits=0, totalPoints=0;
  for(const s of subjects){
    if(typeof s.credits!=='number' || s.credits<=0) throw new RangeError(`Invalid credits for "${s.name}"`);
    const band = marksToGrade(s.marks);
    totalCredits += s.credits; totalPoints += s.credits*band.point;
  }
  if(totalCredits===0) throw new Error('Total credits cannot be zero');
  return Math.round((totalPoints/totalCredits)*100)/100;
}

/* ---------------- Attendance engine (ported) ---------------- */
function calcAttendancePct(attended, total){
  if(attended<0 || total<0) throw new RangeError('Values cannot be negative');
  if(attended>total) throw new RangeError('Attended cannot exceed total');
  if(total===0) return 0;
  return Math.round((attended/total)*10000)/100;
}
function attendanceStatus(pct, threshold=75, criticalMargin=10){
  if(pct < threshold-criticalMargin) return 'critical';
  if(pct < threshold) return 'warn';
  return 'good';
}

/* ---------------- MCQ evaluator (ported) ---------------- */
function evaluateMCQTest(questions, answers){
  let score=0, maxScore=0, correct=0, incorrect=0, unanswered=0;
  for(const q of questions){
    const marks = typeof q.marks==='number'?q.marks:1;
    const neg = typeof q.negativeMarks==='number'?q.negativeMarks:0;
    maxScore += marks;
    const has = Object.prototype.hasOwnProperty.call(answers,q.id) && answers[q.id]!=null;
    if(!has){ unanswered++; continue; }
    if(answers[q.id]===q.correctOption){ correct++; score+=marks; }
    else { incorrect++; score-=neg; }
  }
  if(score<0) score=0;
  const percentage = maxScore===0?0:Math.round((score/maxScore)*10000)/100;
  return { score, maxScore, percentage, correct, incorrect, unanswered };
}

/* ---------------- Room code generator (ported) ---------------- */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateUniqueCode(existingCodes, length=6, maxAttempts=10){
  for(let attempt=0; attempt<maxAttempts; attempt++){
    let code=''; for(let i=0;i<length;i++) code += CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)];
    if(!existingCodes.includes(code)) return code;
  }
  throw new Error('Could not generate a unique code');
}

/* =========================== AUTH FLOW =========================== */

function setAuthTab(which){
  document.getElementById('segSignin').classList.toggle('active', which==='signin');
  document.getElementById('segSignup').classList.toggle('active', which==='signup');
  document.getElementById('signinForm').style.display = which==='signin' ? 'flex' : 'none';
  document.getElementById('signupForm').style.display = which==='signup' ? 'flex' : 'none';
}

function renderPwRules(){
  const status = passwordRuleStatus(document.getElementById('su-pass').value);
  document.querySelectorAll('#pwRules li').forEach(li=>{
    li.classList.toggle('pass', !!status[li.dataset.rule]);
  });
}

async function handleSignup(){
  const msg = document.getElementById('su-msg'); msg.className='formMsg'; msg.textContent='';
  const name = document.getElementById('su-name').value.trim() || 'Student';
  const email = document.getElementById('su-email').value.trim().toLowerCase();
  const password = document.getElementById('su-pass').value;

  const emailCheck = validateEmail(email);
  if(!emailCheck.valid){ msg.textContent = emailCheck.reason; msg.className='formMsg err'; return; }
  const pwCheck = validatePassword(password);
  if(!pwCheck.valid){ msg.textContent = 'Password does not meet the requirements above.'; msg.className='formMsg err'; return; }
  if(state.users.some(u=>u.email===email)){ msg.textContent = 'An account with that email already exists.'; msg.className='formMsg err'; return; }

  const { salt, hash } = await hashPassword(password);
  const user = { id: nextId('user'), name, email, salt, hash, createdAt: new Date().toISOString() };
  state.users.push(user);
  state.currentUserId = user.id;
  saveState();
  toast('Account created — welcome, ' + name + '!', 'ok');
  enterApp();
}

async function handleSignin(){
  const msg = document.getElementById('si-msg'); msg.className='formMsg'; msg.textContent='';
  const email = document.getElementById('si-email').value.trim().toLowerCase();
  const password = document.getElementById('si-pass').value;
  const user = state.users.find(u=>u.email===email);
  if(!user){ msg.textContent = 'No account found for that email.'; msg.className='formMsg err'; return; }
  const { hash } = await hashPassword(password, user.salt);
  if(hash !== user.hash){ msg.textContent = 'Incorrect password.'; msg.className='formMsg err'; return; }
  state.currentUserId = user.id;
  saveState();
  enterApp();
}

function handleLogout(){
  state.currentUserId = null;
  saveState();
  document.getElementById('appShell').classList.remove('visible');
  document.getElementById('authScreen').style.display = 'grid';
  document.getElementById('si-email').value=''; document.getElementById('si-pass').value='';
  setAuthTab('signin');
}

function currentUser(){ return state.users.find(u=>u.id===state.currentUserId) || null; }

function enterApp(){
  const user = currentUser();
  if(!user) return;
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appShell').classList.add('visible');
  document.getElementById('whoName').textContent = user.name;
  document.getElementById('whoEmail').textContent = user.email;
  document.getElementById('dashGreeting').textContent = 'Welcome back, ' + user.name.split(' ')[0];
  setTab('dashboard');
  refreshEverything();
}

/* On load: show the app ONLY if a session already exists. Everyone else
   sees nothing but the auth screen — this is the actual access gate. */
function renderAuthGate(){
  const user = currentUser();
  if(user){ enterApp(); }
  else {
    document.getElementById('authScreen').style.display = 'grid';
    document.getElementById('appShell').classList.remove('visible');
  }
}

/* =========================== NAV =========================== */
function setTab(tab){
  document.querySelectorAll('.navList button').forEach(b=>b.classList.toggle('active', b.dataset.tab===tab));
  document.querySelectorAll('.page').forEach(p=>p.style.display = (p.id==='page-'+tab) ? 'block' : 'none');
  document.getElementById('navList').classList.remove('open');
  if(tab==='dashboard') renderDashboard();
  if(tab==='rooms') renderRooms();
  if(tab==='notes') renderNotesPage();
  if(tab==='attendance') renderAttendance();
  if(tab==='tests') renderTestsPage();
}
function toggleMobileNav(){ document.getElementById('navList').classList.toggle('open'); }

function refreshEverything(){
  renderDashboard(); renderRooms(); renderNotesPage(); renderAttendance();
}

/* =========================== DASHBOARD =========================== */
function renderDashboard(){
  const user = currentUser(); if(!user) return;
  const myRooms = state.rooms.filter(r=>r.memberIds.includes(user.id));
  const myNotes = state.notes.filter(n=>myRooms.some(r=>r.id===n.roomId));
  const myAtt = state.attendance.filter(a=>a.userId===user.id);
  const totals = myAtt.reduce((acc,r)=>({attended:acc.attended+r.attended, total:acc.total+r.total}), {attended:0,total:0});
  const overallPct = totals.total ? calcAttendancePct(totals.attended, totals.total) : null;
  const myAttempts = state.attempts.filter(a=>a.userId===user.id);

  document.getElementById('statRooms').textContent = myRooms.length;
  document.getElementById('statNotes').textContent = myNotes.length;
  document.getElementById('statAttendance').textContent = overallPct===null ? '—' : overallPct+'%';
  document.getElementById('statAttempts').textContent = myAttempts.length;

  const notesList = document.getElementById('dashNotes');
  const recentNotes = [...myNotes].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
  notesList.innerHTML = recentNotes.length ? recentNotes.map(n=>`<li><strong>${escapeHtml(n.title)}</strong><br><span style="color:var(--muted);">${escapeHtml(roomName(n.roomId))}</span></li>`).join('')
    : '<li class="empty">No notes yet — add one from the Notes tab.</li>';

  const roomsList = document.getElementById('dashRooms');
  roomsList.innerHTML = myRooms.length ? myRooms.map(r=>`<li><strong>${escapeHtml(r.name)}</strong><br><span style="color:var(--muted);">${escapeHtml(r.subject)} · code <span class="code-chip">${r.code}</span></span></li>`).join('')
    : '<li class="empty">No rooms yet — create or join one from the Rooms tab.</li>';
}
function roomName(roomId){ const r = state.rooms.find(r=>r.id===roomId); return r? r.name : 'Unknown room'; }
function escapeHtml(str){ const d=document.createElement('div'); d.textContent = str==null?'':String(str); return d.innerHTML; }

/* =========================== ROOMS =========================== */
function createRoom(){
  const user = currentUser();
  const msg = document.getElementById('rm-msg'); msg.className='formMsg';
  const name = document.getElementById('rm-name').value.trim();
  const subject = document.getElementById('rm-subject').value.trim();
  const description = document.getElementById('rm-desc').value.trim();
  if(!name || !subject){ msg.textContent='Give the room a name and subject.'; msg.className='formMsg err'; return; }
  const code = generateUniqueCode(state.rooms.map(r=>r.code));
  const room = { id: nextId('room'), name, subject, description, code, ownerId:user.id, memberIds:[user.id], createdAt:new Date().toISOString() };
  state.rooms.push(room); saveState();
  msg.textContent = `Room created! Share this code: ${code}`; msg.className='formMsg ok';
  document.getElementById('rm-name').value=''; document.getElementById('rm-subject').value=''; document.getElementById('rm-desc').value='';
  renderRooms(); renderDashboard();
}
function joinRoom(){
  const user = currentUser();
  const msg = document.getElementById('join-msg'); msg.className='formMsg';
  const code = document.getElementById('rm-code').value.trim().toUpperCase();
  const room = state.rooms.find(r=>r.code===code);
  if(!room){ msg.textContent='No room found for that code.'; msg.className='formMsg err'; return; }
  if(!room.memberIds.includes(user.id)) room.memberIds.push(user.id);
  saveState();
  msg.textContent = `Joined "${room.name}".`; msg.className='formMsg ok';
  document.getElementById('rm-code').value='';
  renderRooms(); renderDashboard();
}
function renderRooms(){
  const user = currentUser(); if(!user) return;
  const myRooms = state.rooms.filter(r=>r.memberIds.includes(user.id));
  const list = document.getElementById('room-list');
  list.innerHTML = myRooms.length ? myRooms.map(r=>`
    <li class="roomCard">
      <div>
        <strong>${escapeHtml(r.name)}</strong>
        <div style="color:var(--muted);font-size:12.5px;margin-top:2px;">${escapeHtml(r.subject)} · ${r.memberIds.length} member(s)${r.ownerId===user.id?' · you own this':''}</div>
      </div>
      <span class="code-chip">${r.code}</span>
    </li>`).join('') : '<li class="empty">No rooms yet.</li>';
  populateRoomSelects();
}
function populateRoomSelects(){
  const user = currentUser(); if(!user) return;
  const myRooms = state.rooms.filter(r=>r.memberIds.includes(user.id));
  const opts = myRooms.map(r=>`<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  ['note-room','test-room'].forEach(id=>{
    const sel = document.getElementById(id);
    const prev = sel.value;
    sel.innerHTML = opts || '<option value="">No rooms yet — create one first</option>';
    if([...sel.options].some(o=>o.value===prev)) sel.value = prev;
  });
}

/* =========================== NOTES =========================== */
function renderNotesPage(){ populateRoomSelects(); loadNotes(); }
function addNote(){
  const user = currentUser();
  const msg = document.getElementById('note-msg'); msg.className='formMsg';
  const roomId = document.getElementById('note-room').value;
  const title = document.getElementById('note-title').value.trim();
  const content = document.getElementById('note-content').value.trim();
  if(!roomId){ msg.textContent='Create or join a room first.'; msg.className='formMsg err'; return; }
  if(!title){ msg.textContent='Give the note a title.'; msg.className='formMsg err'; return; }
  state.notes.push({ id:nextId('note'), roomId, authorId:user.id, title, content, createdAt:new Date().toISOString() });
  saveState();
  msg.textContent='Note saved.'; msg.className='formMsg ok';
  document.getElementById('note-title').value=''; document.getElementById('note-content').value='';
  loadNotes(); renderDashboard();
}
function loadNotes(){
  const roomId = document.getElementById('note-room').value;
  const list = document.getElementById('note-list');
  const notes = state.notes.filter(n=>n.roomId===roomId).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  list.innerHTML = notes.length ? notes.map(n=>`<li><strong>${escapeHtml(n.title)}</strong><br>${escapeHtml(n.content)}</li>`).join('') : '<li class="empty">No notes in this room yet.</li>';
}

/* =========================== ATTENDANCE =========================== */
function logAttendance(){
  const user = currentUser();
  const msg = document.getElementById('att-msg'); msg.className='formMsg';
  const subject = document.getElementById('att-subject').value.trim();
  const attended = Number(document.getElementById('att-attended').value);
  const total = Number(document.getElementById('att-total').value);
  if(!subject){ msg.textContent='Enter a subject name.'; msg.className='formMsg err'; return; }
  try{
    calcAttendancePct(attended, total); // validates
  }catch(e){ msg.textContent = e.message; msg.className='formMsg err'; return; }
  state.attendance.push({ id:nextId('att'), userId:user.id, subject, attended, total });
  saveState();
  msg.textContent='Attendance saved.'; msg.className='formMsg ok';
  document.getElementById('att-subject').value=''; document.getElementById('att-attended').value=''; document.getElementById('att-total').value='';
  renderAttendance(); renderDashboard();
}
function renderAttendance(){
  const user = currentUser(); if(!user) return;
  const records = state.attendance.filter(a=>a.userId===user.id);
  const list = document.getElementById('att-list');
  list.innerHTML = records.length ? records.map(r=>{
    const pct = calcAttendancePct(r.attended, r.total);
    const st = attendanceStatus(pct);
    const pillClass = st==='good'?'good':st==='warn'?'warn':'danger';
    return `<li style="display:flex;justify-content:space-between;align-items:center;">
      <span>${escapeHtml(r.subject)} — ${r.attended}/${r.total}</span>
      <span class="pill ${pillClass}">${pct}%</span>
    </li>`;
  }).join('') : '<li class="empty">No attendance logged yet.</li>';

  const totals = records.reduce((acc,r)=>({attended:acc.attended+r.attended,total:acc.total+r.total}),{attended:0,total:0});
  const overallEl = document.getElementById('att-overall');
  if(totals.total===0){ overallEl.innerHTML = '<p class="empty" style="padding:0;">Log a subject to see your overall attendance.</p>'; return; }
  const pct = calcAttendancePct(totals.attended, totals.total);
  const st = attendanceStatus(pct);
  const pillClass = st==='good'?'good':st==='warn'?'warn':'danger';
  overallEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <strong style="font-size:20px;font-family:'Fraunces',serif;">${pct}%</strong>
      <span class="pill ${pillClass}">${st==='good'?'On track':st==='warn'?'Watch this':'Critical'}</span>
    </div>
    <div class="bar-track"><div class="bar-fill" style="width:${pct}%;"></div></div>`;
}

/* =========================== GPA =========================== */
function computeSGPA(){
  const resultEl = document.getElementById('gpa-result');
  const lines = document.getElementById('gpa-subjects').value.trim().split('\n').filter(Boolean);
  try{
    const subjects = lines.map(line=>{
      const [name, credits, marks] = line.split(',').map(s=>s.trim());
      return { name, credits:Number(credits), marks:Number(marks) };
    });
    const sgpa = calculateSGPA(subjects);
    const rows = subjects.map(s=>{
      const band = marksToGrade(s.marks);
      return `<tr><td style="padding:6px 10px;">${escapeHtml(s.name)}</td><td style="padding:6px 10px;">${s.credits}</td><td style="padding:6px 10px;">${s.marks}</td><td style="padding:6px 10px;">${band.grade}</td></tr>`;
    }).join('');
    resultEl.innerHTML = `
      <div class="stat" style="display:inline-block;margin-bottom:14px;">
        <div class="num">${sgpa}</div><div class="lbl">SGPA</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13.5px;">
        <thead><tr style="color:var(--muted);text-align:left;"><th style="padding:6px 10px;">Subject</th><th style="padding:6px 10px;">Credits</th><th style="padding:6px 10px;">Marks</th><th style="padding:6px 10px;">Grade</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }catch(e){
    resultEl.innerHTML = `<p class="formMsg err">${escapeHtml(e.message)}</p>`;
  }
}

/* =========================== MCQ TESTS =========================== */
const SAMPLE_QUESTIONS = [
  { id:'q1', text:'What is the time complexity of binary search?', options:['O(n)','O(log n)','O(n log n)','O(1)'], correctOption:1, marks:2, negativeMarks:0.5 },
  { id:'q2', text:'Which data structure uses LIFO order?', options:['Queue','Stack','Heap','Graph'], correctOption:1, marks:2, negativeMarks:0.5 },
  { id:'q3', text:'HTTP status 404 means?', options:['Server Error','Unauthorized','Not Found','Success'], correctOption:2, marks:1, negativeMarks:0.5 },
];
let activeTestId = null;

function renderTestsPage(){ populateRoomSelects(); }

function createTest(){
  const msg = document.getElementById('test-msg'); msg.className='formMsg';
  const roomId = document.getElementById('test-room').value;
  const title = document.getElementById('test-title').value.trim() || 'Sample Quiz';
  if(!roomId){ msg.textContent='Create or join a room first.'; msg.className='formMsg err'; return; }
  const test = { id: nextId('test'), roomId, title, questions: SAMPLE_QUESTIONS, createdAt:new Date().toISOString() };
  state.tests.push(test); saveState();
  activeTestId = test.id;
  msg.textContent = `Test created: ${title}`; msg.className='formMsg ok';
  renderTestQuestions();
}
function renderTestQuestions(){
  const wrap = document.getElementById('test-questions');
  const btn = document.getElementById('submitTestBtn');
  if(!activeTestId){ wrap.innerHTML = '<p class="empty">Create a test above to begin.</p>'; btn.style.display='none'; return; }
  wrap.innerHTML = SAMPLE_QUESTIONS.map(q=>`
    <div class="qBlock">
      <div class="qText">${escapeHtml(q.text)}</div>
      ${q.options.map((opt,i)=>`<label class="opt"><input type="radio" name="${q.id}" value="${i}"> ${escapeHtml(opt)}</label>`).join('')}
    </div>`).join('');
  btn.style.display = 'inline-block';
  document.getElementById('submit-result').innerHTML = '';
}
function submitTest(){
  const user = currentUser();
  const answers = {};
  SAMPLE_QUESTIONS.forEach(q=>{
    const sel = document.querySelector(`input[name="${q.id}"]:checked`);
    if(sel) answers[q.id] = Number(sel.value);
  });
  const result = evaluateMCQTest(SAMPLE_QUESTIONS, answers);
  state.attempts.push({ id:nextId('attempt'), testId:activeTestId, userId:user.id, result, submittedAt:new Date().toISOString() });
  saveState();
  const pillClass = result.percentage>=75?'good':result.percentage>=50?'warn':'danger';
  document.getElementById('submit-result').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <span class="pill ${pillClass}">${result.score}/${result.maxScore} · ${result.percentage}%</span>
      <span style="color:var(--muted);font-size:13.5px;">${result.correct} correct · ${result.incorrect} incorrect · ${result.unanswered} unanswered</span>
    </div>`;
  renderDashboard();
}

/* =========================== INIT =========================== */
renderAuthGate();
