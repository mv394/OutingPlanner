/* =================================================
   Team Outing Poll  -  app.js  (Firebase edition)
   ================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, getDocs, onSnapshot,
    doc, setDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove,
    getDocFromServer, getDocsFromServer
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

const responsesCol  = collection(db, "responses");
const optionsCol         = collection(db, "customOptions");
const questionsCol     = collection(db, "questions");
const staticQuestionsCol = collection(db, "staticQuestions");

const customOptionsCache = new Map();
let liveCounts = {};

/* Helpers */
function escHtml(str) {
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}
function show(pageId) {
    ["pollPage","thankYouPage","resultsPage"].forEach(id =>
        document.getElementById(id).classList.toggle("hidden", id !== pageId));
}

/* SVG icons */
const SVG_EDIT   = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const SVG_DELETE = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
const SVG_TRASH  = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
const SVG_ADD    = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const SVG_DRAG   = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>`;

/* Static question definitions */
const STATIC_QUESTIONS = [
    { id:"days", title:"Preferred Days", subtitle:"Select all days that work for you.", required:true, type:"checkbox", kind:"static", order:10,
      options:["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"], addPlaceholder:"Suggest another day or specific date..." },
    { id:"timeSlot", title:"Preferred Time Slot", subtitle:"Pick the time that suits you best.", required:true, type:"radio", kind:"static", order:20, isCards:true,
  options:[
          {label:"Lunch Break",           sub:"12:30 PM - 2:30 PM (Weekdays)", value:"Lunch Break (12:30-2:30 PM)"},
          {label:"After Work - Early",        sub:"4:30 PM - 6:30 PM (Weekdays)",  value:"After Work Early (4:30-6:30 PM)"},
          {label:"After Work - Extended",     sub:"4:30 PM - 8:00 PM (Weekdays)",  value:"After Work Extended (4:30-8:00 PM)"},
   {label:"Weekend Morning",  sub:"9:00 AM - 12:00 PM",        value:"Weekend Morning (9:00 AM-12:00 PM)"},
      {label:"Weekend Afternoon/Evening", sub:"12:00 PM - 9:00 PM",            value:"Weekend Afternoon/Evening"}
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
          {label:"Fine Dining",         value:"Fine Dining"},
    {label:"Buffet",   value:"Buffet"},
 {label:"Cafe / Bistro",   value:"Cafe / Bistro"}
      ], addPlaceholder:"Suggest another dining style..." },
    { id:"location", title:"Preferred Area in Singapore", type:"checkbox", kind:"static", order:70,
  options:["Near Office","CBD / Raffles","Orchard","Clarke Quay","East Coast","West Side","Sentosa","No Preference"],
      addPlaceholder:"Suggest another location..." },
    { id:"notes", title:"Suggestions & Comments", kind:"static", type:"text", order:80, options:[] }
];

/* Seed */
async function seedStaticQuestions() {
  const snap = await getDocs(staticQuestionsCol);
    const existingMap = new Map();
    snap.forEach(d => existingMap.set(d.id, d.data()));
    const missing = STATIC_QUESTIONS.filter(q => !existingMap.has(q.id));
    if (missing.length > 0) {
        await Promise.all(missing.map(q => setDoc(doc(staticQuestionsCol, q.id), { ...q, removedOptions: [], deleted: false })));
    }
}

/* Chip toggle + cuisine max-3 */
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

/* Build chip */
function buildChip(type, name, value, isUser, fsid) {
    const div = document.createElement("div");
    div.className = "chip" + (isUser ? " user-chip" : "");
    if (fsid) div.dataset.fsid = fsid;
    div.innerHTML = `<input type="${type}" name="${name}" value="${escHtml(value)}" style="display:none" />
        <span class="chip-text">${escHtml(value)}</span>
        <span class="chip-actions">
