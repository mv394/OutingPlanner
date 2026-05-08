/* =================================================
   Team Outing Poll  -  app.js  (Firebase edition)
   ================================================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getFirestore, collection, addDoc, onSnapshot,
    doc, setDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ?? Firebase init (merged from firebase-config.js) ??
const firebaseConfig = {
    apiKey:            "AIzaSyDljkZs3hWm6zQv-aYZp-BYNzgNNKYcfTM",
    authDomain:        "outingpoll.firebaseapp.com",
    projectId:         "outingpoll",
    storageBucket:     "outingpoll.firebasestorage.app",
    messagingSenderId: "22100990738",
    appId:        "1:22100990738:web:8b3c0872fdcd17a733b1cb"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ?? Firestore collection references ??
const responsesCol = collection(db, "responses");
const optionsCol   = collection(db, "customOptions");
const questionsCol = collection(db, "questions"); // New collection for dynamic questions

// ?? Local vote counts built from live snapshot ??
let liveCounts = {};

/* -------------------------------------------------
   CHIP TOGGLE
------------------------------------------------- */
document.addEventListener("change", function (e) {
    const input = e.target;
    const chip  = input.closest(".chip");
    if (!chip) return;
    if (input.type === "checkbox") {
        chip.classList.toggle("selected", input.checked);
    } else if (input.type === "radio") {
        chip.closest(".chip-group")
     .querySelectorAll(".chip")
     .forEach(c => c.classList.remove("selected"));
        chip.classList.add("selected");
    }
});

/* -------------------------------------------------
   CUISINE max-3 guard
------------------------------------------------- */
document.addEventListener("change", function (e) {
    if (e.target.name !== "cuisine") return;
    const checked = document.querySelectorAll('input[name="cuisine"]:checked');
    const hint    = document.getElementById("cuisineHint");
    if (checked.length > 3) {
      e.target.checked = false;
        e.target.closest(".chip").classList.remove("selected");
   hint.textContent = "Maximum 3 cuisines allowed.";
    } else {
    hint.textContent = checked.length > 0 ? checked.length + " / 3 selected" : "";
    }
});

/* -------------------------------------------------
   LOAD CUSTOM OPTIONS from Firestore - live listener
------------------------------------------------- */
function loadCustomOptions() {
    onSnapshot(optionsCol, snapshot => {
        snapshot.docChanges().forEach(change => {
 const d     = change.doc.data();
            const fsid  = change.doc.id;
       const group = document.getElementById(d.groupId);
if (!group) return;

         if (change.type === "added") {
        // Guard: skip if already rendered
                if (document.querySelector(`[data-fsid="${fsid}"]`)) return;
     if (group.classList.contains("card-group")) {
            group.appendChild(buildCard(d.type, d.name, d.value, d.icon || "\u2728", true, fsid));
       } else {
          group.appendChild(buildChip(d.type, d.name, d.value, true, fsid));
 }
    }

            if (change.type === "modified") {
    const el    = document.querySelector(`[data-fsid="${fsid}"]`);
  if (!el) return;
           const input = el.querySelector("input");
      const text  = el.querySelector(".chip-text, .card-text");
     if (input) input.value     = d.value;
                if (text)  text.textContent = d.value;
     }

     if (change.type === "removed") {
                const el = document.querySelector(`[data-fsid="${fsid}"]`);
     if (el) el.remove();
     }
        });
    });
}

/* -------------------------------------------------
   ADD OPTION  ->  saves to Firestore so all users see it
------------------------------------------------- */
document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && e.target.classList.contains("add-input")) {
        e.preventDefault();
        addOption(e.target.nextElementSibling);
    }
});

