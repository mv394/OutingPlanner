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

/* ?? Modal: open/close ?? */
window.openAddQuestionModal = function () {
document.getElementById("qTitle").value = "";
    document.getElementById("qType").value  = "checkbox";
    const list = document.getElementById("qOptionsList");
    list.innerHTML = "";
    ["Option 1", "Option 2", "Option 3"].forEach(p => list.appendChild(makeModalRow(p)));
    document.getElementById("questionModal").classList.remove("hidden");
};

window.openAddPollElementModal = function () {
 document.getElementById("peTitle").value = "";
    document.getElementById("peType").value  = "table-checkbox";
    onPeTypeChange();
    ["peColsList", "peRowsList"].forEach((id, i) => {
        const list = document.getElementById(id);
        list.innerHTML = "";
        const ph = i === 0
    ? ["e.g. Cost", "e.g. Distance", "e.g. Rating"]
     : ["Item 1", "Item 2", "Item 3"];
        ph.forEach(p => list.appendChild(makeModalRow(p)));
    });
document.getElementById("pollElementModal").classList.remove("hidden");
};

window.closeModals = function () {
    document.getElementById("questionModal").classList.add("hidden");
    document.getElementById("pollElementModal").classList.add("hidden");
};

window.onPeTypeChange = function () {
    const type    = document.getElementById("peType").value;
    const colsWrap = document.getElementById("peColsWrap");
    const rowLabel = document.getElementById("peRowsLabel");
    colsWrap.style.display = type === "ranked" ? "none" : "";
    rowLabel.textContent   = type === "ranked" ? "Items to rank" : "Rows (items)";
};

/* ?? Modal row helpers ?? */
function makeModalRow(placeholder) {
    const div = document.createElement("div");
    div.className = "modal-option-row";
    div.innerHTML = `<input type="text" placeholder="${placeholder}" />
        <button class="btn-modal-remove-opt" onclick="removeModalRow(this)">&#x2715;</button>`;
    return div;
}
window.addModalRow = function (listId, placeholder) {
    document.getElementById(listId).appendChild(makeModalRow(placeholder));
};
window.removeModalRow = function (btn) {
    const list = btn.closest(".modal-options-list");
    if (list.children.length > 1) btn.closest(".modal-option-row").remove();
};

/* ?? Save Question ?? */
window.saveNewQuestion = async function () {
    const title   = document.getElementById("qTitle").value.trim();
    const type    = document.getElementById("qType").value;
    if (!title) { alert("Please enter a question."); return; }
    const options = [...document.querySelectorAll("#qOptionsList input")]
      .map(i => i.value.trim()).filter(Boolean);
    if (!options.length) { alert("Please add at least one option."); return; }
    try {
        await addDoc(questionsCol, { title, type, options, cols: [], kind: "question", order: Date.now() });
        closeModals();
    } catch (err) { alert("Failed to save."); console.error(err); }
};

/* ?? Save Poll Element ?? */
window.saveNewPollElement = async function () {
  const title = document.getElementById("peTitle").value.trim();
    const type  = document.getElementById("peType").value;
    if (!title) { alert("Please enter a label."); return; }
    const rows = [...document.querySelectorAll("#peRowsList input")]
        .map(i => i.value.trim()).filter(Boolean);
    if (!rows.length) { alert("Please add at least one row/item."); return; }
    const cols = type === "ranked" ? [] :
  [...document.querySelectorAll("#peColsList input")].map(i => i.value.trim()).filter(Boolean);
    if (type !== "ranked" && !cols.length) { alert("Please add at least one column."); return; }
    try {
        await addDoc(questionsCol, { title, type, options: rows, cols, kind: "element", order: Date.now() });
        closeModals();
    } catch (err) { alert("Failed to save."); console.error(err); }
};

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
  // re-render updated card (e.g. new option added)
const el = document.querySelector(`[data-qid="${fsid}"]`);
     if (el) el.replaceWith(buildQuestionCard(change.doc.data(), fsid));
       }
        });
  });
}

