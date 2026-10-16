// ===== js/pyraminx.js =====
import { PyraminxModule } from './pyraminx-module.js';
import { loadModules, saveModules } from './storage.js';

const appEl = document.getElementById('app');
const filterChipsEl = document.getElementById('filter-chips');
const btnAddTop = document.getElementById('btn-add-top');
const btnAddBottom = document.getElementById('btn-add-bottom');
const btnExport = document.getElementById('btn-export');
const fileImport = document.getElementById('file-import');

/* 筛选状态：
 *   '__ALL__'        = 全部
 *   '__UNGROUPED__'  = 未分组
 *   其他字符串       = 具体分组名
 */
let activeGroup = '__ALL__';
let modules = [];

/* ---------- 持久化 ---------- */
function persist() {
    saveModules(modules.map((m) => m.serialize()));
    renderFilterBar();
    applyFilter();
}

/* ---------- 创建 / 删除 ---------- */
function createModule(state) {
    const mod = new PyraminxModule(state, persist, handleDelete);
    modules.push(mod);
    appEl.appendChild(mod.element);
    mod.mount();
    applyFilter();   // 新模块立即遵守当前筛选
    return mod;
}

function handleDelete(id) {
    const idx = modules.findIndex((m) => m.id === id);
    if (idx === -1) return;
    modules[idx].destroy();
    modules.splice(idx, 1);
    persist();
}

/* ---------- 筛选 ---------- */
function renderFilterBar() {
    if (!filterChipsEl) return;

    // 收集所有分组（去重 + 排序）
    const set = new Set();
    modules.forEach((m) => {
        const g = (m.group || '').trim();
        if (g) set.add(g);
    });
    const groups = Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
    const hasUngrouped = modules.some((m) => !(m.group || '').trim());

    // 生成 chip 列表
    const chips = [{ key: '__ALL__', label: '全部' }];
    groups.forEach((g) => chips.push({ key: g, label: g }));
    if (hasUngrouped) chips.push({ key: '__UNGROUPED__', label: '未分组' });

    // 如果当前激活的组已不存在（例如用户删掉了所有属于该组的模块），回退到"全部"
    if (!chips.some((c) => c.key === activeGroup)) {
        activeGroup = '__ALL__';
    }

    // 重建 chips
    filterChipsEl.innerHTML = '';
    chips.forEach((c) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-chip' + (activeGroup === c.key ? ' active' : '');
        btn.textContent = c.label;
        btn.addEventListener('click', () => {
            if (activeGroup === c.key) return;
            activeGroup = c.key;
            renderFilterBar();
            applyFilter();
        });
        filterChipsEl.appendChild(btn);
    });
}

function applyFilter() {
    modules.forEach((m) => {
        const g = (m.group || '').trim();
        let show = true;

        if (activeGroup === '__ALL__') {
            show = true;
        } else if (activeGroup === '__UNGROUPED__') {
            show = !g;
        } else {
            show = g === activeGroup;
        }

        m.element.style.display = show ? '' : 'none';
    });
}

/* ---------- 导入 / 导出 ---------- */
function exportData() {
    const data = modules.map((m) => m.serialize());
    if (data.length === 0) {
        alert('当前没有可导出的金字塔模块。');
        return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
    });
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
        activeGroup = '__ALL__';   // 导入后重置筛选

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
btnAddTop.addEventListener('click', () => {
    createModule(null);
    persist();
});

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

/* ---------- 全局 resize ---------- */
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
    renderFilterBar();
    applyFilter();
}
init();