// ===== js/blind-module.js =====
import * as THREE from 'three';
import { Cube3x3Module, FACES_3X3 } from './3x3-module.js';

/* ============================================================
 *  主分类
 * ============================================================ */
export const BLIND_MAIN_GROUPS = [
    { key: 'corner', label: '角块 378' },
    { key: 'edge',   label: '棱块 440' },
    { key: 'other',  label: '其他' },
];

/* ============================================================
 *  BlindCubeModule —— 继承三阶模块，加盲拧元数据
 * ============================================================ */
export class BlindCubeModule extends Cube3x3Module {
    constructor(state, onSave, onDelete) {
        super(state, onSave, onDelete);
        this.mainGroup = (state && state.mainGroup) || 'corner';
        this.userGroup = (state && state.userGroup) || '';
        // title 已由父类维护，作为「名字」（如 GY）
        // 重设后重新渲染卡片
        this._updateCardPreview();
    }

    /* ---------- 序列化 ---------- */
    serialize() {
        return {
            ...super.serialize(),
            mainGroup: this.mainGroup,
            userGroup: this.userGroup,
        };
    }

    /* ---------- 覆盖卡片 DOM：顶部加名字 ---------- */
    _buildCardDOM() {
        const card = document.createElement('div');
        card.className = 'pyraminx-card blind-card';
        card.dataset.id = this.id;
        card.innerHTML = `
            <div class="card-name"></div>
            <div class="card-canvas-host"></div>
            <div class="card-formula-preview"></div>
            <div class="card-group-tag hidden"></div>
        `;

        this.element = card;
        this.cardNameEl = card.querySelector('.card-name');
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
        // 名字
        if (this.cardNameEl) {
            const name = (this.title || '').trim();
            if (name) {
                this.cardNameEl.textContent = name;
                this.cardNameEl.classList.remove('empty');
            } else {
                this.cardNameEl.textContent = '（未命名）';
                this.cardNameEl.classList.add('empty');
            }
        }
        // 公式预览
        if (this.cardFormulaEl) {
            if (this.formula && this.formula.trim()) {
                this.cardFormulaEl.textContent = this.formula;
                this.cardFormulaEl.classList.remove('empty');
            } else {
                this.cardFormulaEl.textContent = '（暂无公式）';
                this.cardFormulaEl.classList.add('empty');
            }
        }
        // 分组标签
        if (this.cardGroupEl) {
            const mainLabel = BLIND_MAIN_GROUPS.find((g) => g.key === this.mainGroup)?.label || '';
            const ug = (this.userGroup || '').trim();
            let tagText = mainLabel;
            if (ug) tagText += ' · ' + ug;
            if (tagText) {
                this.cardGroupEl.textContent = tagText;
                this.cardGroupEl.classList.remove('hidden');
            } else {
                this.cardGroupEl.classList.add('hidden');
            }
        }
    }

    /* ---------- 覆盖模态：加分类 / 分组行 ---------- */
    openModal() {
        if (this._modalOpen) return;
        super.openModal();

        const modal = this.modalEl;
        if (!modal) return;

        const header = modal.querySelector('.modal-header');
        const body = modal.querySelector('.modal-body');

        // 隐藏父类的 group 输入
        const parentGroupInput = header.querySelector('.module-group');
        if (parentGroupInput) parentGroupInput.style.display = 'none';

        // 修改标题输入框 placeholder，更清楚
        const titleInput = header.querySelector('.module-title');
        if (titleInput) {
            titleInput.placeholder = '名字（如 GY）';
        }

        // 插入盲拧行
        const blindRow = document.createElement('div');
        blindRow.className = 'blind-row';
        blindRow.innerHTML = `
            <label class="blind-row-label">分类</label>
            <select class="blind-main-select">
                ${BLIND_MAIN_GROUPS.map((g) =>
                    `<option value="${g.key}" ${this.mainGroup === g.key ? 'selected' : ''}>${g.label}</option>`
                ).join('')}
            </select>
            <label class="blind-row-label">分组</label>
            <input type="text" class="blind-user-group" spellcheck="false"
                placeholder="如：G组、J组" value="${(this.userGroup || '').replace(/"/g, '&quot;')}">
        `;
        header.parentNode.insertBefore(blindRow, body);

        blindRow.querySelector('.blind-main-select').addEventListener('change', (e) => {
            this.mainGroup = e.target.value;
            this._updateCardPreview();
            this._debounceSave();
        });
        blindRow.querySelector('.blind-user-group').addEventListener('input', (e) => {
            this.userGroup = e.target.value;
            this._updateCardPreview();
            this._debounceSave();
        });

        requestAnimationFrame(() => this.resize());
    }
}