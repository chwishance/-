// ===== js/blind.js =====
import { BlindCubeModule, BLIND_MAIN_GROUPS } from './blind-module.js';
import {
    loadBlindModules, saveBlindModules,
    loadBlindUIPrefs, saveBlindUIPrefs,
} from './storage.js';

const appEl = document.getElementById('app');
const filterMainEl = document.getElementById('filter-main');
const subFilterBar = document.getElementById('sub-filter-bar');
const subFilterContent = document.getElementById('sub-filter-content');
const btnAddTop = document.getElementById('btn-add-top');
const btnAddBottom = document.getElementById('btn-add-bottom');
const btnExport = document.getElementById('btn-export');
const btnToggle3D = document.getElementById('btn-toggle-3d');
const fileImport = document.getElementById('file-import');

let modules = [];

/* ---------- 状态 ---------- */
let activeMain = 'corner';
let selectedGroups = new Set();   // 空 = 不筛选
let hide3D = false;

/* ---------- 持久化 ---------- */
function persist() {
    saveBlindModules(modules.map((m) => m.serialize()));
    renderMainChips();
    renderSubFilter();
    applyFilter();
}

function createModule(state) {
    const mod = new BlindCubeModule(state, persist, handleDelete);
    modules.push(mod);
    appEl.appendChild(mod.element);
    mod.mount();
    applyFilter();
    return mod;
}

function handleDelete(id) {
    const idx = modules.findIndex((m) => m.id === id);
    if (idx === -1) return;
    modules[idx].destroy();
    modules.splice(idx, 1);
    persist();
}

/* ============================================================
 *  主分类筛选
 * ============================================================ */
function renderMainChips() {
    filterMainEl.innerHTML = '';
    BLIND_MAIN_GROUPS.forEach((g) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-chip' + (activeMain === g.key ? ' active' : '');
        btn.textContent = g.label;
        btn.addEventListener('click', () => {
            if (activeMain === g.key) return;
            activeMain = g.key;
            selectedGroups.clear();
            renderMainChips();
            renderSubFilter();
            applyFilter();
        });
        filterMainEl.appendChild(btn);
    });
}

/* ============================================================
 *  子分组筛选
 * ============================================================ */
function getGroupsForMain(mainKey) {
    const set = new Set();
    modules.forEach((m) => {
        if (m.mainGroup === mainKey) {
            const g = (m.userGroup || '').trim();
            if (g) set.add(g);
        }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
}

function renderSubFilter() {
    subFilterBar.hidden = false;
    subFilterContent.innerHTML = '';

    const groups = getGroupsForMain(activeMain);
    if (groups.length === 0) {
        const tip = document.createElement('span');
        tip.className = 'filter-sub-tip';
        tip.textContent = '暂无分组。新建后填写「分组」字段即可筛选。';
        subFilterContent.appendChild(tip);
        return;
    }

    // 控制条
    const controls = document.createElement('div');
    controls.className = 'filter-sub-controls';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.className = 'sub-chip sub-chip-action';
    selectAllBtn.textContent = '全选';
    selectAllBtn.addEventListener('click', () => {
        selectedGroups = new Set(groups);
        renderSubFilter();
        applyFilter();
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'sub-chip sub-chip-action';
    clearBtn.textContent = '清空';
    clearBtn.addEventListener('click', () => {
        selectedGroups.clear();
        renderSubFilter();
        applyFilter();
    });

    controls.appendChild(selectAllBtn);
    controls.appendChild(clearBtn);
    subFilterContent.appendChild(controls);

    const sep = document.createElement('span');
    sep.className = 'filter-sub-sep';
    subFilterContent.appendChild(sep);

    groups.forEach((g) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'sub-chip' + (selectedGroups.has(g) ? ' active' : '');
        chip.textContent = g;
        chip.addEventListener('click', () => {
            if (selectedGroups.has(g)) selectedGroups.delete(g);
            else selectedGroups.add(g);
            chip.classList.toggle('active');
            applyFilter();
        });
        subFilterContent.appendChild(chip);
    });
}

/* ============================================================
 *  应用筛选
 * ============================================================ */
function applyFilter() {
    modules.forEach((mod) => {
        mod.element.style.display = matchesFilter(mod) ? '' : 'none';
    });
}

function matchesFilter(mod) {
    if (mod.mainGroup !== activeMain) return false;
    if (selectedGroups.size === 0) return true;
    return selectedGroups.has((mod.userGroup || '').trim());
}

/* ============================================================
 *  隐藏 / 显示 3D
 * ============================================================ */
function applyHide3D() {
    document.body.classList.toggle('hide-3d', hide3D);
    if (btnToggle3D) {
        btnToggle3D.textContent = hide3D ? '显示 3D' : '隐藏 3D';
    }
    requestAnimationFrame(() => {
        setTimeout(() => modules.forEach((m) => m.resize()), 60);
    });
}

btnToggle3D.addEventListener('click', () => {
    hide3D = !hide3D;
    applyHide3D();
    const prefs = loadBlindUIPrefs();
    prefs.hide3D = hide3D;
    saveBlindUIPrefs(prefs);
});

/* ============================================================
 *  导入 / 导出
 * ============================================================ */
function exportData() {
    const data = modules.map((m) => m.serialize());
    if (data.length === 0) {
        alert('当前没有可导出的盲拧公式。');
        return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `blind-formulas-${stamp}.json`;
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
        activeMain = 'corner';
        selectedGroups.clear();

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

/* ============================================================
 *  事件
 * ============================================================ */
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

/* ============================================================
 *  启动
 * ============================================================ */
function init() {
    const prefs = loadBlindUIPrefs();
    hide3D = !!prefs.hide3D;
    applyHide3D();

    const states = loadBlindModules();
    if (states.length === 0) {
        createModule(null);
        persist();
    } else {
        states.forEach((s) => createModule(s));
    }
    renderMainChips();
    renderSubFilter();
    applyFilter();
}
init();