async function addOption(btn) {
    const row     = btn.closest(".add-option-row");
    const inp= row.querySelector(".add-input");
    const value   = inp.value.trim();
    if (!value) return;

    const groupId = inp.dataset.group;
    const name    = inp.dataset.name;
    const type    = inp.dataset.type;
    const icon    = inp.dataset.icon || "";
    const group   = document.getElementById(groupId);

    // Duplicate check
    const existing = [...group.querySelectorAll("input")].map(i => i.value.toLowerCase());
    if (existing.includes(value.toLowerCase())) {
        inp.value = "";
  inp.placeholder = "That option already exists!";
        setTimeout(() => { inp.placeholder = inp.dataset.orig || ""; }, 2000);
        return;
    }
    if (!inp.dataset.orig) inp.dataset.orig = inp.placeholder;

    try {
   // Save to Firestore only — onSnapshot handles rendering for ALL users including this one
        await addDoc(optionsCol, { groupId, name, type, value, icon });
        inp.value = "";
        inp.placeholder = "Added! Add another...";
        setTimeout(() => { inp.placeholder = inp.dataset.orig; }, 1800);
    } catch (err) {
        alert("Failed to add option. Please check your Firebase config.");
        console.error(err);
    }
}

// Expose globally for onclick in HTML
window.addOption = addOption;

/* -------------------------------------------------
   BUILD CHIP
------------------------------------------------- */
function buildChip(type, name, value, isUser, firestoreId) {
    const label = document.createElement("label");
    label.className = "chip" + (isUser ? " user-chip" : "");
    if (firestoreId) label.dataset.fsid = firestoreId;
    label.innerHTML =
      '<input type="' + type + '" name="' + name + '" value="' + escHtml(value) + '" />' +
  '<span class="chip-text">' + escHtml(value) + "</span>" +
   '<span class="chip-actions">' +
      '<button type="button" class="btn-chip-edit"  title="Edit"   onclick="editChip(this)">\u270F\uFE0F</button>' +
        '<button type="button" class="btn-chip-delete" title="Delete" onclick="deleteOption(this,\'chip\')">\u2715</button>' +
 "</span>";
    return label;
}

/* -------------------------------------------------
   BUILD CARD
------------------------------------------------- */
function buildCard(type, name, value, icon, isUser, firestoreId) {
    const wrap = document.createElement("label");
    wrap.className = "card-option" + (isUser ? " user-card" : "");
    if (firestoreId) wrap.dataset.fsid = firestoreId;
    wrap.innerHTML =
        '<input type="' + type + '" name="' + name + '" value="' + escHtml(value) + '" />' +
      '<div class="card-body">' +
  '<span class="card-icon">' + icon + "</span>" +
  '<strong class="card-text">' + escHtml(value) + "</strong>" +
        (isUser ? "<small>Added by team</small>" : "") +
  "</div>" +
   '<div class="card-actions">' +
        '<button type="button" class="btn-card-edit"   title="Edit"onclick="editCard(this)">\u270F\uFE0F</button>' +
    '<button type="button" class="btn-card-delete" title="Delete" onclick="deleteOption(this,\'card\')">\u2715</button>' +
        "</div>";
    return wrap;
}

/* -------------------------------------------------
   INJECT controls onto existing HTML chips & cards
------------------------------------------------- */
function initControls() {
    document.querySelectorAll(".chip-group .chip").forEach(chip => {
        const input = chip.querySelector("input");
        if (!input) return;
   chip.childNodes.forEach(node => {
     if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
            const sp = document.createElement("span");
   sp.className = "chip-text";
     sp.textContent = node.textContent;
           chip.replaceChild(sp, node);
       }
        });
   if (!chip.querySelector(".chip-actions")) {
         const actions = document.createElement("span");
          actions.className = "chip-actions";
            actions.innerHTML =
 '<button type="button" class="btn-chip-edit"  title="Edit"   onclick="editChip(this)">\u270F\uFE0F</button>' +
    '<button type="button" class="btn-chip-delete" title="Delete" onclick="deleteOption(this,\'chip\')">\u2715</button>';
            chip.appendChild(actions);
        }
    });

    document.querySelectorAll(".card-group .card-option").forEach(card => {
        if (!card.querySelector(".card-actions")) {
            const actions = document.createElement("div");
actions.className = "card-actions";
            actions.innerHTML =
'<button type="button" class="btn-card-edit"   title="Edit"   onclick="editCard(this)">\u270F\uFE0F</button>' +
 '<button type="button" class="btn-card-delete" title="Delete" onclick="deleteOption(this,\'card\')">\u2715</button>';
            card.appendChild(actions);
        const strong = card.querySelector("strong");
  if (strong) strong.classList.add("card-text");
        }
    });
}

