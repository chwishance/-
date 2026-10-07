// ===== js/storage.js =====
// 全站共享的数据读写层

export const STORAGE_KEY = 'pyraminx_formula_app_v1';

/** 读取全部金字塔模块状态 */
export function loadModules() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error('[存储] 读取失败:', err);
        return [];
    }
}

/** 覆盖保存全部金字塔模块状态 */
export function saveModules(modules) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(modules));
    } catch (err) {
        console.error('[存储] 保存失败:', err);
    }
}

/** 取出现过的所有分组名（去重 + 排序） */
export function getAllGroups(modules) {
    const set = new Set();
    modules.forEach((m) => {
        const g = (m.group || '').trim();
        if (g) set.add(g);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
}

/** 只保留填写了公式的模块（练习用） */
export function getPracticeModules(modules) {
    return modules.filter((m) => m.formula && m.formula.trim());
}

/* ============================================================
 *  三阶魔方专用存储（与金字塔完全隔离）
 * ============================================================ */
const STORAGE_KEY_3X3 = 'cube3_formula_app_v1';

export function load3x3Modules() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_3X3);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error('[存储-3x3] 读取失败:', err);
        return [];
    }
}

export function save3x3Modules(modules) {
    try {
        localStorage.setItem(STORAGE_KEY_3X3, JSON.stringify(modules));
    } catch (err) {
        console.error('[存储-3x3] 保存失败:', err);
    }
}

export function getAll3x3Groups(modules) {
    const set = new Set();
    modules.forEach((m) => {
        const g = (m.group || '').trim();
        if (g) set.add(g);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));
}

export function get3x3PracticeModules(modules) {
    return modules.filter((m) => m.formula && m.formula.trim());
}

/* ============================================================
 *  三阶 FMC 专用存储（独立于普通三阶）
 * ============================================================ */
const STORAGE_KEY_FMC = 'cube3_fmc_formula_app_v1';

export function loadFMCModules() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_FMC);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.error('[存储-FMC] 读取失败:', err);
        return [];
    }
}

export function saveFMCModules(modules) {
    try {
        localStorage.setItem(STORAGE_KEY_FMC, JSON.stringify(modules));
    } catch (err) {
        console.error('[存储-FMC] 保存失败:', err);
    }
}