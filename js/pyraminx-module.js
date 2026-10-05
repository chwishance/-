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
    { key: 'front',  color: '#2FA84F', verts: [V_A, V_C, V_T] }, // 绿 · 前
    { key: 'left',   color: '#E6392E', verts: [V_B, V_A, V_T] }, // 红 · 左
    { key: 'right',  color: '#3B7DD8', verts: [V_C, V_B, V_T] }, // 蓝 · 右
    { key: 'bottom', color: '#F5C518', verts: [V_A, V_B, V_C] }, // 黄 · 底
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
];

/** 取某个贴纸的颜色（含默认色） */
export function getStickerColor(stickerColors, faceIdx, stickerIdx) {
    const key = `${faceIdx}-${stickerIdx}`;
    if (stickerColors && stickerColors[key]) return stickerColors[key];
    return FACES[faceIdx].color;
}

/* ============================================================
 *  构建 3D 模型（可复用于编辑页 / 训练页）
 *  返回 THREE.Group，userData.clickable 为可点击的贴纸网格数组
 * ============================================================ */
export function buildPyraminxGroup(stickerColors) {
    const group = new THREE.Group();
    const clickable = [];

    FACES.forEach((face, faceIdx) => {
        const [P0, P1, P2] = face.verts;

        // 深色背板
        const bgGeom = new THREE.BufferGeometry();
        bgGeom.setAttribute('position', new THREE.BufferAttribute(
            new Float32Array([
                P0.x, P0.y, P0.z,
                P1.x, P1.y, P1.z,
                P2.x, P2.y, P2.z,
            ]), 3
        ));
        const bgMesh = new THREE.Mesh(bgGeom, new THREE.MeshStandardMaterial({
            color: 0x2A2A2A, roughness: 0.95, metalness: 0.0,
            side: THREE.DoubleSide,
        }));
        group.add(bgMesh);

        // 法线
        const normal = new THREE.Vector3()
            .subVectors(P1, P0)
            .cross(new THREE.Vector3().subVectors(P2, P0))
            .normalize();

        // 细分点
        const pts = SUBDIV_POINTS.map(([i, j, k]) =>
            new THREE.Vector3()
                .addScaledVector(P0, i / 3)
                .addScaledVector(P1, j / 3)
                .addScaledVector(P2, k / 3)
        );

        // 9 个贴纸
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
                    pa.x, pa.y, pa.z,
                    pb.x, pb.y, pb.z,
                    pc.x, pc.y, pc.z,
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
 *  构建展开图 SVG（可复用于编辑页 / 训练页）
 *  options.onStickerClick(e, faceIdx, stickerIdx) 可选
 *  返回 SVG 元素，userData.polygons 为 { "face-sticker": polygon }
 * ============================================================ */
export function buildUnfoldSVG(stickerColors, options = {}) {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 200 185');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('class', 'unfold-svg');

    const MID_BOTTOM = [100, 170];
    const MID_LEFT = [55, 92.06];
    const MID_RIGHT = [145, 92.06];

    const UNFOLD_TRIS = [
        [[100, 14.12], MID_LEFT, MID_RIGHT],   // face 0 绿
        [[10, 170], [100, 170], MID_LEFT],     // face 1 红
        [[190, 170], MID_RIGHT, [100, 170]],   // face 2 蓝
        [[100, 170], MID_LEFT, MID_RIGHT],     // face 3 黄
    ];

    const polyMap = {};

    UNFOLD_TRIS.forEach((tri, faceIdx) => {
        const [P0, P1, P2] = tri.map((p) => ({ x: p[0], y: p[1] }));

        const pts = SUBDIV_POINTS.map(([i, j, k]) => ({
            x: (i * P0.x + j * P1.x + k * P2.x) / 3,
            y: (i * P0.y + j * P1.y + k * P2.y) / 3,
        }));

        SUBDIV_TRIS.forEach((t, stickerIdx) => {
            const a = pts[t[0]], b = pts[t[1]], c = pts[t[2]];
            const cx = (a.x + b.x + c.x) / 3;
            const cy = (a.y + b.y + c.y) / 3;
            const SHRINK = 0.9;
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
            poly.setAttribute('fill', getStickerColor(stickerColors, faceIdx, stickerIdx));
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

            svg.appendChild(poly);
            polyMap[`${faceIdx}-${stickerIdx}`] = poly;
        });
    });

    // 外框
    const outline = document.createElementNS(SVG_NS, 'polygon');
    outline.setAttribute('points', '10,170 190,170 100,14.12');
    outline.setAttribute('fill', 'none');
    outline.setAttribute('stroke', '#C9BCA4');
    outline.setAttribute('stroke-width', '1.2');
    outline.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(outline);

    // 返回普通对象，而不是往 DOM 元素上挂属性
    return { svg, polygons: polyMap };
}

/* ============================================================
 *  PyraminxModule —— 单个可编辑模块（编辑页用）
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

        // 运行时
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

        this._buildDOM();
    }

    /* ---------- DOM ---------- */
    _buildDOM() {
        const el = document.createElement('div');
        el.className = 'pyraminx-module';
        el.dataset.id = this.id;

        el.innerHTML = `
            <div class="module-header">
                <input class="module-title" type="text" spellcheck="false" placeholder="命名…">
                <input class="module-group" type="text" spellcheck="false"
                       placeholder="分组（如：翻棱 / 有连色）">
                <button class="btn btn-danger btn-sm" data-action="delete">删除此金字塔</button>
            </div>
            <div class="module-body">
                <div class="panel panel-3d">
                    <div class="panel-label">3D 模型</div>
                    <div class="canvas-host"></div>
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
            </div>
        `;

        this.element = el;

        this.titleInput = el.querySelector('.module-title');
        this.titleInput.value = this.title;
        this.titleInput.addEventListener('input', () => {
            this.title = this.titleInput.value;
            this._debounceSave();
        });

        this.groupInput = el.querySelector('.module-group');
        this.groupInput.value = this.group;
        this.groupInput.addEventListener('input', () => {
            this.group = this.groupInput.value;
            this._debounceSave();
        });

        el.querySelector('[data-action="delete"]').addEventListener('click', () => {
            if (confirm('确定删除这个金字塔模块吗？')) this.onDelete(this.id);
        });

        this.formulaEl = el.querySelector('.formula-textarea');
        this.formulaEl.value = this.formula;
        this.formulaEl.addEventListener('input', () => {
            this.formula = this.formulaEl.value;
            this._debounceSave();
        });

        this.canvasHost = el.querySelector('.canvas-host');
        this.svgHost = el.querySelector('.svg-host');
    }

    _debounceSave() {
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this.onSave(), 300);
    }

    /* ---------- 挂载 ---------- */
    mount() {
        this._initThree();
        this._buildUnfold();
    }

    /* ---------- Three.js ---------- */
    _initThree() {
        const host = this.canvasHost;
        const w = host.clientWidth || 320;
        const h = host.clientHeight || 268;

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
        const d1 = new THREE.DirectionalLight(0xffffff, 0.72); d1.position.set(5, 9, 7); this.scene.add(d1);
        const d2 = new THREE.DirectionalLight(0xfff4e0, 0.42); d2.position.set(-6, 3, -7); this.scene.add(d2);
        const d3 = new THREE.DirectionalLight(0xffffff, 0.25); d3.position.set(0, -8, 2); this.scene.add(d3);

        this.modelGroup = new THREE.Group();
        this.scene.add(this.modelGroup);
        this._buildModel();

        // 点击检测
        this.renderer.domElement.addEventListener('pointerdown', (e) => {
            this._downPos = { x: e.clientX, y: e.clientY };
        });
        this.renderer.domElement.addEventListener('pointerup', (e) => {
            if (!this._downPos) return;
            const dx = e.clientX - this._downPos.x;
            const dy = e.clientY - this._downPos.y;
            this._downPos = null;
            if (dx * dx + dy * dy > 25) return;
            this._handleCanvasClick(e);
        });

        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this.resize());
            this._resizeObserver.observe(host);
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

    _buildUnfold() {
        this.svgHost.innerHTML = '';

        const { svg, polygons } = buildUnfoldSVG(this.stickerColors, {
            onStickerClick: (e, faceIdx, stickerIdx) => {
                this._showPalette(e.clientX, e.clientY, faceIdx, stickerIdx);
            },
        });

        this.svgHost.appendChild(svg);
        this.unfoldPolygons = polygons;   // ← 直接拿 polygons 对象
    }

    /* ---------- 颜色 ---------- */
    getStickerColor(faceIdx, stickerIdx) {
        return getStickerColor(this.stickerColors, faceIdx, stickerIdx);
    }

    setStickerColor(faceIdx, stickerIdx, color) {
        const key = `${faceIdx}-${stickerIdx}`;
        this.stickerColors[key] = color;

        const mesh = this.clickableMeshes.find(
            (m) => m.userData.faceIdx === faceIdx && m.userData.stickerIdx === stickerIdx
        );
        if (mesh && mesh.material) {
            const col = new THREE.Color(color);
            mesh.material.color.copy(col);
            mesh.material.emissive.copy(col).multiplyScalar(0.09);
            mesh.material.needsUpdate = true;
        }

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

    /* ---------- 拾取 ---------- */
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
        if (!this.renderer || !this.camera || !this.canvasHost) return;
        const w = this.canvasHost.clientWidth;
        const h = this.canvasHost.clientHeight;
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
                this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
            }
        }
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}