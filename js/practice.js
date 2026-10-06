// ===== js/practice.js =====
import * as THREE from 'three';
import { loadModules, getAllGroups, getPracticeModules, loadUIPrefs, updateUIPref } from './storage.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadModules, getAllGroups, getPracticeModules } from './storage.js';
import { buildPyraminxGroup, buildUnfoldSVG } from './pyraminx-module.js';

/* ============================================================
 *  状态
 * ============================================================ */
const state = {
    allModules: [],
    pool: [],
    seqIndex: 0,
    current: null,
    revealed: false,
    viewer: null,
    disabledGroups: new Set(),   // 被排除的分组
    settings: {
        drawMode: 'random',      // 'random' | 'sequential'
        practiceMode: '1',       // '1' | '2'
        showGroupTag: true,
        showUnfold: true,
    },
};

const els = {};

/* ============================================================
 *  启动
 * ============================================================ */
document.addEventListener('DOMContentLoaded', init);

function init() {
    // DOM 引用
    els.empty         = document.getElementById('practice-empty');
    els.content       = document.getElementById('practice-content');
    els.progress      = document.getElementById('practice-progress');
    els.groupTag      = document.getElementById('practice-group-tag');
    els.formula       = document.getElementById('practice-formula');
    els.revealBtn     = document.getElementById('btn-reveal');
    els.nextBtn       = document.getElementById('btn-next');
    els.startBtn      = document.getElementById('btn-start');
    els.groupFilter   = document.getElementById('group-filter');
    els.canvasHost    = document.getElementById('practice-canvas');
    els.svgHost       = document.getElementById('practice-svg');
    els.showGroupCb   = document.getElementById('show-group-tag');
els.showUnfoldCb = document.getElementById('show-unfold');
els.container = document.querySelector('.practice-container');
    // 设置：抽取方式
    document.querySelectorAll('input[name="drawMode"]').forEach((el) => {
        el.addEventListener('change', () => {
            if (el.checked) {
                state.settings.drawMode = el.value;
                state.seqIndex = 0;
                updateProgress();
            }
        });
    });

    // 设置：练习模式
    document.querySelectorAll('input[name="practiceMode"]').forEach((el) => {
        el.addEventListener('change', () => {
            if (el.checked) {
                state.settings.practiceMode = el.value;
                updateFormulaPanel();
            }
        });
    });

    // 设置：显示分组
    els.showGroupCb.checked = state.settings.showGroupTag;
    els.showGroupCb.addEventListener('change', () => {
        state.settings.showGroupTag = els.showGroupCb.checked;
        updateGroupTag();
    });

    // 显示 / 隐藏展开图
const prefs = loadUIPrefs();
state.settings.showUnfold = prefs.showUnfoldPyraminx !== false; // 默认 true
els.showUnfoldCb.checked = state.settings.showUnfold;
applyUnfoldVisibility();

els.showUnfoldCb.addEventListener('change', () => {
    state.settings.showUnfold = els.showUnfoldCb.checked;
    applyUnfoldVisibility();
    updateUIPref('showUnfoldPyraminx', state.settings.showUnfold);
});

    // 按钮
    els.revealBtn.addEventListener('click', () => {
        state.revealed = true;
        updateFormulaPanel();
    });

    els.nextBtn.addEventListener('click', () => {
        if (state.pool.length === 0) return;
        drawNext();
    });

    els.startBtn.addEventListener('click', () => {
        state.seqIndex = 0;
        refreshPool();
        if (!els.content.hidden) {
            if (!state.viewer) initViewer();
            drawNext();
        }
    });

    // 加载
    state.allModules = loadModules();
    renderGroupFilter();
    refreshPool();

    if (!els.content.hidden) {
        initViewer();
        drawNext();
    }
}

/* ============================================================
 *  公式池刷新
 * ============================================================ */
function refreshPool() {
    state.allModules = loadModules();
    renderGroupFilter();

    const withFormula = getPracticeModules(state.allModules);
    let pool = withFormula;

    if (state.disabledGroups.size > 0) {
        pool = withFormula.filter((m) => {
            const g = (m.group || '').trim();
            if (!g) return true;                    // 未分组始终包含
            return !state.disabledGroups.has(g);    // 未被排除的保留
        });
    }

    state.pool = pool;

    if (pool.length === 0) {
        showEmpty(withFormula.length === 0
            ? '公式集中还没有填写公式。<br>请先到「公式集」页添加并填写公式。'
            : '当前分组筛选后没有公式。<br>请在左侧勾选至少一个分组。');
        return;
    }

    els.empty.hidden = true;
    els.content.hidden = false;
}

function renderGroupFilter() {
    els.groupFilter.innerHTML = '';
    const groups = getAllGroups(state.allModules);

    if (groups.length === 0) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = '暂无分组（在公式集中可为每个公式填写分组）';
        els.groupFilter.appendChild(p);
        return;
    }

    groups.forEach((g) => {
        const label = document.createElement('label');
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !state.disabledGroups.has(g);
        cb.value = g;
        cb.addEventListener('change', () => {
            if (cb.checked) state.disabledGroups.delete(g);
            else state.disabledGroups.add(g);
            refreshPool();
            if (!els.content.hidden) {
                if (!state.viewer) initViewer();
                drawNext();
            }
        });
        label.appendChild(cb);
        label.appendChild(document.createTextNode(g));
        els.groupFilter.appendChild(label);
    });
}

