// ===== js/fmc-module.js =====
import * as THREE from 'three';
import { Cube3x3Module, FACES_3X3, PALETTE_3X3 } from './3x3-module.js';

/* ============================================================
 *  FMC 分类常量
 * ============================================================ */

export const FMC_GROUPS = ['EO', 'DR', 'HTR', 'FR', 'TECH'];

export const EO_BAD_EDGES = [0, 2, 4, 6, 8];

export const DR_C_RANGE = [0, 1, 2, 3, 4, 5, 6, 7, 8];
export const DR_E_RANGE = [0, 2, 4, 6, 8];

export const HTR_TAGS = [
    '4b5', '2c5',
    '2c4', '0c4', '4b4', '4a4',
    '2c3', '4b3', '4a3', '0c3',
    '4b2', '4a2',
    '4a1 4e', '4a1 not 4e', '0c0',
];

export const FR_TAGS = [
    '4B0',
    '4P1',
    '2P2', 'HL2',
    '2B3', '2P3', 'HL3', 'OP3',
    '1B4', '4P4', '0P4',
];

/* ============================================================
 *  FMCCubeModule
 * ============================================================ */
export class FMCCubeModule extends Cube3x3Module {
    constructor(state, onSave, onDelete) {
        super(state, onSave, onDelete);
        this.mainGroup = (state && state.mainGroup) || 'EO';
        this.meta = state && state.meta
            ? { ...state.meta }
            : this._defaultMeta(this.mainGroup);
        this._updateCardPreview();
    }

    /* ---------- 默认 meta ---------- */
    _defaultMeta(group) {
        if (group === 'EO') return { badEdges: 0 };
        if (group === 'DR') return { c: 0, e: 0 };
        if (group === 'HTR') return { htr: '0c0' };
        if (group === 'FR') return { frTags: ['4B0', '4B0'] };
        if (group === 'TECH') return { tech: '' };
        return {};
    }

    /* ---------- 序列化 ---------- */
    serialize() {
        const base = super.serialize();
        return {
            ...base,
            mainGroup: this.mainGroup,
            meta: { ...this.meta },
        };
    }

    /* ---------- 卡片副标签 ---------- */
    _subLabel() {
        const g = this.mainGroup;
        const m = this.meta || {};
        if (g === 'EO') return m.badEdges != null ? `${m.badEdges} 坏棱` : '';
        if (g === 'DR') return `${m.c ?? 0}c${m.e ?? 0}e`;
        if (g === 'HTR') return m.htr || '';
        if (g === 'FR') return (m.frTags || []).join(' / ');
        if (g === 'TECH') return m.tech || '';
        return '';
    }

    _updateCardPreview() {
        super._updateCardPreview();
        if (!this.mainGroup || !this.cardGroupEl) return;
        const sub = this._subLabel();
        const text = sub ? `${this.mainGroup} · ${sub}` : this.mainGroup;
        this.cardGroupEl.textContent = text;
        this.cardGroupEl.classList.remove('hidden');
    }

