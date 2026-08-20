import { CHEVRON_ICON } from './SidebarUI.js';

const INDENT_PX = 16;

/**
 * LevelListUI (MHRD / Engineering TUI Tree)
 * Renders the curriculum in the sidebar (#levelListPane) as a 3-level
 * expandable tree: super unit (Básicos de C / Uso de la Placa / C
 * Avanzado) -> thematic unit -> Specification + missions -- same
 * convention as SidebarUI's IDE-mode file tree, and the same pattern
 * MHRD's own sidebar uses (its "Tasks/" folder holds the current mission
 * the same way a real folder holds files).
 *
 * The 3 super units always render expanded (there's only 3 of them, so
 * an accordion would just be an extra click for no scannability benefit).
 * Units inside a super unit keep the ORIGINAL accordion behavior --
 * only the *current* unit's Spec+missions show, since with 14 units the
 * full tree would still be an unscannable wall if they all opened at once.
 *
 * Expanding a unit reveals its Specification and its missions as
 * children right there -- this replaced a separate Specification/Design
 * toggle + mission-chip bar that used to live above the editor.
 */
export class LevelListUI {
    constructor(learnBloc) {
        this.learnBloc = learnBloc;
        this.container = document.getElementById('levelListPane');

        this.learnBloc.subscribe(this.render.bind(this));
    }

    // Groups state.units by their `superUnit.id`, preserving each unit's
    // first-seen order (== curriculum order in index.json, no separate
    // sort needed). Units missing a superUnit (shouldn't happen, but
    // matches the defensive-default style the rest of this codebase
    // uses) fall into a synthetic bucket instead of silently vanishing.
    groupBySuperUnit(units) {
        const groups = new Map();
        const fallback = { id: '_ungrouped', title: 'Unidades', order: 999 };

        for (const unit of units) {
            const su = unit.superUnit || fallback;
            if (!groups.has(su.id)) {
                groups.set(su.id, { id: su.id, title: su.title, order: su.order, units: [] });
            }
            groups.get(su.id).units.push(unit);
        }

        return [...groups.values()].sort((a, b) => a.order - b.order);
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

        // Single counter across all 3 groups so unit numbering (the
        // renderUnitRow "[0X]" prefix on a locked/not-yet-current unit)
        // stays continuous across the whole curriculum instead of
        // resetting to 1 inside each super unit.
        let unitIdx = 0;
        this.groupBySuperUnit(state.units).forEach(group => {
            fragment.appendChild(this.renderSuperUnitHeader(group));
            group.units.forEach(unit => {
                const isCurrent = unit.id === state.currentUnitId;
                fragment.appendChild(this.renderUnitRow(unit, unitIdx, state, isCurrent));
                if (isCurrent) {
                    fragment.appendChild(this.renderUnitChildren(unit, state));
                }
                unitIdx++;
            });
        });

        this.container.appendChild(fragment);
    }

    // Non-clickable, always-expanded -- purely a visual grouping label,
    // one step above the "-- Tasks / Units" section divider (same
    // font-mono/uppercase/tracking-widest convention, one notch dimmer so
    // it doesn't compete with that top-level header).
    renderSuperUnitHeader(group) {
        const completed = group.units.reduce((sum, u) => sum + this.learnBloc.getUnitCompletedCount(u.id), 0);
        const total = group.units.reduce((sum, u) => sum + (u.exercises ? u.exercises.length : 0), 0);

        const div = document.createElement('div');
        div.className = "mt-3 mb-1 px-2 pb-1 border-b border-[var(--border-color)] font-mono text-[9px] font-bold uppercase tracking-widest text-[var(--sidebar-text)] opacity-70 flex justify-between";
        div.innerHTML = `<span>${group.title}</span><span>${completed}/${total}</span>`;
        return div;
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
        // Nests one level under its super-unit header -- style wins over
        // the px-2 class's own padding-left (same trick SidebarUI.js's
        // file-tree rows already use for the same reason).
        div.style.paddingLeft = `${8 + INDENT_PX}px`;

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
                <span class="flex-shrink-0 whitespace-nowrap ${isExpanded ? 'text-[var(--active-text)] font-bold' : (isCompleted ? 'text-[var(--success-text)] font-bold' : 'text-[var(--text-muted)]')}">${prefix}</span>
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
        div.style.paddingLeft = `${8 + INDENT_PX * 2}px`;
        div.onclick = () => this.learnBloc.setView('theory');
        div.innerHTML = `[SPEC] Especificación`;
        return div;
    }

    renderExerciseChild(ex, idx, state) {
        const isPassed = !!state.progress[`${state.currentUnitId}/${ex.id}`];
        const isActive = state.currentView === 'code' && ex.id === state.currentExerciseId;
        // The real mission number lives in ex.title itself ("M45: ...")
        // -- deriving it from array position (idx) used to only work by
        // coincidence for the very first unit (where local position 0-3
        // happens to equal global M01-M04); every other unit showed the
        // wrong [M0X] badge. Falls back to position-based numbering only
        // if a title somehow doesn't start with "M<number>:".
        const missionMatch = ex.title.match(/^M(\d+):/);
        const missionNum = missionMatch ? `M${missionMatch[1]}` : `M${String(idx + 1).padStart(2, '0')}`;
        const label = ex.title.replace(/^M\d+:\s*/, '');

        const div = document.createElement('div');
        div.className = `py-1.5 font-mono text-[11px] cursor-pointer transition-colors duration-100 ${
            isActive
                ? 'bg-[var(--active-bg)] text-[var(--active-text)] font-bold'
                : (isPassed ? 'text-[var(--success-text)]' : 'text-[var(--sidebar-text)] hover:text-[var(--accent-text)]')
        }`;
        div.style.paddingLeft = `${8 + INDENT_PX * 2}px`;
        div.onclick = () => this.learnBloc.selectExercise(ex.id);
        div.innerHTML = `${isPassed ? '[OK]' : `[${missionNum}]`} ${label}`;
        return div;
    }
}
