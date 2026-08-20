import { Bloc } from '../core/Bloc.js';
import { globalEventBus } from '../core/EventBus.js';

export class FileSystemBloc extends Bloc {
    // Both params optional -- the existing IDE-mode call site (`new
    // FileSystemBloc()`) is unaffected, getting the APM32 seed on the
    // shared `project` cloud field exactly as before. Playground's
    // instance passes its own plain-C seed and a sibling cloud field
    // (`playgroundProject`) so the two projects don't collide on the
    // same users/{uid} document -- same sibling-field pattern already
    // used for `learnProgress`.
    constructor(seedFiles = null, cloudField = 'project') {
        super();
        this.cloudField = cloudField;
        // Namespace-scoped localStorage mirror of virtualFS -- reported bug:
        // without any of this, reloading the page always lost unsaved work
        // (this bloc never persisted anything itself; only an explicit
        // SAVE CLOUD, which needs an account, did). Same account-isolation
        // design as LearnBloc.setNamespace() (see that file): `namespace`
        // is null/guest until AUTH_LOGIN sets it to a uid, so two different
        // accounts signed into the same browser -- or a signed-in account
        // and a later guest -- never inherit each other's local draft.
        this.namespace = null;
        this.seedFiles = seedFiles;
        if (seedFiles) {
            const firstFile = Object.keys(seedFiles)[0] || null;
            // Direct state overwrite, not emit() -- nothing has subscribed
            // yet this early in construction, so there's nothing to notify.
            this._state = { ...this._state, virtualFS: seedFiles, currentFile: firstFile };
        }

        const draft = this.readLocalDraft();
        // app.js checks this before its own default-example auto-load,
        // which would otherwise silently clobber a just-restored draft
        // moments after construction (found while fixing this bug: only
        // the IDE instance has that auto-load, which is exactly why the
        // Playground restore worked on the first pass and IDE's didn't).
        this.restoredFromLocal = !!draft;
        if (draft) {
            this._state = { ...this._state, virtualFS: draft.virtualFS, currentFile: draft.currentFile };
        }

        // Mirrors every future state change to localStorage -- covers all
        // the existing mutating methods (createFile, updateFileContent,
        // ...) automatically, without touching each one individually.
        this.subscribe(() => this.persistLocal());
    }

    localDraftKey() {
        return `apm32_local_fs_${this.cloudField}_${this.namespace || 'guest'}`;
    }