<button type="button" class="btn-chip-edit" title="Edit" onclick="editChip(event,this)">${SVG_EDIT}</button>
     <button type="button" class="btn-chip-delete" title="Delete" onclick="deleteOption(event,this,'chip')">${SVG_DELETE}</button>
        </span>`;
    div.addEventListener("click", function(e) {
        if (e.target.closest(".chip-actions")) return;
        const inp = div.querySelector("input");
        if (inp.type === "checkbox") {
            inp.checked = !inp.checked;
            div.classList.toggle("selected", inp.checked);
            inp.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
            const group = div.closest(".chip-group");
            if (group) {
                group.querySelectorAll(".chip").forEach(c => {
                    c.classList.remove("selected");
                    c.querySelector("input").checked = false;
                });
            }
            inp.checked = true;
            div.classList.add("selected");
            inp.dispatchEvent(new Event("change", { bubbles: true }));
        }
    });
    return div;
}

/* Build card option */
function buildCard(type, name, value, isUser, fsid) {
    const div = document.createElement("div");
  div.className = "card-option" + (isUser ? " user-card" : "");
    if (fsid) div.dataset.fsid = fsid;
    div.innerHTML = `<input type="${type}" name="${name}" value="${escHtml(value)}" style="display:none" />
        <div class="card-body">
  <strong class="card-text">${escHtml(value)}</strong>
   ${isUser ? "<small>Added by team</small>" : ""}
        </div>
        <div class="card-actions">
  <button type="button" class="btn-card-edit" title="Edit" onclick="editCard(event,this)">${SVG_EDIT}</button>
  <button type="button" class="btn-card-delete" title="Delete" onclick="deleteOption(event,this,'card')">${SVG_DELETE}</button>
        </div>`;
    div.addEventListener("click", function(e) {
        if (e.target.closest(".card-actions")) return;
      const inp = div.querySelector("input");
        if (inp.type === "checkbox") {
          inp.checked = !inp.checked;
            div.classList.toggle("selected", inp.checked);
        } else {
   const group = div.closest(".card-group");
       if (group) {
      group.querySelectorAll(".card-option").forEach(c => {
     c.classList.remove("selected");
      c.querySelector("input").checked = false;
       });
  }
      inp.checked = true;
         div.classList.add("selected");
     }
    });
  return div;
}

/* Inline edit helper */
function startInlineEdit(el, originalText, onSave) {
    el.contentEditable = "true";
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);

    function finish(save) {
        el.contentEditable = "false";
        const newVal = el.textContent.trim();
        if (save && newVal && newVal !== originalText) onSave(newVal);
        else el.textContent = originalText;
    }
    el.addEventListener("blur", () => finish(true), { once: true });
    el.addEventListener("keydown", function kd(e) {
        if (e.key === "Enter")  { e.preventDefault(); el.removeEventListener("keydown", kd); el.blur(); }
        if (e.key === "Escape") { el.removeEventListener("keydown", kd); el.textContent = originalText; el.contentEditable = "false"; }
    });
}

/* Edit chip - disable input so label can't steal focus */
window.editChip = function (e, btn) {
    e.preventDefault();
    e.stopPropagation();
    const chip  = btn.closest(".chip");
    const span  = chip.querySelector(".chip-text");
    const input = chip.querySelector("input");
    if (span.getAttribute("contenteditable") === "true") return;

    const origVal= input.value;
    const firestoreKey = chip.dataset.origVal || origVal;

    startInlineEdit(span, origVal, newVal => {
    const exists = [...chip.closest(".chip-group").querySelectorAll("input")]
            .filter(i => i !== input).map(i => i.value.toLowerCase());
    if (exists.includes(newVal.toLowerCase())) { span.textContent = origVal; return; }
  input.value = newVal;
     span.textContent = newVal;

   if (chip.dataset.fsid && !chip.dataset.fsid.startsWith("temp_")) {
            setDoc(doc(db, "customOptions", chip.dataset.fsid), { value: newVal }, { merge: true })
        .catch(() => { input.value = origVal; span.textContent = origVal; });
            return;
        }
        const staticId = chip.closest("[data-static-id]")?.dataset.staticId;
      if (staticId) {
 updateDoc(doc(staticQuestionsCol, staticId), { [`renamedOptions.${toFieldKey(firestoreKey)}`]: newVal })
   .catch(() => { input.value = origVal; span.textContent = origVal; });
            return;
    }
        const dynCard = chip.closest(".dynamic-question");
        if (dynCard) {
        if (btn.dataset.val !== undefined) btn.dataset.val = newVal;
     const fsid    = dynCard.dataset.qid;
            const opts  = JSON.parse(dynCard.dataset.options || "[]");
            const updated = opts.map(o => o === origVal ? newVal : o);
    dynCard.dataset.options = JSON.stringify(updated);
         updateDoc(doc(db, "questions", fsid), { options: updated })
                .catch(() => { input.value = origVal; span.textContent = origVal; });
        }
 });
};

/* Edit card option */
window.editCard = function (e, btn) {
    e.preventDefault();
    e.stopPropagation();
    const cardEl = btn.closest(".card-option");
    const strong = cardEl.querySelector(".card-text");
    const input  = cardEl.querySelector("input");
    if (strong.getAttribute("contenteditable") === "true") return;

    const origDisplay  = strong.textContent.trim();
    const firestoreKey = cardEl.dataset.origVal || input.value;

    startInlineEdit(strong, origDisplay, newVal => {
  const exists = [...cardEl.closest(".card-group").querySelectorAll("input")]
         .filter(i => i !== input).map(i => i.value.toLowerCase());
        if (exists.includes(newVal.toLowerCase())) { strong.textContent = origDisplay; return; }
   input.value = newVal;
        strong.textContent = newVal;

     if (cardEl.dataset.fsid && !cardEl.dataset.fsid.startsWith("temp_")) {
     setDoc(doc(db, "customOptions", cardEl.dataset.fsid), { value: newVal }, { merge: true })
     .catch(() => { input.value = origDisplay; strong.textContent = origDisplay; });
return;
        }
 const staticId = cardEl.closest("[data-static-id]")?.dataset.staticId;
        if (staticId) {
 updateDoc(doc(staticQuestionsCol, staticId), { [`renamedOptions.${toFieldKey(firestoreKey)}`]: newVal })
     .catch(() => { input.value = origDisplay; strong.textContent = origDisplay; });
        }
 });
};

/* Delete option (static chips & cards) */
window.deleteOption = function (e, btn, kind) {
    e.preventDefault();
    e.stopPropagation();
    const el       = btn.closest(kind === "chip" ? ".chip" : ".card-option");
    const input    = el.querySelector("input");
    if (input.checked) { alert("Deselect this option before deleting it."); return; }
    if (!confirm(`Remove "${input.value}" from the poll?`)) return;

    const fsid     = el.dataset.fsid;
    const value    = el.dataset.origVal || input.value;
    const staticId = el.closest("[data-static-id]")?.dataset.staticId;

    // Remove from DOM and cache immediately - prevents re-render flicker
    el.remove();
    if (fsid) customOptionsCache.delete(fsid);

    if (fsid && !fsid.startsWith("temp_")) {
        // Custom option: delete the doc
        deleteDoc(doc(db, "customOptions", fsid))
            .catch(err => alert("Failed to remove option: " + err.message));
    } else if (staticId) {
        // Built-in static option: mark as removed in the static question doc
        updateDoc(doc(staticQuestionsCol, staticId), { removedOptions: arrayUnion(value) })
            .catch(err => alert("Failed to remove option: " + err.message));
    }
};

/* Add option to static groups (Enter key) */
document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    const inp = e.target;
 if (!inp.classList.contains("add-input") || inp.dataset.actionInput) return;
    e.preventDefault();
    addOption(inp.nextElementSibling);
});

async function addOption(btn) {
    const row     = btn.closest(".add-option-row");
    const inp     = row.querySelector(".add-input");
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

  const tempId = "temp_" + Date.now();
const el = group.classList.contains("card-group")
   ? buildCard(type, name, value, true, tempId)
        : buildChip(type, name, value, true, tempId);
    group.appendChild(el);
    inp.value = "";
    inp.placeholder = "Added! Add another...";
    setTimeout(() => { inp.placeholder = inp.dataset.orig; }, 1800);

    try {
    const docRef = await addDoc(optionsCol, { groupId, name, type, value, icon: "" });
        el.dataset.fsid = docRef.id;
        customOptionsCache.set(docRef.id, { groupId, name, type, value, icon: "" });
    } catch (err) {
        el.remove();
 alert("Failed to save option: " + err.message);
      console.error(err);
    }
}
window.addOption = addOption;

/* Load custom options (real-time) */
function loadCustomOptions() {
    onSnapshot(optionsCol, snapshot => {
        snapshot.docChanges().forEach(change => {
   const d    = change.doc.data();
       const fsid = change.doc.id;
      if (change.type === "added") {
           customOptionsCache.set(fsid, d);
        if (document.querySelector(`[data-fsid="${fsid}"]`)) return;
            const group = document.getElementById(d.groupId);
     if (!group) return;
        const tempEl = [...group.querySelectorAll('[data-fsid^="temp_"]')]
            .find(el => el.querySelector("input")?.value === d.value);
        if (tempEl) { tempEl.dataset.fsid = fsid; return; }
  if (group.classList.contains("card-group")) {
 group.appendChild(buildCard(d.type, d.name, d.value, true, fsid));
    } else {
  group.appendChild(buildChip(d.type, d.name, d.value, true, fsid));
                }
 }
            if (change.type === "removed") {
                customOptionsCache.delete(fsid);
                document.querySelector(`[data-fsid="${fsid}"]`)?.remove();
            }
        });
  });
}


/* Encode string for use as Firestore field path key */
function toFieldKey(str) {
    // Firestore field path keys cannot contain spaces, dots, or start with a digit.
    // Prefix with _ if starts with digit, replace all non-alphanumeric chars with _.
    let key = String(str).trim().replace(/\s+/g, "_").replace(/[~*[\]/.,]/g, "_");
    if (/^[0-9]/.test(key)) key = "_" + key;
    return key;
}

/* Remove question button factory */
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

/* Build static question card */
function buildStaticCard(q) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.staticId = q.id;

    const hdr = document.createElement("div");
    hdr.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.25rem;";
    const h2 = document.createElement("h2");
    h2.textContent = q.title;
    hdr.appendChild(h2);
    hdr.appendChild(makeRemoveBtn("btn-remove-static", "data-static-id", q.id));
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
    const isObj   = typeof opt === "object";
         const val     = isObj ? opt.value   : opt.display;
            const lbl     = isObj ? opt.label : opt.display;
  const sub     = isObj ? (opt.sub || "") : "";
       const origVal = isObj ? (opt.origVal || opt.value) : opt.origVal;
  const wrap    = document.createElement("div");
      wrap.className = "card-option";
            if (origVal) wrap.dataset.origVal = origVal;
     wrap.innerHTML = `<input type="${q.type}" name="${q.id}" value="${escHtml(val)}" style="display:none" />
      <div class="card-body">
  <strong class="card-text">${escHtml(lbl)}</strong>
       ${sub ? "<small>" + escHtml(sub) + "</small>" : ""}
         </div>
    <div class="card-actions">
  <button type="button" class="btn-card-edit" title="Edit" onclick="editCard(event,this)">${SVG_EDIT}</button>
         <button type="button" class="btn-card-delete" title="Delete" onclick="deleteOption(event,this,'card')">${SVG_DELETE}</button>
     </div>`;
            wrap.addEventListener("click", function(e) {
       if (e.target.closest(".card-actions")) return;
      const inp = wrap.querySelector("input");
        if (inp.type === "checkbox") {
            inp.checked = !inp.checked;
            wrap.classList.toggle("selected", inp.checked);
        } else {
            group.querySelectorAll(".card-option").forEach(c => {
                c.classList.remove("selected");
                c.querySelector("input").checked = false;
            });
            inp.checked = true;
            wrap.classList.add("selected");
        }
    });
    group.appendChild(wrap);
    });
    card.appendChild(group);
    } else {
        const group = document.createElement("div");
        group.className = "chip-group";
        group.id = groupId;
    q.options.forEach(opt => {
   const isObj   = typeof opt === "object";
   const val     = isObj ? opt.display : opt;
    const origVal = isObj ? opt.origVal  : undefined;
        const div     = document.createElement("div");
    div.className = "chip";
     if (origVal) div.dataset.origVal = origVal;
            div.innerHTML = `<input type="${q.type}" name="${q.id}" value="${escHtml(val)}" style="display:none" />
        <span class="chip-text">${escHtml(val)}</span>
 <span class="chip-actions">
     <button type="button" class="btn-chip-edit" title="Edit" onclick="editChip(event,this)">${SVG_EDIT}</button>
        <button type="button" class="btn-chip-delete" title="Delete" onclick="deleteOption(event,this,'chip')">${SVG_DELETE}</button>
    </span>`;
    div.addEventListener("click", function(e) {
    if (e.target.closest(".chip-actions")) return;
           const inp = div.querySelector("input");
   if (inp.type === "checkbox") {
 inp.checked = !inp.checked;
     div.classList.toggle("selected", inp.checked);
     inp.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
    group.querySelectorAll(".chip").forEach(c => {
         c.classList.remove("selected");
 c.querySelector("input").checked = false;
        });
 inp.checked = true;
   div.classList.add("selected");
    inp.dispatchEvent(new Event("change", { bubbles: true }));
        }
            });
      group.appendChild(div);
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

/* Load static questions */
function loadStaticQuestions() {
    const form = document.getElementById("pollForm");
    const dynamicContainer = document.getElementById("dynamicQuestionsContainer");
    const submitRow = form.querySelector(".submit-row");

    // Full build — only called on first load or when a card is added/deleted
    function buildAllCards(existingMap) {
        form.querySelectorAll("[data-static-id]").forEach(el => el.remove());
        STATIC_QUESTIONS
            .filter(q => existingMap.has(q.id) && !existingMap.get(q.id).deleted)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .forEach(q => {
                const stored  = existingMap.get(q.id);
                const removed = new Set(stored.removedOptions || []);
                const renamed = stored.renamedOptions || {};
                const filtered = {
                    ...q,
                    options: q.options
                        .filter(opt => {
                            const val = typeof opt === "object" ? opt.value : opt;
                            return !removed.has(val);
                        })
                        .map(opt => {
                            if (typeof opt === "object") {
                                const key      = toFieldKey(opt.value);
                                const newVal   = renamed[key] || opt.value;
                                const newLabel = renamed[toFieldKey(opt.label)] || renamed[key] || opt.label;
                                return { ...opt, value: newVal, label: newLabel, origVal: opt.value };
                            }
                            const key = toFieldKey(opt);
                            return { display: renamed[key] || opt, origVal: opt };
                        })
                };
                const insertBefore = (q.id === "notes") ? submitRow : dynamicContainer || submitRow;
                form.insertBefore(buildStaticCard(filtered), insertBefore);
            });
        // Attach custom options
        customOptionsCache.forEach((data, fsid) => {
            const group = document.getElementById(data.groupId);
            if (!group || document.querySelector(`[data-fsid="${fsid}"]`)) return;
            if (group.classList.contains("card-group")) {
                group.appendChild(buildCard(data.type, data.name, data.value, true, fsid));
            } else {
                group.appendChild(buildChip(data.type, data.name, data.value, true, fsid));
            }
        });
    }

    // Surgical patch — called on subsequent snapshots to avoid rebuilding the DOM
    function patchCards(existingMap) {
        existingMap.forEach((stored, qid) => {
            const card = form.querySelector(`[data-static-id="${qid}"]`);
            if (!card) return;
            if (stored.deleted) { card.remove(); return; }

            const renamed = stored.renamedOptions || {};
            const removed = new Set(stored.removedOptions || []);
            const isCards = card.querySelector(".card-group") !== null;
            const group   = card.querySelector(isCards ? ".card-group" : ".chip-group");
            if (!group) return;

            if (isCards) {
                group.querySelectorAll(".card-option").forEach(opt => {
                    const inp    = opt.querySelector("input");
                    const strong = opt.querySelector(".card-text");
                    if (!inp || !strong) return;
                    if (strong.getAttribute("contenteditable") === "true") return;
                    const origVal = opt.dataset.origVal || inp.value;
                    if (removed.has(origVal)) { opt.remove(); return; }
                    const newLabel = renamed[toFieldKey(origVal)];
                    if (newLabel && strong.textContent !== newLabel) {
                        strong.textContent = newLabel;
                        inp.value = newLabel;
                    }
                });
            } else {
                group.querySelectorAll(".chip").forEach(wrapper => {
                    const chip = wrapper.querySelector(".chip");
                    const inp  = chip.querySelector("input");
                    const span = chip.querySelector(".chip-text");
                    if (!inp || !span) return;
                    if (span.getAttribute("contenteditable") === "true") return;
                    const origVal = wrapper.dataset.origVal || inp.value;
                    if (removed.has(origVal)) { wrapper.remove(); return; }
                    const newLabel = renamed[toFieldKey(origVal)];
                    if (newLabel && span.textContent !== newLabel) {
                        span.textContent = newLabel;
                        inp.value = newLabel;
                    }
                });
            }
        });
    }

    let initialLoad = true;
    return new Promise((resolve, reject) => {
        let settled = false;
        onSnapshot(staticQuestionsCol, snap => {
            const existingMap = new Map();
            snap.forEach(d => existingMap.set(d.id, d.data()));

            if (initialLoad) {
                // First snapshot: full build
                initialLoad = false;
                buildAllCards(existingMap);
            } else {
                // Subsequent snapshots: surgical patch only — no DOM rebuild
                patchCards(existingMap);
            }

            if (!settled) { settled = true; resolve(); }
        }, err => {
            console.error("Failed to load static questions:", err);
            if (!settled) { settled = true; reject(err); }
        });
    });
}

/* Validation */
function validate() {
    const unanswered = [];
    document.querySelectorAll("[data-static-id]").forEach(card => {
        const sid = card.dataset.staticId;
   if (sid === "notes") return;
      const hasRadio    = card.querySelector('input[type="radio"]');
     const hasCheckbox = card.querySelector('input[type="checkbox"]');
 const title       = card.querySelector("h2")?.textContent || sid;
        if (hasRadio    && !card.querySelector('input[type="radio"]:checked'))    unanswered.push(title);
        if (hasCheckbox && !card.querySelector('input[type="checkbox"]:checked')) unanswered.push(title);
    });
    document.querySelectorAll("[data-qid]").forEach(card => {
      const hasRadio    = card.querySelector('input[type="radio"]');
        const hasCheckbox = card.querySelector('input[type="checkbox"]');
        const title       = card.querySelector("h2")?.textContent || "Custom question";
        if (hasRadio    && !card.querySelector('input[type="radio"]:checked'))    unanswered.push(title);
        if (hasCheckbox && !card.querySelector('input[type="checkbox"]:checked')) unanswered.push(title);
    });
    if (unanswered.length === 0) return true;
    const list = unanswered.map(t => `* ${t}`).join("\n");
    return confirm(`You haven't answered the following questions:\n\n${list}\n\nDo you still want to submit?`);
}

