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

/* ===== UI 偏好（跨页面共享） ===== */

const UI_PREFS_KEY = 'pyraminx_ui_prefs_v1';

export function loadUIPrefs() {
    try {
        const raw = localStorage.getItem(UI_PREFS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (err) {
        console.error('[偏好] 读取失败:', err);
        return {};
    }
}

export function saveUIPrefs(prefs) {
    try {
        localStorage.setItem(UI_PREFS_KEY, JSON.stringify(prefs));
    } catch (err) {
        console.error('[偏好] 保存失败:', err);
    }
}

/** 便捷：更新单个偏好字段 */
export function updateUIPref(key, value) {
    const prefs = loadUIPrefs();
    prefs[key] = value;
    saveUIPrefs(prefs);
}
