/* app.js — patient-first after-login behavior
   - After patient login: show main symptom input + test card (10 MCQs)
   - Autosave answers to localStorage per patient so they can resume
   - When finished show suggested specialty and allow sending request
   - Doctors never see patient UI
*/

// storage keys & helpers
const USERS_KEY = 'rt_users';
const REQUESTS_KEY = 'rt_requests';
const APPTS_KEY = 'rt_appts';
const SLOTS_KEY = 'rt_slots';
const SESSION_KEY = 'rt_session';

function load(key, fallback = null) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; } catch (e) { return fallback; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { } }
function ensureDefaults() { if (!load(USERS_KEY)) save(USERS_KEY, []); if (!load(REQUESTS_KEY)) save(REQUESTS_KEY, []); if (!load(APPTS_KEY)) save(APPTS_KEY, []); if (!load(SLOTS_KEY)) save(SLOTS_KEY, []); }
ensureDefaults();

// animateTo helper (same as earlier)
function animateTo(fromEl, toEl, opts = {}) {
  const duration = opts.durationMs || 420;
  if (!fromEl || !toEl) {
    if (fromEl) fromEl.hidden = true;
    if (toEl) { toEl.hidden = false; if (!toEl.classList.contains('page-layer')) toEl.classList.add('page-layer'); }
    return Promise.resolve();
  }
  [fromEl, toEl].forEach(el => { if (!el.classList.contains('page-layer')) el.classList.add('page-layer'); });
  toEl.classList.remove('page-exit', 'page-exit-active', 'page-enter-active');
  toEl.classList.add('page-enter');
  toEl.hidden = false; toEl.getBoundingClientRect();
  fromEl.classList.remove('page-enter', 'page-enter-active'); fromEl.classList.add('page-exit'); fromEl.getBoundingClientRect();
  requestAnimationFrame(() => { fromEl.classList.add('page-exit-active'); toEl.classList.remove('page-enter'); toEl.classList.add('page-enter-active'); });
  return new Promise(resolve => setTimeout(() => { try { fromEl.classList.remove('page-exit', 'page-exit-active'); fromEl.hidden = true; } catch { }; try { toEl.classList.remove('page-enter', 'page-enter-active'); } catch { }; resolve(); }, duration + 30));
}

// DOM refs
const entry = document.getElementById('entry');
const entryPatient = document.getElementById('entry-patient');
const entryDoctor = document.getElementById('entry-doctor');
const choosePatient = document.getElementById('choose-patient');
const chooseDoctor = document.getElementById('choose-doctor');
const roleInput = document.getElementById('role-input');

const patientScreen = document.getElementById('patient-screen');
const pTabSignup = document.getElementById('p-tab-signup');
const pTabLogin = document.getElementById('p-tab-login');
const pSignupForm = document.getElementById('p-signup-form');
const pLoginForm = document.getElementById('p-login-form');
const pBack = document.getElementById('p-back');
const pBack2 = document.getElementById('p-back2');
const pSignMsg = document.getElementById('p-sign-msg');
const pLoginMsg = document.getElementById('p-login-msg');

const pApp = document.getElementById('p-app');
const pUser = document.getElementById('p-user');
const pLogout = document.getElementById('p-logout');

const pMainSym = document.getElementById('p-main-sym');
const pStartTest = document.getElementById('p-start-test');
const pResumeTest = document.getElementById('p-resume-test');
const pTestCard = document.getElementById('p-test-card');
const pQCard = document.getElementById('p-q-card');
const pPrevQ = document.getElementById('p-prev-q');
const pNextQ = document.getElementById('p-next-q');
const pSaveExit = document.getElementById('p-save-and-exit');
const pQNum = document.getElementById('p-q-num');
const pProgFill = document.getElementById('p-progress-fill');

const pRequestCard = document.getElementById('p-request-card');
const pSuggest = document.getElementById('p-suggest');
const pSendRequest = document.getElementById('p-send-request');
const pBackToStart = document.getElementById('p-back-to-start');

const pRequestsList = document.getElementById('p-requests-list');
const pNoReq = document.getElementById('p-no-req');

const doctorScreen = document.getElementById('doctor-screen');
const dTabSignup = document.getElementById('d-tab-signup');
const dTabLogin = document.getElementById('d-tab-login');
const dSignupForm = document.getElementById('d-signup-form');
const dLoginForm = document.getElementById('d-login-form');
const dBack = document.getElementById('d-back');
const dBack2 = document.getElementById('d-back2');
const dSignMsg = document.getElementById('d-sign-msg');
const dLoginMsg = document.getElementById('d-login-msg');