/* Collect answers */
function collectAnswers() {
    const answers = {
        days:        [...document.querySelectorAll('input[name="days"]:checked')].map(i => i.value),
     timeSlot:    document.querySelector('input[name="timeSlot"]:checked')?.value ?? "",
        duration:  document.querySelector('input[name="duration"]:checked')?.value ?? "",
    cuisine:     [...document.querySelectorAll('input[name="cuisine"]:checked')].map(i => i.value),
        dietary:     [...document.querySelectorAll('input[name="dietary"]:checked')].map(i => i.value),
     diningStyle: document.querySelector('input[name="diningStyle"]:checked')?.value ?? "",
        location:    [...document.querySelectorAll('input[name="location"]:checked')].map(i => i.value),
   suggestion:  document.getElementById("suggestion")?.value.trim() ?? "",
        comments:    document.getElementById("comments")?.value.trim() ?? "",
        submittedAt: new Date().toISOString(),
        dynamicAnswers: {}
    };
    document.querySelectorAll("[data-qid]").forEach(card => {
const title      = card.querySelector("h2")?.textContent || card.dataset.qid;
        const radios     = card.querySelectorAll('input[type="radio"]:checked');
        const checkboxes = card.querySelectorAll('input[type="checkbox"]:checked');
const hiddens    = card.querySelectorAll('input[type="hidden"]');
        if (radios.length)     answers.dynamicAnswers[title] = radios[0].value;
  else if (checkboxes.length) answers.dynamicAnswers[title] = [...checkboxes].map(i => i.value);
   else if (hiddens.length)    answers.dynamicAnswers[title] = [...hiddens].map(i => i.value);
    });
    return answers;
}

