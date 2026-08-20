import { Bloc } from '../core/Bloc.js';
import { globalEventBus } from '../core/EventBus.js';
import { parseGccErrors } from '../core/gccErrorParser.js';
import { compileToWasm, runWasmModule } from '../core/WasmToolchain.js';

// Both keys take a `namespace` -- null/undefined for the anonymous/guest
// bucket, a Firebase uid once signed in (see LearnBloc.setNamespace()).
// The guest bucket deliberately reuses the original unscoped key names
// (no `_guest` suffix) so anyone who already had local progress before
// this change doesn't lose it. Without this, two different Google
// accounts signed into the same browser -- or a signed-in account and a
// later guest -- would read and write the exact same localStorage keys
// and silently inherit each other's in-progress edits and pass/fail
// state, which is the bug this namespacing exists to close.
const PROGRESS_KEY_BASE = 'apm32_learn_progress';
const progressKey = (namespace) => namespace ? `${PROGRESS_KEY_BASE}_${namespace}` : PROGRESS_KEY_BASE;
const draftKey = (namespace, unitId, exerciseId) => {
    const base = namespace ? `apm32_learn_draft_${namespace}` : 'apm32_learn_draft';
    return `${base}_${unitId}_${exerciseId}`;
};
// Same trailing-whitespace-insensitive comparison backend/learnRunner.js's
// own normalize() used -- kept identical so a test that passed server-side
// still passes here, and vice versa.
const normalizeOutput = (output) => (output || '').replace(/\s+$/, '');

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
        // Runs before this.namespace has a value (called from the base
        // Bloc constructor), so this always reads the guest bucket first --
        // setNamespace() re-reads under the right key as soon as app.js
        // knows who's signed in (see AUTH_LOGIN below).
        let progress = {};
        try {
            progress = JSON.parse(localStorage.getItem(progressKey(this.namespace)) || '{}');
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
        return true;
    }

    isExercisePassed(unitId, exerciseId) {
        return !!this.state.progress[`${unitId}/${exerciseId}`];
    }

    getUnitCompletedCount(unitId) {
        const unit = this.state.units.find(u => u.id === unitId);
        if (!unit || !unit.exercises) return 0;
        return unit.exercises.filter(ex => !!this.state.progress[`${unitId}/${ex.id}`]).length;
    }

    // Switches which localStorage bucket progress/drafts read and write --
    // app.js calls this on AUTH_LOGIN (with the uid) and AUTH_LOGOUT (with
    // null), *before* touching the cloud, so a stale in-memory progress
    // object from whoever was previously signed in on this browser never
    // gets unioned into the new identity's cloud doc by loadProgressFromCloud.
    async setNamespace(namespace) {
        const next = namespace || null;
        if (this.namespace === next) return;
        this.namespace = next;

        let progress = {};
        try {
            progress = JSON.parse(localStorage.getItem(progressKey(this.namespace)) || '{}');
        } catch {
            progress = {};
        }
        this.emit({ progress });

        // Re-resolve whatever exercise is currently open under the new
        // identity's own draft too -- otherwise it keeps showing the
        // previous identity's unsaved edit until the student navigates
        // away and back.
        const { currentUnitId, currentExercise } = this.state;
        if (currentUnitId && currentExercise) {
            const draft = localStorage.getItem(draftKey(this.namespace, currentUnitId, currentExercise.id));
            if (draft !== null) {
                this.emit({ code: draft });
            } else {
                try {
                    const starterRes = await fetch(`learn-levels/${currentUnitId}/${currentExercise.starterFile}`);
                    if (starterRes.ok) this.emit({ code: await starterRes.text() });
                } catch {
                    // Background identity switch -- not worth surfacing a
                    // fresh error log for, the student didn't take an action.
                }
            }
        }
    }

    // Mirrors FileSystemBloc's saveProjectToCloud/loadProjectFromCloud pair
    // exactly (call-time db/user params, not constructor deps -- LearnBloc
    // stays Auth-agnostic). Both live on the same users/{uid} doc the
    // project save already uses, under a sibling `learnProgress` field.
    async loadProgressFromCloud(db, user) {
        if (!user) return;
        try {
            const doc = await db.collection("users").doc(user.uid).get();
            const cloudProgress = (doc.exists && doc.data().learnProgress) || {};
            // Union, not overwrite -- progress is monotonic (an exercise,
            // once passed, stays passed), so merging can never lose a real
            // pass in either direction. Contrast with the project save's
            // plain overwrite, which is correct there because file content
            // genuinely can conflict.
            const merged = { ...cloudProgress, ...this.state.progress };
            localStorage.setItem(progressKey(this.namespace), JSON.stringify(merged));
            this.emit({ progress: merged });
            // Push the merged result back up immediately -- covers "had
            // local-only progress before ever logging in" by syncing it to
            // the cloud on this same login, not waiting for the next
            // passed exercise.
            await this.saveProgressToCloud(db, user);
        } catch (err) {
            globalEventBus.emit('LOG', { message: `Error cargando progreso: ${err.message}`, type: 'error' });
        }
    }

    async saveProgressToCloud(db, user) {
        if (!user) return;
        try {
            // merge: true is load-bearing here -- a plain .set() would wipe
            // out the `project`/`email` fields FileSystemBloc's cloud save
            // already wrote to this same document.
            await db.collection("users").doc(user.uid)
                .set({ learnProgress: this.state.progress }, { merge: true });
        } catch (err) {
            globalEventBus.emit('LOG', { message: `Error guardando progreso: ${err.message}`, type: 'error' });
        }
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

            const draft = localStorage.getItem(draftKey(this.namespace, unitId, exercise.id));
            const code = draft !== null ? draft : starterCode;

            this.emit({
                currentUnitId: unitId,
                currentUnit: unit,
                currentExerciseId: exercise.id,
                currentExercise: exercise,
                // Also provide currentLevelId for backward compatibility with EditorUI / test results
                currentLevelId: `${unitId}/${exercise.id}`,
                currentView: 'theory', // selecting a unit opens its Specification first
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

            const draft = localStorage.getItem(draftKey(this.namespace, unitId, exercise.id));
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
            localStorage.removeItem(draftKey(this.namespace, unitId, exercise.id));
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
        localStorage.setItem(draftKey(this.namespace, this.state.currentUnitId, this.state.currentExerciseId), this.state.code);
    }

    // Compiles+runs entirely in the browser (vendored wasm-clang -- see
    // WasmToolchain.js) against this exercise's own tests.json (mirrored
    // into frontend/learn-levels/ specifically for this: it used to live
    // backend-only, on purpose, so a curious student couldn't just read
    // expected outputs from the Network tab before ever attempting the
    // exercise -- worth knowing that tradeoff shifted here, though today's
    // UI already reveals a failed test's own expectedStdout anyway).
    async gradeLocally(unitId, exerciseId, code, onProgress) {
        const testsRes = await fetch(`learn-levels/${unitId}/${exerciseId}/tests.json`);
        if (!testsRes.ok) throw new Error('tests.json not found locally');
        const tests = await testsRes.json();

        const compiled = await compileToWasm({ 'main.c': code }, onProgress);
        if (!compiled.success) {
            return { success: false, stage: 'compile', stderr: compiled.stderr };
        }

        if (onProgress) onProgress('Ejecutando pruebas...');
        const results = [];
        for (let i = 0; i < tests.length; i++) {
            const test = tests[i];
            // Same compiled module reused across every test case, one
            // run per test's own stdin.
            const run = await runWasmModule(compiled.module, test.stdin || '');
            const passed = normalizeOutput(run.stdout) === normalizeOutput(test.expectedStdout);
            results.push({
                index: i,
                passed,
                actualStdout: run.stdout,
                expectedStdout: test.expectedStdout,
                timedOut: false
            });
        }

        return { success: true, stage: 'tests', allPassed: results.every(r => r.passed), results };
    }

    // Fallback path -- same server-side grader this app used exclusively
    // before WASM: only reached if the local compiler itself couldn't run
    // (the vendored wasm-clang assets failed to load, etc.), never for the
    // student's own compile errors (those come back as a normal 'compile'
    // stage result either way).
    async gradeOnServer(apiUrl, levelKey, code) {
        const response = await fetch(`${apiUrl}/learn/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ levelId: levelKey, code })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Grading failed');
        return result;
    }

    async runTests(apiUrl, code) {
        if (this.state.isGrading || !this.state.currentUnitId || !this.state.currentExerciseId) return;

        const unitId = this.state.currentUnitId;
        const exerciseId = this.state.currentExerciseId;
        const levelKey = `${unitId}/${exerciseId}`;
        this.emit({ isGrading: true, lastResult: null });
        globalEventBus.emit('LEARN_STATUS', { status: 'grading' });
        globalEventBus.emit('COMPILER_ERRORS', { markers: [] });
        globalEventBus.emit('LOG', { message: `Evaluando '${this.state.currentExercise.title}'...`, type: 'warn' });

        try {
            let result;
            try {
                result = await this.gradeLocally(unitId, exerciseId, code, (msg) => {
                    globalEventBus.emit('LOG', { message: msg, type: 'info' });
                });
            } catch (wasmErr) {
                globalEventBus.emit('LOG', {
                    message: `Compilador local no disponible (${wasmErr.message}) -- usando el servidor...`,
                    type: 'warn'
                });
                result = await this.gradeOnServer(apiUrl, levelKey, code);
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
                localStorage.setItem(progressKey(this.namespace), JSON.stringify(newProgress));
                this.emit({ isGrading: false, lastResult: result, progress: newProgress });
                globalEventBus.emit('LOG', { message: 'Pruebas completadas exitosamente!', type: 'success' });
                // Cloud sync is opt-out-free (unlike the IDE project's
                // autosave checkbox) since there's no destructive-overwrite
                // risk here -- app.js's listener silently no-ops if nobody's
                // logged in, so this is a no-op for the common anonymous case.
                globalEventBus.emit('LEARN_PROGRESS_UPDATED', { progress: newProgress });
            } else {
                this.emit({ isGrading: false, lastResult: result });
                globalEventBus.emit('LOG', { message: 'Algunas pruebas fallaron.', type: 'error' });
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