const dApp = document.getElementById('d-app');
const dUser = document.getElementById('d-user');
const dLogout = document.getElementById('d-logout');
const dProfile = document.getElementById('d-profile');
const dEditProfile = document.getElementById('d-edit-profile');
const dRequestsList = document.getElementById('d-requests-list');
const dNoReqs = document.getElementById('d-no-reqs');
const dApptsList = document.getElementById('d-appts-list');
const dNoAppt = document.getElementById('d-no-appt');
const dSlotDt = document.getElementById('d-slot-dt');
const dAddSlot = document.getElementById('d-add-slot');
const dSlotsList = document.getElementById('d-slots-list');

// session & patient autosave helpers
let session = load(SESSION_KEY, null);
function patientAutosaveKey(username) { return `patient_test_${username}`; }

// hide helpers (ensure doctor doesn't see patient UI and vice versa)
function hidePatientUI() { try { patientScreen.hidden = true; pApp.hidden = true; pTestCard.hidden = true; pRequestCard.hidden = true; } catch { } }
function hideDoctorUI() { try { doctorScreen.hidden = true; dApp.hidden = true; } catch { } }

// Role entry events
entryPatient.addEventListener('click', () => { hideDoctorUI(); animateTo(entry, patientScreen).then(() => showPatientSignup()); });
entryDoctor.addEventListener('click', () => { hidePatientUI(); animateTo(entry, doctorScreen).then(() => showDoctorSignup()); });
choosePatient.addEventListener('click', () => { hideDoctorUI(); animateTo(entry, patientScreen).then(() => showPatientSignup()); });
chooseDoctor.addEventListener('click', () => { hidePatientUI(); animateTo(entry, doctorScreen).then(() => showDoctorSignup()); });

if (roleInput) {
  roleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const v = (roleInput.value || '').trim().toLowerCase();
      const patientKeys = ['patient', 'present', 'prasent', 'pasent', 'pateint', 'patent', 'pasient'];
      const doctorKeys = ['doctor', 'doc', 'dr', 'doktor'];
      if (patientKeys.includes(v)) { roleInput.value = ''; hideDoctorUI(); animateTo(entry, patientScreen).then(() => showPatientSignup()); }
      else if (doctorKeys.includes(v)) { roleInput.value = ''; hidePatientUI(); animateTo(entry, doctorScreen).then(() => showDoctorSignup()); }
      else alert("Type 'patient' or 'doctor'");
    }
  });
}

// patient auth tabs
function showPatientSignup() { pTabSignup.classList.add('active'); pTabLogin.classList.remove('active'); pSignupForm.hidden = false; pLoginForm.hidden = true; pSignMsg.textContent = ''; }
function showPatientLogin() { pTabSignup.classList.remove('active'); pTabLogin.classList.add('active'); pSignupForm.hidden = true; pLoginForm.hidden = false; pLoginMsg.textContent = ''; }
pTabSignup.addEventListener('click', showPatientSignup);
pTabLogin.addEventListener('click', showPatientLogin);
pBack.addEventListener('click', () => animateTo(patientScreen, entry));
pBack2.addEventListener('click', () => animateTo(patientScreen, entry));

// doctor auth tabs
function showDoctorSignup() { dTabSignup.classList.add('active'); dTabLogin.classList.remove('active'); dSignupForm.hidden = false; dLoginForm.hidden = true; dSignMsg.textContent = ''; }
function showDoctorLogin() { dTabSignup.classList.remove('active'); dTabLogin.classList.add('active'); dSignupForm.hidden = true; dLoginForm.hidden = false; dLoginMsg.textContent = ''; }
dTabSignup.addEventListener('click', showDoctorSignup);
dTabLogin.addEventListener('click', showDoctorLogin);
dBack.addEventListener('click', () => animateTo(doctorScreen, entry));
dBack2.addEventListener('click', () => animateTo(doctorScreen, entry));

// ---------- Signup / Login Logic (patient) ----------
const pSignName = document.getElementById('p-sign-name');
const pSignUsername = document.getElementById('p-sign-username');
const pSignPassword = document.getElementById('p-sign-password');
const pLoginUsername = document.getElementById('p-login-username');
const pLoginPassword = document.getElementById('p-login-password');

pSignupForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = pSignName.value.trim(), username = pSignUsername.value.trim(), password = pSignPassword.value;
  if (!name || !username || !password) { pSignMsg.textContent = 'Fill all fields'; return; }
  const users = load(USERS_KEY, []);
  if (users.find(u => u.username === username)) { pSignMsg.textContent = 'Username exists'; return; }
  users.push({ username, password, role: 'patient', name, createdAt: new Date().toISOString() });
  save(USERS_KEY, users);
  session = { username, role: 'patient' }; save(SESSION_KEY, session);

  hideDoctorUI();
  animateTo(patientScreen, pApp).then(() => enterPatientApp(true));
});

pLoginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = pLoginUsername.value.trim(), password = pLoginPassword.value;
  const users = load(USERS_KEY, []);
  const user = users.find(u => u.username === username && u.password === password && u.role === 'patient');
  if (!user) { pLoginMsg.textContent = 'Invalid credentials'; return; }
  session = { username, role: 'patient' }; save(SESSION_KEY, session);

  hideDoctorUI();
  animateTo(patientScreen, pApp).then(() => enterPatientApp(true));
});

// ---------- Signup / Login Logic (doctor) ----------
const dSignName = document.getElementById('d-sign-name');
const dSignUsername = document.getElementById('d-sign-username');
const dSignPassword = document.getElementById('d-sign-password');
const dSignSpecialty = document.getElementById('d-sign-specialty');
const dSignLocation = document.getElementById('d-sign-location');
const dSignBio = document.getElementById('d-sign-bio');
const dSignCert = document.getElementById('d-sign-cert');
const dLoginUsername = document.getElementById('d-login-username');
const dLoginPassword = document.getElementById('d-login-password');

dSignupForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = dSignName.value.trim(), username = dSignUsername.value.trim(), password = dSignPassword.value;
  const specialty = dSignSpecialty.value.trim(), location = dSignLocation.value.trim(), bio = dSignBio.value.trim();
  if (!name || !username || !password || !specialty) { dSignMsg.textContent = 'Fill required fields'; return; }
  const users = load(USERS_KEY, []);
  if (users.find(u => u.username === username)) { dSignMsg.textContent = 'Username exists'; return; }
  let certDataUrl = null;
  if (dSignCert.files && dSignCert.files[0]) certDataUrl = await fileToDataUrl(dSignCert.files[0]);
  users.push({ username, password, role: 'doctor', name, specialty, location: location || 'Clinic Location Not Set', bio, certDataUrl, createdAt: new Date().toISOString() });
  save(USERS_KEY, users);
  session = { username, role: 'doctor' }; save(SESSION_KEY, session);

  hidePatientUI();
  animateTo(doctorScreen, dApp).then(() => enterDoctorApp());
});

dLoginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = dLoginUsername.value.trim(), password = dLoginPassword.value;
  const users = load(USERS_KEY, []);
  const user = users.find(u => u.username === username && u.password === password && u.role === 'doctor');
  if (!user) { dLoginMsg.textContent = 'Invalid credentials'; return; }
  session = { username, role: 'doctor' }; save(SESSION_KEY, session);

  hidePatientUI();
  animateTo(doctorScreen, dApp).then(() => enterDoctorApp());
});

function fileToDataUrl(file) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); }); }

// ---------- Patient test flow ----------
const TOTAL_Q = 10;
let questions = [];
let answers = [];
let currentQ = 0;

function generateQuestions(symptom) {
  const pool = [
    q('How long have you had this symptom?', ['<1 day', '1-3 days', '>3 days']),
    q('Is it getting worse?', ['No', 'Slowly', 'Rapidly']),
    q('Do you have fever?', ['No', 'Mild', 'High']),
    q('Any vomiting or diarrhea?', ['No', 'Sometimes', 'Yes']),
    q('Do you have breathing difficulty?', ['No', 'Mild', 'Yes']),
    q('Any chest pain or pressure?', ['No', 'Occasional', 'Severe']),
    q('Is there swelling at site?', ['No', 'Mild', 'Yes']),
    q('Any bleeding?', ['No', 'Minor', 'Major']),
    q('Any recent injury?', ['No', 'Yes']),
    q('Is the symptom recurring?', ['No', 'Intermittent', 'Constant'])
  ];
  return pool.slice(0, TOTAL_Q);
}
function q(prompt, opts) { return { prompt, options: opts }; }

// enable start button only if symptom present
pMainSym.addEventListener('input', () => {
  const v = pMainSym.value.trim();
  pStartTest.disabled = !v;
});

// resume test if saved
pResumeTest.addEventListener('click', () => {
  const key = patientAutosaveKey(session.username);
  const saved = load(key, null);
  if (!saved) { alert('No saved test'); return; }
  questions = generateQuestions(saved.symptom);
  answers = saved.answers || Array(questions.length).fill(null);
  currentQ = saved.currentQ || 0;
  pTestCard.hidden = false; pRequestCard.hidden = true;
  renderPatientQuestion();
  pResumeTest.hidden = true;
});

// start test handler
pStartTest.addEventListener('click', () => {
  const main = pMainSym.value.trim();
  if (!main) { alert('Enter main symptom'); return; }
  questions = generateQuestions(main);
  answers = Array(questions.length).fill(null);
  currentQ = 0;
  pTestCard.hidden = false; pRequestCard.hidden = true;
  renderPatientQuestion();
});