/* Submit */
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

/* Results */
let _resultsUnsub = null;

window.showResults = function () {
    show("resultsPage");
    document.getElementById("resultsSubtitle").textContent = "Loading...";
    document.getElementById("resultsContent").innerHTML = "";
    if (_resultsUnsub) { _resultsUnsub(); _resultsUnsub = null; }
  _resultsUnsub = onSnapshot(responsesCol, snapshot => {
        liveCounts = {};
        const total = snapshot.size;
        snapshot.forEach(docSnap => {
   const d = docSnap.data();
            const inc = (key, vals) => {
             if (!liveCounts[key]) liveCounts[key] = {};
  (Array.isArray(vals) ? vals : [vals]).forEach(v => { if (v) liveCounts[key][v] = (liveCounts[key][v] || 0) + 1; });
     };
            inc("days", d.days); inc("timeSlot", d.timeSlot); inc("duration", d.duration);
            inc("cuisine", d.cuisine); inc("dietary", d.dietary); inc("diningStyle", d.diningStyle); inc("location", d.location);
            if (d.suggestion) inc("suggestion", d.suggestion);
            if (d.comments)   inc("comments",   d.comments);
            if (d.dynamicAnswers) {
                // Map dynamic question titles to static keys so responses merge
                const titleToKey = {
                    "preferred days": "days",
                    "preferred time slot": "timeSlot",
                    "outing duration": "duration",
                    "cuisine preferences": "cuisine",
                    "dietary restrictions": "dietary",
                    "dining style": "diningStyle",
                    "preferred area": "location",
                };
                Object.entries(d.dynamicAnswers).forEach(([qTitle, val]) => {
                    const staticKey = titleToKey[qTitle.trim().toLowerCase()];
                    inc(staticKey || "dyn_" + qTitle, val);
                });
            }
        });
document.getElementById("resultsSubtitle").textContent = total + " response" + (total !== 1 ? "s" : "") + " - updates live";
        renderResults(total);
    });
};

window.clearAllResponses = async function () {
    if (!confirm("This will permanently delete ALL submitted responses. This cannot be undone.\n\nAre you sure?")) return;
    if (!confirm("Please confirm again - all poll responses will be erased.")) return;
  try {
        const snap = await getDocs(responsesCol);
        await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "responses", d.id))));
        alert("All responses have been cleared.");
    } catch (err) {
        alert("Failed to clear responses: " + err.message);
   console.error(err);
    }
};

function renderResults(total) {
    const content = document.getElementById("resultsContent");
    content.innerHTML = "";
    [{title:"Preferred Days",key:"days"},{title:"Preferred Time Slot",key:"timeSlot"},
     {title:"Outing Duration",key:"duration"},{title:"Cuisine Preferences",key:"cuisine"},
     {title:"Dietary Restrictions",key:"dietary"},{title:"Dining Style",key:"diningStyle"},
     {title:"Preferred Area",key:"location"}
    ].forEach(sec => renderSection(sec.title, sec.key, total, content));
    Object.keys(liveCounts).filter(k => k.startsWith("dyn_"))
        .forEach(k => renderSection(k.slice(4), k, total, content));
    // Render free-text fields as bulleted lists, not bar charts
    renderTextList("Restaurant / Place Suggestions", "suggestion", content);
    renderTextList("Additional Comments", "comments", content);
}

function renderTextList(title, key, content) {
    const entries = Object.entries(liveCounts[key] || {}).filter(([v]) => v.trim());
    if (!entries.length) return;
    const block = document.createElement("div");
    block.className = "result-block";
    block.innerHTML = "<h4>" + escHtml(title) + "</h4>";
    // Sort by count descending, then alphabetically
    entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    entries.forEach(([text, count]) => {
        const badge = count > 1 ? ` <span class="text-count">${count}</span>` : "";
        block.innerHTML += `<div class="text-response">${escHtml(text)}${badge}</div>`;
    });
    content.appendChild(block);
}

function renderSection(title, key, total, content) {
    const entries = Object.entries(liveCounts[key] || {});
    if (!entries.length) return;
    const block = document.createElement("div");
  block.className = "result-block";
 block.innerHTML = "<h4>" + escHtml(title) + "</h4>";
    entries.sort((a, b) => b[1] - a[1]).forEach(([label, count]) => {
        const pct = Math.round((count / Math.max(total, 1)) * 100);
    block.innerHTML += `<div class="bar-row">
            <span class="bar-label">${escHtml(label)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
   <span class="bar-count">${count}</span></div>`;
    });
    content.appendChild(block);
}

/* Reset */
window.resetPoll = function () {
    const form = document.getElementById("pollForm");
    form.reset();
    document.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
    const hint = document.getElementById("cuisineHint");
    if (hint) hint.textContent = "";
    const btn = form.querySelector("[type='submit']");
    if (btn) { btn.textContent = "Submit My Vote"; btn.disabled = false; }
    show("pollPage");
    window.scrollTo({ top: 0, behavior: "smooth" });
};

/* Panels */
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
      await addDoc(questionsCol, { title, type:"checkbox", options:["Add option"], cols:[], kind:"question", order:Date.now() });
   togglePanel("addQuestionPanel", false);
    } catch (err) { alert("Failed to save question: " + err.message); console.error(err); }
}

async function saveNewPollElement() {
  const title = document.getElementById("peTitle").value.trim();
    if (!title) { document.getElementById("peTitle").focus(); return; }
    const type = document.querySelector("#peTypeSelector .type-btn.active")?.dataset.type || "checkbox";
    let options = ["Option 1"], cols = [], cells = {};
  if (type === "table-checkbox" || type === "table-radio") { options = ["Row 1","Row 2"]; cols = ["Col A","Col B"]; cells = {}; }
    else if (type === "ranked") { options = ["Item 1","Item 2","Item 3"]; }
    try {
      await addDoc(questionsCol, { title, type, options, cols, cells, kind:"element", order:Date.now() });
        togglePanel("addPollElementPanel", false);
    } catch (err) { alert("Failed to save element: " + err.message); console.error(err); }
}