/* -------------------------------------------------
   EDIT CHIP
------------------------------------------------- */
window.editChip = function (btn) {
    const chip  = btn.closest(".chip");
    const input = chip.querySelector("input");
    const span  = chip.querySelector(".chip-text");
    const newVal = prompt("Edit option:", input.value);
    if (!newVal || !newVal.trim() || newVal.trim() === input.value) return;
    const group = chip.closest(".chip-group");
    const exists = [...group.querySelectorAll("input")].filter(i => i !== input).map(i => i.value.toLowerCase());
    if (exists.includes(newVal.trim().toLowerCase())) { alert("That option already exists."); return; }
    // Update Firestore if user-added
    if (chip.dataset.fsid) {
        setDoc(doc(db, "customOptions", chip.dataset.fsid), { value: newVal.trim() }, { merge: true });
    }
    input.value = newVal.trim();
    span.textContent = newVal.trim();
};

/* -------------------------------------------------
   EDIT CARD
------------------------------------------------- */
window.editCard = function (btn) {
    const card   = btn.closest(".card-option");
    const input  = card.querySelector("input");
    const strong = card.querySelector(".card-text");
    const newVal = prompt("Edit option:", input.value);
    if (!newVal || !newVal.trim() || newVal.trim() === input.value) return;
    const group = card.closest(".card-group");
    const exists = [...group.querySelectorAll("input")].filter(i => i !== input).map(i => i.value.toLowerCase());
    if (exists.includes(newVal.trim().toLowerCase())) { alert("That option already exists."); return; }
    if (card.dataset.fsid) {
        setDoc(doc(db, "customOptions", card.dataset.fsid), { value: newVal.trim() }, { merge: true });
    }
    input.value = newVal.trim();
    if (strong) strong.textContent = newVal.trim();
};

/* -------------------------------------------------
   DELETE OPTION — let Firestore drive the DOM removal
------------------------------------------------- */
window.deleteOption = function (btn, kind) {
    const el    = btn.closest(kind === "chip" ? ".chip" : ".card-option");
    const input = el.querySelector("input");
    if (input.checked) { alert("Deselect this option before deleting it."); return; }
    if (!confirm('Remove "' + input.value + '" from the poll?')) return;
    if (el.dataset.fsid) {
        // Don't remove locally — onSnapshot "removed" event will remove it for everyone
        deleteDoc(doc(db, "customOptions", el.dataset.fsid));
} else {
   // Built-in option (no Firestore id) — just remove locally
        el.remove();
    }
};

/* -------------------------------------------------
   VALIDATION
------------------------------------------------- */
function validate() {
    const days   = document.querySelectorAll('input[name="days"]:checked');
    const timeSlot = document.querySelector('input[name="timeSlot"]:checked');
    const cuisine  = document.querySelectorAll('input[name="cuisine"]:checked');
    if (!days.length){ alert("Please select at least one preferred day.");      return false; }
    if (!timeSlot)       { alert("Please select a preferred time slot.");           return false; }
    if (!cuisine.length) { alert("Please select at least one cuisine preference."); return false; }
  return true;
}

/* -------------------------------------------------
   COLLECT
------------------------------------------------- */
function collectAnswers() {
    return {
        days:        [...document.querySelectorAll('input[name="days"]:checked')].map(i => i.value),
        timeSlot:    document.querySelector('input[name="timeSlot"]:checked')?.value ?? "",
        duration:    document.querySelector('input[name="duration"]:checked')?.value ?? "",
        cuisine:     [...document.querySelectorAll('input[name="cuisine"]:checked')].map(i => i.value),
        dietary:     [...document.querySelectorAll('input[name="dietary"]:checked')].map(i => i.value),
        diningStyle: document.querySelector('input[name="diningStyle"]:checked')?.value ?? "",
 location:    [...document.querySelectorAll('input[name="location"]:checked')].map(i => i.value),
  suggestion:  document.getElementById("suggestion").value.trim(),
        comments:    document.getElementById("comments").value.trim(),
submittedAt: new Date().toISOString()
    };
}

