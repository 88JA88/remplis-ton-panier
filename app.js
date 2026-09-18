const STORAGE_KEY = 'liste-courses-v3';
const $ = (selector) => document.querySelector(selector);
let recognition = null;
let dictationWanted = false;
let state = loadState();

function makeId() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.catalog) return saved;
    const oldItems = saved?.items || [];
    return { catalog: oldItems.map((item) => ({ id: item.id || makeId(), text: item.text, selected: !item.bought })), items: [] };
  } catch { return { catalog: [], items: [] }; }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); }
function escapeHtml(value) { return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function splitItems(text) { return text.replace(/\bvirgules?\b/gi, ',').replace(/\bà la ligne\b/gi, '\n').split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean); }

function addItems() {
  splitItems($('#items-input').value).forEach((text) => {
    if (!state.catalog.some((item) => item.text.toLocaleLowerCase() === text.toLocaleLowerCase())) state.catalog.push({ id: makeId(), text, selected: true });
  });
  $('#items-input').value = '';
  save();
}
function showView(view) {
  $('#selection-view').hidden = view !== 'selection';
  $('#courses-view').hidden = view !== 'courses';
  document.querySelectorAll('.view-button').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
}
function itemRow(item, bought) {
  return `<div class="item-row${bought ? ' bought-row' : ''}"><input class="item-checkbox" data-id="${item.id}" aria-label="${bought ? 'Remettre' : 'Marquer comme acheté'} : ${escapeHtml(item.text)}" type="checkbox" ${bought ? 'checked' : ''}><span class="course-name" data-id="${item.id}">${escapeHtml(item.text)}</span><input class="note-text" data-id="${item.id}" aria-label="Précision pour ${escapeHtml(item.text)}" value="${escapeHtml(item.note || '')}"></div>`;
}
function render() {
  const catalog = [...state.catalog].sort((a, b) => a.text.localeCompare(b.text, 'fr', { sensitivity: 'base' }));
  let previousLetter = '';
  $('#catalog-list').innerHTML = catalog.map((item) => {
    const letter = item.text.charAt(0).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('fr-FR');
    const newLetter = letter !== previousLetter;
    previousLetter = letter;
    return `<div class="catalog-item${newLetter ? ' alphabet-break' : ''}"><input type="checkbox" data-catalog-id="${item.id}" ${item.selected ? 'checked' : ''}><span class="catalog-name" data-catalog-id="${item.id}">${escapeHtml(item.text)}</span><input class="catalog-text" data-catalog-id="${item.id}" aria-label="Modifier ${escapeHtml(item.text)}" value="${escapeHtml(item.text)}" hidden><button class="catalog-delete" data-catalog-id="${item.id}" aria-label="Supprimer ${escapeHtml(item.text)}">×</button></div>`;
  }).join('');
  const selectedCount = state.catalog.filter((item) => item.selected).length;
  const active = state.items.filter((item) => !item.bought);
  const bought = state.items.filter((item) => item.bought);
  $('#active-list').innerHTML = active.map((item) => itemRow(item, false)).join('');
  $('#bought-list').innerHTML = bought.map((item) => itemRow(item, true)).join('');
  $('#item-count').textContent = active.length ? `${active.length} article${active.length > 1 ? 's' : ''}` : '';
  $('#bought-count').textContent = bought.length ? `(${bought.length})` : '';
  $('#empty-list').hidden = state.items.length > 0;
  $('#finished-message').hidden = !state.items.length || active.length > 0;
  $('#bought-section').hidden = !bought.length;
}