// prev/next/save handlers
pPrevQ.addEventListener('click', () => { if (currentQ > 0) { currentQ--; renderPatientQuestion(); } });
pNextQ.addEventListener('click', () => {
  if (!answers[currentQ]) { alert('Please select an option'); return; }
  if (currentQ < questions.length - 1) { currentQ++; renderPatientQuestion(); return; }
  // finished
  const main = pMainSym.value.trim();
  const suggested = computeSpecialty(main, answers);
  showSuggestionForPatient(suggested, main, answers);
});
pSaveExit.addEventListener('click', () => {
  if (!session || !session.username) { alert('No session'); return; }
  const key = patientAutosaveKey(session.username);
  const payload = { symptom: pMainSym.value.trim(), answers, currentQ };
  save(key, payload);
  alert('Progress saved. You can resume later.');
  pTestCard.hidden = true;
});

// render question
function renderPatientQuestion() {
  const item = questions[currentQ];
  pQNum.textContent = `Question ${currentQ + 1} / ${questions.length}`;
  pProgFill.style.width = `${Math.round(((currentQ + 1) / questions.length) * 100)}%`;
  pQCard.innerHTML = '';
  const qEl = document.createElement('div'); qEl.className = 'question'; qEl.textContent = item.prompt;
  const opts = document.createElement('div'); opts.className = 'options';
  item.options.forEach(opt => {
    const o = document.createElement('div'); o.className = 'option'; o.textContent = opt;
    if (answers[currentQ] === opt) o.classList.add('selected');
    o.addEventListener('click', () => {
      answers[currentQ] = opt;
      opts.querySelectorAll('.option').forEach(x => x.classList.remove('selected'));
      o.classList.add('selected');
      // autosave every answer (so progress isn't lost)
      if (session && session.username) {
        const key = patientAutosaveKey(session.username);
        save(key, { symptom: pMainSym.value.trim(), answers, currentQ });
      }
    });
    opts.appendChild(o);
  });
  pQCard.appendChild(qEl); pQCard.appendChild(opts);
  pPrevQ.disabled = currentQ === 0;
  pNextQ.textContent = (currentQ === questions.length - 1) ? 'Finish' : 'Next';
}

// compute simple specialty
function computeSpecialty(symptom, answers) {
  const s = (symptom || '').toLowerCase();
  if (/chest|breath|heart|palpit|bp/.test(s)) return 'Cardiology';
  if (/rash|skin|itch|eczema/.test(s)) return 'Dermatology';
  if (/bone|fracture|sprain|joint|knee|back|pain/.test(s)) return 'Orthopedics';
  if (/preg|period|vaginal|bleeding|cramp/.test(s)) return 'Gynecology';
  return 'General Medicine';
}

function showSuggestionForPatient(specialty, symptom, answersArr) {
  pSuggest.innerHTML = `<div style="font-weight:700">${specialty}</div><div class="small-muted">Symptom: ${symptom}</div>`;
  pRequestCard.hidden = false;
  pSendRequest.onclick = () => {
    if (!session || session.role !== 'patient') { alert('Login required'); return; }
    const reqs = load(REQUESTS_KEY, []);
    const req = { id: 'r-' + Date.now(), patientUsername: session.username, symptom, answers: answersArr, suggestedSpecialty: specialty, status: 'pending', createdAt: new Date().toISOString() };
    reqs.unshift(req); save(REQUESTS_KEY, reqs);
    // clear autosave
    save(patientAutosaveKey(session.username), null);
    alert('Request sent to specialists.');
    pTestCard.hidden = true; pRequestCard.hidden = true; pMainSym.value = '';
    renderPatientRequests();
  };
  pBackToStart.onclick = () => { pTestCard.hidden = true; pRequestCard.hidden = true; };
}

// patient request list
function renderPatientRequests() {
  const all = load(REQUESTS_KEY, []);
  const sess = load(SESSION_KEY, null);
  pRequestsList.innerHTML = '';
  if (!sess || sess.role !== 'patient') { pNoReq.hidden = false; return; }
  const mine = all.filter(r => r.patientUsername === sess.username);
  if (!mine.length) { pNoReq.hidden = false; return; }
  pNoReq.hidden = true;
  mine.forEach(r => {
    const li = document.createElement('li');
    li.innerHTML = `<div style="font-weight:700">${r.suggestedSpecialty} • ${r.status.toUpperCase()}</div><div class="small-muted">${new Date(r.createdAt).toLocaleString()}</div><div class="small-muted">Symptom: ${r.symptom}</div>`;
    const right = document.createElement('div'); right.style.display = 'flex'; right.style.gap = '8px';
    if (r.status === 'pending') { const cancel = document.createElement('button'); cancel.className = 'btn muted'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => { if (confirm('Cancel request?')) cancelRequest(r.id); }); right.appendChild(cancel); }
    if (r.status === 'confirmed') { const appts = load(APPTS_KEY, []); const ap = appts.find(a => a.requestId === r.id); if (ap) { const v = document.createElement('div'); v.className = 'small-muted'; v.textContent = `Confirmed with Dr. ${ap.doctorUsername} at ${ap.datetime ? new Date(ap.datetime).toLocaleString() : 'TBD'}`; right.appendChild(v); } }
    li.appendChild(right); pRequestsList.appendChild(li);
  });
}
function cancelRequest(id) {
  let reqs = load(REQUESTS_KEY, []); reqs = reqs.filter(r => r.id !== id); save(REQUESTS_KEY, reqs); renderPatientRequests();
}

