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

        // A project already carrying a file/folder name collision (created
        // before createFile/renameFile/renameFolder's guards existed, or
        // resurrected by an old cloud copy from before saveProjectToCloud's
        // mergeFields fix -- see that method's own comment) used to just
        // sit there until the student happened to try compiling and hit a
        // dead end every single time, with no way to tell WHERE the
        // problem was short of hunting through the tree by hand. Sanitize
        // on construction too, not just on setNamespace/
        // loadProjectFromCloud, so a guest project or one restored from a
        // local draft gets the same self-healing.
        this.sanitizeState();

        // Mirrors every future state change to localStorage -- covers all
        // the existing mutating methods (createFile, updateFileContent,
        // ...) automatically, without touching each one individually.
        this.subscribe(() => this.persistLocal());
    }

    // Renames away any plain-file/folder name collision in virtualFS (see
    // folderExistsAt/fileBlockingPath's own comment for what that is and
    // why it's possible at all) by appending "_file" to the offending
    // PLAIN FILE's name -- the folder keeps its original name since it's
    // usually the one holding more/newer content, and the rename is
    // mechanical/reversible (nothing about a bare extension-less name like
    // "fun_est" was ever load-bearing). Called wherever virtualFS gets
    // replaced wholesale (constructor, setNamespace, loadProjectFromCloud)
    // instead of requiring the student to find and fix it by hand after a
    // compile fails -- this IS how that class of bug kept resurfacing even
    // after being "fixed": deleting the stray file only fixed the LOCAL
    // copy, and the next cloud load brought the old, still-colliding one
    // right back (a real reported bug, now with a second layer of defense
    // beyond just not letting it happen again from the UI going forward).
    sanitizeState() {
        const { virtualFS, renamed } = this.sanitizeCollisions(this.state.virtualFS);
        if (renamed.length === 0) return;

        let currentFile = this.state.currentFile;
        for (const [oldKey, newKey] of renamed) {
            if (currentFile === oldKey) currentFile = newKey;
        }
        this._state = { ...this._state, virtualFS, currentFile };

        for (const [oldKey, newKey] of renamed) {
            globalEventBus.emit('LOG', {
                message: `Fixed a file/folder name collision: renamed "${oldKey}" to "${newKey}" (it was both a file and a folder name).`,
                type: 'warn'
            });
        }
    }

    // Pure function: returns a new virtualFS with every stray plain-file/
    // folder collision resolved, plus the list of [oldKey, newKey] renames
    // made -- kept separate from sanitizeState() so it can run on data
    // that isn't this.state yet (loadProjectFromCloud's freshly-fetched
    // doc, in particular).
    sanitizeCollisions(virtualFS) {
        const result = { ...virtualFS };
        const renamed = [];
        // Longest-key-first so a rename never invalidates a not-yet-
        // checked shorter key's own folderExistsAt() lookup mid-loop.
        const keys = Object.keys(virtualFS).sort((a, b) => b.length - a.length);
        for (const key of keys) {
            if (result[key] === undefined) continue; // already renamed away this pass
            if (!this.folderExistsAt(key, result)) continue;

            let newKey = `${key}_file`;
            while (result[newKey] !== undefined || this.folderExistsAt(newKey, result)) {
                newKey += '_2';
            }
            result[newKey] = result[key];
            delete result[key];
            renamed.push([key, newKey]);
        }
        return { virtualFS: result, renamed };
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
            // projectType/projectName/projectId reset too, not just the
            // files -- a real reported bug without this: logging out left
            // the previous account's email sitting in the sidebar's
            // "PROJECT: ..." badge, because this branch only ever touched
            // virtualFS/currentFile. A restored local draft is never the
            // confirmed cloud copy, so 'scratchpad' is right here even
            // while signing IN -- loadProjectFromCloud() flips it to
            // 'cloud' right after, if that account actually has one.
            const { virtualFS, renamed } = this.sanitizeCollisions(draft.virtualFS);
            let currentFile = draft.currentFile;
            for (const [oldKey, newKey] of renamed) {
                if (currentFile === oldKey) currentFile = newKey;
                globalEventBus.emit('LOG', {
                    message: `Fixed a file/folder name collision: renamed "${oldKey}" to "${newKey}" (it was both a file and a folder name).`,
                    type: 'warn'
                });
            }
            this.emit({
                virtualFS,
                currentFile,
                projectType: 'scratchpad',
                projectName: '',
                projectId: null
            });
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

    // The virtual filesystem has no separate "this is a folder" marker --
    // folders in the tree (see SidebarUI.buildTree()) are purely derived
    // from '/'-prefixes of virtualFS keys -- so nothing stopped a plain
    // file and a same-named folder from coexisting. That's exactly what
    // crashed the backend's job-dir writer with a raw, unhelpful "EEXIST
    // ... mkdir '.../fun_est'" (a real reported bug): it tried to create
    // "fun_est" as a real directory (to hold "fun_est/estructuras.c")
    // while a plain file was already sitting at that exact path. These two
    // checks are the two ways that collision can happen, shared by
    // createFile/renameFile/renameFolder so it can't enter virtualFS from
    // any of the three places a name changes.

    // True if a folder already exists at exactly `name` -- i.e. some
    // OTHER key already starts with "name/". Only relevant when `name`
    // itself is about to become a plain file (createFile/renameFile);
    // renameFolder merging into an already-partially-existing folder is
    // fine and not this case.
    folderExistsAt(name, virtualFS = this.state.virtualFS) {
        const prefix = name + '/';
        return Object.keys(virtualFS).some(f => f.startsWith(prefix));
    }

    // True (and returns the offending segment) if `name` itself, or any
    // leading path segment of it, already exists as a plain file --
    // either way `name` can't become (or be nested under) a folder
    // without colliding with a file at that slot.
    fileBlockingPath(name, virtualFS = this.state.virtualFS) {
        const parts = name.split('/');
        let prefix = '';
        for (const part of parts) {
            prefix = prefix ? `${prefix}/${part}` : part;
            if (virtualFS[prefix] !== undefined) return prefix;
        }
        return null;
    }

    createFile(filename) {
        if (this.state.virtualFS[filename]) {
            globalEventBus.emit('LOG', { message: 'File already exists!', type: 'error' });
            return false;
        }
        if (this.folderExistsAt(filename)) {
            globalEventBus.emit('LOG', { message: `"${filename}" already exists as a folder.`, type: 'error' });
            return false;
        }
        const blocker = this.fileBlockingPath(filename);
        if (blocker) {
            globalEventBus.emit('LOG', { message: `"${blocker}" already exists as a file, not a folder.`, type: 'error' });
            return false;
        }

        const newFS = { ...this.state.virtualFS };
        newFS[filename] = `// New file: ${filename}\n`;

        this.emit({ virtualFS: newFS, currentFile: filename });
        // Same signal EditorUI fires on every keystroke -- AutoSaveUI
        // listens for exactly this to schedule a cloud save. Without it,
        // create/delete/rename never got persisted on their own: a real
        // reported bug (deleting a stray file, then reloading/logging back
        // in, brought it right back) because nothing scheduled a save
        // until the user happened to also EDIT something afterward, or
        // clicked SAVE CLOUD manually. File-tree operations are exactly as
        // much "a change worth saving" as typing is.
        globalEventBus.emit('EDITOR_CONTENT_CHANGED');
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
        globalEventBus.emit('EDITOR_CONTENT_CHANGED');
        globalEventBus.emit('LOG', { message: `Deleted ${filename}`, type: 'warn' });
    }

    renameFile(oldName, newName, contentBeforeRename) {
        if (this.state.virtualFS[newName]) {
            globalEventBus.emit('LOG', { message: 'File name already taken!', type: 'error' });
            return false;
        }
        if (this.folderExistsAt(newName)) {
            globalEventBus.emit('LOG', { message: `"${newName}" already exists as a folder.`, type: 'error' });
            return false;
        }
        const blocker = this.fileBlockingPath(newName);
        if (blocker && blocker !== oldName) {
            globalEventBus.emit('LOG', { message: `"${blocker}" already exists as a file, not a folder.`, type: 'error' });
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
        globalEventBus.emit('EDITOR_CONTENT_CHANGED');
        globalEventBus.emit('LOG', { message: `Renamed to ${newName}`, type: 'success' });
        return true;
    }

    renameFolder(oldPath, newPath) {
        const prefix = oldPath + '/';
        const newPrefix = newPath + '/';
        const affected = Object.keys(this.state.virtualFS).filter(f => f.startsWith(prefix));
        if (affected.length === 0) return false;

        // newPath itself (or one of ITS OWN ancestor segments) already
        // being a plain file is the folder-vs-file collision -- newPath
        // partially already existing AS A FOLDER (some unrelated file
        // already under newPath/) is fine, that's just merging into it,
        // which the `collision` check right below already guards for
        // leaf-name clashes.
        const blocker = this.fileBlockingPath(newPath);
        if (blocker) {
            globalEventBus.emit('LOG', { message: `"${blocker}" already exists as a file, not a folder.`, type: 'error' });
            return false;
        }

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
        globalEventBus.emit('EDITOR_CONTENT_CHANGED');
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
        globalEventBus.emit('EDITOR_CONTENT_CHANGED');
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
                const rawFS = doc.data()[this.cloudField];
                // This is the actual fix for a real reported bug: a
                // file/folder collision (e.g. deleting a stray "fun_est"
                // file from the tree) kept "coming back" on every fresh
                // login even after being deleted, because the delete alone
                // never reached Firestore (see FileSystemBloc's other
                // mutations, now fixed to trigger autosave too) -- so the
                // NEXT loadProjectFromCloud() pulled the still-colliding
                // old copy right back down. Sanitizing HERE, on the way
                // in, means a project that's already corrupted (saved
                // before any of these fixes existed) self-heals the moment
                // it's loaded, instead of erroring out on every single
                // compile until its owner manually hunts down the
                // offending name.
                const { virtualFS: loadedFS, renamed } = this.sanitizeCollisions(rawFS);
                const firstFile = Object.keys(loadedFS)[0];
                this.emit({
                    virtualFS: loadedFS,
                    currentFile: firstFile,
                    projectType: 'cloud',
                    projectName: user.email,
                    projectId: null
                });
                for (const [oldKey, newKey] of renamed) {
                    globalEventBus.emit('LOG', {
                        message: `Fixed a file/folder name collision: renamed "${oldKey}" to "${newKey}" (it was both a file and a folder name).`,
                        type: 'warn'
                    });
                }
                if (renamed.length > 0) {
                    // Push the fix back up too, not just into this
                    // session's local state -- otherwise the very next
                    // fresh login (before anyone happens to edit something
                    // or click SAVE CLOUD, and regardless of whether
                    // autosave is even turned on) pulls the still-broken
                    // copy right back down and this whole cycle repeats.
                    // Data-integrity self-heal, not a feature the student
                    // opts into, so this bypasses the autosave toggle on
                    // purpose instead of just emitting EDITOR_CONTENT_CHANGED.
                    await this.saveProjectToCloud(db, user);
                }
                globalEventBus.emit('LOG', { message: "Project loaded successfully!", type: 'success' });
            } else {
                globalEventBus.emit('LOG', { message: "No saved project found.", type: 'info' });
            }
        } catch (error) {
            globalEventBus.emit('LOG', { message: "Error loading project: " + error.message, type: 'error' });
        }
    }

    // state.virtualFS[state.currentFile] is the payload straight-up --
    // EditorUI pushes every keystroke into it synchronously (see
    // EditorUI.js), so it never lags the live editor while this bloc's mode
    // is active. That used to not be true (a debounced sync left a window
    // where a snapshot read here could go stale mid-write, requiring this
    // method to read the editor twice -- once for the payload, once again
    // after the network round-trip finished -- to avoid clobbering newer
    // keystrokes with the pre-write snapshot); now that the sync is
    // immediate, state.virtualFS is already whatever's newest at every
    // point, including after this write's own (unbounded-latency) round
    // trip completes, so there's nothing left to re-read or reconcile.
    async saveProjectToCloud(db, user) {
        if (!user) return;
        try {
            const fsToSave = { ...this.state.virtualFS };

            globalEventBus.emit('LOG', { message: "Saving project to cloud...", type: 'warn' });
            // { merge: true } (bare, no field list) is NOT what this needs,
            // and used to be a real reported bug: renaming or deleting a
            // file, then saving, left the old filename alive in the cloud
            // forever -- it would come back (alongside the new one) on the
            // next login. Firestore's plain merge:true recurses INTO nested
            // map fields (this document's `project`/`playgroundProject` are
            // both nested maps of filepath -> content) and merges them
            // key-by-key against whatever's already stored; a key that's
            // simply absent from this write (the renamed/deleted file) is
            // "not mentioned", not "delete this", so it never actually goes
            // away server-side even though the client moved on.
            //
            // { mergeFields: [...] } is the fix, not just a variant spelling
            // -- naming this document's OWN top-level fields tells Firestore
            // to protect sibling fields this bloc doesn't own (`project` vs
            // `playgroundProject` vs `learnProgress`, still written by other
            // FileSystemBloc/LearnBloc instances) exactly like merge:true
            // did, but REPLACE each named field's value wholesale instead of
            // recursing into it -- so fsToSave here fully overwrites the
            // stored map, and a removed key actually stays removed.
            // eslint-disable-next-line no-undef
            await db.collection("users").doc(user.uid).set({
                email: user.email,
                // eslint-disable-next-line no-undef
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                [this.cloudField]: fsToSave
            }, { mergeFields: ['email', 'lastUpdated', this.cloudField] });

            this.emit({ projectType: 'cloud', projectName: user.email, projectId: null });
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
