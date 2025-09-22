// DM Shared Panel — Web App (NUI)
// Adds dynamic Add-Modal with per-entity field specs (items, vehicles, weapons, jobs)

const state = {
  tab: 'items',
  data: { items:{}, jobs:{}, gangs:{}, vehicles:{}, weapons:{} },
  filteredKeys: [],
  selectedKey: null,
  format: 'json',
};

// ===== Field specs per entity =====
const fieldSpecs = {
  items: [
    { key:'name',        label:'name',        type:'text',     required:true,  placeholder:'advancedlockpick' },
    { key:'label',       label:'label',       type:'text',     required:true,  placeholder:'Advanced Lockpick' },
    { key:'weight',      label:'weight',      type:'number',   required:true,  min:0, step:1,  default:0 },
    { key:'type',        label:'type',        type:'text',     required:true,  default:'item' },
    { key:'image',       label:'image',       type:'text',     placeholder:'advancedlockpick.png' },
    { key:'unique',      label:'unique',      type:'checkbox', default:false },
    { key:'useable',     label:'useable',     type:'checkbox', default:true },
    { key:'shouldClose', label:'shouldClose', type:'checkbox', default:true },
    { key:'description', label:'description', type:'text',     placeholder:'...' },
  ],
  vehicles: [
    { key:'name',     label:'name',     type:'text',   required:true,  placeholder:'sultan' },
    { key:'brand',    label:'brand',    type:'text',   placeholder:'Karin' },
    { key:'model',    label:'model',    type:'text',   required:true,  placeholder:'Sultan' },
    { key:'price',    label:'price',    type:'number', required:true,  min:0, step:1 },
    { key:'category', label:'category', type:'text',   placeholder:'sedans' },
    { key:'hash',     label:'hash',     type:'text',   placeholder:'-295689028' },
  ],
  weapons: [
    { key:'name',        label:'name',        type:'text', required:true,  placeholder:'weapon_pistol' },
    { key:'label',       label:'label',       type:'text', required:true,  placeholder:'Pistol' },
    { key:'weapontype',  label:'weapontype',  type:'text', placeholder:'WEAPON_TYPE_PISTOL' },
    { key:'ammotype',    label:'ammotype',    type:'text', placeholder:'AMMO_PISTOL' },
    { key:'damagereason',label:'damagereason',type:'text', placeholder:'shot' },
  ],
  jobs: [
    { key:'label',       label:'label',       type:'text',     required:true,  placeholder:'Police' },
    { key:'defaultDuty', label:'defaultDuty', type:'checkbox', default:true },
    { key:'offDutyPay',  label:'offDutyPay',  type:'checkbox', default:false },
    { key:'name',        label:'name (optional)', type:'text', placeholder:'police' },
    { key:'grades',      label:'grades (JSON)', type:'textarea', required:true, placeholder:`{\n  "0": { "name": "recruit", "label": "Recruit", "payment": 50 },\n  "1": { "name": "officer", "label": "Officer", "payment": 75 }\n}` },
  ],
  default: [
    { key:'name',  label:'name',  type:'text' },
    { key:'label', label:'label', type:'text' },
  ],
};

// ===== Shortcuts =====
const el = (sel) => document.querySelector(sel);
const listEl = () => el('#list');
const keyInput = () => el('#fileKey');
const jsonTA = () => el('#jsonInput');
const gutter = () => el('#gutter');
const toastEl = () => el('#toast');

// Modal refs (injected if missing)
const addModal = () => el('#addModal');
const addForm  = () => el('#addForm');
const addKey   = () => el('#addKey');
const addFields= () => el('#addFields');
const addEntityLabel = () => el('#addEntityLabel');

// ===== Toast =====
function showToast(msg, ok=true){
  const t = toastEl();
  t.textContent = msg;
  t.classList.remove('hidden', 'ok', 'err');
  t.classList.add(ok ? 'ok' : 'err');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>t.classList.add('hidden'), 2200);
}

// ===== Tabs & List =====
function switchTab(tab){
  state.tab = tab;
  document.querySelectorAll('.tab').forEach(b=> b.classList.toggle('active', b.dataset.tab === tab));
  el('#fileEntity').textContent = tab;
  el('#fileExt').textContent = state.format === 'lua' ? '.lua' : '.json';
  renderList();
  state.selectedKey = null;
  keyInput().textContent = 'new_key';
  setText(state.format === 'lua' ? 'new_key = { }' : '{}');
  updateStatus();
}