    /* ---------- 模态：注入 FMC 字段 + 全涂色按钮 ---------- */
    openModal() {
        if (this._modalOpen) return;
        super.openModal();

        const modal = this.modalEl;
        if (!modal) return;

        const header = modal.querySelector('.modal-header');
        const body = modal.querySelector('.modal-body');

        // 隐藏父类的分组输入
        const parentGroupInput = header.querySelector('.module-group');
        if (parentGroupInput) parentGroupInput.style.display = 'none';

        // 插入 FMC 行
        const fmcRow = document.createElement('div');
        fmcRow.className = 'fmc-row';
        fmcRow.innerHTML = `
            <label class="fmc-row-label">主分组</label>
            <select class="fmc-main-select">
                ${FMC_GROUPS.map((g) => `<option value="${g}">${g}</option>`).join('')}
            </select>
            <div class="fmc-sub-inline"></div>
        `;
        header.parentNode.insertBefore(fmcRow, body);

        const mainSelect = fmcRow.querySelector('.fmc-main-select');
        mainSelect.value = this.mainGroup;

        const subInline = fmcRow.querySelector('.fmc-sub-inline');

        const renderSub = () => {
            subInline.innerHTML = this._buildSubInline();
            this._wireSubEvents(subInline);
        };

        mainSelect.addEventListener('change', () => {
            this.mainGroup = mainSelect.value;
            this.meta = this._defaultMeta(this.mainGroup);
            renderSub();
            this._updateCardPreview();
            this._debounceSave();
        });

        renderSub();

        // ★ 3D 面板底部工具行：全涂色 + 复原
        const panel3d = modal.querySelector('.panel-3d');
        if (panel3d) {
            const tools = document.createElement('div');
            tools.className = 'panel-3d-tools';

            const btnFull = document.createElement('button');
            btnFull.type = 'button';
            btnFull.className = 'btn btn-outline btn-sm full-paint-btn';
            btnFull.textContent = '🎨 全涂色';
            btnFull.addEventListener('click', (e) => {
                e.stopPropagation();
                this._showFullPalette(e.clientX, e.clientY);
            });

            const btnReset = document.createElement('button');
            btnReset.type = 'button';
            btnReset.className = 'btn btn-outline btn-sm reset-paint-btn';
            btnReset.textContent = '↺ 复原';
            btnReset.title = '恢复为标准配色';
            btnReset.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!confirm('恢复为标准配色？所有自定义涂色将被清除。')) return;
                this.resetAllStickers();
            });

            tools.appendChild(btnFull);
            tools.appendChild(btnReset);
            panel3d.appendChild(tools);
        }

        requestAnimationFrame(() => this.resize());
    }

    /* ---------- 子分类输入 HTML ---------- */
    _buildSubInline() {
        const g = this.mainGroup;
        const m = this.meta || {};

        if (g === 'EO') {
            const opts = EO_BAD_EDGES.map((v) =>
                `<option value="${v}" ${m.badEdges === v ? 'selected' : ''}>${v} 坏棱</option>`
            ).join('');
            return `<label>坏棱数</label><select class="fmc-sub-eo">${opts}</select>`;
        }

        if (g === 'DR') {
            const cOpts = DR_C_RANGE.map((v) =>
                `<option value="${v}" ${m.c === v ? 'selected' : ''}>${v}</option>`
            ).join('');
            const eOpts = DR_E_RANGE.map((v) =>
                `<option value="${v}" ${m.e === v ? 'selected' : ''}>${v}</option>`
            ).join('');
            return `<label>c</label><select class="fmc-sub-drc">${cOpts}</select>
                    <label>e</label><select class="fmc-sub-dre">${eOpts}</select>`;
        }

        if (g === 'HTR') {
            const opts = HTR_TAGS.map((v) =>
                `<option value="${v}" ${m.htr === v ? 'selected' : ''}>${v}</option>`
            ).join('');
            return `<label>HTR 分类</label><select class="fmc-sub-htr">${opts}</select>`;
        }

        if (g === 'FR') {
            const tags = m.frTags || ['4B0', '4B0'];
            const aOpts = FR_TAGS.map((v) =>
                `<option value="${v}" ${tags[0] === v ? 'selected' : ''}>${v}</option>`
            ).join('');
            const bOpts = FR_TAGS.map((v) =>
                `<option value="${v}" ${tags[1] === v ? 'selected' : ''}>${v}</option>`
            ).join('');
            return `<label>方向 A</label><select class="fmc-sub-fra">${aOpts}</select>
                    <label>方向 B</label><select class="fmc-sub-frb">${bOpts}</select>`;
        }

        if (g === 'TECH') {
            const val = (m.tech || '').replace(/"/g, '&quot;');
            return `<label>技巧名</label>
                    <input type="text" class="fmc-sub-tech" spellcheck="false"
                        placeholder="如：ID 序列消步 / 插入 / 反向构造"
                        value="${val}">`;
        }

        return '';
    }

    /* ---------- 子分类事件 ---------- */
    _wireSubEvents(container) {
        const g = this.mainGroup;

        if (g === 'EO') {
            const el = container.querySelector('.fmc-sub-eo');
            el?.addEventListener('change', () => {
                this.meta.badEdges = parseInt(el.value, 10);
                this._updateCardPreview();
                this._debounceSave();
            });
        } else if (g === 'DR') {
            const cEl = container.querySelector('.fmc-sub-drc');
            const eEl = container.querySelector('.fmc-sub-dre');
            cEl?.addEventListener('change', () => {
                this.meta.c = parseInt(cEl.value, 10);
                this._updateCardPreview();
                this._debounceSave();
            });
            eEl?.addEventListener('change', () => {
                this.meta.e = parseInt(eEl.value, 10);
                this._updateCardPreview();
                this._debounceSave();
            });
        } else if (g === 'HTR') {
            const el = container.querySelector('.fmc-sub-htr');
            el?.addEventListener('change', () => {
                this.meta.htr = el.value;
                this._updateCardPreview();
                this._debounceSave();
            });
        } else if (g === 'FR') {
            const aEl = container.querySelector('.fmc-sub-fra');
            const bEl = container.querySelector('.fmc-sub-frb');
            const update = () => {
                const tags = [aEl.value, bEl.value].sort();
                this.meta.frTags = tags;
                this._updateCardPreview();
                this._debounceSave();
            };
            aEl?.addEventListener('change', update);
            bEl?.addEventListener('change', update);
        } else if (g === 'TECH') {
            const el = container.querySelector('.fmc-sub-tech');
            el?.addEventListener('input', () => {
                this.meta.tech = el.value.trim();
                this._updateCardPreview();
                this._debounceSave();
            });
        }
    }

    /* ---------- 全涂色 ---------- */
    _showFullPalette(clientX, clientY) {
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
                this.setAllStickers(color);
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

    /** 一键把 54 个贴纸全涂成同一颜色（跳过 6 个中心块） */
    setAllStickers(color) {
        const c = new THREE.Color(color);

        FACES_3X3.forEach((face) => {
            for (let i = 0; i < 9; i++) {
                // ★ 跳过中心块（idx = 4）
                if (i === 4) continue;

                const key = `${face.key}-${i}`;
                this.stickerColors[key] = color;

                const mesh = this.clickableMeshes.find(
                    (m) => m.userData.faceKey === face.key
                        && m.userData.stickerIdx === i
                );
                if (mesh && mesh.material) {
                    mesh.material.color.copy(c);
                    mesh.material.emissive.copy(c).multiplyScalar(0.07);
                    mesh.material.needsUpdate = true;
                }

                const rect = this.unfoldRects[key];
                if (rect) rect.setAttribute('fill', color);
            }
        });

        this.onSave();
    }
        /** 恢复为标准配色（清除所有自定义涂色） */
    resetAllStickers() {
        FACES_3X3.forEach((face) => {
            const color = face.defaultColor;
            const c = new THREE.Color(color);

            for (let i = 0; i < 9; i++) {
                const key = `${face.key}-${i}`;

                // 清除自定义涂色记录（删除后读取时会用默认色）
                delete this.stickerColors[key];

                // 更新 3D 贴纸
                const mesh = this.clickableMeshes.find(
                    (m) => m.userData.faceKey === face.key
                        && m.userData.stickerIdx === i
                );
                if (mesh && mesh.material) {
                    mesh.material.color.copy(c);
                    mesh.material.emissive.copy(c).multiplyScalar(0.07);
                    mesh.material.needsUpdate = true;
                }

                // 更新展开图
                const rect = this.unfoldRects[key];
                if (rect) rect.setAttribute('fill', color);
            }
        });

        this.onSave();
    }
}