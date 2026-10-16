// ===== js/pyraminx-module.js =====
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ============================================================
 *  几何常量
 *  前面 = 绿色 (+Z)  底面 = 黄色 (-Y)
 *  左面 = 红色 (左后)  右面 = 蓝色 (右后)
 * ============================================================ */

export const V_A = new THREE.Vector3(-0.866, -0.354, 0.5);
export const V_B = new THREE.Vector3(0, -0.354, -1);
export const V_C = new THREE.Vector3(0.866, -0.354, 0.5);
export const V_T = new THREE.Vector3(0, 1.061, 0);

export const FACES = [
    { key: 'front',  color: '#2FA84F', verts: [V_A, V_C, V_T] },
    { key: 'left',   color: '#E6392E', verts: [V_B, V_A, V_T] },
    { key: 'right',  color: '#3B7DD8', verts: [V_C, V_B, V_T] },
    { key: 'bottom', color: '#F5C518', verts: [V_A, V_B, V_C] },
];

export const SUBDIV_POINTS = [
    [3, 0, 0], [2, 1, 0], [2, 0, 1], [1, 2, 0], [1, 1, 1],
    [1, 0, 2], [0, 3, 0], [0, 2, 1], [0, 1, 2], [0, 0, 3],
];

export const SUBDIV_TRIS = [
    [0, 1, 2], [1, 3, 4], [2, 4, 5], [4, 7, 8],
    [3, 6, 7], [5, 8, 9], [1, 4, 2], [3, 7, 4], [4, 8, 5],
];

export const PALETTE = [
    '#2FA84F', '#E6392E', '#3B7DD8', '#F5C518',
    '#FF8C1A', '#FFFFFF', '#1A1A1A', '#9B59B6',
    '#808080',
];

export function getStickerColor(stickerColors, faceIdx, stickerIdx) {
    const key = `${faceIdx}-${stickerIdx}`;
    if (stickerColors && stickerColors[key]) return stickerColors[key];
    return FACES[faceIdx].color;
}

/* ============================================================
 *  构建 3D 模型
 * ============================================================ */
export function buildPyraminxGroup(stickerColors) {
    const group = new THREE.Group();
    const clickable = [];

    FACES.forEach((face, faceIdx) => {
        const [P0, P1, P2] = face.verts;

        const bgGeom = new THREE.BufferGeometry();
        bgGeom.setAttribute('position', new THREE.BufferAttribute(
            new Float32Array([
                P0.x, P0.y, P0.z, P1.x, P1.y, P1.z, P2.x, P2.y, P2.z,
            ]), 3
        ));
        const bgMesh = new THREE.Mesh(bgGeom, new THREE.MeshStandardMaterial({
            color: 0x2A2A2A, roughness: 0.95, metalness: 0.0,
            side: THREE.DoubleSide,
        }));
        group.add(bgMesh);

        const normal = new THREE.Vector3()
            .subVectors(P1, P0)
            .cross(new THREE.Vector3().subVectors(P2, P0))
            .normalize();

        const pts = SUBDIV_POINTS.map(([i, j, k]) =>
            new THREE.Vector3()
                .addScaledVector(P0, i / 3)
                .addScaledVector(P1, j / 3)
                .addScaledVector(P2, k / 3)
        );

        SUBDIV_TRIS.forEach((tri, stickerIdx) => {
            const a = pts[tri[0]], b = pts[tri[1]], c = pts[tri[2]];
            const centroid = new THREE.Vector3()
                .add(a).add(b).add(c).multiplyScalar(1 / 3);
            const SHRINK = 0.86;
            const off = normal.clone().multiplyScalar(0.009);
            const pa = centroid.clone().lerp(a, SHRINK).add(off);
            const pb = centroid.clone().lerp(b, SHRINK).add(off);
            const pc = centroid.clone().lerp(c, SHRINK).add(off);

            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(
                new Float32Array([
                    pa.x, pa.y, pa.z, pb.x, pb.y, pb.z, pc.x, pc.y, pc.z,
                ]), 3
            ));
            geom.setAttribute('normal', new THREE.BufferAttribute(
                new Float32Array([
                    normal.x, normal.y, normal.z,
                    normal.x, normal.y, normal.z,
                    normal.x, normal.y, normal.z,
                ]), 3
            ));

            const colorHex = getStickerColor(stickerColors, faceIdx, stickerIdx);
            const baseColor = new THREE.Color(colorHex);
            const mat = new THREE.MeshStandardMaterial({
                color: baseColor.clone(),
                emissive: baseColor.clone().multiplyScalar(0.09),
                roughness: 0.42, metalness: 0.06,
                side: THREE.DoubleSide,
            });

            const mesh = new THREE.Mesh(geom, mat);
            mesh.userData = { faceIdx, stickerIdx };
            group.add(mesh);
            clickable.push(mesh);
        });
    });

    group.userData.clickable = clickable;
    return group;
}
/* ============================================================
 *  构建展开图 SVG
 *  返回 { svg, polygons }
 *
 *  布局（垂直翻转后）：
 *    - 顶部：红（左）、蓝（右）     ← 两个倒三角
 *    - 中部：绿（前）              ← 倒三角
 *    - 底部：黄（底）              ← 正三角
 *
 *  变换：整体垂直翻转 (y → 190 - y)
 *  等价于 旋转 180° + 水平镜像
 *  变换通过 SVG <g transform> 完成，贴纸索引不变
 * ============================================================ */
