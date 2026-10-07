// ===== js/3x3-module.js =====
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ============================================================
 *  三阶魔方几何常量
 *  世界坐标：+x 右 / +y 上 / +z 前
 *  颜色：U 白 / D 黄 / F 绿 / B 蓝 / R 红 / L 橙
 * ============================================================ */

export const FACES_3X3 = [
    {
        key: 'U', defaultColor: '#FFFFFF',
        normal: [0, 1, 0], localU: [1, 0, 0], localV: [0, 0, -1],
    },
    {
        key: 'D', defaultColor: '#F5C518',
        normal: [0, -1, 0], localU: [1, 0, 0], localV: [0, 0, 1],
    },
    {
        key: 'F', defaultColor: '#2FA84F',
        normal: [0, 0, 1], localU: [1, 0, 0], localV: [0, 1, 0],
    },
    {
        key: 'B', defaultColor: '#3B7DD8',
        normal: [0, 0, -1], localU: [-1, 0, 0], localV: [0, 1, 0],
    },
    {
        key: 'R', defaultColor: '#E6392E',
        normal: [1, 0, 0], localU: [0, 0, -1], localV: [0, 1, 0],
    },
    {
        key: 'L', defaultColor: '#FF8C1A',
        normal: [-1, 0, 0], localU: [0, 0, 1], localV: [0, 1, 0],
    },
];

export const PALETTE_3X3 = [
    '#2FA84F', '#E6392E', '#3B7DD8', '#F5C518',
    '#FF8C1A', '#FFFFFF', '#1A1A1A', '#808080',
];

/** 取贴纸颜色（含默认色） */
export function getSticker3x3Color(stickerColors, faceKey, idx) {
    const key = `${faceKey}-${idx}`;
    if (stickerColors && stickerColors[key]) return stickerColors[key];
    const face = FACES_3X3.find((f) => f.key === faceKey);
    return face ? face.defaultColor : '#808080';
}

/* ============================================================
 *  构建 3D 三阶魔方
 * ============================================================ */
export function buildCube3x3Group(stickerColors) {
    const group = new THREE.Group();
    const clickable = [];

    // 27 个小立方体（含中心，简化代码）
    const cubieGeom = new THREE.BoxGeometry(0.94, 0.94, 0.94);
    const cubieMat = new THREE.MeshStandardMaterial({
        color: 0x1A1A1A,
        roughness: 0.75,
        metalness: 0.08,
    });

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const cubie = new THREE.Mesh(cubieGeom, cubieMat);
                cubie.position.set(x, y, z);
                group.add(cubie);
            }
        }
    }

    // 54 个贴纸
    const stickerGeom = new THREE.PlaneGeometry(0.84, 0.84);
    const zAxis = new THREE.Vector3(0, 0, 1);
    const FACE_DIST = 1.5 + 0.01;

    FACES_3X3.forEach((face) => {
        const n = new THREE.Vector3(...face.normal);
        const lu = new THREE.Vector3(...face.localU);
        const lv = new THREE.Vector3(...face.localV);
        const center = n.clone().multiplyScalar(FACE_DIST);
        const quat = new THREE.Quaternion().setFromUnitVectors(zAxis, n);

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const idx = row * 3 + col;
                const u = col - 1;
                const v = 1 - row;
                const pos = center.clone()
                    .addScaledVector(lu, u)
                    .addScaledVector(lv, v);

                const colorHex = getSticker3x3Color(stickerColors, face.key, idx);
                const c = new THREE.Color(colorHex);

                const mat = new THREE.MeshStandardMaterial({
                    color: c.clone(),
                    emissive: c.clone().multiplyScalar(0.07),
                    roughness: 0.38,
                    metalness: 0.05,
                    side: THREE.DoubleSide,
                });

                const mesh = new THREE.Mesh(stickerGeom, mat);
                mesh.position.copy(pos);
                mesh.quaternion.copy(quat);
                mesh.userData = { faceKey: face.key, stickerIdx: idx };

                group.add(mesh);
                clickable.push(mesh);
            }
        }
    });

    group.userData.clickable = clickable;
    return group;
}

