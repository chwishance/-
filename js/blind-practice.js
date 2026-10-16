// ===== js/blind-practice.js =====
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadBlindModules } from './storage.js';
import { buildCube3x3Group } from './3x3-module.js';

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
    disabledGroups: new Set(),
    mainGroup: 'corner',
    settings: {
        drawMode: 'random',
        practiceMode: '1',
        showGroupTag: true,
        showNote: true,
        show3D: true,
    },
};

const els = {};

/* ============================================================
 *  启动
 * ============================================================ */
document.addEventListener('DOMContentLoaded', init);

function init() {
    els.empty       = document.getElementById('practice-empty');
    els.content     = document.getElementById('practice-content');
    els.progress    = document.getElementById('practice-progress');
    els.nameEl      = document.getElementById('practice-name');
    els.groupTag    = document.getElementById('practice-group-tag');
    els.formula     = document.getElementById('practice-formula');
    els.revealBtn   = document.getElementById('btn-reveal');
    els.nextBtn     = document.getElementById('btn-next');
    els.startBtn    = document.getElementById('btn-start');
    els.groupFilter = document.getElementById('user-group-filter');
    els.canvasHost  = document.getElementById('practice-canvas');
    els.showGroupCb = document.getElementById('show-group-tag');
    els.showNoteCb  = document.getElementById('show-note');
    els.show3DCb    = document.getElementById('show-3d');
    els.container   = document.querySelector('.practice-container');

    // 主分类
    document.querySelectorAll('input[name="mainGroup"]').forEach((el) => {
        el.addEventListener('change', () => {
            if (!el.checked) return;
            state.mainGroup = el.value;
            state.disabledGroups.clear();
            refreshPool();
            if (!els.content.hidden) {
                if (!state.viewer) initViewer();
                drawNext();
            }
        });
    });

    // 抽取方式
    document.querySelectorAll('input[name="drawMode"]').forEach((el) => {
        el.addEventListener('change', () => {
            if (el.checked) {
                state.settings.drawMode = el.value;
                state.seqIndex = 0;
                updateProgress();
            }
        });
    });

    // 练习模式
    document.querySelectorAll('input[name="practiceMode"]').forEach((el) => {
        el.addEventListener('change', () => {
            if (el.checked) {
                state.settings.practiceMode = el.value;
                updateFormulaPanel();
            }
        });
    });

    // 显示分组
    els.showGroupCb.checked = state.settings.showGroupTag;
    els.showGroupCb.addEventListener('change', () => {
        state.settings.showGroupTag = els.showGroupCb.checked;
        updateGroupTag();
    });

    // 显示备注
    els.showNoteCb.checked = state.settings.showNote;
    els.showNoteCb.addEventListener('change', () => {
        state.settings.showNote = els.showNoteCb.checked;
        updateFormulaPanel();
    });

    // 显示 3D
    els.show3DCb.checked = state.settings.show3D;
    els.show3DCb.addEventListener('change', () => {
        state.settings.show3D = els.show3DCb.checked;
        applyShow3D();
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
    state.allModules = loadBlindModules();
    renderGroupFilter();
    refreshPool();

    if (!els.content.hidden) {
        initViewer();
        drawNext();
    }
}

/* ============================================================
 *  3D 显示 / 隐藏
 * ============================================================ */
function applyShow3D() {
    els.container.classList.toggle('hide-3d', !state.settings.show3D);
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
        }, 60);
    });
}

/* ============================================================
 *  公式池
 * ============================================================ */
