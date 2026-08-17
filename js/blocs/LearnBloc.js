import { Bloc } from '../core/Bloc.js';
import { globalEventBus } from '../core/EventBus.js';
import { parseGccErrors } from '../core/gccErrorParser.js';

const PROGRESS_KEY = 'apm32_learn_progress';
const draftKey = (unitId, exerciseId) => `apm32_learn_draft_${unitId}_${exerciseId}`;

/**
 * LearnBloc
 * Manages Units (10 thematic units), the currently active unit and exercise,
 * live code, theory markdown, and test progress.
 *
 * Unlock Rule:
 * Unit 1 is unlocked by default.
 * Unit N is unlocked if all its prerequisite units have AT LEAST 1 completed exercise.
 */
export class LearnBloc extends Bloc {
    get initialState() {
        let progress = {};
        try {
            progress = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
        } catch {
            progress = {};
        }

        return {
            units: [],
            currentUnitId: null,
            currentUnit: null,
            currentExerciseId: null,
            currentExercise: null,
            // 'code' | 'theory' -- which panel the sidebar tree's active
            // child (an exercise vs. "Especificación") should show. Lives
            // here, not as local DOM state in a UI class, so the sidebar
            // tree and the panel-switcher both react to the same source.
            currentView: 'code',
            code: '',
            theoryMd: '',
            isGrading: false,
            lastResult: null,
            progress
        };
    }

    setView(view) {
        if (view !== 'code' && view !== 'theory') return;
        if (this.state.currentView === view) return;
        this.emit({ currentView: view });
    }

    isUnitUnlocked(unit) {
        if (!unit || !unit.prerequisites || unit.prerequisites.length === 0) return true;

        // A prerequisite unit is considered completed if at least 1 exercise in it is passed
        return unit.prerequisites.every(preId => {
            const preUnit = this.state.units.find(u => u.id === preId);
            if (!preUnit || !preUnit.exercises) return false;
            return preUnit.exercises.some(ex => !!this.state.progress[`${preId}/${ex.id}`]);
        });
    }

    isExercisePassed(unitId, exerciseId) {
        return !!this.state.progress[`${unitId}/${exerciseId}`];
    }