/* ============================================================
 *  构建三阶展开图
 *  布局：十字形
 *        U
 *    L   F   R   B
 *        D
 * ============================================================ */
export function buildCube3x3Unfold(stickerColors, options = {}) {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 240 180');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'unfold-svg');

    const FACE_POS = {
        U: { x: 60, y: 0 },
        L: { x: 0, y: 60 },
        F: { x: 60, y: 60 },
        R: { x: 120, y: 60 },
        B: { x: 180, y: 60 },
        D: { x: 60, y: 120 },
    };
    const CELL = 20;
    const PAD = 1.2;

    const polyMap = {};

    FACES_3X3.forEach((face) => {
        const fp = FACE_POS[face.key];

        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                const idx = row * 3 + col;
                const cx = fp.x + col * CELL;
                const cy = fp.y + row * CELL;

                const rect = document.createElementNS(SVG_NS, 'rect');
                rect.setAttribute('x', (cx + PAD).toFixed(2));
                rect.setAttribute('y', (cy + PAD).toFixed(2));
                rect.setAttribute('width', (CELL - PAD * 2).toFixed(2));
                rect.setAttribute('height', (CELL - PAD * 2).toFixed(2));
                rect.setAttribute('rx', '2');
                rect.setAttribute('ry', '2');
                rect.setAttribute('fill',
                    getSticker3x3Color(stickerColors, face.key, idx));
                rect.setAttribute('stroke', '#2A2A2A');
                rect.setAttribute('stroke-width', '0.6');
                rect.dataset.faceKey = face.key;
                rect.dataset.stickerIdx = String(idx);

                if (typeof options.onStickerClick === 'function') {
                    rect.style.cursor = 'pointer';
                    rect.addEventListener('click', (e) => {
                        e.stopPropagation();
                        options.onStickerClick(e, face.key, idx);
                    });
                }

                svg.appendChild(rect);
                polyMap[`${face.key}-${idx}`] = rect;
            }
        }
    });

    // 每个面的外框
    Object.values(FACE_POS).forEach((pos) => {
        const outline = document.createElementNS(SVG_NS, 'rect');
        outline.setAttribute('x', pos.x);
        outline.setAttribute('y', pos.y);
        outline.setAttribute('width', CELL * 3);
        outline.setAttribute('height', CELL * 3);
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', '#C9BCA4');
        outline.setAttribute('stroke-width', '1.2');
        outline.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(outline);
    });

    return { svg, polygons: polyMap };
}

/* ============================================================
 *  Cube3x3Module
 * ============================================================ */