function renderList(){
  const ul = listEl();
  ul.innerHTML = '';
  const obj = state.data[state.tab] || {};
  const q = (el('#search').value || '').toLowerCase().trim();
  const keys = Object.keys(obj).sort();
  const filtered = keys.filter(k => !q || k.toLowerCase().includes(q));
  state.filteredKeys = filtered;
  for(const k of filtered){
    const li = document.createElement('li');
    li.textContent = k;
    li.dataset.key = k;
    if(state.selectedKey === k) li.classList.add('active');
    li.addEventListener('click', ()=>{
      state.selectedKey = k;
      keyInput().textContent = k;
      try{
        const val = obj[k] ?? {};
        if(state.format === 'lua') setText(toLua(val, k)); else setText(JSON.stringify(val, null, 2));
      }catch(e){ setText(state.format === 'lua' ? 'new_key = { }' : '{}'); }
      renderList();
      updateStatus();
    });
    ul.appendChild(li);
  }
}

function currentEntity(){ return state.tab }

// ===== NUI Bridge =====
function sendNui(name, data={}){
  fetch(`https://dm-sharedpanel/${name}`, {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data)
  });
}

window.addEventListener('message', (e)=>{
  const m = e.data;
  if(!m || !m.type) return;
  if(m.type === 'open'){
    el('#app').classList.remove('hidden');
    sendNui('fetchAll', {});
  } else if(m.type === 'populate' || m.type === 'allData'){
    state.data = m.data || state.data;
    renderList();
  } else if(m.type === 'result'){
    const d = m.data || {};
    showToast((d.ok ? '✅ ' : '❌ ') + (d.message || (d.ok ? 'Done' : 'Error')), !!d.ok);
  }
});

// ===== Add Modal (DOM injection + logic) =====
function ensureAddModal(){
  if(addModal()) return;
  const wrapper = document.createElement('div');
  wrapper.id = 'addModal';
  wrapper.className = 'modal hidden';
  wrapper.innerHTML = `
    <form id="addForm" class="modal-card" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-title">Add <span id="addEntityLabel">items</span> entry</div>
        <button type="button" id="addCancelX" class="icon-btn" aria-label="Close">×</button>
      </div>
      <div class="modal-body">
        <label class="stack">
          <span class="lbl">Key (table key)</span>
          <input id="addKey" type="text" required placeholder="unique_key" />
        </label>
        <div id="addFields" class="fields"></div>
      </div>
      <div class="modal-footer">
        <button type="button" id="addCancelBtn" class="ghost">Cancel</button>
        <button type="submit" class="primary">Add</button>
      </div>
    </form>`;
  el('#app').appendChild(wrapper);

  // Wire close actions
  el('#addCancelBtn').addEventListener('click', closeAddModal);
  el('#addCancelX').addEventListener('click', closeAddModal);
  wrapper.addEventListener('click', (ev)=>{ if(ev.target === wrapper) closeAddModal(); });
  document.addEventListener('keydown', (ev)=>{ if(!addModal().classList.contains('hidden') && ev.key === 'Escape') closeAddModal(); });

  // Submit handler
  addForm().addEventListener('submit', (e)=>{
    e.preventDefault();
    const entity = state.tab;
    const key = (addKey().value || '').trim();
    if (!key) return showToast('Key required', false);
    try{
      const value = collectFormValue(entity);
      // reflect in editor immediately
      state.selectedKey = key;
      keyInput().textContent = key;
      setText(state.format === 'lua' ? toLua(value, key) : JSON.stringify(value, null, 2));
      doAction('add', key, value);
      closeAddModal();
    }catch(err){ showToast(String(err.message || err), false); }
  });
}