$('#add-items').onclick = addItems;
$('#items-input').onkeydown = (event) => { if (event.key === 'Enter') { event.preventDefault(); addItems(); } };
$('#validate-selection').onclick = () => { state.items = state.catalog.filter((item) => item.selected).map((item) => ({ id: makeId(), text: item.text, note: '', bought: false })); save(); showView('courses'); };
$('#help-button').onclick = () => { $('#help-window').hidden = false; };
$('#help-close').onclick = () => { $('#help-window').hidden = true; };
$('#help-window').onclick = (event) => { if (event.target.id === 'help-window') $('#help-window').hidden = true; };
function downloadBackup(file) { const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = file.name; link.click(); window.setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
$('#backup-button').onclick = async () => {
  const date = new Date().toISOString().slice(0, 10);
  const file = new File([JSON.stringify({ catalog: state.catalog }, null, 2)], `remplis-ton-panier-denrees-${date}.json`, { type: 'application/json' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Sauvegarde Remplis ton panier' }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  downloadBackup(file);
};
$('#restore-input').onchange = async (event) => { const file = event.target.files[0]; if (!file) return; try { const saved = JSON.parse(await file.text()); if (Array.isArray(saved.catalog)) { state.catalog = saved.catalog.filter((item) => item && item.text).map((item) => ({ id: item.id || makeId(), text: String(item.text), selected: Boolean(item.selected) })); save(); } } catch { alert('Ce fichier de sauvegarde est invalide.'); } event.target.value = ''; };
document.querySelectorAll('.view-button').forEach((button) => { button.onclick = () => showView(button.dataset.view); });
$('#new-list').onclick = () => { state.catalog.forEach((item) => { item.selected = false; }); save(); showView('selection'); };
$('#confirm-no').onclick = () => { $('#confirm-new').hidden = true; };
$('#confirm-yes').onclick = () => { state.catalog.forEach((item) => { item.selected = false; }); $('#confirm-new').hidden = true; save(); showView('selection'); };
document.addEventListener('change', (event) => {
  if (event.target.dataset.catalogId) { const item = state.catalog.find((entry) => entry.id === event.target.dataset.catalogId); item.selected = event.target.checked; save(); }
  if (event.target.classList.contains('catalog-text')) { const item = state.catalog.find((entry) => entry.id === event.target.dataset.catalogId); const text = event.target.value.trim(); if (!text) state.catalog = state.catalog.filter((entry) => entry.id !== item.id); else item.text = text; save(); }
  if (event.target.classList.contains('item-checkbox')) { const item = state.items.find((entry) => entry.id === event.target.dataset.id); item.bought = event.target.checked; save(); }
  if (event.target.classList.contains('item-text')) { const item = state.items.find((entry) => entry.id === event.target.dataset.id); const text = event.target.value.trim(); if (!text) state.items = state.items.filter((entry) => entry.id !== item.id); else item.text = text; save(); }
  if (event.target.classList.contains('note-text')) { const item = state.items.find((entry) => entry.id === event.target.dataset.id); item.note = event.target.value; save(); }
});
document.addEventListener('click', (event) => {
  if (event.target.classList.contains('catalog-name')) { if (longPressActive) { longPressActive = false; return; } const item = state.catalog.find((entry) => entry.id === event.target.dataset.catalogId); item.selected = !item.selected; save(); }
  if (event.target.classList.contains('course-name')) { const item = state.items.find((entry) => entry.id === event.target.dataset.id); item.bought = !item.bought; save(); }
  if (event.target.classList.contains('catalog-delete')) { state.catalog = state.catalog.filter((item) => item.id !== event.target.dataset.catalogId); save(); }
});
let pressTimer;
let longPressActive = false;
let editingCatalogInput = null;
document.addEventListener('pointerdown', (event) => {
  if (!event.target.classList.contains('catalog-name')) return;
  longPressActive = false;
  editingCatalogInput = null;
  pressTimer = window.setTimeout(() => { longPressActive = true; const name = event.target; const input = name.parentElement.querySelector('.catalog-text'); name.hidden = true; input.hidden = false; editingCatalogInput = input; }, 550);
});
document.addEventListener('pointerup', () => { window.clearTimeout(pressTimer); if (longPressActive && editingCatalogInput) { editingCatalogInput.focus(); editingCatalogInput.setSelectionRange(editingCatalogInput.value.length, editingCatalogInput.value.length); } });
document.addEventListener('pointercancel', () => { window.clearTimeout(pressTimer); editingCatalogInput = null; });
document.addEventListener('contextmenu', (event) => { if (event.target.classList.contains('catalog-name')) event.preventDefault(); });
function setDictationStatus(message, visible = true) { $('#dictation-status').textContent = message; $('#dictation-status').hidden = !visible; }
function startDictation() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { setDictationStatus('Dictée continue indisponible ici. Utilisez le micro du clavier.'); return; }
  if (!recognition) { recognition = new SpeechRecognition(); recognition.lang = 'fr-FR'; recognition.continuous = true; recognition.onresult = (event) => { for (let index = event.resultIndex; index < event.results.length; index += 1) if (event.results[index].isFinal) $('#items-input').value += `${$('#items-input').value ? ', ' : ''}${event.results[index][0].transcript}`; }; recognition.onend = () => { if (dictationWanted) try { recognition.start(); } catch {} }; }
  dictationWanted = true; $('#dictation-button').textContent = 'Arrêter'; $('#dictation-button').classList.add('listening'); setDictationStatus('Micro ouvert — dictez vos denrées.'); try { recognition.start(); } catch {}
}
function stopDictation() { dictationWanted = false; recognition?.stop(); $('#dictation-button').textContent = 'Dictée'; $('#dictation-button').classList.remove('listening'); setDictationStatus('', false); }
$('#refresh-button').onclick = () => window.location.reload();
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js'));
render();
