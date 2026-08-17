import { CHEVRON_ICON } from './SidebarUI.js';

const INDENT_PX = 16;

/**
 * LevelListUI (MHRD / Engineering TUI Tree)
 * Renders the 11 thematic units in the sidebar (#levelListPane) as an
 * expandable tree -- same convention as SidebarUI's IDE-mode file tree,
 * and the same pattern MHRD's own sidebar uses (its "Tasks/" folder holds
 * the current mission the same way a real folder holds files). Only the
 * *current* unit ever renders expanded (accordion, not free-multi-expand):
 * with 11 units x (1 spec + 4 exercises) children, showing more than one
 * open at a time would turn this into an unscannable wall.
 *
 * Expanding a unit reveals its Specification and its 4 missions as
 * children right there -- this replaced a separate Specification/Design
 * toggle + mission-chip bar that used to live above the editor.
 */
export class LevelListUI {
    constructor(learnBloc) {
        this.learnBloc = learnBloc;
        this.container = document.getElementById('levelListPane');

        this.learnBloc.subscribe(this.render.bind(this));
    }

    render(state) {
        if (!this.container) return;
        this.container.innerHTML = '';

        if (!state.units || state.units.length === 0) {
            this.container.innerHTML = `<div class="p-3 text-[10px] opacity-40 uppercase tracking-widest font-mono">// INITIALIZING WORKSPACE...</div>`;
            return;
        }

        const fragment = document.createDocumentFragment();

        const section = document.createElement('div');
        section.className = "text-[10px] font-mono font-bold text-[var(--sidebar-text)] uppercase tracking-widest mb-3 px-1 flex justify-between";
        section.innerHTML = `<span>-- Tasks / Units</span><span>${state.units.length} UNITS</span>`;
        fragment.appendChild(section);

        state.units.forEach((unit, idx) => {
            const isCurrent = unit.id === state.currentUnitId;
            fragment.appendChild(this.renderUnitRow(unit, idx, state, isCurrent));
            if (isCurrent) {
                fragment.appendChild(this.renderUnitChildren(unit, state));
            }
        });

        this.container.appendChild(fragment);
    }

    renderUnitRow(unit, idx, state, isExpanded) {
        const unlocked = this.learnBloc.isUnitUnlocked(unit);
        const completedCount = this.learnBloc.getUnitCompletedCount(unit.id);
        const totalCount = unit.exercises ? unit.exercises.length : 4;
        const isCompleted = completedCount > 0;

        const div = document.createElement('div');
        div.className = `py-2 px-2 font-mono text-[11px] flex items-center justify-between transition-colors duration-100 ${
            isExpanded
                ? 'bg-[var(--active-bg)] text-[var(--active-text)] font-bold'
                : (unlocked
                    ? 'bg-transparent text-[var(--sidebar-text)] hover:text-[var(--accent-text)] cursor-pointer'
                    : 'bg-transparent text-[var(--text-muted)] cursor-not-allowed opacity-40')
        }`;

        if (unlocked && !isExpanded) {
            div.onclick = () => this.learnBloc.loadUnit(unit.id);
        }

        const prefix = isCompleted ? '[OK]' : (unlocked ? `[${String(idx + 1).padStart(2, '0')}]` : '[-]');
        const shortTitle = unit.title.replace(/^Unidad \d+:\s*/i, '');

        const chevron = unlocked
            ? `<span style="transform: rotate(${isExpanded ? 90 : 0}deg); display: inline-flex;">${CHEVRON_ICON}</span>`
            : `<span class="w-3 flex-shrink-0"></span>`;

        div.innerHTML = `
            <div class="flex items-center gap-1.5 overflow-hidden pointer-events-none min-w-0 flex-1 mr-2">
                ${chevron}
                <span class="flex-shrink-0 whitespace-nowrap ${isExpanded ? 'text-[var(--active-text)] font-bold' : (isCompleted ? 'text-[var(--btn-green-text)] font-bold' : 'text-[var(--text-muted)]')}">${prefix}</span>
                <span class="truncate min-w-0">${shortTitle}</span>
            </div>
            <span class="flex-shrink-0 text-[10px] font-mono tracking-wider ${isExpanded ? 'text-[var(--active-text)] font-bold' : 'text-[var(--text-muted)]'}">
                ${completedCount}/${totalCount}
            </span>
        `;

        return div;
    }

    renderUnitChildren(unit, state) {
        const wrap = document.createElement('div');
        wrap.className = 'mb-1';

        wrap.appendChild(this.renderSpecChild(state));

        (unit.exercises || []).forEach((ex, idx) => {
            wrap.appendChild(this.renderExerciseChild(ex, idx, state));
        });

        return wrap;
    }

    // No opacity fades here on purpose -- text-main/sidebar-text are already
    // full-strength colors, so a bracket prefix at opacity-70 on top of that
    // was a second, unnecessary dimming layer stacked on the first (that
    // combination is what actually made the tree hard to read). Active gets
    // the same inverted fill as the parent unit row -- one consistent
    // "this is what's showing" signal, not a color-only change that's easy
    // to miss.
    renderSpecChild(state) {
        const isActive = state.currentView === 'theory';
        const div = document.createElement('div');
        div.className = `py-1.5 font-mono text-[11px] cursor-pointer transition-colors duration-100 ${
            isActive ? 'bg-[var(--active-bg)] text-[var(--active-text)] font-bold' : 'text-[var(--sidebar-text)] hover:text-[var(--accent-text)]'
        }`;
        div.style.paddingLeft = `${8 + INDENT_PX}px`;
        div.onclick = () => this.learnBloc.setView('theory');
        div.innerHTML = `[SPEC] Especificación`;
        return div;
    }

    renderExerciseChild(ex, idx, state) {
        const isPassed = !!state.progress[`${state.currentUnitId}/${ex.id}`];
        const isActive = state.currentView === 'code' && ex.id === state.currentExerciseId;
        const missionNum = `M${String(idx + 1).padStart(2, '0')}`;
        const label = ex.title.replace(/^Ejercicio \d+:\s*/i, '');

        const div = document.createElement('div');
        div.className = `py-1.5 font-mono text-[11px] cursor-pointer transition-colors duration-100 ${
            isActive
                ? 'bg-[var(--active-bg)] text-[var(--active-text)] font-bold'
                : (isPassed ? 'text-[var(--btn-green-text)]' : 'text-[var(--sidebar-text)] hover:text-[var(--accent-text)]')
        }`;
        div.style.paddingLeft = `${8 + INDENT_PX}px`;
        div.onclick = () => this.learnBloc.selectExercise(ex.id);
        div.innerHTML = `${isPassed ? '[OK]' : `[${missionNum}]`} ${label}`;
        return div;
    }
}