    getUnitCompletedCount(unitId) {
        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit || !unit.exercises) return 0;
        return unit.exercises.filter(ex => !!this.state.progress[`${unitId}/${ex.id}`]).length;
    }

    async loadLevelsIndex() {
        try {
            const res = await fetch('learn-levels/index.json');
            if (!res.ok) throw new Error('Failed to fetch levels index');
            const units = await res.json();
            this.emit({ units });

            if (units.length > 0 && !this.state.currentUnitId) {
                await this.loadUnit(units[0].id);
            }
        } catch (err) {
            globalEventBus.emit('LOG', { message: `Error loading levels: ${err.message}`, type: 'error' });
        }
    }

    async loadUnit(unitId, targetExerciseId = null) {
        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit) return;

        if (!this.isUnitUnlocked(unit)) {
            globalEventBus.emit('LOG', { message: 'Completa al menos un ejercicio de la unidad anterior.', type: 'error' });
            return;
        }

        const exerciseId = targetExerciseId || (unit.exercises && unit.exercises.length > 0 ? unit.exercises[0].id : null);
        const exercise = unit.exercises.find(e => e.id === exerciseId) || unit.exercises[0];

        try {
            globalEventBus.emit('LOG', { message: `Cargando ${unit.title}...`, type: 'warn' });

            const [theoryRes, starterRes] = await Promise.all([
                fetch(`learn-levels/${unitId}/${unit.theoryFile}`),
                fetch(`learn-levels/${unitId}/${exercise.starterFile}`)
            ]);
            if (!theoryRes.ok || !starterRes.ok) throw new Error('Error al obtener contenido de la unidad');

            const theoryMd = await theoryRes.text();
            const starterCode = await starterRes.text();

            const draft = localStorage.getItem(draftKey(unitId, exercise.id));
            const code = draft !== null ? draft : starterCode;

            this.emit({
                currentUnitId: unitId,
                currentUnit: unit,
                currentExerciseId: exercise.id,
                currentExercise: exercise,
                // Also provide currentLevelId for backward compatibility with EditorUI / test results
                currentLevelId: `${unitId}/${exercise.id}`,
                currentView: 'code', // land on code, not wherever theory was left
                code,
                theoryMd,
                lastResult: null
            });

            globalEventBus.emit('COMPILER_ERRORS', { markers: [] });
            globalEventBus.emit('LOG', { message: `Unidad cargada: ${unit.title}`, type: 'success' });
        } catch (err) {
            globalEventBus.emit('LOG', { message: `Error cargando unidad: ${err.message}`, type: 'error' });
        }
    }

    async selectExercise(exerciseId) {
        if (!this.state.currentUnit || !this.state.currentUnitId) return;
        if (this.state.currentExerciseId === exerciseId) {
            // Same exercise clicked again (e.g. from the theory child while
            // this one was already selected) -- nothing to re-fetch, just
            // make sure the code view is what shows.
            this.setView('code');
            return;
        }

        this.saveDraft();

        const unitId = this.state.currentUnitId;
        const exercise = this.state.currentUnit.exercises.find(e => e.id === exerciseId);
        if (!exercise) return;

        try {
            const starterRes = await fetch(`learn-levels/${unitId}/${exercise.starterFile}`);
            if (!starterRes.ok) throw new Error('Error al cargar ejercicio');
            const starterCode = await starterRes.text();

            const draft = localStorage.getItem(draftKey(unitId, exercise.id));
            const code = draft !== null ? draft : starterCode;

            this.emit({
                currentExerciseId: exercise.id,
                currentExercise: exercise,
                currentLevelId: `${unitId}/${exercise.id}`,
                currentView: 'code',
                code,
                lastResult: null
            });

            globalEventBus.emit('COMPILER_ERRORS', { markers: [] });
        } catch (err) {
            globalEventBus.emit('LOG', { message: `Error cargando ejercicio: ${err.message}`, type: 'error' });
        }
    }

    async resetLevelCode() {
        if (!this.state.currentUnitId || !this.state.currentExercise) return;
        const unitId = this.state.currentUnitId;
        const exercise = this.state.currentExercise;

        try {
            localStorage.removeItem(draftKey(unitId, exercise.id));
            const starterRes = await fetch(`learn-levels/${unitId}/${exercise.starterFile}`);
            if (!starterRes.ok) throw new Error('Failed to fetch starter code');
            const starterCode = await starterRes.text();

            this.emit({
                code: starterCode,
                lastResult: null
            });

            globalEventBus.emit('COMPILER_ERRORS', { markers: [] });
            globalEventBus.emit('LOG', { message: `Código de '${exercise.title}' restablecido.`, type: 'info' });
        } catch (err) {
            globalEventBus.emit('LOG', { message: `Error restableciendo código: ${err.message}`, type: 'error' });
        }
    }

    saveDraft() {
        if (!this.state.currentUnitId || !this.state.currentExerciseId) return;
        localStorage.setItem(draftKey(this.state.currentUnitId, this.state.currentExerciseId), this.state.code);
    }

    async runTests(apiUrl, code) {
        if (this.state.isGrading || !this.state.currentUnitId || !this.state.currentExerciseId) return;

        const levelKey = `${this.state.currentUnitId}/${this.state.currentExerciseId}`;
        this.emit({ isGrading: true, lastResult: null });
        globalEventBus.emit('LEARN_STATUS', { status: 'grading' });
        globalEventBus.emit('COMPILER_ERRORS', { markers: [] });
        globalEventBus.emit('LOG', { message: `Evaluando '${this.state.currentExercise.title}'...`, type: 'warn' });

        try {
            const response = await fetch(`${apiUrl}/learn/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ levelId: levelKey, code })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Grading failed');
            }

            if (result.stage === 'compile') {
                const markers = parseGccErrors(result.stderr || '');
                if (markers.length > 0) globalEventBus.emit('COMPILER_ERRORS', { markers });
                globalEventBus.emit('LOG', { message: 'Error de compilación. Revisa las líneas marcadas en el editor.', type: 'error' });
                this.emit({ isGrading: false, lastResult: result });
                globalEventBus.emit('LEARN_STATUS', { status: 'done' });
                globalEventBus.emit('LEARN_RESULT', result);
                return;
            }

            if (result.allPassed) {
                const newProgress = { ...this.state.progress, [levelKey]: true };
                localStorage.setItem(PROGRESS_KEY, JSON.stringify(newProgress));
                this.emit({ isGrading: false, lastResult: result, progress: newProgress });
                globalEventBus.emit('LOG', { message: 'Pruebas completadas exitosamente!', type: 'success' });
            } else {
                this.emit({ isGrading: false, lastResult: result });
                globalEventBus.emit('LOG', { message: 'Algunas pruebas fallaron. Revisa la pestaña Results.', type: 'error' });
            }
            globalEventBus.emit('LEARN_STATUS', { status: 'done' });
            globalEventBus.emit('LEARN_RESULT', result);
        } catch (err) {
            this.emit({ isGrading: false });
            globalEventBus.emit('LEARN_STATUS', { status: 'error' });
            globalEventBus.emit('LOG', { message: `Error ejecutando pruebas: ${err.message}`, type: 'error' });
        }
    }
}