/* ?? Build card ?? */
function buildQuestionCard(d, fsid) {
    const card    = document.createElement("div");
    card.className = "card dynamic-question";
    card.dataset.qid = fsid;

    const groupId = "qgroup_" + fsid;
    const name    = "qdyn_"   + fsid;

    // Header row
    const header = document.createElement("div");
    header.style.cssText = "display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;flex-wrap:wrap;";
    header.innerHTML = `<h2>&#x1F4CB; ${escHtml(d.title)}</h2>`;
    const removeBtn = document.createElement("button");
    removeBtn.type      = "button";
    removeBtn.className = "btn-remove-question";
    removeBtn.dataset.qid = fsid;
    removeBtn.innerHTML = "&#x1F5D1; Remove";
    header.appendChild(removeBtn);
 card.appendChild(header);

    // Body
    if (d.type === "checkbox" || d.type === "radio") {
        // ?? chip list ??
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

     // Add option row
     const row = document.createElement("div");
        row.className = "add-option-row";
        row.innerHTML = `<input type="text" class="add-input dyn-add-input" placeholder="Add another option..."
            data-qid="${fsid}" data-group="${groupId}" data-type="${d.type}" data-name="${name}" />
            <button type="button" class="btn-add" data-action="addDynOpt" data-qid="${fsid}">&#x2795; Add</button>`;
        card.appendChild(row);

    } else if (d.type === "table-checkbox" || d.type === "table-radio") {
        // ?? vote table ??
        const inputType = d.type === "table-checkbox" ? "checkbox" : "radio";
     const wrap  = document.createElement("div");
        wrap.style.overflowX = "auto";
  const table = document.createElement("table");
        table.className = "vote-table";
     table.id = groupId;

        // thead
        let thead = `<thead><tr><th>Option</th>`;
    d.cols.forEach(col => { thead += `<th>${escHtml(col)}</th>`; });
     thead += `<th></th></tr></thead>`;
   table.innerHTML = thead;

 // tbody
    const tbody = document.createElement("tbody");
        d.options.forEach(opt => {
   const tr = document.createElement("tr");
 let cells = `<td>${escHtml(opt)}</td>`;
            d.cols.forEach(col => {
      const nm = `${name}_${col.replace(/\s+/g,"_")}`;
     cells += `<td><input type="${inputType}" name="${nm}" value="${escHtml(opt)}" /></td>`;
 });
    cells += `<td><button type="button" class="btn-tbl-delete"
       data-action="removeTblRow" data-qid="${fsid}" data-val="${escHtml(opt)}">&#x2715;</button></td>`;
          tr.innerHTML = cells;
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
      wrap.appendChild(table);
        card.appendChild(wrap);

  // Add row
        const row = document.createElement("div");
 row.className = "add-option-row";
        row.innerHTML = `<input type="text" class="add-input" placeholder="Add another row..."
         data-qid="${fsid}" data-type="${inputType}" data-name="${name}"
          data-cols='${escHtml(JSON.stringify(d.cols))}' />
 <button type="button" class="btn-add" data-action="addTblRow" data-qid="${fsid}">&#x2795; Add Row</button>`;
        card.appendChild(row);

    } else if (d.type === "ranked") {
 // ?? ranked list ??
        const hint = document.createElement("p");
        hint.style.cssText = "font-size:.8rem;color:#888;";
        hint.textContent = "Drag to reorder your preference";
  card.appendChild(hint);

        const list = document.createElement("div");
        list.className = "ranked-list";
        list.id = groupId;
        d.options.forEach((opt, i) => {
            const item = document.createElement("div");
            item.className  = "ranked-item";
    item.draggable  = true;
  item.innerHTML  = `<span class="rank-handle">&#x2630;</span>
          <span class="rank-number">${i + 1}</span>
                <span class="rank-label">${escHtml(opt)}</span>
          <input type="hidden" name="${name}" value="${escHtml(opt)}" />
       <span class="rank-actions">
     <button type="button" class="btn-tbl-delete"
    data-action="removeRankRow" data-qid="${fsid}" data-val="${escHtml(opt)}">&#x2715;</button>
     </span>`;
            list.appendChild(item);
  });
        card.appendChild(list);
setTimeout(() => initRankedList(list), 50);

        // Add item
    const row = document.createElement("div");
        row.className = "add-option-row";
        row.innerHTML = `<input type="text" class="add-input" placeholder="Add another item..."
            data-qid="${fsid}" data-group="${groupId}" data-name="${name}" />
  <button type="button" class="btn-add" data-action="addRankRow" data-qid="${fsid}">&#x2795; Add</button>`;
     card.appendChild(row);
    }

    return card;
}

/* ?? Event delegation for all dynamic card actions ?? */
document.addEventListener("click", async function (e) {
    // Remove question
    const removeBtn = e.target.closest(".btn-remove-question");
    if (removeBtn) {
        const fsid = removeBtn.dataset.qid;
    if (!fsid) return;
 if (!confirm("Remove this question/element for everyone?")) return;
    try { await deleteDoc(doc(db, "questions", fsid)); }
        catch (err) { alert("Failed to remove."); console.error(err); }
        return;
    }

    // Action buttons inside dynamic cards
    const btn    = e.target.closest("[data-action]");
  if (!btn) return;
    const action = btn.dataset.action;
    const fsid   = btn.dataset.qid;
    const card   = btn.closest(".card");

    if (action === "addDynOpt") {
        const inp   = card.querySelector(".dyn-add-input");
        const value = inp.value.trim();
    if (!value) return;
        const { updateDoc, arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await updateDoc(doc(db, "questions", fsid), { options: arrayUnion(value) });
     inp.value = "";
    }

  if (action === "addTblRow") {
        const inp   = card.querySelector(".add-input[data-action!='addTblRow']") || card.querySelector(`[data-qid="${fsid}"].add-input`);
        const row = btn.closest(".add-option-row");
        const input = row.querySelector(".add-input");
        const value = input.value.trim();
      if (!value) return;
   const { updateDoc, arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
        await updateDoc(doc(db, "questions", fsid), { options: arrayUnion(value) });
        input.value = "";
    }

    if (action === "removeTblRow") {
        const value = btn.dataset.val;
   if (!confirm(`Remove "${value}"?`)) return;
      const { updateDoc, arrayRemove } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
   await updateDoc(doc(db, "questions", fsid), { options: arrayRemove(value) });
    }

  if (action === "addRankRow") {
   const row   = btn.closest(".add-option-row");
        const input = row.querySelector(".add-input");
        const value = input.value.trim();
        if (!value) return;
        const { updateDoc, arrayUnion } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  await updateDoc(doc(db, "questions", fsid), { options: arrayUnion(value) });
        input.value = "";
    }

    if (action === "removeRankRow") {
        const value = btn.dataset.val;
        if (!confirm(`Remove "${value}"?`)) return;
    const { updateDoc, arrayRemove } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
   await updateDoc(doc(db, "questions", fsid), { options: arrayRemove(value) });
    }
});

/* ?? Ranked list drag ?? */
function initRankedList(list) {
    let dragged = null;
    const attach = item => {
        item.addEventListener("dragstart", () => { dragged = item; item.classList.add("dragging"); });
        item.addEventListener("dragend",   () => { dragged = null; item.classList.remove("dragging"); updateRankNumbers(list); });
  item.addEventListener("dragover",  e => {
     e.preventDefault();
       const after = getDragAfterElement(list, e.clientY);
            if (after == null) list.appendChild(dragged);
 else list.insertBefore(dragged, after);
   });
    };
    list.querySelectorAll(".ranked-item").forEach(attach);
}

function updateRankNumbers(list) {
    [...list.querySelectorAll(".rank-number")].forEach((el, i) => { el.textContent = i + 1; });
}

function getDragAfterElement(list, y) {
    const items = [...list.querySelectorAll(".ranked-item:not(.dragging)")];
    return items.reduce((closest, child) => {
  const box    = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        return offset < 0 && offset > closest.offset ? { offset, element: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