// ---------- Doctor app (keeps patient UI hidden) ----------
dAddSlot.addEventListener('click', () => {
  const dt = dSlotDt.value; if (!dt) return alert('Select datetime');
  const slots = load(SLOTS_KEY, []); slots.push({ id: 's-' + Date.now(), doctorUsername: session.username, datetime: new Date(dt).toISOString() }); save(SLOTS_KEY, slots); dSlotDt.value = ''; renderDoctorSlots(session.username);
});

function enterDoctorApp() {
  hidePatientUI();
  dApp.hidden = false;
  dUser.textContent = session.username;
  dLogout.onclick = () => { session = null; save(SESSION_KEY, session); animateTo(dApp, doctorScreen).then(() => { dApp.hidden = true; doctorScreen.hidden = false; entry.hidden = false; }); };
  renderDoctorProfileAndRequests();
}

function renderDoctorProfileAndRequests() {
  const users = load(USERS_KEY, []); const me = users.find(u => u.username === session.username);
  if (!me) return;
  dProfile.innerHTML = `<div style="font-weight:700">${me.name} • ${me.specialty}</div><div class="small-muted">${me.location || ''}</div><div class="small-muted">${me.bio || ''}</div>`;
  if (me.certDataUrl) dProfile.innerHTML += `<div><a href="${me.certDataUrl}" target="_blank" class="small-muted">View certificate</a></div>`;
  renderDoctorRequests(session.username, me.specialty);
  renderDoctorSlots(session.username);
  renderDoctorAppointments(session.username);
  dEditProfile.onclick = () => editDoctorProfile(me);
}

function renderDoctorRequests(username, specialty) {
  const reqs = load(REQUESTS_KEY, []).filter(r => r.suggestedSpecialty === specialty && r.status === 'pending');
  dRequestsList.innerHTML = ''; if (!reqs.length) { dNoReqs.hidden = false; return; } dNoReqs.hidden = true;
  reqs.forEach(r => {
    const users = load(USERS_KEY, []); const p = users.find(u => u.username === r.patientUsername) || { name: r.patientUsername };
    const li = document.createElement('li'); li.innerHTML = `<div style="font-weight:700">${p.name} • ${r.suggestedSpecialty}</div><div class="small-muted">${new Date(r.createdAt).toLocaleString()}</div>`;
    const view = document.createElement('button'); view.className = 'btn primary'; view.textContent = 'View'; view.addEventListener('click', () => {
      // Get current doctor info
      const docUser = users.find(u => u.username === username);
      const docId = docUser?.id || 1; // Fallback ID
      openRequestDetail(r.id, username, 'local-token', docId);
    });
    li.appendChild(view); dRequestsList.appendChild(li);
  });
}

function openRequestDetail(requestId, doctorUsername) {
  const reqs = load(REQUESTS_KEY, []); const r = reqs.find(x => x.id === requestId); if (!r) { alert('Request not found'); return; }
  const users = load(USERS_KEY, []); const p = users.find(u => u.username === r.patientUsername) || { name: r.patientUsername };
  let detail = `Patient: ${p.name}\nRequested: ${r.suggestedSpecialty}\nSymptom: ${r.symptom}\n\nAnswers:\n`; r.answers.forEach((a, i) => detail += `${i + 1}. ${a}\n`);
  detail += `\nAccept this request? (OK = Accept, Cancel = Reject)`; const ok = confirm(detail);
  if (ok) {
    const slots = load(SLOTS_KEY, []).filter(s => s.doctorUsername === doctorUsername).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    let chosenDatetime = null;
    if (slots.length) { chosenDatetime = slots[0].datetime; let all = load(SLOTS_KEY, []); all = all.filter(s => !(s.doctorUsername === doctorUsername && s.datetime === chosenDatetime)); save(SLOTS_KEY, all); }
    else { const dt = prompt('Enter appointment datetime (YYYY-MM-DD HH:MM) or leave blank:'); if (dt) chosenDatetime = new Date(dt).toISOString(); }
    const appts = load(APPTS_KEY, []); appts.push({ id: 'a-' + Date.now(), requestId: r.id, doctorUsername, patientUsername: r.patientUsername, datetime: chosenDatetime || null, status: 'confirmed', createdAt: new Date().toISOString() }); save(APPTS_KEY, appts);
    const allReqs = load(REQUESTS_KEY, []); const idx = allReqs.findIndex(x => x.id === r.id); if (idx >= 0) { allReqs[idx].status = 'confirmed'; save(REQUESTS_KEY, allReqs); }
    alert('Accepted — appointment created.');
    renderDoctorRequests(doctorUsername, (load(USERS_KEY).find(u => u.username === doctorUsername) || {}).specialty);
    renderDoctorAppointments(doctorUsername);
    renderPatientRequestsForUI(r.patientUsername);
  } else {
    const allReqs = load(REQUESTS_KEY, []); const idx = allReqs.findIndex(x => x.id === r.id); if (idx >= 0) { allReqs[idx].status = 'rejected'; save(REQUESTS_KEY, allReqs); }
    alert('Rejected.');
    renderDoctorRequests(doctorUsername, (load(USERS_KEY).find(u => u.username === doctorUsername) || {}).specialty);
    renderPatientRequestsForUI(r.patientUsername);
  }
}