export function buildUnfoldSVG(stickerColors, options = {}) {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 190');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'unfold-svg');

    // ★ 垂直翻转组：y' = 190 - y
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', 'matrix(1 0 0 -1 0 190)');

    // 大三角形三个顶点（未翻转坐标）
    const TT = [100, 20];   // 顶
    const LB = [10, 170];   // 左下
    const RB = [190, 170];  // 右下
    const ML = [55, 95];    // 左中
    const MR = [145, 95];   // 右中
    const MB = [100, 170];  // 底中

    // 4 个面：顶点角色与 3D FACES 严格一致
    const UNFOLD_TRIS = [
        [ML, MR, MB],   // 面 0 绿（前）：P0=V_A, P1=V_C, P2=V_T
        [LB, ML, MB],   // 面 1 红（左）：P0=V_B, P1=V_A, P2=V_T
        [MR, RB, MB],   // 面 2 蓝（右）：P0=V_C, P1=V_B, P2=V_T
        [ML, TT, MR],   // 面 3 黄（底）：P0=V_A, P1=V_B, P2=V_C
    ];

    const polyMap = {};

    UNFOLD_TRIS.forEach((tri, faceIdx) => {
        const [P0, P1, P2] = tri.map((p) => ({ x: p[0], y: p[1] }));

        // 细分点：与 3D 中 SUBDIV_POINTS 使用同一套重心坐标
        const pts = SUBDIV_POINTS.map(([i, j, k]) => ({
            x: (i * P0.x + j * P1.x + k * P2.x) / 3,
            y: (i * P0.y + j * P1.y + k * P2.y) / 3,
        }));

        SUBDIV_TRIS.forEach((t, stickerIdx) => {
            const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]];
            const cx = (a.x + b.x + c.x) / 3;
            const cy = (a.y + b.y + c.y) / 3;
            const SHRINK = 0.88;
            const sp = (p) => ({
                x: cx + (p.x - cx) * SHRINK,
                y: cy + (p.y - cy) * SHRINK,
            });
            const pa = sp(a), pb = sp(b), pc = sp(c);

            const poly = document.createElementNS(SVG_NS, 'polygon');
            poly.setAttribute('points',
                `${pa.x.toFixed(2)},${pa.y.toFixed(2)} ` +
                `${pb.x.toFixed(2)},${pb.y.toFixed(2)} ` +
                `${pc.x.toFixed(2)},${pc.y.toFixed(2)}`
            );
            poly.setAttribute('fill',
                getStickerColor(stickerColors, faceIdx, stickerIdx));
            poly.setAttribute('stroke', '#2A2A2A');
            poly.setAttribute('stroke-width', '0.8');
            poly.setAttribute('stroke-linejoin', 'round');
            poly.dataset.faceIdx = String(faceIdx);
            poly.dataset.stickerIdx = String(stickerIdx);

            if (typeof options.onStickerClick === 'function') {
                poly.style.cursor = 'pointer';
                poly.addEventListener('click', (e) => {
                    e.stopPropagation();
                    options.onStickerClick(e, faceIdx, stickerIdx);
                });
            }

            g.appendChild(poly);   // ★ 加到 g 里
            polyMap[`${faceIdx}-${stickerIdx}`] = poly;
        });
    });

    // 大三角形外框
    const outline = document.createElementNS(SVG_NS, 'polygon');
    outline.setAttribute('points',
        `${TT[0]},${TT[1]} ${LB[0]},${LB[1]} ${RB[0]},${RB[1]}`);
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', '#C9BCA4');
    outline.setAttribute('stroke-width', '1.2');
    outline.setAttribute('stroke-linejoin', 'round');
    g.appendChild(outline);   // ★ 加到 g 里

    svg.appendChild(g);
    return { svg, polygons: polyMap };
}
/* ============================================================
 *  PyraminxModule —— 卡片 + 模态
 * ============================================================ */
