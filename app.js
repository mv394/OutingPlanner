/* =================================================
   Team Outing Poll  -  app.js  (Firebase edition)
   ================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, onSnapshot,
    doc, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ?? Firebase init ??
const firebaseConfig = {
    apiKey: "AIzaSyDljkZs3hWm6zQv-aYZp-BYNzgNNKYcfTM",
    authDomain: "outingpoll.firebaseapp.com",
    projectId: "outingpoll",
    storageBucket: "outingpoll.firebasestorage.app",
    messagingSenderId: "22100990738",
    appId: "1:22100990738:web:8b3c0872fdcd17a733b1cb"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const responsesCol       = collection(db, "responses");
const optionsCol         = collection(db, "customOptions");
const questionsCol       = collection(db, "questions");
const staticQuestionsCol = collection(db, "staticQuestions");

const customOptionsCache = new Map();
let liveCounts = {};

/* ?? Helpers ?? */
function escHtml(str) {
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function show(pageId) {
    ["pollPage","thankYouPage","resultsPage"].forEach(id =>
        document.getElementById(id).classList.toggle("hidden", id !== pageId));
}

/* ?? SVG icons ?? */
const SVG_EDIT   = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const SVG_DELETE = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const SVG_TRASH  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
const SVG_ADD    = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const SVG_DRAG   = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>`;

/* ?? Static question definitions ?? */
const STATIC_QUESTIONS = [
    { id:"days", title:"Preferred Days", subtitle:"Select all days that work for you.", required:true, type:"checkbox", kind:"static", order:10,
   options:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], addPlaceholder:"Suggest another day or specific date..." },
 { id:"timeSlot", title:"Preferred Time Slot", subtitle:"Pick the time that suits you best.", required:true, type:"radio", kind:"static", order:20, isCards:true,
      options:[
     {label:"Lunch Break",         sub:"12:30 PM - 2:30 PM (Weekdays)", value:"Lunch Break (12:30-2:30 PM)"},
   {label:"After Work - Early",     sub:"4:30 PM - 6:30 PM (Weekdays)",  value:"After Work Early (4:30-6:30 PM)"},
          {label:"After Work - Extended",  sub:"4:30 PM - 8:00 PM (Weekdays)",  value:"After Work Extended (4:30-8:00 PM)"},
        {label:"Weekend Morning",     sub:"9:00 AM - 12:00 PM",          value:"Weekend Morning (9:00 AM-12:00 PM)"},
          {label:"Weekend Afternoon/Evening", sub:"12:00 PM - 9:00 PM",         value:"Weekend Afternoon/Evening"}
      ], addPlaceholder:"Suggest another time slot..." },
    { id:"duration", title:"Outing Duration", subtitle:"How long should the outing last?", type:"radio", kind:"static", order:30,
      options:["1 - 1.5 hrs","1.5 - 2 hrs","2 - 3 hrs","3 hrs+"], addPlaceholder:"Suggest another duration..." },
    { id:"cuisine", title:"Preferred Cuisine", subtitle:"All options are vegetarian-friendly. Pick up to 3.", required:true, type:"checkbox", kind:"static", order:40, maxSelect:3,
options:["Chinese Vegetarian","Japanese (Veg options)","Indian Vegetarian","Malay / Halal (Veg options)","Western Vegetarian","Thai (Veg options)","Mediterranean","Korean (Veg options)","Vegan","No Preference"],
      addPlaceholder:"Suggest another cuisine..." },
    { id:"dietary", title:"Dietary Restrictions", subtitle:"Select all that apply.", type:"checkbox", kind:"static", order:50,
      options:["Halal","Vegetarian","Vegan","No Pork","No Seafood","Nut Allergy","Gluten-Free","None"], addPlaceholder:"Add another dietary restriction..." },
    { id:"diningStyle", title:"Preferred Dining Style", type:"radio", kind:"static", order:60, isCards:true,
      options:[
          {label:"Hawker / Food Court", value:"Hawker / Food Court"},
      {label:"Casual Restaurant",   value:"Casual Restaurant"},
      {label:"Fine Dining",     value:"Fine Dining"},
          {label:"Buffet",              value:"Buffet"},
     {label:"Cafe / Bistro",    value:"Cafe / Bistro"}
      ], addPlaceholder:"Suggest another dining style..." },
    { id:"location", title:"Preferred Area in Singapore", type:"checkbox", kind:"static", order:70,
      options:["Near Office","CBD / Raffles","Orchard","Clarke Quay","East Coast","West Side","Sentosa","No Preference"],
      addPlaceholder:"Suggest another location..." },
    { id:"notes", title:"Suggestions & Comments", kind:"static", type:"text", order:80, options:[] }
];

/* ?? Seed ?? */
async function seedStaticQuestions() {
    // Always overwrite with clean local definitions (fixes stale Firestore data with bad chars)
    for (const q of STATIC_QUESTIONS) await setDoc(doc(staticQuestionsCol, q.id), q);
}

/* ?? Chip toggle + cuisine max-3 ?? */
document.addEventListener("change", function (e) {
  const input = e.target;
    const chip  = input.closest(".chip");
    if (!chip) return;
    if (input.type === "checkbox") chip.classList.toggle("selected", input.checked);
    else if (input.type === "radio") {
        chip.closest(".chip-group").querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
 chip.classList.add("selected");
    }
    if (input.name === "cuisine") {
        const checked = document.querySelectorAll('input[name="cuisine"]:checked');
        const hint    = document.getElementById("cuisineHint");
        if (hint) {
        if (checked.length > 3) { input.checked = false; chip.classList.remove("selected"); hint.textContent = "Maximum 3 cuisines allowed."; }
       else hint.textContent = checked.length > 0 ? `${checked.length} / 3 selected` : "";
     }
    }
});

/* ?? Build chip ?? */
function buildChip(type, name, value, isUser, fsid) {
    const lbl = document.createElement("label");
    lbl.className = "chip" + (isUser ? " user-chip" : "");
    if (fsid) lbl.dataset.fsid = fsid;
    lbl.innerHTML = `<input type="${type}" name="${name}" value="${escHtml(value)}" />
        <span class="chip-text">${escHtml(value)}</span>
        <span class="chip-actions">
        <button type="button" class="btn-chip-edit" title="Edit" onclick="editChip(this)">${SVG_EDIT}</button>
   <button type="button" class="btn-chip-delete" title="Delete" onclick="deleteOption(this,'chip')">${SVG_DELETE}</button>
        </span>`;
  return lbl;
}

/* ?? Build card option ?? */
function buildCard(type, name, value, isUser, fsid) {
    const wrap = document.createElement("label");
    wrap.className = "card-option" + (isUser ? " user-card" : "");
    if (fsid) wrap.dataset.fsid = fsid;
    wrap.innerHTML = `<input type="${type}" name="${name}" value="${escHtml(value)}" />
        <div class="card-body">
 <strong class="card-text">${escHtml(value)}</strong>
     ${isUser ? "<small>Added by team</small>" : ""}
</div>
        <div class="card-actions">
       <button type="button" class="btn-card-edit" title="Edit" onclick="editCard(this)">${SVG_EDIT}</button>
            <button type="button" class="btn-card-delete" title="Delete" onclick="deleteOption(this,'card')">${SVG_DELETE}</button>
     </div>`;
    return wrap;
}

/* ?? Edit / delete options ?? */
window.editChip = function (btn) {
    const chip  = btn.closest(".chip");
 const input = chip.querySelector("input");
    const span  = chip.querySelector(".chip-text");
    const v = prompt("Edit option:", input.value);
    if (!v || !v.trim() || v.trim() === input.value) return;
    const exists = [...chip.closest(".chip-group").querySelectorAll("input")]
   .filter(i => i !== input).map(i => i.value.toLowerCase());
    if (exists.includes(v.trim().toLowerCase())) { alert("That option already exists."); return; }
    if (chip.dataset.fsid) setDoc(doc(db,"customOptions",chip.dataset.fsid),{value:v.trim()},{merge:true});
    input.value = span.textContent = v.trim();
};

window.editCard = function (btn) {
    const card   = btn.closest(".card-option");
    const input  = card.querySelector("input");
    const strong = card.querySelector(".card-text");
    const v = prompt("Edit option:", input.value);
    if (!v || !v.trim() || v.trim() === input.value) return;
    const exists = [...card.closest(".card-group").querySelectorAll("input")]
        .filter(i => i !== input).map(i => i.value.toLowerCase());
    if (exists.includes(v.trim().toLowerCase())) { alert("That option already exists."); return; }
    if (card.dataset.fsid) setDoc(doc(db,"customOptions",card.dataset.fsid),{value:v.trim()},{merge:true});
    input.value = v.trim();
 if (strong) strong.textContent = v.trim();
};

window.deleteOption = function (btn, kind) {
  const el    = btn.closest(kind === "chip" ? ".chip" : ".card-option");
    const input = el.querySelector("input");
    if (input.checked) { alert("Deselect this option before deleting it."); return; }
    if (!confirm(`Remove "${input.value}" from the poll?`)) return;

    const fsid   = el.dataset.fsid;
    const parent = el.parentNode;
    const next   = el.nextSibling;

  // Optimistic: remove immediately
    el.remove();

    if (fsid && !fsid.startsWith("temp_")) {
        deleteDoc(doc(db, "customOptions", fsid)).catch(err => {
 // Rollback on failure
    if (next) parent.insertBefore(el, next);
         else parent.appendChild(el);
alert("Failed to remove option: " + err.message);
   console.error(err);
});
    }
};

/* ?? Add option to static groups ?? */
document.addEventListener("keydown", function (e) {
  if (e.key !== "Enter") return;
    const inp = e.target;
    if (!inp.classList.contains("add-input") || inp.dataset.actionInput) return;
    e.preventDefault();
    addOption(inp.nextElementSibling);
});

async function addOption(btn) {
    const row     = btn.closest(".add-option-row");
    const inp= row.querySelector(".add-input");
    const value   = inp.value.trim();
    if (!value) return;
    const groupId = inp.dataset.group;
    const name    = inp.dataset.name;
    const type    = inp.dataset.type;
    const group   = document.getElementById(groupId);
    if (!group) return;
    const existing = [...group.querySelectorAll("input")].map(i => i.value.toLowerCase());
    if (existing.includes(value.toLowerCase())) {
        inp.value = "";
        inp.placeholder = "That option already exists!";
        setTimeout(() => { inp.placeholder = inp.dataset.orig || ""; }, 2000);
        return;
    }
    if (!inp.dataset.orig) inp.dataset.orig = inp.placeholder;

    // ?? Optimistic update: append immediately, don't wait for Firestore ??
 const tempId = "temp_" + Date.now();
 const el = group.classList.contains("card-group")
        ? buildCard(type, name, value, true, tempId)
        : buildChip(type, name, value, true, tempId);
    group.appendChild(el);
    inp.value = "";
    inp.placeholder = "Added! Add another...";
    setTimeout(() => { inp.placeholder = inp.dataset.orig; }, 1800);

    // ?? Write to Firestore in background ??
    try {
        const docRef = await addDoc(optionsCol, { groupId, name, type, value, icon: "" });
        // Replace temp id with real Firestore id
  el.dataset.fsid = docRef.id;
        customOptionsCache.set(docRef.id, { groupId, name, type, value, icon: "" });
    } catch (err) {
        // Rollback on failure
        el.remove();
     alert("Failed to save option: " + err.message);
        console.error(err);
    }
}
window.addOption = addOption;

/* ?? Load custom options (real-time, handles live changes from other users) ?? */
function loadCustomOptions() {
    onSnapshot(optionsCol, snapshot => {
        snapshot.docChanges().forEach(change => {
    const d    = change.doc.data();
         const fsid = change.doc.id;

            if (change.type === "added") {
    customOptionsCache.set(fsid, d);
     // Already in DOM with real id?
           if (document.querySelector(`[data-fsid="${fsid}"]`)) return;
  const group = document.getElementById(d.groupId);
         if (!group) return;
     // Was added optimistically with a temp id? Upgrade it instead of duplicating.
  const tempEl = [...group.querySelectorAll('[data-fsid^="temp_"]')]
   .find(el => el.querySelector("input")?.value === d.value);
     if (tempEl) {
         tempEl.dataset.fsid = fsid;
  return;
        }
// New addition from another user — append normally
        if (group.classList.contains("card-group")) {
        group.appendChild(buildCard(d.type, d.name, d.value, true, fsid));
        } else {
       group.appendChild(buildChip(d.type, d.name, d.value, true, fsid));
}
            }

       if (change.type === "modified") {
                customOptionsCache.set(fsid, d);
             const el = document.querySelector(`[data-fsid="${fsid}"]`);
    if (!el) return;
           const input = el.querySelector("input");
        const text  = el.querySelector(".chip-text, .card-text");
      if (input) input.value = d.value;
                if (text)  text.textContent = d.value;
   }

      if (change.type === "removed") {
   customOptionsCache.delete(fsid);
    const el = document.querySelector(`[data-fsid="${fsid}"]`);
    if (el) el.remove();
            }
        });
    });
}

/* ?? Remove question button factory ?? */
function makeRemoveBtn(cls, attr, val) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = cls;
    btn.setAttribute(attr, val);
    btn.title = "Remove Question";
    btn.setAttribute("aria-label", "Remove Question");
    btn.innerHTML = SVG_TRASH;
    btn.style.cssText = "display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:2rem;height:2rem;background:#fff0f0;border:2px solid #e74c3c;color:#e74c3c;border-radius:.5rem;cursor:pointer;";
    btn.onmouseover = () => { btn.style.background = "#e74c3c"; btn.style.color = "white"; };
    btn.onmouseout  = () => { btn.style.background = "#fff0f0"; btn.style.color = "#e74c3c"; };
    return btn;
}

/* ?? Build static question card ?? */
function buildStaticCard(q) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.staticId = q.id;

    const hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.25rem;";
    const h2 = document.createElement("h2");
  h2.textContent = q.title;  // plain text — no emoji from Firestore
    hdr.appendChild(h2);
    hdr.appendChild(makeRemoveBtn("btn-remove-static","data-static-id",q.id));
    card.appendChild(hdr);

 if (q.subtitle) {
        const sub = document.createElement("p");
        sub.className = "card-sub";
        sub.innerHTML = escHtml(q.subtitle) + (q.required ? ' <span class="req">*</span>' : "");
        card.appendChild(sub);
  }

    if (q.type === "text") {
        card.innerHTML += `
            <div class="field">
 <label for="suggestion">Any restaurant or place you'd recommend?</label>
          <input type="text" id="suggestion" placeholder="e.g. Lau Pa Sat, Hjh Maimunah, Whole Earth..." />
   </div>
            <div class="field">
     <label for="comments">Anything else you'd like us to know?</label>
            <textarea id="comments" rows="3" placeholder="Special requests, accessibility needs, etc."></textarea>
       </div>`;
        return card;
    }

    const groupId = q.id + "Group";

    if (q.isCards) {
      const group = document.createElement("div");
        group.className = "card-group";
  group.id = groupId;
        q.options.forEach(opt => {
      const isObj = typeof opt === "object";
        const val   = isObj ? opt.value : opt;
     const lbl   = isObj ? opt.label : opt;
   const sub = isObj ? (opt.sub || "") : "";
     const wrap  = document.createElement("label");
        wrap.className = "card-option";
   wrap.innerHTML = `<input type="${q.type}" name="${q.id}" value="${escHtml(val)}" />
       <div class="card-body">
  <strong class="card-text">${escHtml(lbl)}</strong>
        ${sub ? `<small>${escHtml(sub)}</small>` : ""}
    </div>
        <div class="card-actions">
        <button type="button" class="btn-card-edit" title="Edit" onclick="editCard(this)">${SVG_EDIT}</button>
     <button type="button" class="btn-card-delete" title="Delete" onclick="deleteOption(this,'card')">${SVG_DELETE}</button>
    </div>`;
            group.appendChild(wrap);
 });
        card.appendChild(group);
    } else {
   const group = document.createElement("div");
  group.className = "chip-group";
        group.id = groupId;
        q.options.forEach(opt => {
            const lbl = document.createElement("label");
          lbl.className = "chip";
         lbl.innerHTML = `<input type="${q.type}" name="${q.id}" value="${escHtml(opt)}" />
<span class="chip-text">${escHtml(opt)}</span>
     <span class="chip-actions">
        <button type="button" class="btn-chip-edit" title="Edit" onclick="editChip(this)">${SVG_EDIT}</button>
      <button type="button" class="btn-chip-delete" title="Delete" onclick="deleteOption(this,'chip')">${SVG_DELETE}</button>
         </span>`;
  group.appendChild(lbl);
        });
   card.appendChild(group);
        if (q.id === "cuisine") {
            const hint = document.createElement("p");
      hint.className = "hint";
     hint.id = "cuisineHint";
            card.appendChild(hint);
        }
    }

    if (q.addPlaceholder) {
      const row = document.createElement("div");
        row.className = "add-option-row";
        row.innerHTML = `<input type="text" class="add-input"
      placeholder="${escHtml(q.addPlaceholder)}"
   data-group="${groupId}"
   data-name="${q.id}"
      data-type="${q.type}" />
            <button type="button" class="btn-add" onclick="addOption(this)">${SVG_ADD} Add</button>`;
        card.appendChild(row);
    }
    return card;
}

/* ?? Load static questions (one-time, then custom options real-time) ?? */
async function loadStaticQuestions() {
    const form      = document.getElementById("pollForm");
    const submitRow = form.querySelector(".submit-row");
    try {
        // Get which static question IDs still exist in Firestore (not removed)
        const snap = await getDocs(staticQuestionsCol);
        const existingIds = new Set();
        snap.forEach(d => existingIds.add(d.id));

        // Render from clean local array — never from Firestore data (avoids stale special chars)
        STATIC_QUESTIONS
         .filter(q => existingIds.has(q.id))
        .sort((a, b) => (a.order || 0) - (b.order || 0))
  .forEach(q => form.insertBefore(buildStaticCard(q), submitRow));

  // Fetch custom options now that cards are in DOM
   const optSnap = await getDocs(optionsCol);
        optSnap.forEach(d => {
    const data = d.data();
        const fsid = d.id;
 customOptionsCache.set(fsid, data);
     const group = document.getElementById(data.groupId);
            if (!group || document.querySelector(`[data-fsid="${fsid}"]`)) return;
      if (group.classList.contains("card-group")) {
      group.appendChild(buildCard(data.type, data.name, data.value, true, fsid));
            } else {
       group.appendChild(buildChip(data.type, data.name, data.value, true, fsid));
            }
        });
    } catch (err) { console.error("Failed to load questions/options:", err); }
}

/* ?? Validation ?? */
function validate() {
    if (!document.querySelectorAll('input[name="days"]:checked').length)    { alert("Please select at least one preferred day."); return false; }
    if (!document.querySelector('input[name="timeSlot"]:checked')){ alert("Please select a preferred time slot."); return false; }
    if (!document.querySelectorAll('input[name="cuisine"]:checked').length) { alert("Please select at least one cuisine preference."); return false; }
  return true;
}

/* ?? Collect answers ?? */
function collectAnswers() {
    return {
        days:   [...document.querySelectorAll('input[name="days"]:checked')].map(i => i.value),
        timeSlot:    document.querySelector('input[name="timeSlot"]:checked')?.value ?? "",
      duration:    document.querySelector('input[name="duration"]:checked')?.value ?? "",
        cuisine:     [...document.querySelectorAll('input[name="cuisine"]:checked')].map(i => i.value),
        dietary:     [...document.querySelectorAll('input[name="dietary"]:checked')].map(i => i.value),
        diningStyle: document.querySelector('input[name="diningStyle"]:checked')?.value ?? "",
  location:    [...document.querySelectorAll('input[name="location"]:checked')].map(i => i.value),
        suggestion:  document.getElementById("suggestion")?.value.trim() ?? "",
        comments:    document.getElementById("comments")?.value.trim() ?? "",
        submittedAt: new Date().toISOString()
 };
}

/* ?? Submit ?? */
document.getElementById("pollForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!validate()) return;
    const btn = this.querySelector(".btn-submit");
  btn.textContent = "Submitting...";
    btn.disabled = true;
  try {
     await addDoc(responsesCol, collectAnswers());
        show("thankYouPage");
        window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
        alert("Failed to submit: " + err.message);
   console.error(err);
        btn.textContent = "Submit My Vote";
        btn.disabled = false;
  }
});

/* ?? Results ?? */
window.showResults = function () {
    show("resultsPage");
    document.getElementById("resultsSubtitle").textContent = "Loading...";
    document.getElementById("resultsContent").innerHTML = "";
    onSnapshot(responsesCol, snapshot => {
        liveCounts = {};
        const total = snapshot.size;
        snapshot.forEach(docSnap => {
 const d = docSnap.data();
        const inc = (key, vals) => {
   if (!liveCounts[key]) liveCounts[key] = {};
       (Array.isArray(vals) ? vals : [vals]).forEach(v => { if (v) liveCounts[key][v] = (liveCounts[key][v] || 0) + 1; });
 };
      inc("days",d.days); inc("timeSlot",d.timeSlot); inc("duration",d.duration);
  inc("cuisine",d.cuisine); inc("dietary",d.dietary); inc("diningStyle",d.diningStyle); inc("location",d.location);
        });
        document.getElementById("resultsSubtitle").textContent = total + " response" + (total !== 1 ? "s" : "") + " - updates live";
        renderResults(total);
 });
};

function renderResults(total) {
    const content = document.getElementById("resultsContent");
    content.innerHTML = "";
    [{title:"Preferred Days",key:"days"},{title:"Preferred Time Slot",key:"timeSlot"},{title:"Outing Duration",key:"duration"},
     {title:"Cuisine Preferences",key:"cuisine"},{title:"Dietary Restrictions",key:"dietary"},
     {title:"Dining Style",key:"diningStyle"},{title:"Preferred Area",key:"location"}
    ].forEach(sec => {
        const entries = Object.entries(liveCounts[sec.key] || {});
        if (!entries.length) return;
      const block = document.createElement("div");
        block.className = "result-block";
        block.innerHTML = "<h4>" + sec.title + "</h4>";
   entries.sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
   const pct = Math.round((count / Math.max(total, 1)) * 100);
  block.innerHTML += `<div class="bar-row"><span class="bar-label">${escHtml(key)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
    <span class="bar-count">${count}</span></div>`;
        });
    content.appendChild(block);
    });
}

/* ?? Reset ?? */
window.resetPoll = function () {
    document.getElementById("pollForm").reset();
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
    const hint = document.getElementById("cuisineHint");
    if (hint) hint.textContent = "";
    show("pollPage");
    window.scrollTo({ top: 0, behavior: "smooth" });
};

/* ?? Panels ?? */
function initPanels() {
    document.getElementById("btnAddQuestion").onclick = () => {
        document.getElementById("qTitle").value = "";
     togglePanel("addQuestionPanel", true);
        togglePanel("addPollElementPanel", false);
      document.getElementById("qTitle").focus();
    };
    document.getElementById("btnCancelQuestion").onclick = () => togglePanel("addQuestionPanel", false);
    document.getElementById("btnSaveQuestion").onclick   = saveNewQuestion;
    document.getElementById("qTitle").addEventListener("keydown", e => { if (e.key === "Enter") saveNewQuestion(); });

    document.getElementById("btnAddPollElement").onclick = () => {
        document.getElementById("peTitle").value = "";
        document.querySelectorAll("#peTypeSelector .type-btn").forEach(b => b.classList.remove("active"));
        document.querySelector("#peTypeSelector .type-btn[data-type='checkbox']").classList.add("active");
        togglePanel("addPollElementPanel", true);
        togglePanel("addQuestionPanel", false);
        document.getElementById("peTitle").focus();
    };
    document.getElementById("btnCancelPollElement").onclick = () => togglePanel("addPollElementPanel", false);
    document.getElementById("btnSavePollElement").onclick   = saveNewPollElement;
    document.getElementById("peTypeSelector").addEventListener("click", e => {
   const btn = e.target.closest(".type-btn");
      if (!btn) return;
        document.querySelectorAll("#peTypeSelector .type-btn").forEach(b => b.classList.remove("active"));
btn.classList.add("active");
    });
}

function togglePanel(id, visible) {
    document.getElementById(id).classList.toggle("hidden", !visible);
}

async function saveNewQuestion() {
    const title = document.getElementById("qTitle").value.trim();
    if (!title) { document.getElementById("qTitle").focus(); return; }
    try {
        await addDoc(questionsCol, {title, type:"checkbox", options:["Add option"], cols:[], kind:"question", order:Date.now()});
        togglePanel("addQuestionPanel", false);
    } catch (err) { alert("Failed to save question: " + err.message); console.error(err); }
}

async function saveNewPollElement() {
    const title = document.getElementById("peTitle").value.trim();
    if (!title) { document.getElementById("peTitle").focus(); return; }
    const type = document.querySelector("#peTypeSelector .type-btn.active")?.dataset.type || "checkbox";
    let options = ["Add Text"], cols = [];
 if (type === "table-checkbox" || type === "table-radio") { options = ["Row 1","Row 2"]; cols = ["Option A","Option B"]; }
    else if (type === "ranked") { options = ["Item 1","Item 2","Item 3"]; }
    try {
        await addDoc(questionsCol, {title, type, options, cols, kind:"element", order:Date.now()});
        togglePanel("addPollElementPanel", false);
  } catch (err) { alert("Failed to save element: " + err.message); console.error(err); }
}

/* ?? Load dynamic questions ?? */
function loadQuestions() {
    const container = document.getElementById("dynamicQuestionsContainer");
    container.innerHTML = '<p style="color:#aaa;font-size:.85rem;padding:.5rem 0;">Loading questions...</p>';
    onSnapshot(questionsCol, snapshot => {
      if (snapshot.empty) {
    container.innerHTML = '<p style="color:#bbb;font-size:.85rem;padding:.5rem 0;text-align:center;">No custom questions yet - use the buttons above to add one.</p>';
            return;
        }
        const p = container.querySelector("p");
        if (p) p.remove();
        snapshot.docChanges().forEach(change => {
      const fsid = change.doc.id;
if (change.type === "added") {
       if (document.querySelector(`[data-qid="${fsid}"]`)) return;
     container.appendChild(buildQuestionCard(change.doc.data(), fsid));
            }
        if (change.type === "removed") {
const el = document.querySelector(`[data-qid="${fsid}"]`);
          if (el) el.remove();
     if (!container.querySelector("[data-qid]")) {
         container.innerHTML = '<p style="color:#bbb;font-size:.85rem;padding:.5rem 0;text-align:center;">No custom questions yet - use the buttons above to add one.</p>';
      }
       }
    if (change.type === "modified") {
         const el = document.querySelector(`[data-qid="${fsid}"]`);
                if (el) el.replaceWith(buildQuestionCard(change.doc.data(), fsid));
            }
        });
 }, err => {
        container.innerHTML = `<div style="background:#fff0f0;border:2px solid #e74c3c;border-radius:.75rem;padding:1rem;color:#c0392b;font-size:.88rem;">
            <strong>Could not load questions</strong><br/>${err.message}<br/><br/>
  <small>Check Firebase Console - Firestore - Rules</small></div>`;
        console.error(err);
    });
}

function buildQuestionCard(d, fsid) {
    const card    = document.createElement("div");
    card.className = "card dynamic-question";
    card.dataset.qid = fsid;
    const name    = "qdyn_" + fsid;
    const groupId = "qgroup_" + fsid;

    const header = document.createElement("div");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem;";
    const title = document.createElement("h2");
    title.style.cssText = "flex:1;margin:0;font-size:1.05rem;font-weight:700;color:#4a3fa0;";
    title.textContent = d.title;
    header.appendChild(title);
    header.appendChild(makeRemoveBtn("btn-remove-dyn","data-qid",fsid));
    card.appendChild(header);

    if (d.type === "checkbox" || d.type === "radio") {
        const group = document.createElement("div");
   group.className = "chip-group";
        group.id = groupId;
        d.options.forEach(opt => {
         const lbl = document.createElement("label");
       lbl.className = "chip";
          lbl.innerHTML = `<input type="${d.type}" name="${name}" value="${escHtml(opt)}" /><span class="chip-text">${escHtml(opt)}</span>`;
            group.appendChild(lbl);
        });
card.appendChild(group);
        card.appendChild(makeDynAddRow("addDynOpt", fsid, groupId, d.type, name, "Add another option..."));

    } else if (d.type === "table-checkbox" || d.type === "table-radio") {
        const inputType = d.type === "table-checkbox" ? "checkbox" : "radio";
     const wrap  = document.createElement("div");
        wrap.style.overflowX = "auto";
 const table = document.createElement("table");
        table.className = "vote-table";
        table.id = groupId;
        let thead = `<thead><tr><th>Option</th>`;
        d.cols.forEach(col => { thead += `<th>${escHtml(col)}</th>`; });
        thead += `<th></th></tr></thead>`;
   table.innerHTML = thead;
        const tbody = document.createElement("tbody");
        d.options.forEach(opt => {
            const tr = document.createElement("tr");
     let cells = `<td>${escHtml(opt)}</td>`;
       d.cols.forEach(col => {
        cells += `<td><input type="${inputType}" name="${name}_${col.replace(/\s+/g,"_")}" value="${escHtml(opt)}" /></td>`;
       });
     cells += `<td><button type="button" class="btn-tbl-delete" data-action="removeTblRow" data-qid="${fsid}" data-val="${escHtml(opt)}">${SVG_DELETE}</button></td>`;
          tr.innerHTML = cells;
            tbody.appendChild(tr);
   });
        table.appendChild(tbody);
   wrap.appendChild(table);
 card.appendChild(wrap);
     card.appendChild(makeDynAddRow("addTblRow", fsid, null, inputType, name, "Add another row...", JSON.stringify(d.cols)));

    } else if (d.type === "ranked") {
        const hint = document.createElement("p");
        hint.style.cssText = "font-size:.8rem;color:#888;margin-bottom:.4rem;";
        hint.textContent = "Drag to reorder your preference";
        card.appendChild(hint);
      const list = document.createElement("div");
        list.className = "ranked-list";
        list.id = groupId;
        d.options.forEach((opt, i) => list.appendChild(makeRankedItem(opt, i + 1, name, fsid)));
        card.appendChild(list);
        setTimeout(() => initRankedList(list), 50);
        card.appendChild(makeDynAddRow("addRankRow", fsid, groupId, null, name, "Add another item..."));
    }
    return card;
}

function makeDynAddRow(action, fsid, groupId, type, name, placeholder, cols) {
    const row = document.createElement("div");
    row.className = "add-option-row";
    row.innerHTML = `<input type="text" class="add-input" placeholder="${placeholder}"
        data-action-input="${action}" data-qid="${fsid}"
        ${groupId ? `data-group="${groupId}"` : ""}
        ${type    ? `data-type="${type}"`     : ""}
        ${name    ? `data-name="${name}"`     : ""}
     ${cols    ? `data-cols='${cols}'`     : ""} />
        <button type="button" class="btn-add" data-action="${action}" data-qid="${fsid}">${SVG_ADD} Add</button>`;
    return row;
}

function makeRankedItem(opt, num, name, fsid) {
    const item = document.createElement("div");
    item.className = "ranked-item";
    item.draggable = true;
    item.innerHTML = `<span class="rank-handle">${SVG_DRAG}</span>
        <span class="rank-number">${num}</span>
  <span class="rank-label">${escHtml(opt)}</span>
        <input type="hidden" name="${name}" value="${escHtml(opt)}" />
        <span class="rank-actions">
  <button type="button" class="btn-tbl-delete" data-action="removeRankRow" data-qid="${fsid}" data-val="${escHtml(opt)}">${SVG_DELETE}</button>
        </span>`;
    return item;
}

function initRankedList(list) {
    let dragged = null;
    list.querySelectorAll(".ranked-item").forEach(item => {
        item.addEventListener("dragstart", () => { dragged = item; item.classList.add("dragging"); });
        item.addEventListener("dragend",   () => { dragged = null; item.classList.remove("dragging"); updateRankNumbers(list); });
        item.addEventListener("dragover",  e => {
            e.preventDefault();
            const after = getDragAfterElement(list, e.clientY);
  if (after == null) list.appendChild(dragged);
      else list.insertBefore(dragged, after);
        });
    });
}

function updateRankNumbers(list) {
    [...list.querySelectorAll(".rank-number")].forEach((el, i) => el.textContent = i + 1);
}

function getDragAfterElement(list, y) {
    return [...list.querySelectorAll(".ranked-item:not(.dragging)")].reduce((closest, child) => {
        const offset = y - child.getBoundingClientRect().top - child.getBoundingClientRect().height / 2;
 return offset < 0 && offset > closest.offset ? { offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

/* ?? Combined click handler ?? */
document.addEventListener("click", async function (e) {
    const sBtn = e.target.closest(".btn-remove-static");
    if (sBtn) {
const sid = sBtn.getAttribute("data-static-id");
      if (!sid || !confirm("Remove this question for everyone?")) return;
   try { await deleteDoc(doc(staticQuestionsCol, sid)); }
      catch (err) { alert("Failed to remove: " + err.message); console.error(err); }
        return;
    }
    const dBtn = e.target.closest(".btn-remove-dyn");
    if (dBtn) {
      const fsid = dBtn.getAttribute("data-qid");
        if (!fsid || !confirm("Remove this question for everyone?")) return;
        try { await deleteDoc(doc(db, "questions", fsid)); }
        catch (err) { alert("Failed to remove: " + err.message); console.error(err); }
     return;
    }
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const fsid   = btn.dataset.qid;
    const row    = btn.closest(".add-option-row");
    const inp    = row ? row.querySelector(".add-input") : null;
    if (action === "addDynOpt" || action === "addTblRow" || action === "addRankRow") {
        const value = inp ? inp.value.trim() : "";
        if (!value) { if (inp) inp.focus(); return; }
        await updateDoc(doc(db, "questions", fsid), { options: arrayUnion(value) });
        if (inp) inp.value = "";
    }
    if (action === "removeTblRow" || action === "removeRankRow") {
        const value = btn.dataset.val;
        if (!confirm(`Remove "${value}"?`)) return;
  await updateDoc(doc(db, "questions", fsid), { options: arrayRemove(value) });
    }
});

/* ?? Enter key for dynamic add inputs ?? */
document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    const inp = e.target.closest("[data-action-input]");
if (!inp) return;
    e.preventDefault();
    inp.nextElementSibling?.click();
});

/* ?? INIT ?? */
seedStaticQuestions();
loadStaticQuestions();
loadCustomOptions();
loadQuestions();
initPanels();
