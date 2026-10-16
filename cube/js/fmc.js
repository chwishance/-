// ===== js/fmc.js =====
import {
    FMCCubeModule,
    FMC_GROUPS,
    EO_BAD_EDGES,
    DR_C_RANGE,
    DR_E_RANGE,
    HTR_TAGS,
    FR_TAGS,
} from './fmc-module.js';
import { loadFMCModules, saveFMCModules } from './storage.js';

const appEl = document.getElementById('app');
const filterMainEl = document.getElementById('filter-main');
const subFilterBar = document.getElementById('sub-filter-bar');
const subFilterLabel = document.getElementById('sub-filter-label');
const subFilterContent = document.getElementById('sub-filter-content');
const btnAddTop = document.getElementById('btn-add-top');
const btnAddBottom = document.getElementById('btn-add-bottom');
const btnExport = document.getElementById('btn-export');
const fileImport = document.getElementById('file-import');

let modules = [];

/* ---------- 筛选状态 ----------
 * 默认：主分组 = EO，子分类全部为空（不筛选）
 * 空集合 = 显示该主分组下的全部
 * 非空集合 = 只显示匹配的
 */
const filter = {
    mainGroup: 'EO',
    eo: new Set(),
    drC: new Set(),
    drE: new Set(),
    htr: new Set(),
    fr: new Set(),
    tech: new Set(),
};

/* ---------- 持久化 ---------- */
function persist() {
    saveFMCModules(modules.map((m) => m.serialize()));
    renderMainChips();
    renderSubFilter();
    applyFilter();
}

function createModule(state) {
    const mod = new FMCCubeModule(state, persist, handleDelete);
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
 *  主分组筛选栏
 * ============================================================ */
function renderMainChips() {
    filterMainEl.innerHTML = '';
    if (!FMC_GROUPS.includes(filter.mainGroup)) {
        filter.mainGroup = FMC_GROUPS[0];
    }
    FMC_GROUPS.forEach((g) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-chip' + (filter.mainGroup === g ? ' active' : '');
        btn.textContent = g;
        btn.addEventListener('click', () => {
            if (filter.mainGroup === g) return;
            filter.mainGroup = g;
            renderMainChips();
            renderSubFilter();
            applyFilter();
        });
        filterMainEl.appendChild(btn);
    });
}

/* ============================================================
 *  子分类筛选栏
 * ============================================================ */
function renderSubFilter() {
    subFilterBar.hidden = false;
    subFilterLabel.textContent = filter.mainGroup + ' 子分类';
    subFilterContent.innerHTML = '';

    // 控制条：全选 / 清空
    const controls = document.createElement('div');
    controls.className = 'filter-sub-controls';

    const selectAllBtn = document.createElement('button');
    selectAllBtn.type = 'button';
    selectAllBtn.className = 'sub-chip sub-chip-action';
    selectAllBtn.textContent = '全选';
    selectAllBtn.addEventListener('click', () => {
        selectAllSub();
        renderSubFilter();
        applyFilter();
    });

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'sub-chip sub-chip-action';
    clearBtn.textContent = '清空';
    clearBtn.addEventListener('click', () => {
        clearSub();
        renderSubFilter();
        applyFilter();
    });

    controls.appendChild(selectAllBtn);
    controls.appendChild(clearBtn);
    subFilterContent.appendChild(controls);

    // 分隔符
    const sep = document.createElement('span');
    sep.className = 'filter-sub-sep';
    subFilterContent.appendChild(sep);

    // 各主分组的子 chips
    if (filter.mainGroup === 'EO') {
        EO_BAD_EDGES.forEach((v) => {
            subFilterContent.appendChild(makeSubChip(
                `${v} 坏棱`,
                filter.eo.has(v),
                (on) => {
                    if (on) filter.eo.add(v); else filter.eo.delete(v);
                    applyFilter();
                }
            ));
        });
        return;
    }

    if (filter.mainGroup === 'DR') {
        const g1 = document.createElement('div');
        g1.className = 'filter-sub-group';
        const l1 = document.createElement('span');
        l1.className = 'filter-sub-label';
        l1.textContent = 'c:';
        g1.appendChild(l1);
        DR_C_RANGE.forEach((v) => {
            g1.appendChild(makeSubChip(String(v), filter.drC.has(v), (on) => {
                if (on) filter.drC.add(v); else filter.drC.delete(v);
                applyFilter();
            }));
        });
        subFilterContent.appendChild(g1);

        const g2 = document.createElement('div');
        g2.className = 'filter-sub-group';
        const l2 = document.createElement('span');
        l2.className = 'filter-sub-label';
        l2.textContent = 'e:';
        g2.appendChild(l2);
        DR_E_RANGE.forEach((v) => {
            g2.appendChild(makeSubChip(String(v), filter.drE.has(v), (on) => {
                if (on) filter.drE.add(v); else filter.drE.delete(v);
                applyFilter();
            }));
        });
        subFilterContent.appendChild(g2);
        return;
    }

    if (filter.mainGroup === 'HTR') {
        HTR_TAGS.forEach((v) => {
            subFilterContent.appendChild(makeSubChip(v, filter.htr.has(v), (on) => {
                if (on) filter.htr.add(v); else filter.htr.delete(v);
                applyFilter();
            }));
        });
        return;
    }

    if (filter.mainGroup === 'FR') {
        FR_TAGS.forEach((v) => {
            subFilterContent.appendChild(makeSubChip(v, filter.fr.has(v), (on) => {
                if (on) filter.fr.add(v); else filter.fr.delete(v);
                applyFilter();
            }));
        });
        return;
    }

    if (filter.mainGroup === 'TECH') {
        const techs = getAllTechNames();
        if (techs.length === 0) {
            const tip = document.createElement('span');
            tip.className = 'filter-sub-tip';
            tip.textContent = '暂无技巧分类。新建 TECH 条目并在模态里填写「技巧名」后，这里会出现可筛选的标签。';
            subFilterContent.appendChild(tip);
            return;
        }
        techs.forEach((v) => {
            subFilterContent.appendChild(makeSubChip(v, filter.tech.has(v), (on) => {
                if (on) filter.tech.add(v); else filter.tech.delete(v);
                applyFilter();
            }));
        });
        return;
    }
}