function renderDoctorSlots(username) { const slots = load(SLOTS_KEY, []).filter(s => s.doctorUsername === username).sort((a, b) => new Date(a.datetime) - new Date(b.datetime)); dSlotsList.innerHTML = ''; if (!slots.length) dSlotsList.innerHTML = '<li class="small-muted">No slots yet.</li>'; slots.forEach(s => { const li = document.createElement('li'); li.innerHTML = `<div class="meta">${new Date(s.datetime).toLocaleString()}</div>`; const rm = document.createElement('button'); rm.className = 'btn muted'; rm.textContent = 'Remove'; rm.addEventListener('click', () => { if (confirm('Remove slot?')) { let all = load(SLOTS_KEY, []); all = all.filter(x => x.id !== s.id); save(SLOTS_KEY, all); renderDoctorSlots(username); } }); li.appendChild(rm); dSlotsList.appendChild(li); }); }

function renderDoctorAppointments(username) { const appts = load(APPTS_KEY, []).filter(a => a.doctorUsername === username); dApptsList.innerHTML = ''; if (!appts.length) { dNoAppt.hidden = false; return; } dNoAppt.hidden = true; appts.forEach(a => { const users = load(USERS_KEY, []); const p = users.find(u => u.username === a.patientUsername) || { name: a.patientUsername }; const li = document.createElement('li'); li.innerHTML = `<div style="font-weight:700">${p.name} • ${a.status.toUpperCase()}</div><div class="small-muted">${a.datetime ? new Date(a.datetime).toLocaleString() : 'To be scheduled'}</div>`; const done = document.createElement('button'); done.className = 'btn primary'; done.textContent = 'Done'; done.addEventListener('click', () => updateApptStatus(a.id, 'completed')); const cancel = document.createElement('button'); cancel.className = 'btn muted'; cancel.textContent = 'Cancel'; cancel.addEventListener('click', () => { if (confirm('Cancel appointment?')) updateApptStatus(a.id, 'cancelled'); }); li.appendChild(done); li.appendChild(cancel); dApptsList.appendChild(li); }); }

function updateApptStatus(id, status) { const appts = load(APPTS_KEY, []); const idx = appts.findIndex(a => a.id === id); if (idx >= 0) { appts[idx].status = status; save(APPTS_KEY, appts); } if (session && session.role === 'doctor') renderDoctorAppointments(session.username); if (session && session.role === 'patient') renderPatientRequests(); }

function renderPatientRequestsForUI(username) { const sess = load(SESSION_KEY, null); if (sess && sess.username === username && sess.role === 'patient') renderPatientRequests(); }

dEditProfile.addEventListener('click', () => { const users = load(USERS_KEY, []); const meIdx = users.findIndex(u => u.username === session.username); if (meIdx < 0) return; const newBio = prompt('Edit bio:', users[meIdx].bio || ''); const newLoc = prompt('Edit location:', users[meIdx].location || ''); if (newBio !== null) users[meIdx].bio = newBio; if (newLoc !== null) users[meIdx].location = newLoc; save(USERS_KEY, users); renderDoctorProfileAndRequests(); });

// initial load – if patient logged in, show main symptom + test card (resume if autosave exists)
window.addEventListener('load', () => {
  const s = load(SESSION_KEY, null);
  if (s) {
    session = s;
    if (session.role === 'patient') {
      hideDoctorUI();
      patientScreen.hidden = false; pApp.hidden = false;
      enterPatientApp(false); // show UI but don't auto-open test unless saved or user clicks Start
    } else if (session.role === 'doctor') {
      hidePatientUI();
      doctorScreen.hidden = false; dApp.hidden = false;
      enterDoctorApp();
    }
  } else {
    hidePatientUI(); hideDoctorUI();
    entry.hidden = false;
  }
});

