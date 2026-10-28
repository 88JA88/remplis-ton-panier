const STORAGE_KEY = 'liste-courses-v3';
const PRICE_DRAFT_KEY = 'liste-courses-price-draft-v1';
const PRICE_HISTORY_KEY = 'liste-courses-price-history-v1';
const PRICE_ARTICLE_KEY = 'liste-courses-price-article-v1';
const KEY_FIELDS_STORAGE_KEY = 'liste-courses-key-fields-v1';
const STARTER_CATALOG = ['Pain', 'Lait', 'Œufs', 'Beurre', 'Fruits', 'Légumes', 'Pâtes', 'Riz', 'Café', 'Eau'];
const $ = (selector) => document.querySelector(selector);
let recognition = null;
let dictationWanted = false;
let state = loadState();
let previousView = 'selection';
const emptyPriceOffers = () => Array.from({ length: 3 }, (_, index) => ({ id: index + 1, count: 1, price: '', content: '', unit: '' }));
function loadPriceOffers() {
  try {
    const stored = JSON.parse(localStorage.getItem(PRICE_DRAFT_KEY));
    if (!Array.isArray(stored) || stored.length !== 3) return emptyPriceOffers();
    return stored.map((offer, index) => ({ id: index + 1, count: Number(offer.count) > 0 ? offer.count : 1, price: offer.price || '', content: offer.content || '', unit: ['kg', 'g', 'l', 'cl'].includes(offer.unit) ? offer.unit : '' }));
  } catch { return emptyPriceOffers(); }
}
function loadPriceHistory() { try { const stored = JSON.parse(localStorage.getItem(PRICE_HISTORY_KEY)); return Array.isArray(stored) ? stored : []; } catch { return []; } }
let priceOffers = loadPriceOffers();
let priceHistory = loadPriceHistory();
let priceArticleName = localStorage.getItem(PRICE_ARTICLE_KEY) || '';
let keyFields = loadKeyFields();
function savePriceDraft() { localStorage.setItem(PRICE_DRAFT_KEY, JSON.stringify(priceOffers)); }
function setPriceArticleName(name) { priceArticleName = name || ''; localStorage.setItem(PRICE_ARTICLE_KEY, priceArticleName); }
function loadKeyFields() { try { const stored = JSON.parse(localStorage.getItem(KEY_FIELDS_STORAGE_KEY)); return Array.isArray(stored) ? Array.from({ length: 5 }, (_, index) => String(stored[index] || '')) : Array(5).fill(''); } catch { return Array(5).fill(''); } }
function renderKeyFields() { document.querySelectorAll('[data-key-field]').forEach((input) => { input.value = keyFields[Number(input.dataset.keyField)] || ''; }); }
function saveKeyFields() { localStorage.setItem(KEY_FIELDS_STORAGE_KEY, JSON.stringify(keyFields)); }

