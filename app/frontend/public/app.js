const API_URL = '/api';

const $ = (id) => document.getElementById(id);

function showMessage(text, isError = false) {
  const el = $('message');
  el.textContent = text;
  el.className = isError ? 'error' : 'success';
}

async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json' };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Erreur ${res.status}`);
  }
  return data;
}

const get = (url) => api(url);
const post = (url, body) => api(url, { method: 'POST', body: JSON.stringify(body) });
const patch = (url, body) => api(url, { method: 'PATCH', body: JSON.stringify(body) });

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function emptyRow(columns, text) {
  const tr = document.createElement('tr');
  const td = cell(text);
  td.colSpan = columns;
  td.className = 'empty';
  tr.append(td);
  return tr;
}

function renderParcelles(parcelles) {
  const body = $('parcelles-body');
  body.replaceChildren();
  if (parcelles.length === 0) {
    body.append(emptyRow(5, 'Aucune parcelle pour le moment.'));
  }
  parcelles.forEach((p) => {
    const tr = document.createElement('tr');

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'small danger';
    deleteButton.textContent = 'Supprimer';
    deleteButton.addEventListener('click', () => deleteParcelle(p));
    const actionCell = document.createElement('td');
    actionCell.append(deleteButton);

    tr.append(cell(p.id), cell(p.nom), cell(p.surface_ha), cell(p.culture), actionCell);
    body.append(tr);
  });

  const select = $('a-parcelle');
  select.replaceChildren();
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Choisir une parcelle';
  select.append(placeholder);
  parcelles.forEach((p) => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = `${p.nom} (n° ${p.id})`;
    select.append(option);
  });
}

function renderArrosages(arrosages) {
  const body = $('arrosages-body');
  body.replaceChildren();
  if (arrosages.length === 0) {
    body.append(emptyRow(7, 'Aucun arrosage planifié.'));
  }
  arrosages.forEach((a) => {
    const tr = document.createElement('tr');

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.step = '0.01';
    input.value = a.volume_reel_l ?? '';
    input.setAttribute('aria-label', `Consommation réelle de l'arrosage ${a.id}`);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'small';
    button.textContent = 'Enregistrer';
    button.addEventListener('click', () => saveReal(a.id, input.value));

    const box = document.createElement('div');
    box.className = 'reel-box';
    box.append(input, button);
    const reelCell = document.createElement('td');
    reelCell.append(box);

    const ecart =
      a.volume_reel_l === null
        ? '—'
        : (Number(a.volume_reel_l) - Number(a.volume_l)).toFixed(2);

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'small danger';
    deleteButton.textContent = 'Supprimer';
    deleteButton.addEventListener('click', () => deleteArrosage(a));
    const actionCell = document.createElement('td');
    actionCell.append(deleteButton);

    tr.append(
      cell(a.date_arrosage),
      cell(a.parcelle_nom),
      cell(a.duree_min),
      cell(a.volume_l),
      reelCell,
      cell(ecart),
      actionCell
    );
    body.append(tr);
  });
}

async function loadParcelles() {
  renderParcelles(await get(`${API_URL}/parcelles`));
}

async function loadArrosages() {
  renderArrosages(await get(`${API_URL}/arrosages`));
}

async function refresh() {
  try {
    await Promise.all([loadParcelles(), loadArrosages()]);
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function deleteParcelle(parcelle) {
  const question = `Supprimer la parcelle « ${parcelle.nom} » et tous ses arrosages ?`;
  if (!window.confirm(question)) return;
  try {
    await api(`${API_URL}/parcelles/${parcelle.id}`, { method: 'DELETE' });
    showMessage(`Parcelle « ${parcelle.nom} » supprimée.`);
    await Promise.all([loadParcelles(), loadArrosages()]);
  } catch (err) {
    showMessage(err.message, true);
  }
}

async function deleteArrosage(arrosage) {
  const question = `Supprimer l'arrosage du ${arrosage.date_arrosage} (${arrosage.parcelle_nom}) ?`;
  if (!window.confirm(question)) return;
  try {
    await api(`${API_URL}/arrosages/${arrosage.id}`, { method: 'DELETE' });
    showMessage('Arrosage supprimé.');
    await loadArrosages();
  } catch (err) {
    showMessage(err.message, true);
  }
}
async function saveReal(id, value) {
  if (value === '') {
    showMessage('Saisissez le volume réellement consommé.', true);
    return;
  }
  try {
    await patch(`${API_URL}/arrosages/${id}`, { volume_reel_l: Number(value) });
    showMessage('Consommation réelle enregistrée.');
    await loadArrosages();
  } catch (err) {
    showMessage(err.message, true);
  }
}

$('parcelle-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const parcelle = await post(`${API_URL}/parcelles`, {
      nom: $('p-nom').value.trim(),
      surface_ha: Number($('p-surface').value),
      culture: $('p-culture').value.trim(),
    });
    showMessage(`Parcelle « ${parcelle.nom} » créée.`);
    e.target.reset();
    await loadParcelles();
  } catch (err) {
    showMessage(err.message, true);
  }
});

$('arrosage-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const arrosage = await post(`${API_URL}/arrosages`, {
      parcelle_id: Number($('a-parcelle').value),
      date_arrosage: $('a-date').value,
      duree_min: Number($('a-duree').value),
      volume_l: Number($('a-volume').value),
    });
    showMessage(`Arrosage planifié le ${arrosage.date_arrosage}.`);
    e.target.reset();
    await loadArrosages();
  } catch (err) {
    showMessage(err.message, true);
  }
});

refresh();