/* ---------- 全选 / 清空 ---------- */
function selectAllSub() {
    const g = filter.mainGroup;
    if (g === 'EO') filter.eo = new Set(EO_BAD_EDGES);
    else if (g === 'DR') {
        filter.drC = new Set(DR_C_RANGE);
        filter.drE = new Set(DR_E_RANGE);
    }
    else if (g === 'HTR') filter.htr = new Set(HTR_TAGS);
    else if (g === 'FR') filter.fr = new Set(FR_TAGS);
    else if (g === 'TECH') filter.tech = new Set(getAllTechNames());
}

function clearSub() {
    const g = filter.mainGroup;
    if (g === 'EO') filter.eo = new Set();
    else if (g === 'DR') {
        filter.drC = new Set();
        filter.drE = new Set();
    }
    else if (g === 'HTR') filter.htr = new Set();
    else if (g === 'FR') filter.fr = new Set();
    else if (g === 'TECH') filter.tech = new Set();
}

/* ---------- TECH 技巧名收集 ---------- */
function getAllTechNames() {
    const set = new Set();
    modules.forEach((m) => {
        if (m.mainGroup === 'TECH') {
            const t = ((m.meta && m.meta.tech) || '').trim();
            if (t) set.add(t);
        }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
}

function makeSubChip(label, checked, onChange) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sub-chip' + (checked ? ' active' : '');
    chip.textContent = label;
    chip.addEventListener('click', () => {
        const now = !chip.classList.contains('active');
        chip.classList.toggle('active', now);
        onChange(now);
    });
    return chip;
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
    if (mod.mainGroup !== filter.mainGroup) return false;
    const m = mod.meta || {};

    if (mod.mainGroup === 'EO') {
        if (filter.eo.size === 0) return true;
        return filter.eo.has(m.badEdges);
    }
    if (mod.mainGroup === 'DR') {
        const okC = filter.drC.size === 0 || filter.drC.has(m.c);
        const okE = filter.drE.size === 0 || filter.drE.has(m.e);
        return okC && okE;
    }
    if (mod.mainGroup === 'HTR') {
        if (filter.htr.size === 0) return true;
        return filter.htr.has(m.htr);
    }
    if (mod.mainGroup === 'FR') {
        if (filter.fr.size === 0) return true;
        const tags = m.frTags || [];
        return tags.some((t) => filter.fr.has(t));
    }
    if (mod.mainGroup === 'TECH') {
        if (filter.tech.size === 0) return true;
        return filter.tech.has((m.tech || '').trim());
    }
    return true;
}

/* ============================================================
 *  导入 / 导出
 * ============================================================ */
function exportData() {
    const data = modules.map((m) => m.serialize());
    if (data.length === 0) {
        alert('当前没有可导出的 FMC 公式。');
        return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `fmc-formulas-${stamp}.json`;
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

        // 重置筛选
        filter.mainGroup = FMC_GROUPS[0];
        filter.eo = new Set();
        filter.drC = new Set();
        filter.drE = new Set();
        filter.htr = new Set();
        filter.fr = new Set();
        filter.tech = new Set();

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
    const states = loadFMCModules();
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