function createInputForSpec(spec){
  let input;
  if (spec.type === 'checkbox') {
    input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!spec.default;
  } else if (spec.type === 'number') {
    input = document.createElement('input');
    input.type = 'number';
    if (spec.min != null) input.min = spec.min;
    if (spec.step != null) input.step = spec.step;
    if (spec.default != null) input.value = spec.default;
    if (spec.placeholder) input.placeholder = spec.placeholder;
  } else if (spec.type === 'textarea') {
    input = document.createElement('textarea');
    input.rows = 6; input.spellcheck = false;
    input.value = spec.default != null ? spec.default : '';
    if (spec.placeholder) input.placeholder = spec.placeholder;
  } else {
    input = document.createElement('input');
    input.type = 'text';
    if (spec.default != null) input.value = spec.default;
    if (spec.placeholder) input.placeholder = spec.placeholder;
  }
  if (spec.required) input.required = true;
  input.dataset.key = spec.key;
  input.dataset.type = spec.type;
  return input;
}

function buildAddFields(entity){
  const specs = fieldSpecs[entity] || fieldSpecs.default;
  const host = addFields();
  host.innerHTML = '';
  for(const spec of specs){
    const row = document.createElement('label');
    row.className = 'stack';
    const span = document.createElement('span');
    span.className = 'lbl';
    span.textContent = spec.label;
    const input = createInputForSpec(spec);
    row.appendChild(span);
    row.appendChild(input);
    host.appendChild(row);
  }
}

function openAddModal(){
  ensureAddModal();
  const entity = state.tab;
  addEntityLabel().textContent = entity;
  addKey().value = 'new_key';
  buildAddFields(entity);
  addModal().classList.remove('hidden');
  setTimeout(()=> addKey().focus(), 0);
}

function closeAddModal(){
  if(!addModal()) return;
  addModal().classList.add('hidden');
  addForm().reset();
  addFields().innerHTML = '';
}

function collectFormValue(entity){
  const specs = fieldSpecs[entity] || fieldSpecs.default;
  const value = {};
  for (const spec of specs){
    const ctl = addForm().querySelector(`[data-key="${spec.key}"]`);
    if (!ctl) continue;
    let v;
    if (spec.type === 'checkbox') v = !!ctl.checked;
    else if (spec.type === 'number') v = ctl.value === '' ? null : Number(ctl.value);
    else v = ctl.value;

    if (spec.required && (v === '' || v === null || v === undefined)){
      throw new Error(`Missing required field: ${spec.label}`);
    }
    value[spec.key] = v;
  }

  if (entity === 'items'){
    // normalize types
    if (typeof value.weight === 'string' && value.weight !== '') value.weight = Number(value.weight) || 0;
  }

  if (entity === 'vehicles'){
    if (typeof value.price === 'string' && value.price !== '') value.price = Number(value.price) || 0;
  }

  if (entity === 'jobs'){
    if (typeof value.grades === 'string'){
      try { value.grades = JSON.parse(value.grades); }
      catch(e){ throw new Error('grades must be valid JSON'); }
    }
    if (!value.name || !value.name.trim()){
      value.name = (addKey().value || '').trim();
    }
  }

  return value;
}

// ===== Actions =====
function doAction(action, overrideKey, overrideValue){
  const entity = currentEntity();
  let k = (overrideKey != null) ? String(overrideKey) : (keyInput().textContent || '').trim();
  if(!k) return showToast('Key required', false);

  let value = null;
  if(action !== 'remove'){
    if (overrideValue !== undefined){
      value = overrideValue;
    } else {
      const txt = (jsonTA().value || '').trim() || (state.format === 'lua' ? `${k} = { }` : '{}');
      if(state.format === 'lua'){
        const res = parseLuaEditor(txt);
        if(!res.ok) return showToast('Lua parse error: ' + res.error, false);
        if(!k && res.key) { k = res.key; el('#fileKey').textContent = k; }
        value = res.value;
      } else {
        try { value = JSON.parse(txt); } catch(e){ return showToast('JSON invalid', false); }
      }
    }
  }

  sendNui('perform', { entity, action, key: k, value });
}

// ===== Format handling (JSON <-> Lua) =====
function jsToLuaValue(v){
  if(Array.isArray(v)) return '{ ' + v.map(jsToLuaValue).join(', ') + ' }';
  const t = typeof v;
  if(v === null) return 'nil';
  if(t === 'string') return `'${v.replace(/'/g, "\\'")}'`;
  if(t === 'number' || t === 'boolean') return String(v).toLowerCase();
  if(t === 'object'){
    const parts = [];
    for(const k of Object.keys(v)) parts.push(`${k} = ${jsToLuaValue(v[k])}`);
    return '{ ' + parts.join(', ') + ' }';
  }
  return 'nil';
}