/* -------------------------------------------------
   SUBMIT  ->save to Firestore
------------------------------------------------- */
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
        alert("Failed to submit. Please check your Firebase config.");
        console.error(err);
      btn.textContent = "Submit My Vote";
  btn.disabled = false;
    }
});

/* -------------------------------------------------
   RESULTS  ->  live listener from Firestore
------------------------------------------------- */
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
     (Array.isArray(vals) ? vals : [vals]).forEach(v => {
  if (v) liveCounts[key][v] = (liveCounts[key][v] || 0) + 1;
   });
    };
            inc("days",        d.days);
   inc("timeSlot",    d.timeSlot);
            inc("duration",    d.duration);
 inc("cuisine",     d.cuisine);
            inc("dietary",     d.dietary);
            inc("diningStyle", d.diningStyle);
        inc("location",    d.location);
        });

        document.getElementById("resultsSubtitle").textContent =
          total + " response" + (total !== 1 ? "s" : "") + " — updates live";

        renderResults(total);
    });
};

function renderResults(total) {
    const content = document.getElementById("resultsContent");
    content.innerHTML = "";

  const sections = [
   { title: "Preferred Days",         key: "days" },
     { title: "Preferred Time Slot",    key: "timeSlot" },
        { title: "Outing Duration",        key: "duration" },
        { title: "Cuisine Preferences",    key: "cuisine" },
        { title: "Dietary Restrictions",   key: "dietary" },
        { title: "Dining Style",        key: "diningStyle" },
        { title: "Preferred Area",    key: "location" },
    ];

    sections.forEach(sec => {
   const data    = liveCounts[sec.key] || {};
        const entries = Object.entries(data);
        if (!entries.length) return;
        const block = document.createElement("div");
block.className = "result-block";
   block.innerHTML = "<h4>" + sec.title + "</h4>";
        entries.sort((a, b) => b[1] - a[1]).forEach(([key, count]) => {
        const pct = Math.round((count / Math.max(total, 1)) * 100);
          block.innerHTML +=
    '<div class="bar-row">' +
       '<span class="bar-label">' + escHtml(key) + "</span>" +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
       '<span class="bar-count">' + count + "</span>" +
         "</div>";
        });
        content.appendChild(block);
    });
}

/* -------------------------------------------------
   RESET
------------------------------------------------- */
window.resetPoll = function () {
    document.getElementById("pollForm").reset();
document.querySelectorAll(".chip").forEach(c => c.classList.remove("selected"));
    document.getElementById("cuisineHint").textContent = "";
    show("pollPage");
    window.scrollTo({ top: 0, behavior: "smooth" });
};

/* =================================================
DYNAMIC QUESTIONS  —  Firestore: "questions"
   Simple Q&A — checkbox or radio chips
   ================================================= */