/* Load dynamic questions */
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
      document.querySelector(`[data-qid="${fsid}"]`)?.remove();
     if (!container.querySelector("[data-qid]")) {
     container.innerHTML = '<p style="color:#bbb;font-size:.85rem;padding:.5rem 0;text-align:center;">No custom questions yet - use the buttons above to add one.</p>';
  }
        }
            if (change.type === "modified") {
                const el = document.querySelector(`[data-qid="${fsid}"]`);
                if (!el) return;
                const data = change.doc.data();
                // Skip if local DOM already reflects this data (own write confirmed by server)
                const incomingOpts  = JSON.stringify(data.options || []);
                const incomingCols  = JSON.stringify(data.cols    || []);
                const incomingCells = JSON.stringify(data.cells   || {});
                if (
                    el.dataset.options === incomingOpts &&
                    el.dataset.cols    === incomingCols &&
                    el.dataset.cells   === incomingCells
                ) return;
                el.dataset.options = incomingOpts;
                el.dataset.cols    = incomingCols;
                el.dataset.cells   = incomingCells;
                _patchCard(el, data, fsid);
            }
  });
    }, err => {
        container.innerHTML = `<div style="background:#fff0f0;border:2px solid #e74c3c;border-radius:.75rem;padding:1rem;color:#c0392b;font-size:.88rem;">
            <strong>Could not load questions</strong><br/>${err.message}<br/><br/>
            <small>Check Firebase Console - Firestore - Rules</small></div>`;
    console.error(err);
    });
}

/* Surgical patch of dynamic question cards on Firestore update */
function _patchCard(el, data, fsid) {
    const name = "qdyn_" + fsid;
    const type = data.type;

    if (type === "checkbox" || type === "radio") {
        const group = el.querySelector(".chip-group");
        if (!group) return;
        const existingVals = new Set([...group.querySelectorAll("input")].map(i => i.value));
        const wantedVals   = new Set(data.options || []);
        [...group.querySelectorAll(".chip")].forEach(chip => {
    const v = chip.querySelector("input")?.value;
    if (v && !wantedVals.has(v)) chip.remove();
        });
        (data.options || []).forEach(opt => {
      if (!existingVals.has(opt)) group.appendChild(buildChip(type, name, opt, true, "patched_" + Date.now()));
        });

    } else if (type === "table-checkbox" || type === "table-radio") {
  const table  = el.querySelector(".vote-table");
        const tbody  = table?.querySelector("tbody");
  const addRow = tbody?.querySelector(".tr-add-row");
        if (!tbody || !addRow) return;
        const cols     = data.cols    || [];
  const rows     = data.options || [];
        const cells    = data.cells   || {};
        const voteType = type === "table-checkbox" ? "checkbox" : "radio";
        const existingRowEls = [...tbody.querySelectorAll("tr[data-row]")];
        const existingRows   = new Set(existingRowEls.map(r => r.dataset.row));
   const wantedRows     = new Set(rows);
        existingRowEls.forEach(tr => { if (!wantedRows.has(tr.dataset.row)) tr.remove(); });
        rows.forEach(row => {
            if (existingRows.has(row)) return;
            const tr = document.createElement("tr"); tr.dataset.row = row;
            const tdVote = tr.insertCell(); tdVote.className = "td-vote";
     const vi = document.createElement("input");
            vi.type = voteType; vi.name = `${name}_vote`; vi.value = row;
  tdVote.appendChild(vi);
  const tdLabel = tr.insertCell(); tdLabel.className = "td-row-label";
            const rowLabel = (cells[row] && cells[row]["__label__"]) || row;
            tdLabel.innerHTML = `<span class="cell-text row-label-text" contenteditable="true" data-action="editTableRowLabel"
 data-qid="${fsid}" data-row="${escHtml(row)}">${escHtml(rowLabel)}</span>
     <button type="button" class="btn-del-row" data-action="removeTblRow"
          data-qid="${fsid}" data-val="${escHtml(row)}" title="Delete row">${SVG_DELETE}</button>`;
    cols.forEach(col => {
                const td = tr.insertCell(); td.className = "td-cell";
         const cellVal = (cells[row] && cells[row][col]) || "";
        td.innerHTML = `<span class="cell-text" contenteditable="true" data-action="editTableCell"
   data-qid="${fsid}" data-row="${escHtml(row)}" data-col="${escHtml(col)}">${escHtml(cellVal)}</span>`;
     });
            tr.insertCell().className = "td-spacer";
     tbody.insertBefore(tr, addRow);
        });
  const thead = table.querySelector("thead tr");
        const existingCols = new Set([...thead.querySelectorAll("th[data-col]")].map(th => th.dataset.col));
        const wantedCols   = new Set(cols);
   [...thead.querySelectorAll("th[data-col]")].forEach(th => { if (!wantedCols.has(th.dataset.col)) th.remove(); });
        [...tbody.querySelectorAll("tr[data-row]")].forEach(tr => {
          [...tr.querySelectorAll("td.td-cell")].forEach(td => {
     const span = td.querySelector("[data-col]");
              if (span && !wantedCols.has(span.dataset.col)) td.remove();
            });
        });
        const thAddCol = thead.querySelector(".th-add-col");
      cols.forEach(col => {
  if (existingCols.has(col)) return;
            const th = document.createElement("th"); th.className = "th-col"; th.dataset.col = col;
            th.innerHTML = `<span class="cell-text" contenteditable="true" data-action="editTableCol"
        data-qid="${fsid}" data-val="${escHtml(col)}">${escHtml(col)}</span>
     <button type="button" class="btn-del-col" data-action="removeTableCol"
        data-qid="${fsid}" data-val="${escHtml(col)}" title="Delete column">${SVG_DELETE}</button>`;
      thead.insertBefore(th, thAddCol);
    [...tbody.querySelectorAll("tr[data-row]")].forEach(tr => {
         const td = document.createElement("td"); td.className = "td-cell";
        td.innerHTML = `<span class="cell-text" contenteditable="true" data-action="editTableCell"
               data-qid="${fsid}" data-row="${escHtml(tr.dataset.row)}" data-col="${escHtml(col)}"></span>`;
      tr.insertBefore(td, tr.querySelector(".td-spacer"));
          });
        });
        const footerTd = addRow.querySelector("td");
        if (footerTd) footerTd.colSpan = cols.length + 3;

        // Update existing cell values from Firestore (handles edits from other users)
        [...tbody.querySelectorAll("tr[data-row]")].forEach(tr => {
            const row = tr.dataset.row;
            [...tr.querySelectorAll("td.td-cell span[data-col]")].forEach(span => {
                if (span.getAttribute("contenteditable") === "true") return;
                const col      = span.dataset.col;
                const cellVal  = (cells[row] && cells[row][col]) || "";
                if (span.textContent !== cellVal) span.textContent = cellVal;
            });
        });

    } else if (type === "ranked") {
        const list = el.querySelector(".ranked-list");
        if (!list) return;
        const existingVals = new Set([...list.querySelectorAll(".ranked-item input[type=hidden]")].map(i => i.value));
    const wantedVals   = new Set(data.options || []);
        [...list.querySelectorAll(".ranked-item")].forEach(item => {
        const v = item.querySelector("input[type=hidden]")?.value;
  if (v && !wantedVals.has(v)) item.remove();
     });
        (data.options || []).forEach(opt => {
 if (!existingVals.has(opt)) {
                const num = list.querySelectorAll(".ranked-item").length + 1;
      list.appendChild(makeRankedItem(opt, num, name, fsid));
  }
   });
  updateRankNumbers(list);
        initRankedList(list);
    }
}