function toLua(obj, key){
  try { return `${key} = ${jsToLuaValue(obj)}`; }
  catch(e){ return `${key} = { }`; }
}

function luaBodyToJsonText(lua){
  const inner = (function(){
    const s = (lua || '').trim();
    const eq = s.indexOf('=');
    const body = eq >= 0 ? s.slice(eq+1).trim() : s;
    const noTrail = body.replace(/[,;]\s*$/, '');
    const start = noTrail.indexOf('{');
    const end = noTrail.lastIndexOf('}');
    return (start >= 0 && end >= 0) ? noTrail.slice(start, end+1) : noTrail;
  })();
  let jsonish = inner;
  jsonish = jsonish.replace(/(\w+)\s*=\s/g, '"$1": ');
  jsonish = jsonish.replace(/'([^']*)'/g, '"$1"');
  jsonish = jsonish.replace(/\bnil\b/g, 'null');
  jsonish = jsonish.replace(/,\s*([}\]])/g, '$1');
  return jsonish;
}

function parseLuaEditor(text){
  try{
    let key = null;
    const m = text.match(/^(\s*([\w_]+)\s*=)/);
    if(m && m[2]) key = m[2];
    const jsonish = luaBodyToJsonText(text);
    const value = JSON.parse(jsonish);
    return { ok:true, key, value };
  }catch(e){ return { ok:false, error: String(e && e.message || e) }; }
}

// ===== Code editor helpers (line numbers & cursor status) =====
function setText(text){ jsonTA().value = text; syncGutter(); }
function countLines(str){ return ((str || '').match(/\n/g) || []).length + 1; }
function syncGutter(){
  const ta = jsonTA();
  const lines = countLines(ta.value);
  const g = gutter();
  let html = '';
  for(let i=1;i<=lines;i++) html += `<div>${i}</div>`;
  g.innerHTML = html; g.scrollTop = ta.scrollTop;
}
function updateStatus(){
  const ta = jsonTA();
  const pos = ta.selectionStart || 0;
  const text = ta.value || '';
  let line = 1, col = 1;
  for(let i=0;i<pos;i++){ if(text[i] === '\n'){ line++; col = 1; } else { col++; } }
  el('#status-left').textContent = state.format.toUpperCase();
  el('#status-center').textContent = state.selectedKey ? 'Editing' : 'Ready';
  el('#status-right').textContent = `Ln ${line}, Col ${col}   Spaces: 2   UTF-8   LF`;
}

// ===== Events =====
document.addEventListener('DOMContentLoaded', ()=>{
  ensureAddModal();

  // Tabs
  document.querySelectorAll('.tab').forEach(b=> b.addEventListener('click', ()=> switchTab(b.dataset.tab)));
  // Search
  el('#search').addEventListener('input', renderList);
  // Buttons
  el('#addBtn').addEventListener('click', openAddModal);
  el('#updateBtn').addEventListener('click', ()=>doAction('update'));
  el('#removeBtn').addEventListener('click', ()=>doAction('remove'));
  el('#refreshBtn').addEventListener('click', ()=> sendNui('fetchAll', {}));
  // Close button (NUI)
  el('#closeBtn').addEventListener('click', () => {
    sendNui('close', {});
    el('#app').classList.add('hidden');
  });

  // Editor events
  jsonTA().addEventListener('input', ()=>{ syncGutter(); updateStatus(); });
  jsonTA().addEventListener('scroll', ()=>{ gutter().scrollTop = jsonTA().scrollTop; });
  jsonTA().addEventListener('click', updateStatus);
  jsonTA().addEventListener('keyup', updateStatus);

  // Initial
  switchTab('items');

  // Format switch
  document.getElementById('fmtSelect').addEventListener('change', (e)=>{
    state.format = e.target.value;
    el('#fileExt').textContent = state.format === 'lua' ? '.lua' : '.json';
    const obj = state.data[state.tab] || {};
    const k = state.selectedKey;
    if(k && obj[k] !== undefined){
      const val = obj[k];
      setText(state.format === 'lua' ? toLua(val, k) : JSON.stringify(val, null, 2));
    } else {
      setText(state.format === 'lua' ? 'new_key = { }' : '{}');
    }
    updateStatus();
  });

  setText(state.format === 'lua' ? 'new_key = { }' : '{}');
  updateStatus();
});