export class PyraminxModule {
    constructor(state, onSave, onDelete) {
        this.onSave = onSave || (() => {});
        this.onDelete = onDelete || (() => {});

        this.id = (state && state.id) ||
            `pyr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.title = (state && state.title) || '金字塔';
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
        this.unfoldPolygons = {};
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

        // 构建卡片 DOM
        this._buildCardDOM();
    }

    /* ---------- 卡片 DOM ---------- */
    _buildCardDOM() {
        const card = document.createElement('div');
        card.className = 'pyraminx-card';
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

        // 判断点击 vs 拖动
        card.addEventListener('pointerdown', (e) => {
            this._cardDownPos = { x: e.clientX, y: e.clientY };
        });
        card.addEventListener('pointerup', (e) => {
            if (!this._cardDownPos) return;
            const dx = e.clientX - this._cardDownPos.x;
            const dy = e.clientY - this._cardDownPos.y;
            this._cardDownPos = null;
            if (dx * dx + dy * dy > 64) return; // 8px 阈值
            // 拖动过就忽略；否则打开模态
            if (!this._modalOpen) this.openModal();
        });
        card.addEventListener('pointercancel', () => {
            this._cardDownPos = null;
        });

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

    /* ---------- 挂载 ---------- */
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
        this.camera.position.set(2.15, 1.85, 2.85);
        this.camera.lookAt(0, 0.05, 0);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        host.appendChild(this.renderer.domElement);

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.09;
        this.controls.enablePan = false;
        this.controls.minDistance = 2.6;
        this.controls.maxDistance = 8;
        this.controls.rotateSpeed = 0.85;
        this.controls.target.set(0, 0.05, 0);
        this.controls.update();

        this.scene.add(new THREE.AmbientLight(0xffffff, 0.82));
        const d1 = new THREE.DirectionalLight(0xffffff, 0.72);
        d1.position.set(5, 9, 7); this.scene.add(d1);
        const d2 = new THREE.DirectionalLight(0xfff4e0, 0.42);
        d2.position.set(-6, 3, -7); this.scene.add(d2);
        const d3 = new THREE.DirectionalLight(0xffffff, 0.25);
        d3.position.set(0, -8, 2); this.scene.add(d3);

        this.modelGroup = new THREE.Group();
        this.scene.add(this.modelGroup);
        this._buildModel();

        // 点击拾取（只在模态打开时启用）
        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            this._downPos = { x: e.clientX, y: e.clientY };
        });
        this.renderer.domElement.addEventListener('pointerup', (e) => {
            if (!this._downPos) return;
            const dx = e.clientX - this._downPos.x;
            const dy = e.clientY - this._downPos.y;
            this._downPos = null;
            if (dx * dx + dy * dy > 25) return;
            if (!this._modalOpen) return; // 卡片模式下不弹调色板
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
        const group = buildPyraminxGroup(this.stickerColors);
        while (group.children.length > 0) {
            this.modelGroup.add(group.children[0]);
        }
        this.clickableMeshes = group.userData.clickable;
    }

    /* ---------- 打开模态 ---------- */
    openModal() {
        if (this._modalOpen) return;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="pyraminx-modal">
                <div class="modal-header">
                    <input class="module-title" type="text" spellcheck="false" placeholder="命名…">
                    <input class="module-group" type="text" spellcheck="false" placeholder="分组（如：翻棱 / 有连色）">
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
                            placeholder="备注"></textarea>
                    </div>
                </div>
            </div>
        `;

        // 标题
        const titleInput = overlay.querySelector('.module-title');
        titleInput.value = this.title;
        titleInput.addEventListener('input', () => {
            this.title = titleInput.value;
            this._debounceSave();
        });

        // 分组
        const groupInput = overlay.querySelector('.module-group');
        groupInput.value = this.group;
        groupInput.addEventListener('input', () => {
            this.group = groupInput.value;
            this._updateCardPreview();
            this._debounceSave();
        });

        // 公式
        const formulaEl = overlay.querySelector('.formula-textarea');
        formulaEl.value = this.formula;
        formulaEl.addEventListener('input', () => {
            this.formula = formulaEl.value;
            this._updateCardPreview();
            this._debounceSave();
        });

        // 备注
        const noteEl = overlay.querySelector('.note-textarea');
        noteEl.value = this.note;
        noteEl.addEventListener('input', () => {
            this.note = noteEl.value;
            this._debounceSave();
        });

        // 按钮
        overlay.querySelector('[data-action="close"]').addEventListener('click',
            () => this.closeModal());
        overlay.querySelector('[data-action="delete"]').addEventListener('click', () => {
            if (confirm('确定删除这个金字塔吗？')) {
                this.closeModal();
                this.onDelete(this.id);
            }
        });

        // 点遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.closeModal();
        });

        // ESC 关闭
        this._escHandler = (e) => {
            if (e.key === 'Escape') this.closeModal();
        };
        document.addEventListener('keydown', this._escHandler);

        document.body.appendChild(overlay);
        this.modalOverlay = overlay;
        this.modalEl = overlay.querySelector('.pyraminx-modal');

        // ★ 把渲染器 canvas 从卡片移到模态
        const modalCanvasHost = overlay.querySelector('.modal-canvas-host');
        if (this.renderer && this.renderer.domElement) {
            modalCanvasHost.appendChild(this.renderer.domElement);
        }

        // 构建展开图
        this._buildUnfoldIn(overlay.querySelector('.svg-host'));

        this._modalOpen = true;

        // 尺寸更新
        requestAnimationFrame(() => {
            this.resize();
            // 让 OrbitControls 重新计算（部分版本需要）
            if (this.controls) this.controls.update();
        });

        // 自动聚焦标题（可选，便于立即改名）
        setTimeout(() => titleInput.focus(), 60);
    }

    /* ---------- 关闭模态 ---------- */
    closeModal() {
        if (!this._modalOpen) return;

        // 先把 canvas 移回卡片（此时 size 还是模态尺寸，稍后再 resize）
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
        this.unfoldPolygons = {};
        this._modalOpen = false;

        requestAnimationFrame(() => {
            this.resize();
        });
    }

    /* ---------- 展开图 ---------- */
    _buildUnfoldIn(host) {
        host.innerHTML = '';
        const { svg, polygons } = buildUnfoldSVG(this.stickerColors, {
            onStickerClick: (e, faceIdx, stickerIdx) => {
                this._showPalette(e.clientX, e.clientY, faceIdx, stickerIdx);
            },
        });
        host.appendChild(svg);
        this.unfoldPolygons = polygons;
    }

    /* ---------- 颜色 ---------- */
    getStickerColor(faceIdx, stickerIdx) {
        return getStickerColor(this.stickerColors, faceIdx, stickerIdx);
    }

    setStickerColor(faceIdx, stickerIdx, color) {
        const key = `${faceIdx}-${stickerIdx}`;
        this.stickerColors[key] = color;

        const mesh = this.clickableMeshes.find(
            (m) => m.userData.faceIdx === faceIdx &&
                   m.userData.stickerIdx === stickerIdx
        );
        if (mesh && mesh.material) {
            const col = new THREE.Color(color);
            mesh.material.color.copy(col);
            mesh.material.emissive.copy(col).multiplyScalar(0.09);
            mesh.material.needsUpdate = true;
        }

        // 更新展开图（如果模态打开着）
        const poly = this.unfoldPolygons[key];
        if (poly) poly.setAttribute('fill', color);

        this.onSave();
    }

    /* ---------- 调色板 ---------- */
    _showPalette(clientX, clientY, faceIdx, stickerIdx) {
        this.closePalette();

        const palette = document.createElement('div');
        palette.className = 'color-palette';
        palette.style.left = `${clientX}px`;
        palette.style.top = `${clientY}px`;
        palette.addEventListener('click', (e) => e.stopPropagation());

        PALETTE.forEach((color) => {
            const swatch = document.createElement('div');
            swatch.className = 'color-swatch';
            swatch.style.background = color;
            swatch.title = color;
            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setStickerColor(faceIdx, stickerIdx, color);
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

    /* ---------- 3D 拾取 ---------- */
    _handleCanvasClick(e) {
        if (!this.renderer) return;
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.pointerNDC, this.camera);
        const hits = this.raycaster.intersectObjects(this.clickableMeshes, false);
        if (hits.length > 0) {
            const { faceIdx, stickerIdx } = hits[0].object.userData;
            this._showPalette(e.clientX, e.clientY, faceIdx, stickerIdx);
        }
    }

    /* ---------- 尺寸 ---------- */
    resize() {
        if (!this.renderer || !this.camera) return;

        // 根据当前所在容器决定尺寸
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