/* Build dynamic question card */
function buildQuestionCard(d, fsid) {
    const card    = document.createElement("div");
    card.className = "card dynamic-question";
    card.dataset.qid     = fsid;
    card.dataset.options = JSON.stringify(d.options || []);
    card.dataset.cols    = JSON.stringify(d.cols    || []);
    card.dataset.cells   = JSON.stringify(d.cells   || {});
 const name    = "qdyn_" + fsid;
    const groupId = "qgroup_" + fsid;

    const header = document.createElement("div");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap;margin-bottom:.5rem;";
    const title = document.createElement("h2");
    title.style.cssText = "flex:1;margin:0;font-size:1.05rem;font-weight:700;color:#4a3fa0;";
    title.textContent = d.title;
    header.appendChild(title);
    header.appendChild(makeRemoveBtn("btn-remove-dyn", "data-qid", fsid));
    card.appendChild(header);

    if (d.type === "checkbox" || d.type === "radio") {
        const group = document.createElement("div");
        group.className = "chip-group"; group.id = groupId;
        d.options.forEach(opt => {
 const lbl = document.createElement("label");
            lbl.className = "chip";
            lbl.innerHTML = `<input type="${d.type}" name="${name}" value="${escHtml(opt)}" />
          <span class="chip-text">${escHtml(opt)}</span>
    <span class="chip-actions">
             <button type="button" class="btn-chip-edit" title="Edit"
          data-action="editDynOpt" data-qid="${fsid}" data-val="${escHtml(opt)}">${SVG_EDIT}</button>
      <button type="button" class="btn-chip-delete" title="Delete"
     data-action="removeDynOpt" data-qid="${fsid}" data-val="${escHtml(opt)}">${SVG_DELETE}</button>
     </span>`;
     group.appendChild(lbl);
   });
        card.appendChild(group);
      card.appendChild(makeDynAddRow("addDynOpt", fsid, groupId, d.type, name, "Add another option..."));

    } else if (d.type === "table-checkbox" || d.type === "table-radio") {
        const inputType = d.type === "table-checkbox" ? "checkbox" : "radio";
        const cols = d.cols || []; const rows = d.options || []; const cells = d.cells || {};
        const wrap = document.createElement("div"); wrap.style.overflowX = "auto";
        const table = document.createElement("table");
   table.className = "vote-table editable-table"; table.id = groupId;
    const thead = table.createTHead(); const hRow = thead.insertRow();
        const thVote = document.createElement("th"); thVote.className = "th-vote"; thVote.textContent = "Vote"; hRow.appendChild(thVote);
        const thRowH = document.createElement("th"); thRowH.className = "th-row-label"; thRowH.textContent = "Option"; hRow.appendChild(thRowH);
        cols.forEach(col => {
      const th = document.createElement("th"); th.className = "th-col"; th.dataset.col = col;
     th.innerHTML = `<span class="cell-text" contenteditable="true" data-action="editTableCol"
                data-qid="${fsid}" data-val="${escHtml(col)}">${escHtml(col)}</span>
          <button type="button" class="btn-del-col" data-action="removeTableCol"
        data-qid="${fsid}" data-val="${escHtml(col)}" title="Delete column">${SVG_DELETE}</button>`;
            hRow.appendChild(th);
 });
        const thAddCol = document.createElement("th"); thAddCol.className = "th-add-col";
      thAddCol.innerHTML = `<button type="button" class="btn-add-col" data-action="addTableColInline" data-qid="${fsid}" title="Add column">+ Col</button>`;
        hRow.appendChild(thAddCol);
        const tbody = table.createTBody();
        rows.forEach(row => {
            const tr = tbody.insertRow(); tr.dataset.row = row;
            const tdVote = tr.insertCell(); tdVote.className = "td-vote";
 const voteInp = document.createElement("input");
            voteInp.type = inputType; voteInp.name = `${name}_vote`; voteInp.value = row;
            tdVote.appendChild(voteInp);
            const tdLabel = tr.insertCell(); tdLabel.className = "td-row-label";
            const rowLabel = (cells[row] && cells[row]["__label__"]) || row;
            tdLabel.innerHTML = `<span class="cell-text row-label-text" contenteditable="true" data-action="editTableRowLabel"
        data-qid="${fsid}" data-row="${escHtml(row)}">${escHtml(rowLabel)}</span>
         <button type="button" class="btn-del-row" data-action="removeTblRow"
           data-qid="${fsid}" data-val="${escHtml(row)}" title="Delete row">${SVG_DELETE}</button>`;
       cols.forEach(col => {
        const td = tr.insertCell(); td.className = "td-cell";
      const cellVal = (cells[row] && cells[row][col]) || "";
td.innerHTML = `<span class="cell-text" contenteditable="true" data-action="editTableCell"
          data-qid="${fsid}" data-row="${escHtml(row)}" data-col="${escHtml(col)}">${escHtml(cellVal)}</span>`;
    });
      tr.insertCell().className = "td-spacer";
        });
        const trAddRow = tbody.insertRow(); trAddRow.className = "tr-add-row";
        const tdAddRow = trAddRow.insertCell(); tdAddRow.colSpan = cols.length + 3;
      tdAddRow.innerHTML = `<div class="add-option-row">
            <input type="text" class="add-input" placeholder="Add row..."
           data-action-input="addTblRow" data-qid="${fsid}" />
            <button type="button" class="btn-add" data-action="addTblRow" data-qid="${fsid}">${SVG_ADD} Add Row</button>
        </div>`;
      wrap.appendChild(table); card.appendChild(wrap);

    } else if (d.type === "ranked") {
   const hint = document.createElement("p");
        hint.style.cssText = "font-size:.8rem;color:#888;margin-bottom:.4rem;";
        hint.textContent = "Drag to reorder your preference";
    card.appendChild(hint);
        const list = document.createElement("div"); list.className = "ranked-list"; list.id = groupId;
        d.options.forEach((opt, i) => list.appendChild(makeRankedItem(opt, i + 1, name, fsid)));
  card.appendChild(list);
        setTimeout(() => initRankedList(list), 50);
     card.appendChild(makeDynAddRow("addRankRow", fsid, groupId, null, name, "Add another item..."));
    }
    return card;
}

function makeDynAddRow(action, fsid, groupId, type, name, placeholder) {
    const row = document.createElement("div"); row.className = "add-option-row";
 row.innerHTML = `<input type="text" class="add-input" placeholder="${placeholder}"
    data-action-input="${action}" data-qid="${fsid}"
        ${groupId ? `data-group="${groupId}"` : ""}
  ${type    ? `data-type="${type}"`     : ""}
        ${name    ? `data-name="${name}"`     : ""} />
    <button type="button" class="btn-add" data-action="${action}" data-qid="${fsid}">${SVG_ADD} Add</button>`;
    return row;
}