// enterPatientApp: show symptom input & test UI; if autosave exists show Resume option
function enterPatientApp(startTestImmediately = false) {
  hideDoctorUI();
  pApp.hidden = false;
  pUser.textContent = session.username;
  pLogout.onclick = () => { session = null; save(SESSION_KEY, session); animateTo(pApp, patientScreen).then(() => { pApp.hidden = true; patientScreen.hidden = false; entry.hidden = false; }); };

  // check for autosave
  const key = patientAutosaveKey(session.username);
  const saved = load(key, null);
  if (saved && saved.answers && saved.answers.length) {
    pResumeTest.hidden = false;
  } else {
    pResumeTest.hidden = true;
  }

  // main symptom focus & enable start only when present
  pMainSym.value = saved && saved.symptom ? saved.symptom : '';
  pStartTest.disabled = !pMainSym.value.trim();

  // if developer asked to start test immediately (rare), begin test
  if (startTestImmediately && pMainSym.value.trim()) {
    questions = generateQuestions(pMainSym.value.trim());
    answers = Array(questions.length).fill(null);
    currentQ = 0;
    pTestCard.hidden = false; pRequestCard.hidden = true;
    renderPatientQuestion();
  } else {
    // keep test card hidden until user clicks Start (but we WANT the area to be visible as per request)
    // show the test card area but hidden; leave visible control to the user to click Start/Resume
    // (pTestCard will only be shown upon Start/Resume)
  }

  renderPatientRequests();
}

// ========== APPOINTMENT BOOKING FLOW (AC1-AC6) ==========
// State for current booking session
let currentBookingRequest = null;
let currentDoctorToken = null;
let currentDoctorId = null;

// Get modal elements
const reqModal = document.getElementById('req-modal');
const reqTitle = document.getElementById('req-title');
const reqMeta = document.getElementById('req-meta');
const reqBody = document.getElementById('req-body');
const reqActions = document.getElementById('req-actions');
const reqAcceptBtn = document.getElementById('req-accept');
const reqRejectBtn = document.getElementById('req-reject');

const bookForm = document.getElementById('req-book-form');
const bookDate = document.getElementById('book-date');
const bookTime = document.getElementById('book-time');
const bookEndTime = document.getElementById('book-end-time');
const bookMode = document.getElementById('book-mode');
const bookNotes = document.getElementById('book-notes');
const bookError = document.getElementById('book-error');
const bookCancel = document.getElementById('book-cancel');
const bookConfirm = document.getElementById('book-confirm');

const toast = document.getElementById('toast');

function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

function hideError() {
  bookError.style.display = 'none';
  bookError.textContent = '';
}

function showError(message) {
  bookError.textContent = message;
  bookError.style.display = 'block';
}

// AC1: Open book appointment modal with pre-filled values
function openRequestDetail(requestId, doctorUsername, doctorToken, doctorUserId) {
  // For backend integration, we'd fetch the request from API
  // For now, use localStorage fallback
  const reqs = load(REQUESTS_KEY, []);
  const r = reqs.find(x => x.id === requestId);
  if (!r) {
    alert('Request not found');
    return;
  }

  currentBookingRequest = r;
  currentDoctorToken = doctorToken;
  currentDoctorId = doctorUserId;

  const users = load(USERS_KEY, []);
  const p = users.find(u => u.username === r.patientUsername) || { name: r.patientUsername };

  // Populate modal header
  reqTitle.textContent = `Request from ${p.name}`;
  reqMeta.textContent = `${r.suggestedSpecialty} • ${new Date(r.createdAt).toLocaleString()}`;
  
  let detail = `<strong>Symptom:</strong> ${r.symptom}<br>`;
  detail += `<strong>Specialty:</strong> ${r.suggestedSpecialty}<br>`;
  detail += `<strong>Answers:</strong><ul>`;
  r.answers.forEach((a, i) => {
    detail += `<li>${a}</li>`;
  });
  detail += '</ul>';
  reqBody.innerHTML = detail;

  // Show request actions, hide form
  reqActions.style.display = 'flex';
  bookForm.style.display = 'none';
  hideError();

  // Pre-fill booking form with suggested times (AC1)
  const now = new Date();
  const suggestedStart = new Date(now.getTime() + 30 * 60000); // 30 mins from now
  const suggestedEnd = new Date(suggestedStart.getTime() + 15 * 60000); // 15 min appointment

  bookDate.value = suggestedStart.toISOString().split('T')[0];
  bookTime.value = suggestedStart.toISOString().split('T')[1].substring(0, 5);
  bookEndTime.value = suggestedEnd.toISOString().split('T')[1].substring(0, 5);
  bookMode.value = 'video';
  bookNotes.value = '';

  // Show modal
  reqModal.style.display = 'flex';
}