/* ?? Panel wiring (runs after DOM ready) ?? */
function initPanels() {
    // Add Question
    document.getElementById("btnAddQuestion").onclick = () => {
     document.getElementById("qTitle").value = "";
 togglePanel("addQuestionPanel", true);
        togglePanel("addPollElementPanel", false);
document.getElementById("qTitle").focus();
 };
  document.getElementById("btnCancelQuestion").onclick = () => togglePanel("addQuestionPanel", false);
    document.getElementById("btnSaveQuestion").onclick = saveNewQuestion;
    document.getElementById("qTitle").addEventListener("keydown", e => {
        if (e.key === "Enter") saveNewQuestion();
    });

    // Add Poll Element
    document.getElementById("btnAddPollElement").onclick = () => {
        document.getElementById("peTitle").value = "";
        // reset type selector
      document.querySelectorAll("#peTypeSelector .type-btn").forEach(b => b.classList.remove("active"));
        document.querySelector("#peTypeSelector .type-btn[data-type='checkbox']").classList.add("active");
    togglePanel("addPollElementPanel", true);
 togglePanel("addQuestionPanel", false);
        document.getElementById("peTitle").focus();
    };
    document.getElementById("btnCancelPollElement").onclick = () => togglePanel("addPollElementPanel", false);
    document.getElementById("btnSavePollElement").onclick   = saveNewPollElement;

    // Type selector buttons
    document.getElementById("peTypeSelector").addEventListener("click", e => {
        const btn = e.target.closest(".type-btn");
        if (!btn) return;
      document.querySelectorAll("#peTypeSelector .type-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
    });
}

function togglePanel(id, show) {
    document.getElementById(id).classList.toggle("hidden", !show);
}

/* ?? Save Question — just title + type, no pre-set options ?? */
async function saveNewQuestion() {
  const title = document.getElementById("qTitle").value.trim();
    if (!title) { document.getElementById("qTitle").focus(); return; }
  const type  = "checkbox"; // default; user adds options after
    try {
        await addDoc(questionsCol, {
    title, type, options: ["Add option"], cols: [],
  kind: "question", order: Date.now()
  });
  togglePanel("addQuestionPanel", false);
    } catch (err) { alert("Failed to save question."); console.error(err); }
}

/* ?? Save Poll Element — title + chosen type, default placeholder options ?? */
async function saveNewPollElement() {
    const title = document.getElementById("peTitle").value.trim();
    if (!title) { document.getElementById("peTitle").focus(); return; }
    const activeBtn = document.querySelector("#peTypeSelector .type-btn.active");
 const type  = activeBtn ? activeBtn.dataset.type : "checkbox";

    let options = ["Add Text"], cols = [];
    if (type === "table-checkbox" || type === "table-radio") {
        options = ["Row 1", "Row 2"];
        cols    = ["Option A", "Option B"];
    } else if (type === "ranked") {
        options = ["Item 1", "Item 2", "Item 3"];
    }
    try {
        await addDoc(questionsCol, {
     title, type, options, cols,
            kind: "element", order: Date.now()
        });
        togglePanel("addPollElementPanel", false);
    } catch (err) { alert("Failed to save element."); console.error(err); }
}

/* ?? Live listener ?? */
function loadQuestions() {
    const container = document.getElementById("dynamicQuestionsContainer");
    onSnapshot(questionsCol, snapshot => {
        snapshot.docChanges().forEach(change => {
            const fsid = change.doc.id;
      if (change.type === "added") {
    if (document.querySelector(`[data-qid="${fsid}"]`)) return;
     container.appendChild(buildQuestionCard(change.doc.data(), fsid));
      }
         if (change.type === "removed") {
              const el = document.querySelector(`[data-qid="${fsid}"]`);
   if (el) el.remove();
          }
   if (change.type === "modified") {
     const el = document.querySelector(`[data-qid="${fsid}"]`);
       if (el) el.replaceWith(buildQuestionCard(change.doc.data(), fsid));
         }
        });
    });
}

/* ?? Build card ?? */
function buildQuestionCard(d, fsid) {
    const card  = document.createElement("div");
    card.className = "card dynamic-question";
    card.dataset.qid = fsid;

    const name = "qdyn_" + fsid;
    const groupId = "qgroup_" + fsid;

    // ?? Header with always-visible remove button ??
    const header = document.createElement("div");
    header.className = "dyn-card-header";
    const title = document.createElement("h2");
    title.innerHTML = "&#x1F4CB; " + escHtml(d.title);
    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn-remove-q";
    removeBtn.setAttribute("data-qid", fsid);
    removeBtn.textContent = "? Remove";
    header.appendChild(title);
    header.appendChild(removeBtn);
    card.appendChild(header);

    // ?? Body by type ??
    if (d.type === "checkbox" || d.type === "radio") {
   const group = document.createElement("div");
        group.className = "chip-group";
  group.id = groupId;
      d.options.forEach(opt => {
const lbl = document.createElement("label");
            lbl.className = "chip";
     lbl.innerHTML = `<input type="${d.type}" name="${name}" value="${escHtml(opt)}" />
 <span class="chip-text">${escHtml(opt)}</span>`;
  group.appendChild(lbl);
        });
    card.appendChild(group);
        card.appendChild(makeAddRow("addDynOpt", fsid, groupId, d.type, name, "Add another option…"));

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
          let cells = `<td class="tbl-opt-cell" contenteditable="false">${escHtml(opt)}</td>`;
       d.cols.forEach(col => {
  const nm = `${name}_${col.replace(/\s+/g, "_")}`;
  cells += `<td><input type="${inputType}" name="${nm}" value="${escHtml(opt)}" /></td>`;
         });
 cells += `<td><button type="button" class="btn-tbl-delete" data-action="removeTblRow" data-qid="${fsid}" data-val="${escHtml(opt)}">?</button></td>`;
 tr.innerHTML = cells;
  tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        wrap.appendChild(table);
        card.appendChild(wrap);
      card.appendChild(makeAddRow("addTblRow", fsid, null, inputType, name, "Add another row…", JSON.stringify(d.cols)));

    } else if (d.type === "ranked") {
   const hint = document.createElement("p");
  hint.style.cssText = "font-size:.8rem;color:#888;margin-bottom:.4rem;";
        hint.textContent = "Drag to reorder your preference";
     card.appendChild(hint);
    const list = document.createElement("div");
 list.className = "ranked-list";
        list.id = groupId;
        d.options.forEach((opt, i) => {
       list.appendChild(makeRankedItem(opt, i + 1, name, fsid));
        });
    card.appendChild(list);
    setTimeout(() => initRankedList(list), 50);
        card.appendChild(makeAddRow("addRankRow", fsid, groupId, null, name, "Add another item…"));
    }

    return card;
}

function makeAddRow(action, fsid, groupId, type, name, placeholder, cols) {
    const row = document.createElement("div");
    row.className = "add-option-row";
    row.innerHTML = `<input type="text" class="add-input" placeholder="${placeholder}"
        data-action-input="${action}" data-qid="${fsid}"
        ${groupId ? `data-group="${groupId}"` : ""}
   ${type    ? `data-type="${type}"`   : ""}
      ${name    ? `data-name="${name}"`     : ""}
        ${cols    ? `data-cols='${cols}'`     : ""} />
        <button type="button" class="btn-add" data-action="${action}" data-qid="${fsid}">&#x2795; Add</button>`;
    return row;
}

function makeRankedItem(opt, num, name, fsid) {
    const item = document.createElement("div");
    item.className = "ranked-item";
    item.draggable = true;
    item.innerHTML = `<span class="rank-handle">&#x2630;</span>
        <span class="rank-number">${num}</span>
        <span class="rank-label">${escHtml(opt)}</span>
        <input type="hidden" name="${name}" value="${escHtml(opt)}" />
     <span class="rank-actions">
            <button type="button" class="btn-tbl-delete" data-action="removeRankRow" data-qid="${fsid}" data-val="${escHtml(opt)}">?</button>
   </span>`;
    return item;
}

/* ?? Event delegation — single listener for ALL dynamic card actions ?? */
document.addEventListener("click", async function (e) {

    // ?? Remove question ??
 const rBtn = e.target.closest(".btn-remove-q");
    if (rBtn) {
        const fsid = rBtn.getAttribute("data-qid");
     if (!fsid) return;
      if (!confirm("Remove this for everyone?")) return;
        try { await deleteDoc(doc(db, "questions", fsid)); }
        catch (err) { alert("Failed to remove."); console.error(err); }
        return;
    }

    // ?? Add/remove inside cards ??
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
  const action = btn.dataset.action;
    const fsid   = btn.dataset.qid;
    const row    = btn.closest(".add-option-row");
    const inp    = row ? row.querySelector(".add-input") : null;

    const { updateDoc, arrayUnion, arrayRemove } = await import(
        "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"
    );

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

/* ?? Also trigger add on Enter key in dynamic add inputs ?? */
document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    const inp = e.target.closest("[data-action-input]");
    if (!inp) return;
    e.preventDefault();
    inp.nextElementSibling?.click();
});

/* ?? Ranked drag ?? */
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

/* ?? INIT ?? */
initControls();
loadCustomOptions();
loadQuestions();
initPanels();