function makeRankedItem(opt, num, name, fsid) {
    const item = document.createElement("div");
    item.className = "ranked-item"; item.draggable = true;
    item.innerHTML = `<span class="rank-handle">${SVG_DRAG}</span>
        <span class="rank-number">${num}</span>
      <span class="rank-label">${escHtml(opt)}</span>
        <input type="hidden" name="${name}" value="${escHtml(opt)}" />
        <span class="rank-actions">
    <button type="button" class="btn-chip-edit" title="Edit"
     data-action="editRankItem" data-qid="${fsid}" data-val="${escHtml(opt)}">${SVG_EDIT}</button>
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
      if (after == null) list.appendChild(dragged); else list.insertBefore(dragged, after);
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

/* Passcode */
const PASSCODE = "OT2025";
function checkPasscode() {
    const inp = document.getElementById("passcodeInput");
    const err = document.getElementById("passcodeError");
    if (inp.value.trim().toUpperCase() === PASSCODE.toUpperCase()) {
        document.getElementById("passcodeGate").classList.add("hidden");
        document.getElementById("mainContent").classList.remove("hidden");
        sessionStorage.setItem("pollUnlocked", "1");
    } else {
        err.classList.remove("hidden");
        inp.classList.add("error");
        inp.value = "";
setTimeout(() => inp.classList.remove("error"), 400);
        inp.focus();
    }
}
window.checkPasscode = checkPasscode;

document.addEventListener("DOMContentLoaded", () => {
    const unlocked = sessionStorage.getItem("pollUnlocked") === "1";
    if (!unlocked) {
        document.getElementById("passcodeInput").focus();
    } else {
        document.getElementById("passcodeGate").classList.add("hidden");
        document.getElementById("mainContent").classList.remove("hidden");
    }
    document.getElementById("passcodeInput").addEventListener("keydown", e => {
   if (e.key === "Enter") checkPasscode();
        document.getElementById("passcodeError").classList.add("hidden");
    });
});

/* Enter key for dynamic add inputs */
document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    const inp = e.target.closest("[data-action-input]");
    if (!inp) return;
    e.preventDefault();
    inp.nextElementSibling?.click();
});

/* Combined click handler */
document.addEventListener("click", async function (e) {
    const sBtn = e.target.closest(".btn-remove-static");
    if (sBtn) {
      const sid = sBtn.getAttribute("data-static-id");
   if (!sid || !confirm("Remove this question for everyone?")) return;
 document.querySelector(`[data-static-id="${sid}"]`)?.remove();
        try { await updateDoc(doc(staticQuestionsCol, sid), { deleted: true }); }
catch (err) { alert("Failed to remove: " + err.message); console.error(err); await loadStaticQuestions(); }
        return;
    }
  const dBtn = e.target.closest(".btn-remove-dyn");
    if (dBtn) {
    const fsid = dBtn.getAttribute("data-qid");
        if (!fsid || !confirm("Remove this question for everyone?")) return;
  document.querySelector(`[data-qid="${fsid}"]`)?.remove();
        try { await deleteDoc(doc(db, "questions", fsid)); }
        catch (err) { alert("Failed to remove: " + err.message); console.error(err); }
      return;
    }
    const btn  = e.target.closest("[data-action]");
  if (!btn) return;
    const action = btn.dataset.action;
    const fsid   = btn.dataset.qid;
    const row    = btn.closest(".add-option-row");
    const inp    = row ? row.querySelector(".add-input") : null;
 const card   = btn.closest(".dynamic-question");

    if (action === "editDynOpt") {
        const oldVal = btn.dataset.val;
        const span   = btn.closest(".chip")?.querySelector(".chip-text");
        if (!span) return;
    startInlineEdit(span, oldVal, newVal => {
 btn.dataset.val = newVal;
            const input = btn.closest(".chip")?.querySelector("input");
  if (input) input.value = newVal;
            const opts    = JSON.parse(card.dataset.options || "[]");
            const updated = opts.map(o => o === oldVal ? newVal : o);
            card.dataset.options = JSON.stringify(updated);
            updateDoc(doc(db, "questions", fsid), { options: updated });
        });
        return;
  }
    if (action === "removeDynOpt") {
     const val = btn.dataset.val;
        if (!confirm(`Remove "${val}"?`)) return;
        btn.closest(".chip")?.remove();
    const opts = JSON.parse(card.dataset.options || "[]");
        card.dataset.options = JSON.stringify(opts.filter(o => o !== val));
        await updateDoc(doc(db, "questions", fsid), { options: arrayRemove(val) });
        return;
  }
  if (action === "removeTableCol") {
    const val = btn.dataset.val;
        if (!confirm(`Remove column "${val}"?`)) return;
  const table = card.querySelector(".vote-table");
    table?.querySelector(`th[data-col="${CSS.escape(val)}"]`)?.remove();
     table?.querySelectorAll(`td.td-cell span[data-col="${CSS.escape(val)}"]`).forEach(s => s.closest("td")?.remove());
    const cols    = JSON.parse(card.dataset.cols || "[]");
   const updated = cols.filter(c => c !== val);
        card.dataset.cols = JSON.stringify(updated);
   await updateDoc(doc(db, "questions", fsid), { cols: updated });
        return;
    }
  if (action === "removeTblRow") {
    const val = btn.dataset.val;
        if (!confirm(`Remove row "${val}"?`)) return;
        btn.closest("tr")?.remove();
        const opts    = JSON.parse(card.dataset.options || "[]");
        const updated = opts.filter(o => o !== val);
        card.dataset.options = JSON.stringify(updated);
        await updateDoc(doc(db, "questions", fsid), { options: updated });
        return;
    }
    if (action === "removeRankRow") {
        const val  = btn.dataset.val;
        if (!confirm(`Remove "${val}"?`)) return;
        const item = btn.closest(".ranked-item");
   const list = item?.closest(".ranked-list");
item?.remove();
        if (list) updateRankNumbers(list);
        const opts = JSON.parse(card.dataset.options || "[]");
        card.dataset.options = JSON.stringify(opts.filter(o => o !== val));
        await updateDoc(doc(db, "questions", fsid), { options: arrayRemove(val) });
 return;
    }
    if (action === "addDynOpt" || action === "addTblRow" || action === "addRankRow") {
        const value = inp ? inp.value.trim() : "";
     if (!value) { if (inp) inp.focus(); return; }
        if (inp) inp.value = "";
        if (action === "addDynOpt") {
    const groupEl = card.querySelector(".chip-group");
 if (groupEl) {
     const name = inp.dataset.name || ("qdyn_" + fsid);
       const type = inp.dataset.type || "checkbox";
  groupEl.appendChild(buildChip(type, name, value, true, "patched_" + Date.now()));
         }
    const opts = JSON.parse(card.dataset.options || "[]");
     if (!opts.includes(value)) card.dataset.options = JSON.stringify([...opts, value]);
        }
        if (action === "addTblRow") {
      const table  = card.querySelector(".vote-table");
     const tbody  = table?.querySelector("tbody");
            const addRow = tbody?.querySelector(".tr-add-row");
      if (tbody && addRow) {
         const cols     = JSON.parse(card.dataset.cols || "[]");
        const name     = "qdyn_" + fsid;
         const voteType = table.querySelector('input[name$="_vote"]')?.type || "checkbox";
           const tr = document.createElement("tr"); tr.dataset.row = value;
    const tdVote = tr.insertCell(); tdVote.className = "td-vote";
                const vi = document.createElement("input");
            vi.type = voteType; vi.name = `${name}_vote`; vi.value = value;
  tdVote.appendChild(vi);
       const tdLabel = tr.insertCell(); tdLabel.className = "td-row-label";
            tdLabel.innerHTML = `<span class="cell-text row-label-text" contenteditable="true"
      data-action="editTableRowLabel" data-qid="${fsid}" data-row="${escHtml(value)}">${escHtml(value)}</span>
        <button type="button" class="btn-del-row" data-action="removeTblRow"
  data-qid="${fsid}" data-val="${escHtml(value)}" title="Delete row">${SVG_DELETE}</button>`;
  const existingCells = JSON.parse(card.dataset.cells || "{}");
  cols.forEach(col => {
        const td = tr.insertCell(); td.className = "td-cell";
        const cellVal = (existingCells[value] && existingCells[value][col]) || "";
        td.innerHTML = `<span class="cell-text" contenteditable="true" data-action="editTableCell"
          data-qid="${fsid}" data-row="${escHtml(value)}" data-col="${escHtml(col)}">${escHtml(cellVal)}</span>`;
    });
    tr.insertCell().className = "td-spacer";
      tbody.insertBefore(tr, addRow);
      }
     const opts = JSON.parse(card.dataset.options || "[]");
            if (!opts.includes(value)) card.dataset.options = JSON.stringify([...opts, value]);
 }
   if (action === "addRankRow") {
    const list = card.querySelector(".ranked-list");
            if (list) {
const name = "qdyn_" + fsid;
     const num  = list.querySelectorAll(".ranked-item").length + 1;
      list.appendChild(makeRankedItem(value, num, name, fsid));
       initRankedList(list);
  }
            const opts = JSON.parse(card.dataset.options || "[]");
        if (!opts.includes(value)) card.dataset.options = JSON.stringify([...opts, value]);
        }
    updateDoc(doc(db, "questions", fsid), { options: arrayUnion(value) })
       .catch(err => { alert("Failed to save: " + err.message); console.error(err); });
 return;
    }
    if (action === "addTableColInline") {
        const table    = card.querySelector(".vote-table");
      const thead    = table?.querySelector("thead tr");
        const tbody    = table?.querySelector("tbody");
        const thAddCol = thead?.querySelector(".th-add-col");
        if (!thead || !thAddCol) return;
      const colInp = document.createElement("input");
        colInp.type = "text"; colInp.placeholder = "Column name...";
      colInp.style.cssText = "font-size:.8rem;padding:.2rem .4rem;border:1px solid #a78bfa;border-radius:.3rem;width:90px;";
  thAddCol.replaceChildren(colInp);
        colInp.focus();
        function restoreBtn() {
            thAddCol.innerHTML = `<button type="button" class="btn-add-col" data-action="addTableColInline" data-qid="${fsid}" title="Add column">+ Col</button>`;
        }
        function commitCol() {
        const col = colInp.value.trim(); restoreBtn();
          if (!col) return;
   const cols = JSON.parse(card.dataset.cols || "[]");
            if (cols.includes(col)) return;
  const th = document.createElement("th"); th.className = "th-col"; th.dataset.col = col;
      th.innerHTML = `<span class="cell-text" contenteditable="true" data-action="editTableCol"
      data-qid="${fsid}" data-val="${escHtml(col)}">${escHtml(col)}</span>
     <button type="button" class="btn-del-col" data-action="removeTableCol"
          data-qid="${fsid}" data-val="${escHtml(col)}" title="Delete column">${SVG_DELETE}</button>`;
     thead.insertBefore(th, thAddCol);
            [...tbody.querySelectorAll("tr[data-row]")].forEach(tr => {
       const td = document.createElement("td"); td.className = "td-cell";
        td.innerHTML = `<span class="cell-text" contenteditable="true" data-action="editTableCell"
          data-qid="${fsid}" data-row="${escHtml(tr.dataset.row)}" data-col="${escHtml(col)}"></span>`;
tr.insertBefore(td, tr.querySelector(".td-spacer"));
     });
 const footerTd = tbody.querySelector(".tr-add-row td");
          if (footerTd) footerTd.colSpan = (cols.length + 1) + 3;
   card.dataset.cols = JSON.stringify([...cols, col]);
         updateDoc(doc(db, "questions", fsid), { cols: arrayUnion(col) })
       .catch(err => alert("Failed to save column: " + err.message));
   }

        colInp.addEventListener("blur", commitCol, { once: true });
        colInp.addEventListener("keydown", e => {
            if (e.key === "Enter") { e.preventDefault(); colInp.removeEventListener("blur", commitCol); commitCol(); }
   if (e.key === "Escape") { colInp.removeEventListener("blur", commitCol); restoreBtn(); }
 });
        return;
    }
});
document.addEventListener("focusout", async function (e) {
    const span = e.target;
    if (span.getAttribute("contenteditable") !== "true") return;
    if (!span.classList.contains("cell-text")) return;
    const card = span.closest(".dynamic-question");
    if (!card) return;
    const rt = e.relatedTarget;
    if (rt && (rt.tagName === "BUTTON" || rt.tagName === "INPUT") && card.contains(rt)) return;
    span.setAttribute("contenteditable", "false");
    const action = span.dataset.action;
    const fsid   = span.dataset.qid;
    const newVal = span.textContent.trim();
    if (!fsid) return;
    // Allow empty newVal for cell clears - only skip if nothing changed
    if (action !== "editTableCell" && !newVal) return;
    if (action === "editTableCol") {
        const oldVal = span.dataset.val;
        if (newVal === oldVal) return;
        const cols    = JSON.parse(card.dataset.cols || "[]");
        const updated = cols.map(c => c === oldVal ? newVal : c);
        span.dataset.val = newVal;
   const th = span.closest("th");
        if (th) th.dataset.col = newVal;
        card.querySelectorAll("td.td-cell span[data-col]").forEach(s => { if (s.dataset.col === oldVal) s.dataset.col = newVal; });
        const delBtn = th?.querySelector("[data-action='removeTableCol']");
        if (delBtn) delBtn.dataset.val = newVal;
card.dataset.cols = JSON.stringify(updated);
        await updateDoc(doc(db, "questions", fsid), { cols: updated });
        return;
    }
    if (action === "editTableRowLabel") {
        const oldRow = span.dataset.row;
   if (newVal === oldRow) return;
   const opts    = JSON.parse(card.dataset.options || "[]");
   const updated = opts.map(o => o === oldRow ? newVal : o);
        span.dataset.row = newVal;
        const tr = span.closest("tr");
        if (tr) {
 tr.dataset.row = newVal;
  tr.querySelectorAll("span[data-row]").forEach(s => s.dataset.row = newVal);
    const vi = tr.querySelector("input[type=checkbox], input[type=radio]");
     if (vi) vi.value = newVal;
            const db2 = tr.querySelector(".btn-del-row");
    if (db2) db2.dataset.val = newVal;
      }
  card.dataset.options = JSON.stringify(updated);
  await updateDoc(doc(db, "questions", fsid), { options: updated });
     return;
  }
    if (action === "editTableCell") {
        const row = span.dataset.row;
        const col = span.dataset.col;
        // Update local dataset immediately so modified snapshot comparison matches
        const cells = JSON.parse(card.dataset.cells || "{}");
        if (!cells[row]) cells[row] = {};
        if (newVal) {
            cells[row][col] = newVal;
        } else {
            delete cells[row][col];
            if (Object.keys(cells[row]).length === 0) delete cells[row];
        }
        card.dataset.cells = JSON.stringify(cells);
        // Save empty string as explicit delete, otherwise save the value
        const updateData = newVal
            ? { ["cells." + row + "." + col]: newVal }
            : { ["cells." + row + "." + col]: "" };
        await updateDoc(doc(db, "questions", fsid), updateData);
        return;
    }
});
(async () => {
    await seedStaticQuestions();
    // Pre-populate customOptionsCache before static questions render
    const optSnap = await getDocsFromServer(optionsCol);
    optSnap.forEach(d => customOptionsCache.set(d.id, d.data()));
    // Now start the static questions listener (resolves after first server snapshot)
    await loadStaticQuestions();
    // Real-time listeners for ongoing changes
    loadCustomOptions();
    loadQuestions();
    initPanels();
})();

