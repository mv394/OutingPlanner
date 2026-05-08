/* =================================================
   Team Outing Poll  -  app.js  (Firebase edition)
   ================================================= */
import { db } from "./firebase-config.js";
import {
    collection, addDoc, onSnapshot,
    doc, setDoc, deleteDoc, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ?? Firestore collection references ??
const responsesCol  = collection(db, "responses");
const optionsCol    = collection(db, "customOptions");

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
   LOAD CUSTOM OPTIONS from Firestore on page load
------------------------------------------------- */
async function loadCustomOptions() {
    const snap = await getDocs(optionsCol);
    snap.forEach(docSnap => {
        const d = docSnap.data();
        const group = document.getElementById(d.groupId);
        if (!group) return;
        // avoid duplicates
        const existing = [...group.querySelectorAll("input")].map(i => i.value.toLowerCase());
     if (existing.includes(d.value.toLowerCase())) return;
        if (group.classList.contains("card-group")) {
   group.appendChild(buildCard(d.type, d.name, d.value, d.icon || "\u2728", true, docSnap.id));
        } else {
            group.appendChild(buildChip(d.type, d.name, d.value, true, docSnap.id));
        }
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
  const inp     = row.querySelector(".add-input");
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

    // Save to Firestore
    const docRef = await addDoc(optionsCol, { groupId, name, type, value, icon });

    // Render locally
    if (group.classList.contains("card-group")) {
     group.appendChild(buildCard(type, name, value, icon || "\u2728", true, docRef.id));
    } else {
        group.appendChild(buildChip(type, name, value, true, docRef.id));
    }

    inp.value = "";
    inp.placeholder = "Added! Add another...";
    setTimeout(() => { inp.placeholder = inp.dataset.orig; }, 1800);
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
   DELETE OPTION
------------------------------------------------- */
window.deleteOption = function (btn, kind) {
    const el    = btn.closest(kind === "chip" ? ".chip" : ".card-option");
 const input = el.querySelector("input");
    if (input.checked) { alert("Deselect this option before deleting it."); return; }
    if (!confirm('Remove "' + input.value + '" from the poll?')) return;
    // Remove from Firestore if user-added
    if (el.dataset.fsid) {
        deleteDoc(doc(db, "customOptions", el.dataset.fsid));
    }
    el.remove();
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

/* -------------------------------------------------
   HELPERS
------------------------------------------------- */
function show(id) {
    ["pollPage", "thankYouPage", "resultsPage"].forEach(p => {
        document.getElementById(p).classList.toggle("hidden", p !== id);
  });
}

function escHtml(str) {
    return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* -------------------------------------------------
   INIT
------------------------------------------------- */
initControls();
loadCustomOptions();