function refreshPool() {
    state.allModules = loadBlindModules();
    renderGroupFilter();

    // 按主分类筛选
    const byMain = state.allModules.filter(
        (m) => (m.mainGroup || 'corner') === state.mainGroup
    );
    // 必须有公式
    const withFormula = byMain.filter((m) => m.formula && m.formula.trim());

    let pool = withFormula;
    if (state.disabledGroups.size > 0) {
        pool = withFormula.filter((m) => {
            const g = (m.userGroup || '').trim();
            if (!g) return true;  // 无分组始终包含
            return !state.disabledGroups.has(g);
        });
    }

    state.pool = pool;

    if (pool.length === 0) {
        showEmpty(withFormula.length === 0
            ? '当前分类下还没有填写公式的条目。<br>请先到「公式集」页添加并填写公式。'
            : '当前分组筛选后没有公式。<br>请在左侧勾选至少一个分组。');
        return;
    }

    els.empty.hidden = true;
    els.content.hidden = false;
}

/* 只列出当前主分类下的用户分组 */
function renderGroupFilter() {
    els.groupFilter.innerHTML = '';
    const set = new Set();
    state.allModules.forEach((m) => {
        if ((m.mainGroup || 'corner') !== state.mainGroup) return;
        const g = (m.userGroup || '').trim();
        if (g) set.add(g);
    });
    const groups = Array.from(set).sort((a, b) => a.localeCompare(b, 'zh'));

    if (groups.length === 0) {
        const p = document.createElement('p');
        p.className = 'muted';
        p.textContent = '当前分类下暂无分组';
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
 *  抽取
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
    updateName();
    updateGroupTag();
    updateFormulaPanel();
    updateViewerModel(m.stickerColors || {});
}

/* ============================================================
 *  渲染子模块
 * ============================================================ */
function updateProgress() {
    const total = state.pool.length;
    if (state.settings.drawMode === 'sequential') {
        const cur = ((state.seqIndex - 1) % total + total) % total + 1;
        els.progress.textContent = `顺序 ${cur} / ${total}`;
    } else {
        els.progress.textContent = `随机 · 共 ${total} 项`;
    }
}

function updateName() {
    const m = state.current;
    if (!m) { els.nameEl.textContent = ''; return; }
    els.nameEl.textContent = (m.title || '').trim() || '未命名';
}

function updateGroupTag() {
    const m = state.current;
    if (!m || !state.settings.showGroupTag) {
        els.groupTag.hidden = true;
        return;
    }
    const g = (m.userGroup || '').trim();
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
        const f = escapeHtml(m.formula || '');
        const noteHtml =
            state.settings.showNote && m.note && m.note.trim()
                ? `<div class="formula-note">${escapeHtml(m.note)}</div>`
                : '';
        els.formula.innerHTML = `<div class="formula-display">${f}</div>${noteHtml}`;
        els.revealBtn.hidden = true;
    } else {
        const tip = state.settings.showNote && m.note && m.note.trim()
            ? '点击「显示公式」查看'
            : '点击「显示公式」查看';
        els.formula.innerHTML = `<div class="formula-hidden">${tip}</div>`;
        els.revealBtn.hidden = false;
    }
}

/* ============================================================
 *  3D 查看器
 * ============================================================ */
function initViewer() {
    const host = els.canvasHost;
    const w = host.clientWidth || 320;
    const h = host.clientHeight || 320;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#FCFAF5');

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(4.6, 4.2, 4.8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.enablePan = false;
    controls.minDistance = 4.5;
    controls.maxDistance = 14;
    controls.rotateSpeed = 0.85;
    controls.target.set(0, 0, 0);
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const d1 = new THREE.DirectionalLight(0xffffff, 0.75);
    d1.position.set(6, 10, 8); scene.add(d1);
    const d2 = new THREE.DirectionalLight(0xfff4e0, 0.42);
    d2.position.set(-7, 4, -8); scene.add(d2);
    const d3 = new THREE.DirectionalLight(0xffffff, 0.22);
    d3.position.set(0, -8, 3); scene.add(d3);

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

function updateViewerModel(stickerColors) {
    const v = state.viewer;
    if (!v) return;
    if (v.modelGroup) {
        v.scene.remove(v.modelGroup);
        disposeObject(v.modelGroup);
        v.modelGroup = null;
    }
    const group = buildCube3x3Group(stickerColors);
    v.scene.add(group);
    v.modelGroup = group;
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