    readLocalDraft() {
        try {
            const raw = localStorage.getItem(this.localDraftKey());
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    persistLocal() {
        try {
            localStorage.setItem(this.localDraftKey(), JSON.stringify({
                virtualFS: this.state.virtualFS,
                currentFile: this.state.currentFile
            }));
        } catch {
            // Quota exceeded or localStorage unavailable (private browsing,
            // etc.) -- local persistence is a convenience, not something
            // worth surfacing an error for.
        }
    }

    // Switches which localStorage bucket this instance reads/writes --
    // app.js calls this on AUTH_LOGIN (uid) and AUTH_LOGOUT (null), before
    // loadProjectFromCloud(), so a signed-in account never starts from
    // whichever identity was previously using this browser.
    setNamespace(namespace) {
        const next = namespace || null;
        if (this.namespace === next) return;
        this.namespace = next;

        const draft = this.readLocalDraft();
        // Same flag the constructor sets, kept up to date here too -- both
        // are "did this instance just get a real draft from localStorage,
        // or a fresh/seed slate" for app.js's example-auto-load guard.
        this.restoredFromLocal = !!draft;
        if (draft) {
            this.emit({ virtualFS: draft.virtualFS, currentFile: draft.currentFile });
            return;
        }

        // No local draft under the new identity -- back to a clean slate
        // (the seed, or this bloc's own hardcoded default), not just the
        // file content but the project metadata that goes with a fresh
        // instance too.
        const fresh = this.initialState;
        if (this.seedFiles) {
            fresh.virtualFS = this.seedFiles;
            fresh.currentFile = Object.keys(this.seedFiles)[0] || null;
        }
        this.emit(fresh);
    }

    get initialState() {
        return {
            virtualFS: {
                'src/main.c': `#include "apm32f10x.h"\n#include "apm32_config.h"\n\n/* USER CODE BEGIN Includes */\n/* USER CODE END Includes */\n\nint main(void) {\n    // Configures clocks and selected components\n    APM32_Init();\n    \n    /* USER CODE BEGIN Init */\n    /* USER CODE END Init */\n\n    while(1) {\n        /* USER CODE BEGIN While */\n        GPIOB->ODATA ^= (1 << 2); // Toggle LED PB2\n        delay_ms(500);\n\n        /* USER CODE END While */\n    }\n    \n    return 0;\n}`,
                'src/apm32_config.c': `#include "apm32_config.h"\n\n/* USER CODE BEGIN Includes */\n/* USER CODE END Includes */\n\nvoid APM32_Init(void) {\n    // System Initialization (Main Clocks)\n    SystemInit();\n    \n    // Initialization of selected components\n    SysTick_Init(); // Inicializar timer de delay\n    RCM->APB2CLKEN |= (1 << 3); // Habilitar reloj GPIOB\n    \n    // Configurar LED en PB2 como salida Push-Pull (50MHz)\n    GPIOB->CFGLOW = (GPIOB->CFGLOW & ~(0xF << 8)) | (0x3 << 8);\n\n    /* USER CODE BEGIN APM32_Init */\n    /* USER CODE END APM32_Init */\n}\n\n/* USER CODE BEGIN Private Functions */\n/* USER CODE END Private Functions */`,
                'inc/apm32_config.h': `#ifndef APM_CFG\n#define APM_CFG\n#include "apm32f10x.h"\n\nvoid APM32_Init(void);\n\n#endif`,
                'src/delay.c': `#include "delay.h"\n#include "apm32f10x.h"\n\nvolatile uint32_t msTicks = 0;\n\nvoid SysTick_Init(void) {\n    // Update SystemCoreClock variable in case HSE fails and HSI (8MHz) is used\n    SystemCoreClockUpdate();\n    \n    // Configure SysTick for 1ms intervals\n    if (SysTick_Config(SystemCoreClock / 1000)) {\n        while (1); // Error trap\n    }\n    \n    // Set SysTick to the highest priority (0) to prevent delay_ms() from deadlocking\n    NVIC_SetPriority(SysTick_IRQn, 0);\n}\n\nvoid delay_ms(uint32_t ms) {\n    uint32_t start = msTicks;\n    while ((msTicks - start) < ms);\n}\n\nvoid SysTick_Handler(void) {\n    msTicks++;\n}`,
                'inc/delay.h': `#ifndef DELAY_H\n#define DELAY_H\n\n#include <stdint.h>\n\nextern volatile uint32_t msTicks;\n\n// Prototipos\nvoid SysTick_Init(void);\nvoid delay_ms(uint32_t ms);\n\n// Aliases for common naming conventions\n#define DelayMs     delay_ms\n#define Delay_ms    delay_ms\n#define delayMs     delay_ms\n#define DELAY_MS    delay_ms\n\n#endif`
            },
            currentFile: 'src/main.c',
            projectType: 'scratchpad',
            projectName: '',
            projectId: null,
            // Playground only: names (not content -- see setBinaryNames())
            // of binaries ConsoleUI's manual terminal has compiled this
            // session. Always [] for IDE's instance.
            binaryNames: []
        };
    }

    // Playground's manual terminal (ConsoleUI.js) compiles binaries that
    // deliberately never enter virtualFS -- their actual bytes stay in
    // ConsoleUI's own session memory (never shown as text, never saved to
    // cloud). This just records their NAMES so SidebarUI can show that they
    // exist instead of a compiled program silently vanishing from view.
    setBinaryNames(names) {
        this.emit({ binaryNames: names || [] });
    }

    createFile(filename) {
        if (this.state.virtualFS[filename]) {
            globalEventBus.emit('LOG', { message: 'File already exists!', type: 'error' });
            return false;
        }
        
        const newFS = { ...this.state.virtualFS };
        newFS[filename] = `// New file: ${filename}\n`;
        
        this.emit({ virtualFS: newFS, currentFile: filename });
        globalEventBus.emit('LOG', { message: `Created ${filename}`, type: 'success' });
        return true;
    }

    deleteFile(filename) {
        if (!this.state.virtualFS[filename]) return;
        
        const newFS = { ...this.state.virtualFS };
        delete newFS[filename];
        
        let newCurrent = this.state.currentFile;
        if (newCurrent === filename) {
            const keys = Object.keys(newFS);
            newCurrent = keys.length > 0 ? keys[0] : null;
        }
        
        this.emit({ virtualFS: newFS, currentFile: newCurrent });
        globalEventBus.emit('LOG', { message: `Deleted ${filename}`, type: 'warn' });
    }

    renameFile(oldName, newName, contentBeforeRename) {
        if (this.state.virtualFS[newName]) {
            globalEventBus.emit('LOG', { message: 'File name already taken!', type: 'error' });
            return false;
        }

        const newFS = { ...this.state.virtualFS };
        // Si hay un contenido actual en el editor antes de renombrar, lo usamos en lugar del viejo virtualFS
        newFS[newName] = contentBeforeRename !== undefined ? contentBeforeRename : newFS[oldName];
        delete newFS[oldName];

        let newCurrent = this.state.currentFile;
        if (newCurrent === oldName) {
            newCurrent = newName;
        }

        this.emit({ virtualFS: newFS, currentFile: newCurrent });
        globalEventBus.emit('LOG', { message: `Renamed to ${newName}`, type: 'success' });
        return true;
    }

    renameFolder(oldPath, newPath) {
        const prefix = oldPath + '/';
        const newPrefix = newPath + '/';
        const affected = Object.keys(this.state.virtualFS).filter(f => f.startsWith(prefix));
        if (affected.length === 0) return false;

        const collision = affected.some(f => this.state.virtualFS[newPrefix + f.slice(prefix.length)] !== undefined);
        if (collision) {
            globalEventBus.emit('LOG', { message: 'A file already exists at that folder name.', type: 'error' });
            return false;
        }

        const newFS = { ...this.state.virtualFS };
        let newCurrent = this.state.currentFile;
        affected.forEach(oldFile => {
            const newFile = newPrefix + oldFile.slice(prefix.length);
            newFS[newFile] = newFS[oldFile];
            delete newFS[oldFile];
            if (this.state.currentFile === oldFile) newCurrent = newFile;
        });

        this.emit({ virtualFS: newFS, currentFile: newCurrent });
        globalEventBus.emit('LOG', { message: `Renamed folder to ${newPath}`, type: 'success' });
        return true;
    }

    deleteFolder(folderPath) {
        const prefix = folderPath + '/';
        const affected = Object.keys(this.state.virtualFS).filter(f => f.startsWith(prefix));
        if (affected.length === 0) return false;

        const hasMain = affected.some(f => f.split('/').pop() === 'main.c');
        if (hasMain) {
            globalEventBus.emit('LOG', { message: 'Cannot delete a folder that contains main.c.', type: 'error' });
            return false;
        }

        const newFS = { ...this.state.virtualFS };
        affected.forEach(f => delete newFS[f]);

        let newCurrent = this.state.currentFile;
        if (affected.includes(newCurrent)) {
            const keys = Object.keys(newFS);
            newCurrent = keys.length > 0 ? keys[0] : null;
        }

        this.emit({ virtualFS: newFS, currentFile: newCurrent });
        globalEventBus.emit('LOG', { message: `Deleted folder ${folderPath}`, type: 'warn' });
        return true;
    }

    updateFileContent(filename, content) {
        const newFS = { ...this.state.virtualFS };
        newFS[filename] = content;
        this.emit({ virtualFS: newFS });
    }

    // Bulk variant of updateFileContent/createFile -- used by Playground's
    // RUN round-trip (see app.js): a program that does fopen("x", "w")
    // writes into the sandbox's job dir, and the backend reads that dir
    // back after execution (learnRunner.js's runArbitrary) so whatever the
    // program created/changed lands back in the file manager instead of
    // being silently discarded with the rest of the job dir.
    mergeFiles(filesMap) {
        if (!filesMap || Object.keys(filesMap).length === 0) return;
        const newFS = { ...this.state.virtualFS, ...filesMap };
        this.emit({ virtualFS: newFS });
    }

    // Diffs `outputFiles` (what a Playground RUN/terminal exec sent back)
    // against `submittedFiles` (what was sent to it) and merges in only
    // what's new or changed -- unchanged source files would just be
    // redundant no-op writes. Returns the changed filenames so the caller
    // can log/report what happened. Shared by app.js's RUN button handler
    // and ConsoleUI's manual terminal, so the diff logic lives in one place.
    mergeChangedFiles(submittedFiles, outputFiles) {
        if (!outputFiles) return [];
        const changed = {};
        for (const [name, content] of Object.entries(outputFiles)) {
            if (submittedFiles[name] !== content) changed[name] = content;
        }
        const names = Object.keys(changed);
        if (names.length > 0) this.mergeFiles(changed);
        return names;
    }

    selectFile(filename) {
        if (this.state.virtualFS[filename] !== undefined) {
            this.emit({ currentFile: filename });
        }
    }

    async loadProjectFromCloud(db, user) {
        if (!user) return;
        try {
            globalEventBus.emit('LOG', { message: "Loading project from cloud...", type: 'warn' });
            const doc = await db.collection("users").doc(user.uid).get();
            if (doc.exists && doc.data()[this.cloudField]) {
                const loadedFS = doc.data()[this.cloudField];
                const firstFile = Object.keys(loadedFS)[0];
                this.emit({
                    virtualFS: loadedFS,
                    currentFile: firstFile,
                    projectType: 'cloud',
                    projectName: user.email,
                    projectId: null
                });
                globalEventBus.emit('LOG', { message: "Project loaded successfully!", type: 'success' });
            } else {
                globalEventBus.emit('LOG', { message: "No saved project found.", type: 'info' });
            }
        } catch (error) {
            globalEventBus.emit('LOG', { message: "Error loading project: " + error.message, type: 'error' });
        }
    }

    async saveProjectToCloud(db, user, currentEditorContent) {
        if (!user) return;
        try {
            // Sync editor content into what gets saved...
            const fsToSave = { ...this.state.virtualFS };
            if (this.state.currentFile && currentEditorContent !== undefined) {
                fsToSave[this.state.currentFile] = currentEditorContent;
            }

            globalEventBus.emit('LOG', { message: "Saving project to cloud...", type: 'warn' });
            // merge: true is load-bearing -- this document has sibling fields
            // (`project`, `playgroundProject`, `learnProgress`) written by
            // other blocs; a plain .set() here would wipe whichever of those
            // this particular FileSystemBloc instance doesn't own.
            // eslint-disable-next-line no-undef
            await db.collection("users").doc(user.uid).set({
                email: user.email,
                // eslint-disable-next-line no-undef
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                [this.cloudField]: fsToSave
            }, { merge: true });
            // ...AND into this.state.virtualFS itself, in the same emit as
            // projectType/projectName below -- not just the local fsToSave
            // copy used for the write above. A real reported bug without
            // this: the emit still notifies EditorUI's render()/
            // renderPlayground(), whose stale-content self-heal check saw
            // the (unpatched) old virtualFS disagree with the live editor
            // content and reverted the editor right back -- SAVE CLOUD was
            // erasing the very edit it had just saved to Firestore.
            this.emit({ virtualFS: fsToSave, projectType: 'cloud', projectName: user.email, projectId: null });
            globalEventBus.emit('LOG', { message: "Project saved successfully!", type: 'success' });
        } catch (error) {
            globalEventBus.emit('LOG', { message: "Error saving project: " + error.message, type: 'error' });
        }
    }

    async loadExample(exampleId, examplesList) {
        const example = examplesList.find(e => e.id === exampleId);
        if (!example) return;
        
        try {
            globalEventBus.emit('LOG', { message: `Fetching '${example.name}'...`, type: 'warn' });
            if (example.description) globalEventBus.emit('LOG', { message: `Project Info: ${example.description}`, type: 'info' });
            
            const fetchedFiles = {};
            const cacheBuster = `?t=${Date.now()}`;
            
            for (const file of example.files) {
                const res = await fetch(`examples/${example.id}/${file}${cacheBuster}`);
                if (!res.ok) throw new Error(`Failed to load ${file}`);
                fetchedFiles[file] = await res.text();
            }
            
            // Find main.c or default to first file
            const currentFile = Object.keys(fetchedFiles).find(f => f === 'main.c' || f.endsWith('/main.c')) || Object.keys(fetchedFiles)[0];
            
            this.emit({
                virtualFS: fetchedFiles,
                currentFile: currentFile,
                projectType: 'example',
                projectName: example.name,
                projectId: example.id
            });
            globalEventBus.emit('LOG', { message: `Workspace loaded: ${example.name}`, type: 'success' });
            
        } catch (err) {
            globalEventBus.emit('LOG', { message: `Error loading workspace: ${err.message}`, type: 'error' });
        }
    }
}