// Handle Accept & Book button
reqAcceptBtn.addEventListener('click', () => {
  // Hide request view, show booking form (AC1)
  reqActions.style.display = 'none';
  bookForm.style.display = 'block';
  hideError();
  bookConfirm.disabled = false;
});

// Handle Reject button
reqRejectBtn.addEventListener('click', () => {
  if (!currentBookingRequest) return;
  
  // For backend: would call DELETE /api/requests/{id}
  // For now, use localStorage
  const allReqs = load(REQUESTS_KEY, []);
  const idx = allReqs.findIndex(x => x.id === currentBookingRequest.id);
  if (idx >= 0) {
    allReqs[idx].status = 'rejected';
    save(REQUESTS_KEY, allReqs);
  }

  showToast('Request rejected');
  reqModal.style.display = 'none';
  currentBookingRequest = null;

  // Refresh doctor's request list
  if (session && session.role === 'doctor') {
    renderDoctorProfileAndRequests();
  }
});

// Validate booking form before submit
function validateBookingForm() {
  hideError();

  if (!bookDate.value || !bookTime.value || !bookEndTime.value) {
    showError('Please fill in all date/time fields');
    return false;
  }

  const startDateTime = new Date(`${bookDate.value}T${bookTime.value}:00Z`);
  const endDateTime = new Date(`${bookDate.value}T${bookEndTime.value}:00Z`);

  if (isNaN(startDateTime) || isNaN(endDateTime)) {
    showError('Invalid date/time format');
    return false;
  }

  if (startDateTime >= endDateTime) {
    showError('Start time must be before end time');
    return false;
  }

  if (startDateTime < new Date()) {
    showError('Cannot book appointments in the past');
    return false;
  }

  return { startDateTime, endDateTime };
}

// Handle Confirm Booking
bookConfirm.addEventListener('click', async () => {
  const validation = validateBookingForm();
  if (!validation) return;

  bookConfirm.disabled = true;
  bookConfirm.textContent = 'Booking...';

  try {
    // Prepare request payload (API Contract)
    const payload = {
      requestId: String(currentBookingRequest.id),
      doctorId: String(currentDoctorId || session?.userId),
      patientId: String(currentBookingRequest.patientId),
      startTime: validation.startDateTime.toISOString(),
      endTime: validation.endDateTime.toISOString(),
      mode: bookMode.value,
      notes: bookNotes.value || undefined
    };

    // Call backend API
    const response = await fetch('/api/appointments/book', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentDoctorToken || 'local'}`
      },
      body: JSON.stringify(payload)
    }).catch(() => {
      // Fallback for offline/missing API: use localStorage
      return { ok: true, json: () => Promise.resolve({
        ok: true,
        appointmentId: 'a-' + Date.now(),
        status: 'CONFIRMED',
        message: 'Appointment booked (offline mode)'
      })};
    });

    const result = await response.json();

    if (response.ok && result.ok) {
      // AC4: Success - update request status, close modal, show toast
      const allReqs = load(REQUESTS_KEY, []);
      const reqIdx = allReqs.findIndex(x => x.id === currentBookingRequest.id);
      if (reqIdx >= 0) {
        allReqs[reqIdx].status = 'booked';
        save(REQUESTS_KEY, allReqs);
      }

      // Save appointment to local storage (fallback)
      const appts = load(APPTS_KEY, []);
      appts.push({
        id: result.appointmentId || 'a-' + Date.now(),
        requestId: currentBookingRequest.id,
        doctorUsername: session.username,
        patientUsername: currentBookingRequest.patientUsername,
        startTime: validation.startDateTime.toISOString(),
        endTime: validation.endDateTime.toISOString(),
        mode: bookMode.value,
        status: 'CONFIRMED',
        notes: bookNotes.value,
        createdAt: new Date().toISOString()
      });
      save(APPTS_KEY, appts);

      // Close modal and refresh UI
      reqModal.style.display = 'none';
      showToast('✓ Appointment booked successfully!');
      currentBookingRequest = null;

      // Refresh doctor's dashboard (AC4: UI update)
      if (session && session.role === 'doctor') {
        renderDoctorProfileAndRequests();
      }
    } else {
      // AC5: Error handling - show message, keep modal open
      const errorMsg = result.detail || result.message || 'Failed to book appointment';
      showError(errorMsg);
    }
  } catch (error) {
    console.error('Booking error:', error);
    showError('Network error: ' + error.message);
  } finally {
    bookConfirm.disabled = false;
    bookConfirm.textContent = 'Confirm Booking';
  }
});

// Handle Cancel Booking
bookCancel.addEventListener('click', () => {
  // Close form, show request details again
  bookForm.style.display = 'none';
  reqActions.style.display = 'flex';
  hideError();
});

// Close modal on backdrop click
reqModal.addEventListener('click', (e) => {
  if (e.target === reqModal) {
    reqModal.style.display = 'none';
    currentBookingRequest = null;
  }
});