export class Cube3x3Module {
    constructor(state, onSave, onDelete) {
        this.onSave = onSave || (() => {});
        this.onDelete = onDelete || (() => {});

        this.id = (state && state.id) ||
            `c3_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.title = (state && state.title) || '三阶';
        this.group = (state && state.group) || '';
        this.stickerColors =
            (state && state.stickerColors && typeof state.stickerColors === 'object')
                ? { ...state.stickerColors }
                : {};
        this.formula = (state && state.formula) || '';
        this.note = (state && state.note) || '';

        // Three.js 运行时
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.modelGroup = null;
        this.raycaster = new THREE.Raycaster();
        this.pointerNDC = new THREE.Vector2();
        this.clickableMeshes = [];
        this.unfoldRects = {};
        this.paletteEl = null;
        this._animId = null;
        this._downPos = null;
        this._resizeObserver = null;
        this._saveTimer = null;
        this._closePaletteBound = () => this.closePalette();

        // 模态
        this.modalOverlay = null;
        this.modalEl = null;
        this._modalOpen = false;
        this._escHandler = null;
        this._cardDownPos = null;

        this._buildCardDOM();
    }

    /* ---------- 卡片 ---------- */
    _buildCardDOM() {
        const card = document.createElement('div');
        card.className = 'pyraminx-card';   // 复用金字塔的卡片类名（样式同形）
        card.dataset.id = this.id;
        card.innerHTML = `
            <div class="card-canvas-host"></div>
            <div class="card-formula-preview"></div>
            <div class="card-group-tag hidden"></div>
        `;

        this.element = card;
        this.cardCanvasHost = card.querySelector('.card-canvas-host');
        this.cardFormulaEl = card.querySelector('.card-formula-preview');
        this.cardGroupEl = card.querySelector('.card-group-tag');

        card.addEventListener('pointerdown', (e) => {
            this._cardDownPos = { x: e.clientX, y: e.clientY };
        });
        card.addEventListener('pointerup', (e) => {
            if (!this._cardDownPos) return;
            const dx = e.clientX - this._cardDownPos.x;
            const dy = e.clientY - this._cardDownPos.y;
            this._cardDownPos = null;
            if (dx * dx + dy * dy > 64) return;
            if (!this._modalOpen) this.openModal();
        });
        card.addEventListener('pointercancel', () => { this._cardDownPos = null; });

        this._updateCardPreview();
    }

    _updateCardPreview() {
        if (this.formula && this.formula.trim()) {
            this.cardFormulaEl.textContent = this.formula;
            this.cardFormulaEl.classList.remove('empty');
        } else {
            this.cardFormulaEl.textContent = '（暂无公式）';
            this.cardFormulaEl.classList.add('empty');
        }
        if (this.group && this.group.trim()) {
            this.cardGroupEl.textContent = this.group;
            this.cardGroupEl.classList.remove('hidden');
        } else {
            this.cardGroupEl.classList.add('hidden');
        }
    }

    _debounceSave() {
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this.onSave(), 300);
    }

    mount() {
        this._initThree();
    }

    /* ---------- Three.js ---------- */
    _initThree() {
        const host = this.cardCanvasHost;
        const w = host.clientWidth || 200;
        const h = host.clientHeight || 200;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#FCFAF5');

        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        this.camera.position.set(4.6, 4.2, 4.8);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.09;
        this.controls.enablePan = false;
        this.controls.minDistance = 4.5;
        this.controls.maxDistance = 14;
        this.controls.rotateSpeed = 0.85;
        this.controls.target.set(0, 0, 0);
        this.controls.update();

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
        const d1 = new THREE.DirectionalLight(0xffffff, 0.75);
        d1.position.set(6, 10, 8); this.scene.add(d1);
        const d2 = new THREE.DirectionalLight(0xfff4e0, 0.42);
        d2.position.set(-7, 4, -8); this.scene.add(d2);
        const d3 = new THREE.DirectionalLight(0xffffff, 0.22);
        d3.position.set(0, -8, 3); this.scene.add(d3);

        this.modelGroup = new THREE.Group();
        this.scene.add(this.modelGroup);
        this._buildModel();

        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            this._downPos = { x: e.clientX, y: e.clientY };
        });
        this.renderer.domElement.addEventListener('pointerup', (e) => {
            if (!this._downPos) return;
            const dx = e.clientX - this._downPos.x;
            const dy = e.clientY - this._downPos.y;
            this._downPos = null;
            if (dx * dx + dy * dy > 25) return;
            if (!this._modalOpen) return;
            this._handleCanvasClick(e);
        });

        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this.resize());
            this._resizeObserver.observe(this.cardCanvasHost);
        }

        const loop = () => {
            this._animId = requestAnimationFrame(loop);
            if (this.controls) this.controls.update();
            if (this.renderer && this.scene && this.camera) {
                this.renderer.render(this.scene, this.camera);
            }
        };
        loop();
    }

    _buildModel() {
        while (this.modelGroup.children.length > 0) {
            const obj = this.modelGroup.children.pop();
            this._disposeObject(obj);
        }
        const g = buildCube3x3Group(this.stickerColors);
        while (g.children.length > 0) {
            this.modelGroup.add(g.children[0]);
        }
        this.clickableMeshes = g.userData.clickable;
    }

    /* ---------- 模态 ---------- */
    openModal() {
        if (this._modalOpen) return;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="pyraminx-modal">
                <div class="modal-header">
                    <input class="module-title" type="text" spellcheck="false" placeholder="命名…">
                    <input class="module-group" type="text" spellcheck="false" placeholder="分组（如：OLL / PLL）">
                    <div class="modal-spacer"></div>
                    <button class="btn btn-danger btn-sm" data-action="delete">删除</button>
                    <button class="btn btn-outline btn-sm" data-action="close">关闭</button>
                </div>
                <div class="modal-body">
                    <div class="panel panel-3d">
                        <div class="panel-label">3D 模型</div>
                        <div class="modal-canvas-host"></div>
                    </div>
                    <div class="panel panel-unfold">
                        <div class="panel-label">展开图</div>
                        <div class="svg-host"></div>
                    </div>
                    <div class="panel panel-formula">
                        <div class="panel-label">公式</div>
                        <textarea class="formula-textarea" spellcheck="false"
                            placeholder="在此输入公式…"></textarea>
                    </div>
                    <div class="panel panel-note">
                        <div class="panel-label">备注（记忆方式、做法心得）</div>
                        <textarea class="note-textarea" spellcheck="false"
                            placeholder="例如：先做角块归位，再做棱块换位…"></textarea>
                    </div>
                </div>
            </div>
        `;

        const titleInput = overlay.querySelector('.module-title');
        titleInput.value = this.title;
        titleInput.addEventListener('input', () => {
            this.title = titleInput.value;
            this._debounceSave();
        });

        const groupInput = overlay.querySelector('.module-group');
        groupInput.value = this.group;
        groupInput.addEventListener('input', () => {
            this.group = groupInput.value;
            this._updateCardPreview();
            this._debounceSave();
        });

        const formulaEl = overlay.querySelector('.formula-textarea');
        formulaEl.value = this.formula;
        formulaEl.addEventListener('input', () => {
            this.formula = formulaEl.value;
            this._updateCardPreview();
            this._debounceSave();
        });

        const noteEl = overlay.querySelector('.note-textarea');
        noteEl.value = this.note;
        noteEl.addEventListener('input', () => {
            this.note = noteEl.value;
            this._debounceSave();
        });

        overlay.querySelector('[data-action="close"]').addEventListener('click',
            () => this.closeModal());
        overlay.querySelector('[data-action="delete"]').addEventListener('click', () => {
            if (confirm('确定删除这个三阶公式吗？')) {
                this.closeModal();
                this.onDelete(this.id);
            }
        });

        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeModal();
        });

        this._escHandler = (e) => {
            if (e.key === 'Escape') this.closeModal();
        };
        document.addEventListener('keydown', this._escHandler);

        document.body.appendChild(overlay);
        this.modalOverlay = overlay;
        this.modalEl = overlay.querySelector('.pyraminx-modal');

        // 把 canvas 移到模态
        const modalCanvasHost = overlay.querySelector('.modal-canvas-host');
        if (this.renderer && this.renderer.domElement) {
            modalCanvasHost.appendChild(this.renderer.domElement);
        }

        this._buildUnfoldIn(overlay.querySelector('.svg-host'));

        this._modalOpen = true;

        requestAnimationFrame(() => {
            this.resize();
            if (this.controls) this.controls.update();
        });

        setTimeout(() => titleInput.focus(), 60);
    }

    closeModal() {
        if (!this._modalOpen) return;

        if (this.renderer && this.renderer.domElement && this.cardCanvasHost) {
            this.cardCanvasHost.appendChild(this.renderer.domElement);
        }

        if (this.modalOverlay) {
            this.modalOverlay.remove();
            this.modalOverlay = null;
            this.modalEl = null;
        }

        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }

        this.closePalette();
        this.unfoldRects = {};
        this._modalOpen = false;

        requestAnimationFrame(() => this.resize());
    }

    _buildUnfoldIn(host) {
        host.innerHTML = '';
        const { svg, polygons } = buildCube3x3Unfold(this.stickerColors, {
            onStickerClick: (e, faceKey, idx) => {
                this._showPalette(e.clientX, e.clientY, faceKey, idx);
            },
        });
        host.appendChild(svg);
        this.unfoldRects = polygons;
    }

    /* ---------- 涂色 ---------- */
    setStickerColor(faceKey, idx, color) {
        const key = `${faceKey}-${idx}`;
        this.stickerColors[key] = color;

        const mesh = this.clickableMeshes.find(
            (m) => m.userData.faceKey === faceKey && m.userData.stickerIdx === idx
        );
        if (mesh && mesh.material) {
            const c = new THREE.Color(color);
            mesh.material.color.copy(c);
            mesh.material.emissive.copy(c).multiplyScalar(0.07);
            mesh.material.needsUpdate = true;
        }

        const rect = this.unfoldRects[key];
        if (rect) rect.setAttribute('fill', color);

        this.onSave();
    }

    /* ---------- 调色板 ---------- */
    _showPalette(clientX, clientY, faceKey, idx) {
        this.closePalette();

        const palette = document.createElement('div');
        palette.className = 'color-palette';
        palette.style.left = `${clientX}px`;
        palette.style.top = `${clientY}px`;
        palette.addEventListener('click', (e) => e.stopPropagation());

        PALETTE_3X3.forEach((color) => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.background = color;
            swatch.title = color;
            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setStickerColor(faceKey, idx, color);
                this.closePalette();
            });
            palette.appendChild(swatch);
        });

        document.body.appendChild(palette);
        this.paletteEl = palette;

        const rect = palette.getBoundingClientRect();
        if (rect.left < 8) {
            palette.style.left = `${rect.width / 2 + 8}px`;
        } else if (rect.right > window.innerWidth - 8) {
            palette.style.left = `${window.innerWidth - rect.width / 2 - 8}px`;
        }
        if (rect.top < 8) {
            palette.style.transform = 'translate(-50%, 10%)';
        }

        setTimeout(() => {
            document.addEventListener('click', this._closePaletteBound);
        }, 0);
    }

    closePalette() {
        if (this.paletteEl) {
            this.paletteEl.remove();
            this.paletteEl = null;
        }
        document.removeEventListener('click', this._closePaletteBound);
    }

    _handleCanvasClick(e) {
        if (!this.renderer) return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.pointerNDC, this.camera);
        const hits = this.raycaster.intersectObjects(this.clickableMeshes, false);
        if (hits.length > 0) {
            const { faceKey, stickerIdx } = hits[0].object.userData;
            this._showPalette(e.clientX, e.clientY, faceKey, stickerIdx);
        }
    }

    /* ---------- 尺寸 ---------- */
    resize() {
        if (!this.renderer || !this.camera) return;
        let host = this.cardCanvasHost;
        if (this._modalOpen && this.modalEl) {
            host = this.modalEl.querySelector('.modal-canvas-host');
        }
        if (!host) return;
        const w = host.clientWidth;
        const h = host.clientHeight;
        if (w === 0 || h === 0) return;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    /* ---------- 序列化 / 销毁 ---------- */
    serialize() {
        return {
            id: this.id,
            title: this.title,
            group: this.group,
            stickerColors: { ...this.stickerColors },
            formula: this.formula,
            note: this.note,
        };
    }

    _disposeObject(obj) {
        if (!obj) return;
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material.dispose();
        }
    }

    destroy() {
        this.closeModal();
        if (this._animId) cancelAnimationFrame(this._animId);
        if (this._resizeObserver) this._resizeObserver.disconnect();
        this.closePalette();
        if (this.controls) this.controls.dispose();
        if (this.modelGroup) {
            while (this.modelGroup.children.length > 0) {
                this._disposeObject(this.modelGroup.children.pop());
            }
        }
        if (this.renderer) {
            this.renderer.dispose();
            if (this.renderer.domElement && this.renderer.domElement.parentNode) {
                this.renderer.domElement.parentNode.removeChild(
                    this.renderer.domElement
                );
            }
        }
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}