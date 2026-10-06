// ===== js/pyraminx.js =====
import { PyraminxModule } from './pyraminx-module.js';
import { loadModules, saveModules } from './storage.js';
import { PyraminxModule } from './pyraminx-module.js';
import { loadModules, saveModules, loadUIPrefs, updateUIPref } from './storage.js';

const appEl = document.getElementById('app');
const btnAddTop = document.getElementById('btn-add-top');
const btnAddBottom = document.getElementById('btn-add-bottom');
const btnExport = document.getElementById('btn-export');
const fileImport = document.getElementById('file-import');

let modules = [];

function persist() {
    saveModules(modules.map((m) => m.serialize()));
}

function createModule(state) {
    const mod = new PyraminxModule(state, persist, handleDelete);
    modules.push(mod);
    appEl.appendChild(mod.element);
    mod.mount();
    return mod;
}

function handleDelete(id) {
    const idx = modules.findIndex((m) => m.id === id);
    if (idx === -1) return;
    modules[idx].destroy();
    modules.splice(idx, 1);
    persist();
}

/* ---------- 导入 / 导出 ---------- */
function exportData() {
    const data = modules.map((m) => m.serialize());
    if (data.length === 0) {
        alert('当前没有可导出的金字塔模块。');
        return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `pyraminx-formulas-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function importData(file) {
    if (!file) return;
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('JSON 顶层必须是数组');

        modules.forEach((m) => m.destroy());
        modules = [];
        appEl.innerHTML = '';

        data.forEach((state) => createModule(state));
        persist();

        if (data.length === 0) {
            createModule(null);
            persist();
        }
    } catch (err) {
        console.error('[导入] 失败:', err);
        alert('导入失败：文件格式不正确。\n' + err.message);
    }
}

/* ---------- 事件 ---------- */
btnAddTop.addEventListener('click', () => { createModule(null); persist(); });

btnAddBottom.addEventListener('click', () => {
    createModule(null);
    persist();
    const last = appEl.lastElementChild;
    if (last) last.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

btnExport.addEventListener('click', exportData);

fileImport.addEventListener('change', (e) => {
    importData(e.target.files && e.target.files[0]);
    e.target.value = '';
});

let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => modules.forEach((m) => m.resize()), 120);
});

/* ---------- 启动 ---------- */
function init() {
    const states = loadModules();
    if (states.length === 0) {
        createModule(null);
        persist();
    } else {
        states.forEach((s) => createModule(s));
    }
}
init();