function showEmpty(html) {
    els.empty.innerHTML = `<p>${html}</p>`;
    els.empty.hidden = false;
    els.content.hidden = true;
}

/* ============================================================
 *  抽取逻辑
 * ============================================================ */
function drawNext() {
    const pool = state.pool;
    if (pool.length === 0) return;

    let next;
    if (state.settings.drawMode === 'random') {
        if (pool.length === 1) {
            next = pool[0];
        } else {
            let tries = 0;
            do {
                next = pool[Math.floor(Math.random() * pool.length)];
                tries++;
            } while (next === state.current && tries < 12);
        }
    } else {
        next = pool[state.seqIndex % pool.length];
        state.seqIndex++;
    }

    state.current = next;
    state.revealed = false;
    renderCurrent();
}

function renderCurrent() {
    const m = state.current;
    if (!m) return;
    updateProgress();
    updateGroupTag();
    updateFormulaPanel();
    updateViewerModel(m.stickerColors || {});
    updateUnfoldSVG(m.stickerColors || {});
}

/* ============================================================
 *  渲染子模块
 * ============================================================ */
function updateProgress() {
    const total = state.pool.length;
    if (state.settings.drawMode === 'sequential') {
        const cur = ((state.seqIndex - 1) % total + total) % total + 1;
        els.progress.textContent = `顺序抽取 · 第 ${cur} / ${total} 个`;
    } else {
        els.progress.textContent = `随机抽取 · 共 ${total} 个公式`;
    }
}

function updateGroupTag() {
    const m = state.current;
    if (!m || !state.settings.showGroupTag) {
        els.groupTag.hidden = true;
        return;
    }
    const g = (m.group || '').trim();
    if (!g) {
        els.groupTag.hidden = true;
        return;
    }
    els.groupTag.textContent = g;
    els.groupTag.hidden = false;
}

function updateFormulaPanel() {
    const m = state.current;
    if (!m) return;

    if (state.settings.practiceMode === '2' || state.revealed) {
        els.formula.innerHTML = `<div class="formula-display">${escapeHtml(m.formula)}</div>`;
        els.revealBtn.hidden = true;
    } else {
        els.formula.innerHTML = `<div class="formula-hidden">点击「显示公式」查看</div>`;
        els.revealBtn.hidden = false;
    }
}

function updateViewerModel(stickerColors) {
    const v = state.viewer;
    if (!v) return;
    if (v.modelGroup) {
        v.scene.remove(v.modelGroup);
        disposeObject(v.modelGroup);
        v.modelGroup = null;
    }
    const group = buildPyraminxGroup(stickerColors);
    v.scene.add(group);
    v.modelGroup = group;
}

function updateUnfoldSVG(stickerColors) {
    els.svgHost.innerHTML = '';
    const { svg } = buildUnfoldSVG(stickerColors);   // ← 解构出 svg
    els.svgHost.appendChild(svg);
}

/* ============================================================
 *  查看器（Three.js，只初始化一次）
 * ============================================================ */
function initViewer() {
    const host = els.canvasHost;
    const w = host.clientWidth || 320;
    const h = host.clientHeight || 300;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#FCFAF5');

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(2.15, 1.85, 2.85);
    camera.lookAt(0, 0.05, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.enablePan = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 8;
    controls.rotateSpeed = 0.85;
    controls.target.set(0, 0.05, 0);
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.82));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.72); d1.position.set(5, 9, 7); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xfff4e0, 0.42); d2.position.set(-6, 3, -7); scene.add(d2);
    const d3 = new THREE.DirectionalLight(0xffffff, 0.25); d3.position.set(0, -8, 2); scene.add(d3);

    const viewer = {
        scene, camera, renderer, controls,
        modelGroup: null,
        animId: null,
        ro: null,
    };
    state.viewer = viewer;

    function loop() {
        viewer.animId = requestAnimationFrame(loop);
        controls.update();
        renderer.render(scene, camera);
    }
    loop();

    if (typeof ResizeObserver !== 'undefined') {
        viewer.ro = new ResizeObserver(() => {
            const w2 = host.clientWidth;
            const h2 = host.clientHeight;
            if (w2 === 0 || h2 === 0) return;
            camera.aspect = w2 / h2;
            camera.updateProjectionMatrix();
            renderer.setSize(w2, h2);
        });
        viewer.ro.observe(host);
    }
}
function applyUnfoldVisibility() {
    els.container.classList.toggle('hide-unfold', !state.settings.showUnfold);

    // 展开图区域宽度变化后，需要重新计算 3D 视口
    requestAnimationFrame(() => {
        setTimeout(() => {
            const v = state.viewer;
            if (!v || !els.canvasHost) return;
            const w = els.canvasHost.clientWidth;
            const h = els.canvasHost.clientHeight;
            if (!w || !h) return;
            v.camera.aspect = w / h;
            v.camera.updateProjectionMatrix();
            v.renderer.setSize(w, h);
        }, 40);
    });
}
/* ============================================================
 *  工具
 * ============================================================ */
function disposeObject(obj) {
    if (!obj) return;
    if (obj.children && obj.children.length) {
        [...obj.children].forEach(disposeObject);
    }
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[c]);
}
