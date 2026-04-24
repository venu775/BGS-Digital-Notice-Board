// Digital Notice Board - final version with single-page login
const STORAGE_KEY = "digital_notice_board_final_v1";

const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const nowISO = ()=> new Date().toISOString();

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function loadNotices() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    return JSON.parse(raw);
  } catch(e) {
    console.error(e);
    return seed();
  }
}
function saveNotices(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

function seed(){
  const s = [
    {id:uid(), title:"Semester Exam Circular", type:"Circular", date:"2025-09-10", expiry:"2025-09-30", description:"Exams from 10th Sept. Check timetable.", added: nowISO(), pinned:false, read:false},
    {id:uid(), title:"Inter College Coding Contest", type:"Event", date:addDaysISO(7), expiry:addDaysISO(14), description:"Register your team at CS Dept.", added: nowISO(), pinned:false, read:false},
    {id:uid(), title:"Urgent: Water supply disruption", type:"Urgent", date:addDaysISO(1), expiry:addDaysISO(2), description:"Water off tomorrow 9 AM - 5 PM.", added: nowISO(), pinned:true, read:false}
  ];
  saveNotices(s);
  return s;
}

function addDaysISO(days){
  const d = new Date(); d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}

let notices = loadNotices();
let currentTab = "all";
let tickerIndex = 0;
let bulkSelectMode = false;
let selectedNotices = new Set();
let sortType = "date";
let currentRole = "admin"; // "admin" or "student"

function isExpired(n){ if(!n.expiry) return false; const e=new Date(n.expiry+"T23:59:59"); return e < new Date(); }
function escapeHtml(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function sortNotices(list){ 
  let sorted = list.slice().sort((a,b)=>{
    if((a.pinned?1:0)!=(b.pinned?1:0)) return (b.pinned?1:0)-(a.pinned?1:0);
    if(sortType === "title") return (a.title||"").localeCompare(b.title||"");
    if(sortType === "type") return (a.type||"").localeCompare(b.type||"");
    return new Date(b.added)-new Date(a.added);
  });
  return sorted;
}

function renderTicker(){
  const urgents = notices.filter(n=>n.type==="Urgent" && !isExpired(n));
  const ticker = $("#ticker-inner");
  if(urgents.length===0){ ticker.textContent = "No urgent notices at the moment."; return; }
  tickerIndex = tickerIndex % urgents.length;
  ticker.textContent = `${urgents[tickerIndex].title} — ${urgents[tickerIndex].description}`;
  clearInterval(window._tickerTimer);
  window._tickerTimer = setInterval(()=> {
    tickerIndex = (tickerIndex+1)%urgents.length;
    ticker.textContent = `${urgents[tickerIndex].title} — ${urgents[tickerIndex].description}`;
  }, 6000);
}

function renderNotices(){
  const container = $("#notices");
  container.innerHTML = "";
  const q = $("#search").value.toLowerCase().trim();
  let filtered = notices.filter(n => !isExpired(n));
  if(currentTab !== "all") filtered = filtered.filter(n=> n.type === currentTab);
  if(q) filtered = filtered.filter(n => (n.title + " " + n.description + " " + (n.type||"")).toLowerCase().includes(q));
  filtered = sortNotices(filtered);

  if(filtered.length === 0){
    container.innerHTML = `<div class="notice"><p class="small">No notices to display. Use the admin panel to add notices.</p></div>`;
    renderTicker();
    return;
  }

  // use index to stagger animation delay
  for(let i = 0; i < filtered.length; i++){
    const n = filtered[i];
    const el = document.createElement("article");
    // ensure we have easy access to id for click handlers
    el.setAttribute('data-id', n.id);
    const isUnread = !n.read;
    el.className = "notice" + (n.pinned? " pinned":"") + (isUnread? " unread":"");
    el.innerHTML = `
      ${bulkSelectMode ? `<input type="checkbox" class="notice-checkbox" data-id="${n.id}" aria-label="Select notice">` : ""}
      <div class="meta">
        <div class="${n.type==='Urgent'?'badge urgent':(n.type==='Event'?'badge event':'badge circular')}">${escapeHtml(n.type)}</div>
        <div class="countdown" data-date="${n.date||''}"></div>
      </div>
      <h3>${escapeHtml(n.title)}</h3>
      <p>${escapeHtml(n.description)}</p>
      ${n.image ? `<img src="${n.image}" class="poster" alt="Poster for ${escapeHtml(n.title)}">` : ""}
      ${n.attachment ? `<div class="notice-file" role="group" aria-label="Attachment">📎 ${escapeHtml(n.attachment.name)}</div>` : ""}
      <div class="actions" role="group" aria-label="Notice actions">
        <button class="icon-btn admin-only" data-action="pin" data-id="${n.id}" title="${n.pinned?'Unpin':'Pin'}" aria-pressed="${n.pinned}">${n.pinned?'📌':'📍'}</button>
        <button class="icon-btn admin-only" data-action="edit" data-id="${n.id}" title="Edit">✎</button>
        <button class="icon-btn admin-only" data-action="delete" data-id="${n.id}" title="Delete">🗑</button>
      </div>
    `;
    // stagger animation delay for nicer entrance
    el.style.animationDelay = `${i * 60}ms`;
    container.appendChild(el);
  }
  renderAllCountdowns();
  renderTicker();
}

function renderAllCountdowns(){
  const nodes = $$(".countdown");
  nodes.forEach(n=>{
    const dateStr = n.getAttribute("data-date");
    if(!dateStr){ n.textContent = ""; return; }
    const target = new Date(dateStr + "T00:00:00");
    function update(){
      const diff = target - new Date();
      if(diff<=0){ n.textContent = "Happening soon"; return; }
      const days = Math.floor(diff/(1000*60*60*24));
      const hrs = Math.floor(diff/(1000*60*60) % 24);
      const mins = Math.floor(diff/(1000*60) % 60);
      n.textContent = `${days}d ${hrs}h ${mins}m`;
    }
    update();
  });
}

function resetForm(){ $("#notice-id").value=""; $("#title").value=""; $("#type").value="Circular"; $("#notice-date").value=""; $("#expiry-date").value=""; $("#description").value=""; $("#image-upload").value=""; $("#file-attach").value=""; }

function addOrUpdateNotice(e){
  e.preventDefault();
  // prevent student edits
  if(document.body.classList.contains('role-student')){
    alert("Students have view-only access and cannot add or edit notices.");
    return;
  }
  const id = $("#notice-id").value;
  const title = $("#title").value.trim();
  const type = $("#type").value;
  const date = $("#notice-date").value || null;
  const expiry = $("#expiry-date").value || null;
  const description = $("#description").value.trim();

  if(!title || !description){ alert("Please provide title and description."); return; }

  const imageFile = $("#image-upload").files[0];
  const attachFile = $("#file-attach").files[0];

  if(attachFile && attachFile.size > 10*1024*1024){
    alert("File size must be less than 10MB");
    return;
  }

  let imageData = null;
  let attachmentData = null;

  if(imageFile){
    const fr = new FileReader();
    fr.onload = () => {
      imageData = fr.result;
      if(attachFile){
        const fr2 = new FileReader();
        fr2.onload = () => {
          attachmentData = {name:attachFile.name, data:fr2.result, type:attachFile.type};
          storeNotice(id,title,type,date,expiry,description,imageData,attachmentData);
        };
        fr2.readAsDataURL(attachFile);
      } else {
        storeNotice(id,title,type,date,expiry,description,imageData,null);
      }
    };
    fr.readAsDataURL(imageFile);
  } else if(attachFile){
    const fr = new FileReader();
    fr.onload = () => {
      attachmentData = {name:attachFile.name, data:fr.result, type:attachFile.type};
      storeNotice(id,title,type,date,expiry,description,null,attachmentData);
    };
    fr.readAsDataURL(attachFile);
  } else {
    storeNotice(id,title,type,date,expiry,description,null,null);
  }
}

function storeNotice(id,title,type,date,expiry,description,imageData,attachmentData){
  if(id){
    const idx = notices.findIndex(n=>n.id===id);
    if(idx>=0){
      notices[idx] = {...notices[idx], title, type, date, expiry, description};
      if(imageData !== null) notices[idx].image = imageData;
      if(attachmentData !== null) notices[idx].attachment = attachmentData;
      saveNotices(notices); renderNotices(); renderStats(); resetForm(); alert("Notice updated."); return;
    }
  }
  const newNotice = {id:uid(), title, type, date, expiry, description, added: nowISO(), pinned:false, read:false};
  if(imageData) newNotice.image = imageData;
  if(attachmentData) newNotice.attachment = attachmentData;
  notices.push(newNotice);
  saveNotices(notices); renderNotices(); renderStats(); resetForm();
}

function onNoticeAction(e){
  const btn = e.target.closest("button");
  if(!btn) {
    const article = e.target.closest(".notice");
    if(article){
      const id = article.getAttribute("data-id");
      if(id){
        const idx = notices.findIndex(n=>n.id===id);
        if(idx>=0 && !notices[idx].read){ notices[idx].read = true; saveNotices(notices); renderNotices(); }
      }
    }
    return;
  }

  // prevent any admin actions when student
  if(document.body.classList.contains('role-student')){
    // silently ignore or show message
    return;
  }

  const action = btn.getAttribute("data-action");
  const id = btn.getAttribute("data-id");
  if(action === "delete"){
    if(!confirm("Delete this notice?")) return;
    notices = notices.filter(n=>n.id!==id);
    saveNotices(notices); renderNotices(); renderStats();
  } else if(action === "edit"){
    const n = notices.find(x=>x.id===id);
    if(!n) return;
    $("#notice-id").value = n.id; $("#title").value = n.title; $("#type").value = n.type; $("#notice-date").value = n.date || ""; $("#expiry-date").value = n.expiry || ""; $("#description").value = n.description;
    if(n.read) notices.find(x=>x.id===id).read = false;
    window.scrollTo({top:0,behavior:"smooth"});
  } else if(action === "pin"){
    const idx = notices.findIndex(n=>n.id===id);
    if(idx>=0){ notices[idx].pinned = !notices[idx].pinned; saveNotices(notices); renderNotices(); renderStats(); }
  }
}

function exportJSON(){ const dataStr = JSON.stringify(notices, null, 2); const blob = new Blob([dataStr], {type:"application/json"}); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "notices.json"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); }
function importJSON(file){ const fr = new FileReader(); fr.onload = ()=>{ try{ const imported = JSON.parse(fr.result); if(!Array.isArray(imported)) throw new Error("JSON must be an array"); const map = new Map(notices.map(n=>[n.id,n])); for(const it of imported){ if(!it.id) it.id = uid(); map.set(it.id,it); } notices = Array.from(map.values()); saveNotices(notices); renderNotices(); alert("Imported successfully."); }catch(err){ alert("Failed to import: "+ err.message); } }; fr.readAsText(file); }
function clearAll(){ if(!confirm("Clear all notices? This cannot be undone.")) return; notices = []; saveNotices(notices); renderNotices(); }

function loadTheme(){ const saved = localStorage.getItem("dnb_theme"); const t = saved || "dark"; document.body.setAttribute("data-theme", t); $("#theme-toggle").checked = (t==="light"); }
function toggleTheme(e){ const theme = e.target.checked? "light":"dark"; document.body.setAttribute("data-theme", theme); localStorage.setItem("dnb_theme", theme); }

function setTab(t){ currentTab = t; $$(".tab").forEach(el=>el.classList.toggle("active", el.getAttribute("data-type")===t)); const statsSection = $("#stats-section"); if(statsSection){ if(t === "Stats"){ statsSection.style.display = "grid"; $(".container").style.display = "none"; } else { statsSection.style.display = "none"; $(".container").style.display = "grid"; } } renderNotices(); }

function renderStats(){
  const stats = {
    total: notices.length,
    urgent: notices.filter(n=>n.type==="Urgent").length,
    events: notices.filter(n=>n.type==="Event").length,
    circular: notices.filter(n=>n.type==="Circular").length,
    pinned: notices.filter(n=>n.pinned).length,
    expired: notices.filter(n=>isExpired(n)).length
  };
  $("#stat-total").textContent = stats.total;
  $("#stat-urgent").textContent = stats.urgent;
  $("#stat-events").textContent = stats.events;
  $("#stat-circular").textContent = stats.circular;
  $("#stat-pinned").textContent = stats.pinned;
  $("#stat-expired").textContent = stats.expired;
}

// Add helper to enable/disable admin-only interactive controls
function updateAdminControls(isStudent){
  const nodes = document.querySelectorAll('.admin-only');
  nodes.forEach(n => {
    // disable buttons/inputs/selects for students
    if (n.tagName === 'BUTTON' || n.tagName === 'INPUT' || n.tagName === 'SELECT' || n.tagName === 'TEXTAREA') {
      try { n.disabled = !!isStudent; } catch(e) {}
    }
    // ensure non-interactive visually for students
    n.style.pointerEvents = isStudent ? 'none' : '';
    n.setAttribute('aria-hidden', isStudent ? 'true' : 'false');
  });
}

// Prevent student from toggling bulk select
function toggleBulkSelect(){
  if(document.body.classList.contains('role-student')) return;
  bulkSelectMode = !bulkSelectMode;
  const bulkActions = $("#bulk-actions");
  const bulkBtn = $("#bulk-select-btn");
  if(bulkActions && bulkBtn){
    if(bulkSelectMode){
      bulkActions.style.display = "flex";
      bulkBtn.textContent = "Done";
    } else {
      bulkActions.style.display = "none";
      bulkBtn.textContent = "📋 Select";
      selectedNotices.clear();
    }
  }
  renderNotices();
}

// Prevent student from bulk deleting
function bulkDelete(){
  if(document.body.classList.contains('role-student')) return;
  if(selectedNotices.size === 0) return;
  if(!confirm(`Delete ${selectedNotices.size} notice(s)?`)) return;
  notices = notices.filter(n => !selectedNotices.has(n.id));
  saveNotices(notices); renderNotices(); renderStats(); toggleBulkSelect();
}

// Prevent student from bulk pinning
function bulkPin(){
  if(document.body.classList.contains('role-student')) return;
  if(selectedNotices.size === 0) return;
  notices.forEach(n => { if(selectedNotices.has(n.id)) n.pinned = true; });
  saveNotices(notices); renderNotices(); renderStats(); toggleBulkSelect();
}

function setupKeyboardShortcuts(){
  document.addEventListener("keydown", (e) => {
    if(e.ctrlKey || e.metaKey){
      if(e.key === "f"){ e.preventDefault(); $("#search")?.focus(); }
      else if(e.key === "n"){
        if(document.body.classList.contains('role-student')) return;
        e.preventDefault(); $("#title")?.focus(); resetForm(); }
      else if(e.key === "b"){ e.preventDefault(); toggleBulkSelect(); }
      else if(e.key === "s"){
        if(document.body.classList.contains('role-student')) return;
        e.preventDefault(); const form = document.getElementById("notice-form"); if(form && $("#title").value) form.dispatchEvent(new Event("submit")); }
    }
    else if(e.key === "Escape"){
      if(bulkSelectMode) toggleBulkSelect();
      const modal = $("#shortcuts-modal");
      if(modal && modal.style.display !== "none") modal.style.display = "none";
    }
    else if(e.key === "?" && !["INPUT","TEXTAREA"].includes(e.target.tagName)){
      e.preventDefault();
      const modal = $("#shortcuts-modal");
      if(modal) modal.style.display = modal.style.display === "none" ? "flex" : "none";
    }
  });
}

function showHelpModal(){
  const modal = $("#shortcuts-modal");
  if(modal) modal.style.display = modal.style.display === "none" ? "flex" : "none";
}

function setupLogin(){ 
  const loginForm = $("#loginForm"); 
  const loginError = $("#loginError"); 
  const loginSection = $("#loginSection"); 
  const appSection = $("#appSection"); 
  const logoutBtn = $("#logoutBtn"); 
  const USER = "admin"; 
  const PASS = "1234";
  const STUD_USER = "student";
  const STUD_PASS = "1111";
  if(loginForm) loginForm.addEventListener("submit", function(e){ 
    e.preventDefault(); 
    const user = $("#username").value.trim(); 
    const pass = $("#password").value.trim(); 
    const role = $("#role-select") ? $("#role-select").value : "admin"; 
    currentRole = role; 
    if(role === "admin"){ 
      if(user === USER && pass === PASS){ 
        loginSection.style.display = "none"; 
        appSection.style.display = "block"; 
        loginError.textContent = ""; 
        document.body.classList.remove('role-student'); 
      } else { 
        loginError.textContent = "❌ Invalid username or password"; 
        return; 
      } 
    } else { 
      // student login - require specific demo credentials
      if(user === STUD_USER && pass === STUD_PASS){
        loginSection.style.display = "none";
        appSection.style.display = "block";
        loginError.textContent = "";
        document.body.classList.add('role-student');
      } else {
        loginError.textContent = "❌ Invalid student username or password";
        return;
      }
    }
    // update aria-hidden and render UI according to role
    appSection.setAttribute('aria-hidden', 'false');
    // disable/enable admin-only interactive controls
    updateAdminControls(document.body.classList.contains('role-student'));
    // ensure admin-only UI hidden/shown by CSS; refresh notices
    renderNotices();
    renderStats();
  }); 
  if(logoutBtn) logoutBtn.addEventListener("click", ()=>{ 
    appSection.style.display = "none"; 
    loginSection.style.display = "flex"; 
    loginForm.reset(); 
    document.body.classList.remove('role-student'); 
    currentRole = 'admin'; 
    updateAdminControls(false);
  }); 
}

function wire(){ 
  document.getElementById("notice-form").addEventListener("submit", addOrUpdateNotice); 
  $("#notices").addEventListener("click", onNoticeAction); 
  $("#search").addEventListener("input", renderNotices); 
  $("#sort-by").addEventListener("change", (e)=>{ sortType = e.target.value; renderNotices(); }); 
  $("#bulk-select-btn").addEventListener("click", toggleBulkSelect); 
  $("#bulk-delete").addEventListener("click", bulkDelete); 
  $("#bulk-pin").addEventListener("click", bulkPin); 
  $("#bulk-cancel").addEventListener("click", toggleBulkSelect); 
  $("#notices").addEventListener("change", (e)=>{ if(e.target.classList.contains("notice-checkbox")) updateBulkCount(); }); 
  $("#clear-filters").addEventListener("click", ()=>{ $("#search").value=""; setTab("all"); renderNotices(); }); 
  $("#export-json").addEventListener("click", exportJSON); 
  $("#import-file").addEventListener("change",(ev)=>{ const f=ev.target.files[0]; if(f) importJSON(f); ev.target.value=""; }); 
  $("#clear-all").addEventListener("click", clearAll); 
  $("#theme-toggle").addEventListener("change", toggleTheme); 
  $("#help-btn").addEventListener("click", showHelpModal); 
  $("#close-modal").addEventListener("click", showHelpModal); 
  $$(".tab").forEach(b=> b.addEventListener("click", ()=> setTab(b.getAttribute("data-type")))); 
  document.getElementById("year").textContent = (new Date()).getFullYear(); 
  loadTheme(); 
  renderNotices(); 
  renderTicker(); 
  renderStats(); 
  setupLogin(); 
  setupKeyboardShortcuts(); 
  // Cancel-edit handler (reset and scroll)
  $("#cancel-edit").addEventListener("click", (ev)=>{
    ev.preventDefault();
    resetForm();
    window.scrollTo({top:0,behavior:'smooth'});
  });
} 
document.addEventListener("DOMContentLoaded", wire); 
setInterval(()=> renderAllCountdowns(), 60*1000);
(function() {
  // create chatbot elements
  const chatbotButton = document.createElement('button');
  chatbotButton.id = 'chatbot-btn';
  chatbotButton.textContent = '💬 Chat';
  chatbotButton.style.position = 'fixed';
  chatbotButton.style.bottom = '20px';
  chatbotButton.style.right = '20px';
  chatbotButton.style.zIndex = 1000;
  chatbotButton.className = 'ghost';
  chatbotButton.setAttribute('aria-controls','chatbot-window');
  chatbotButton.setAttribute('aria-expanded','false');
  chatbotButton.setAttribute('aria-label','Open chat assistant');

  const chatbotWindow = document.createElement('div');
  chatbotWindow.id = 'chatbot-window';
  chatbotWindow.style.position = 'fixed';
  chatbotWindow.style.bottom = '70px';
  chatbotWindow.style.right = '20px';
  chatbotWindow.style.width = '320px';
  chatbotWindow.style.maxHeight = '380px';
  chatbotWindow.style.background = '#222';
  chatbotWindow.style.color = '#fafafa';
  chatbotWindow.style.boxShadow = '0 0 10px #0008';
  chatbotWindow.style.borderRadius = '10px';
  chatbotWindow.style.display = 'flex'; // keep flex but initially hidden via class
  chatbotWindow.style.flexDirection = 'column';
  chatbotWindow.style.zIndex = 1001;
  chatbotWindow.classList.add('chatbot-hidden'); // hidden by default
  chatbotWindow.setAttribute('role','dialog');
  chatbotWindow.setAttribute('aria-modal','false');
  chatbotWindow.setAttribute('aria-hidden','true');

  // Chat header
  const chatHeader = document.createElement('div');
  chatHeader.style.padding = '10px 14px';
  chatHeader.style.background = '#111';
  chatHeader.style.borderTopLeftRadius = '10px';
  chatHeader.style.borderTopRightRadius = '10px';
  chatHeader.style.display = 'flex';
  chatHeader.style.justifyContent = 'space-between';
  chatHeader.style.alignItems = 'center';

  const title = document.createElement('span');
  title.textContent = "Ask BGS Bot";
  title.style.fontWeight = 'bold';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = "✖";
  closeBtn.style.background = 'none';
  closeBtn.style.border = 'none';
  closeBtn.style.color = '#fafafa';
  closeBtn.style.fontSize = '1.2em';
  closeBtn.style.cursor = 'pointer';
  closeBtn.className = 'chat-close-btn';
  closeBtn.setAttribute('aria-label', 'Close chat');

  chatHeader.appendChild(title);
  chatHeader.appendChild(closeBtn);

  // Messages
  const chatMessages = document.createElement('div');
  chatMessages.id = "chatbot-messages";
  chatMessages.style.flex = '1';
  chatMessages.style.overflowY = 'auto';
  chatMessages.style.padding = '10px';
  chatMessages.style.maxHeight = '240px';

  // Input area
  const chatForm = document.createElement('form');
  chatForm.id = "chatbot-form";
  chatForm.style.display = 'flex';
  chatForm.style.background = '#222';
  chatForm.style.padding = '8px';
  chatForm.style.borderBottomLeftRadius = '10px';
  chatForm.style.borderBottomRightRadius = '10px';

  const chatInput = document.createElement('input');
  chatInput.type = 'text';
  chatInput.placeholder = 'Ask me anything about the notice board!';
  chatInput.style.flex = 1;
  chatInput.style.padding = '6px';
  chatInput.style.borderRadius = '4px';
  chatInput.style.border = '1px solid #444';
  chatInput.style.background = '#181818';
  chatInput.style.color = '#fff';

  const chatSend = document.createElement('button');
  chatSend.type = 'submit';
  chatSend.textContent = 'Send';
  chatSend.style.marginLeft = '8px';
  chatSend.className = 'btn';

  chatForm.appendChild(chatInput);
  chatForm.appendChild(chatSend);

  chatbotWindow.appendChild(chatHeader);
  chatbotWindow.appendChild(chatMessages);
  chatbotWindow.appendChild(chatForm);

  document.body.appendChild(chatbotButton);
  document.body.appendChild(chatbotWindow);

  // Toggle chatbot window with ARIA updates and focus
  chatbotButton.onclick = () => {
    const opened = !chatbotWindow.classList.toggle('chatbot-hidden');
    chatbotWindow.setAttribute('aria-hidden', String(chatbotWindow.classList.contains('chatbot-hidden')));
    chatbotButton.setAttribute('aria-expanded', String(!chatbotWindow.classList.contains('chatbot-hidden')));
    if (opened) {
      chatInput.focus();
    } else {
      chatbotButton.focus();
    }
  };
  closeBtn.onclick = () => {
    chatbotWindow.classList.add('chatbot-hidden');
    chatbotWindow.setAttribute('aria-hidden','true');
    chatbotButton.setAttribute('aria-expanded','false');
    chatbotButton.focus();
  };

  // allow Enter/Space on close button for keyboard users (button already handles click, this is defensive)
  closeBtn.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      closeBtn.click();
    }
  });

  // allow Escape to close chatbot
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      if (!chatbotWindow.classList.contains('chatbot-hidden')) {
        chatbotWindow.classList.add('chatbot-hidden');
        chatbotWindow.setAttribute('aria-hidden','true');
        chatbotButton.setAttribute('aria-expanded','false');
        chatbotButton.focus();
      }
    }
  });

  // Chat logic
  const botResponses = [
    {
      keywords: ['urgent', 'emergency', 'important'],
      response: 'Urgent notices are highlighted in the "Urgent" tab and ticker. Please check that section regularly for updates.'
    },
    {
      keywords: ['circular', 'rules', 'policy'],
      response: 'Circulars and rules can be found under the "Circulars" tab above.'
    },
    {
      keywords: ['event', 'fest', 'workshop', 'seminar'],
      response: 'Upcoming events are listed in the "Events" tab. You can filter and view all events there!'
    },
    {
      keywords: ['login', 'password', 'account'],
      response: 'If you are facing login issues, please ensure your credentials are correct. For demo, use admin / 1234.'
    },
    {
      keywords: ['stats', 'statistics', 'how many'],
      response: 'The "Stats" tab shows statistics such as totals, urgent and events. Click 📊 Stats to view them!'
    },
    {
      keywords: ['theme', 'color', 'dark mode', 'light'],
      response: 'You can toggle between dark and light modes using the switch at the top right.'
    },
    {
      keywords: ['logout', 'sign out'],
      response: 'You can logout from the system using the Logout button at the top right corner.'
    },
    {
      keywords: ['help', 'how', 'about', 'what'],
      response: 'This is the Digital Notice Board for BGS College of Engineering and Technology. Use the tabs above to browse notices, circulars, events and more!'
    }
  ];

  function getBotResponse(msg) {
    msg = msg.trim().toLowerCase();
    // Special/generic responses
    if (!msg) return null;
    for (const entry of botResponses) {
      for (const kw of entry.keywords) {
        if (msg.includes(kw)) return entry.response;
      }
    }
    // Fallback
    if (msg.includes("hi") || msg.includes("hello")) {
      return "Hello! How can I assist you with the notice board today?";
    }
    return "Sorry, I didn't understand that. Please ask about notices, events, circulars, using the tabs above.";
  }

  function appendMessage(message, isUser) {
    const msg = document.createElement('div');
    msg.textContent = message;
    msg.style.marginBottom = '8px';
    msg.style.background = isUser ? '#363CC9' : '#444';
    msg.style.color = isUser ? '#fff' : '#efefef';
    msg.style.alignSelf = isUser ? 'flex-end' : 'flex-start';
    msg.style.padding = '7px 13px';
    msg.style.borderRadius = isUser
      ? '14px 14px 4px 14px'
      : '14px 14px 14px 4px';
    msg.style.maxWidth = '80%';
    msg.style.fontSize = '0.97em';
    msg.style.wordBreak = 'break-word';
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  chatForm.onsubmit = function(e) {
    e.preventDefault();
    const userMsg = chatInput.value;
    if (!userMsg) return;
    appendMessage(userMsg, true);
    chatInput.value = '';
    setTimeout(() => {
      const botMsg = getBotResponse(userMsg);
      if (botMsg) appendMessage(botMsg, false);
    }, 400);
  }
})();