function makeId() { return crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`; }
function loadState() {
  try {
    const storedState = localStorage.getItem(STORAGE_KEY);
    if (!storedState) return { catalog: STARTER_CATALOG.map((text) => ({ id: makeId(), text, selected: false, column: 'left' })), items: [] };
    const saved = JSON.parse(storedState);
    if (saved?.catalog) {
      const catalog = saved.catalog.map((item) => ({ ...item, column: item.column === 'right' ? 'right' : 'left' }));
      const migrated = { ...saved, catalog };
      if (saved.catalog.some((item) => !item.column)) localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    const oldItems = saved?.items || [];
    return { catalog: oldItems.map((item) => ({ id: item.id || makeId(), text: item.text, selected: !item.bought, column: 'left' })), items: [] };
  } catch { return { catalog: [], items: [] }; }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); render(); }
function escapeHtml(value) { return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function splitItems(text) { return text.replace(/\bvirgules?\b/gi, ',').replace(/\bà la ligne\b/gi, '\n').split(/[,;\n]+/).map((item) => item.trim()).filter(Boolean); }

function addItems(column = 'left') {
  splitItems($('#items-input').value).forEach((text) => {
    if (!state.catalog.some((item) => item.text.toLocaleLowerCase() === text.toLocaleLowerCase())) state.catalog.push({ id: makeId(), text, selected: true, column });
  });
  $('#items-input').value = '';
  save();
}
function showView(view) {
  if (view !== 'price') previousView = view;
  $('#selection-view').hidden = view !== 'selection';
  $('#courses-view').hidden = view !== 'courses';
  $('#price-view').hidden = view !== 'price';
  $('#selection-header').hidden = view !== 'selection';
  $('#selection-nav').hidden = view !== 'selection';
  document.querySelectorAll('.view-button').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  if (view === 'price') renderPriceComparator();
}
function euro(value) { return `${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`; }
function unitKind(unit) { return ['kg', 'g'].includes(unit) ? 'weight' : ['l', 'cl'].includes(unit) ? 'volume' : ''; }
function comparisonKind() { return unitKind(priceOffers.find((offer) => offer.unit)?.unit || ''); }
function priceResult(offer) {
  const count = Number(offer.count);
  const price = Number(String(offer.price).replace(',', '.'));
  const content = Number(String(offer.content).replace(',', '.'));
  if (!Number.isFinite(count) || count <= 0 || !Number.isFinite(price) || price < 0) return '<span class="result-placeholder">Renseignez le prix</span>';
  const kind = unitKind(offer.unit);
  if (!kind || !Number.isFinite(content) || content <= 0) return '<span class="result-placeholder">Renseignez le poids ou volume</span>';
  const baseContent = offer.unit === 'kg' || offer.unit === 'l' ? content * 1000 : offer.unit === 'cl' ? content * 10 : content;
  const perBase = price / (count * baseContent) * 1000;
  const smallUnit = kind === 'weight' ? '100 g' : '100 ml';
  const largeUnit = kind === 'weight' ? 'kg' : 'L';
  const perSmall = price / (count * baseContent) * 100;
  return `<strong>${euro(perBase)}</strong> <span>par ${largeUnit}</span><small>${euro(perSmall)} / ${smallUnit}</small>`;
}
function priceResultText(offer) {
  const count = Number(offer.count);
  const price = Number(String(offer.price).replace(',', '.'));
  const content = Number(String(offer.content).replace(',', '.'));
  const kind = unitKind(offer.unit);
  if (!kind || !Number.isFinite(count) || count <= 0 || !Number.isFinite(price) || price < 0 || !Number.isFinite(content) || content <= 0) return 'Données incomplètes';
  const baseContent = offer.unit === 'kg' || offer.unit === 'l' ? content * 1000 : offer.unit === 'cl' ? content * 10 : content;
  return `${euro(price / (count * baseContent) * 1000)} / ${kind === 'weight' ? 'kg' : 'L'}`;
}
function renderPriceHistory() {
  $('#price-history-list').innerHTML = priceHistory.length ? priceHistory.map((entry, historyIndex) => {
    const filledOffers = entry.offers.map((offer, index) => ({ offer, index })).filter(({ offer }) => offer.price !== '' || offer.content !== '' || offer.unit);
    return `<article class="history-entry"><div><strong>${escapeHtml(entry.label)}</strong><button class="delete-history-button" data-history-index="${historyIndex}" type="button">Supprimer</button></div><ul>${filledOffers.map(({ offer, index }) => `<li>Offre ${index + 1} — ${escapeHtml(String(offer.count))} article${Number(offer.count) > 1 ? 's' : ''} × ${escapeHtml(String(offer.content))} ${escapeHtml(offer.unit)} : <b>${escapeHtml(priceResultText(offer))}</b></li>`).join('') || '<li>Données incomplètes</li>'}</ul></article>`;
  }).join('') : '<p class="empty-history">Aucune comparaison mémorisée pour le moment.</p>';
}
function savePriceComparison() {
  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(now);
  const label = `${priceArticleName ? `${priceArticleName} — ` : ''}Comparaison du ${dateLabel}`;
  priceHistory.unshift({ label, date: now.toISOString(), article: priceArticleName, offers: priceOffers.map((offer) => ({ ...offer })) });
  priceHistory = priceHistory.slice(0, 20);
  localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(priceHistory));
  renderPriceHistory();
}
function renderPriceComparator() {
  $('#price-article-name').textContent = priceArticleName ? `— ${priceArticleName}` : '';
  const kind = comparisonKind();
  const units = (offer) => {
    const options = [['kg', 'kg'], ['g', 'g'], ['l', 'L'], ['cl', 'cl']];
    return `<option value="" ${!offer.unit ? 'selected' : ''} disabled>Unité</option>${options.map(([value, label]) => `<option value="${value}" ${offer.unit === value ? 'selected' : ''} ${kind && unitKind(value) !== kind ? 'disabled' : ''}>${label}</option>`).join('')}`;
  };
  const lockNotice = kind ? `<p class="unit-lock">Comparaison verrouillée : ${kind === 'weight' ? 'poids' : 'volume'} <button id="reset-unit-lock" type="button">Changer</button></p>` : '<p class="unit-lock">Choisissez une unité : le comparateur gardera ensuite le même type pour les trois offres.</p>';
  $('#price-offers').innerHTML = `${lockNotice}<div class="price-offer-grid">${priceOffers.map((offer, index) => `<article class="price-offer"><h3>Offre ${index + 1}</h3><label>Nombre d’articles<input data-price-field="count" data-offer="${index}" type="number" inputmode="decimal" min="1" step="1" required value="${offer.count}"></label><label>Poids ou volume par article<span class="content-input"><input data-price-field="content" data-offer="${index}" type="text" inputmode="decimal" placeholder="ex. 125" value="${escapeHtml(String(offer.content))}"><select data-price-field="unit" data-offer="${index}">${units(offer)}</select></span></label><label>Prix payé (€)<input data-price-field="price" data-offer="${index}" type="text" inputmode="decimal" placeholder="ex. 4,80" value="${escapeHtml(String(offer.price))}"></label><div class="price-result" aria-live="polite"><span>Prix équivalent</span><div>${priceResult(offer)}</div></div></article>`).join('')}</div>`;
  renderPriceHistory();
}
function itemRow(item, bought) {
  return `<div class="item-row${bought ? ' bought-row' : ''}"><input class="item-checkbox" data-id="${item.id}" aria-label="${bought ? 'Remettre' : 'Marquer comme acheté'} : ${escapeHtml(item.text)}" type="checkbox" ${bought ? 'checked' : ''}><span class="course-name" data-id="${item.id}">${escapeHtml(item.text)}</span><input class="note-text" data-id="${item.id}" aria-label="Précision pour ${escapeHtml(item.text)}" value="${escapeHtml(item.note || '')}"></div>`;
}
function render() {
  const catalog = [...state.catalog].sort((a, b) => a.text.localeCompare(b.text, 'fr', { sensitivity: 'base' }));
  const catalogRows = (column) => {
    let previousLetter = '';
    return catalog.filter((item) => item.column === column).map((item) => {
      const letter = item.text.charAt(0).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('fr-FR');
      const newLetter = letter !== previousLetter;
      previousLetter = letter;
      const destination = column === 'left' ? 'right' : 'left';
      const label = destination === 'right' ? 'Déplacer à droite' : 'Déplacer à gauche';
      const button = destination === 'right' ? 'D' : 'G';
      return `<div class="catalog-item${newLetter ? ' alphabet-break' : ''}"><input type="checkbox" data-catalog-id="${item.id}" ${item.selected ? 'checked' : ''}><span class="catalog-name" data-catalog-id="${item.id}">${escapeHtml(item.text)}</span><input class="catalog-text" data-catalog-id="${item.id}" aria-label="Modifier ${escapeHtml(item.text)}" value="${escapeHtml(item.text)}" hidden><button class="catalog-column-button" data-catalog-id="${item.id}" aria-label="${label} : ${escapeHtml(item.text)}">${button}</button><button class="catalog-delete" data-catalog-id="${item.id}" aria-label="Supprimer ${escapeHtml(item.text)}">×</button></div>`;
    }).join('');
  };
  $('#catalog-list').innerHTML = `<div class="catalog-column">${catalogRows('left')}</div><div class="catalog-column">${catalogRows('right')}</div>`;
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

$('#add-left').onclick = () => addItems('left');
$('#add-right').onclick = () => addItems('right');
$('#items-input').onkeydown = (event) => { if (event.key === 'Enter') { event.preventDefault(); addItems(); } };
$('#validate-selection').onclick = () => { const selected = state.catalog.filter((item) => item.selected); state.items = selected.map((item) => ({ id: makeId(), text: item.text, note: '', bought: false })); save(); showView('courses'); };
$('#help-button').onclick = () => { $('#help-window').hidden = false; };
$('#courses-help-button').onclick = () => { $('#help-window').hidden = false; };
$('#back-to-selection').onclick = () => showView('selection');
$('#close-price-compare').onclick = () => showView(previousView);
$('#open-price-compare').onclick = () => { setPriceArticleName(''); showView('price'); };
$('#save-price-comparison').onclick = savePriceComparison;
$('#help-close').onclick = () => { $('#help-window').hidden = true; };
$('#help-window').onclick = (event) => { if (event.target.id === 'help-window') $('#help-window').hidden = true; };
$('#key-button').onclick = () => { renderKeyFields(); $('#key-window').hidden = false; $('#key-window [data-key-field="0"]').focus(); };
$('#key-close').onclick = () => { $('#key-window').hidden = true; };
$('#key-window').onclick = (event) => { if (event.target.id === 'key-window') $('#key-window').hidden = true; };
function downloadBackup(file) { const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = file.name; link.click(); window.setTimeout(() => URL.revokeObjectURL(link.href), 1000); }
$('#backup-button').onclick = async () => {
  const date = new Date().toISOString().slice(0, 10);
  const file = new File([JSON.stringify({ catalog: state.catalog, keyFields }, null, 2)], `remplis-ton-panier-denrees-${date}.json`, { type: 'application/json' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Sauvegarde Remplis ton panier' }); return; }
    catch (error) { if (error.name === 'AbortError') return; }
  }
  downloadBackup(file);
};
$('#restore-input').onchange = async (event) => { const file = event.target.files[0]; if (!file) return; try { const saved = JSON.parse(await file.text()); if (Array.isArray(saved.catalog)) { state.catalog = saved.catalog.filter((item) => item && item.text).map((item) => ({ id: item.id || makeId(), text: String(item.text), selected: Boolean(item.selected), column: item.column === 'right' ? 'right' : 'left' })); if (Array.isArray(saved.keyFields)) { keyFields = Array.from({ length: 5 }, (_, index) => String(saved.keyFields[index] || '')); saveKeyFields(); } save(); } } catch { alert('Ce fichier de sauvegarde est invalide.'); } event.target.value = ''; };
document.querySelectorAll('.view-button').forEach((button) => { button.onclick = () => showView(button.dataset.view); });
$('#new-list').onclick = () => { state.catalog.forEach((item) => { item.selected = false; }); save(); showView('selection'); };
$('#confirm-no').onclick = () => { $('#confirm-new').hidden = true; };
$('#confirm-yes').onclick = () => { state.catalog.forEach((item) => { item.selected = false; }); $('#confirm-new').hidden = true; save(); showView('selection'); };
document.addEventListener('change', (event) => {
  if (event.target.dataset.catalogId) { const item = state.catalog.find((entry) => entry.id === event.target.dataset.catalogId); item.selected = event.target.checked; save(); }
  if (event.target.classList.contains('catalog-text')) { const item = state.catalog.find((entry) => entry.id === event.target.dataset.catalogId); const text = event.target.value.trim(); if (!text) { if (window.confirm(`Supprimer « ${item.text} » ?`)) { state.catalog = state.catalog.filter((entry) => entry.id !== item.id); save(); } else render(); } else { item.text = text; save(); } }
  if (event.target.classList.contains('item-checkbox')) {
    const item = state.items.find((entry) => entry.id === event.target.dataset.id);
    if (event.target.checked) {
      event.target.closest('.item-row').classList.add('checking');
      window.setTimeout(() => { item.bought = true; save(); }, 550);
    } else { item.bought = false; save(); }
  }
  if (event.target.classList.contains('item-text')) { const item = state.items.find((entry) => entry.id === event.target.dataset.id); const text = event.target.value.trim(); if (!text) state.items = state.items.filter((entry) => entry.id !== item.id); else item.text = text; save(); }
  if (event.target.classList.contains('note-text')) { const item = state.items.find((entry) => entry.id === event.target.dataset.id); item.note = event.target.value; save(); }
  if (event.target.dataset.priceField) {
    const offer = priceOffers[Number(event.target.dataset.offer)];
    offer[event.target.dataset.priceField] = event.target.value;
    savePriceDraft();
    renderPriceComparator();
  }
});
document.addEventListener('input', (event) => {
  if (event.target.dataset.keyField) { keyFields[Number(event.target.dataset.keyField)] = event.target.value; saveKeyFields(); return; }
  if (!event.target.dataset.priceField) return;
  const offer = priceOffers[Number(event.target.dataset.offer)];
  offer[event.target.dataset.priceField] = event.target.value;
  savePriceDraft();
  if (event.target.dataset.priceField !== 'type' && event.target.dataset.priceField !== 'unit') {
    const result = event.target.closest('.price-offer').querySelector('.price-result > div');
    result.innerHTML = priceResult(offer);
  }
});
document.addEventListener('click', (event) => {
  if (event.target.id === 'reset-unit-lock') { priceOffers.forEach((offer) => { offer.unit = ''; }); savePriceDraft(); renderPriceComparator(); }
  if (event.target.classList.contains('delete-history-button')) {
    const historyIndex = Number(event.target.dataset.historyIndex);
    if (Number.isInteger(historyIndex) && window.confirm('Supprimer cette comparaison mémorisée ?')) {
      priceHistory.splice(historyIndex, 1);
      localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(priceHistory));
      renderPriceHistory();
    }
  }
  if (event.target.classList.contains('catalog-name')) { if (longPressActive) { longPressActive = false; return; } const item = state.catalog.find((entry) => entry.id === event.target.dataset.catalogId); item.selected = !item.selected; save(); }
  if (event.target.classList.contains('catalog-column-button')) { const item = state.catalog.find((entry) => entry.id === event.target.dataset.catalogId); if (item) { item.column = item.column === 'right' ? 'left' : 'right'; save(); } }
  if (event.target.classList.contains('course-name')) { const item = state.items.find((entry) => entry.id === event.target.dataset.id); item.bought = !item.bought; save(); }
  if (event.target.classList.contains('catalog-delete')) { const item = state.catalog.find((entry) => entry.id === event.target.dataset.catalogId); if (item && window.confirm(`Supprimer « ${item.text} » ?`)) { state.catalog = state.catalog.filter((entry) => entry.id !== item.id); save(); } }
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
