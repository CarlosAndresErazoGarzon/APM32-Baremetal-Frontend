import { globalEventBus } from '../core/EventBus.js';

const INDENT_PX = 16;
const FOLDER_ICON = `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>`;
// Exported: LevelListUI reuses this exact chevron for the unit tree's own
// expand/collapse, so both trees in the app share one expand affordance.
export const CHEVRON_ICON = `<svg class="w-3 h-3 flex-shrink-0 transition-transform duration-150" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 20 20"><path stroke-linecap="round" stroke-linejoin="round" d="M7 5l6 5-6 5"></path></svg>`;
const FILE_ICON_PATH = `<path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"></path>`;
// A little terminal window -- distinguishes compiled binaries (from
// ConsoleUI's manual "gcc ... -o test") from real source files at a glance.
const BINARY_ICON = `<svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.75" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path stroke-linecap="round" stroke-linejoin="round" d="M7 9l3 3-3 3M13 15h4"></path></svg>`;

const DEFAULT_IDS = {
    fileTreeList: 'fileTreeList',
    newFileBtn: 'newFileBtn',
    projectBadge: 'projectBadge',
    exampleSelector: 'exampleSelector'
};

export class SidebarUI {
    // `ids` lets a second instance (Playground) target its own sibling
    // panel's markup instead of IDE's -- defaults preserve today's exact
    // element IDs, so the existing `new SidebarUI(fsBloc, editorGetter)`
    // call site needs zero changes. Mobile-drawer wiring (#sidebar/
    // #mobileMenuBtn/#sidebarOverlay) moved out to SidebarDrawerUI, a
    // single app-wide singleton -- those elements are shared by both
    // trees, so binding them here too would double-fire on every click.
    constructor(fileSystemBloc, editorGetter, ids = DEFAULT_IDS) {
        this.fsBloc = fileSystemBloc;
        this.getEditorContent = editorGetter; // Callback to get Monaco content

        this.fileListEl = document.getElementById(ids.fileTreeList);
        this.newFileBtn = document.getElementById(ids.newFileBtn);
        this.projectBadge = document.getElementById(ids.projectBadge);
        this.exampleSelector = ids.exampleSelector ? document.getElementById(ids.exampleSelector) : null;

        // Folder paths the user has manually collapsed (everything starts expanded)
        this.collapsedFolders = new Set();

        this.initEventListeners();

        // Subscribe to FileSystem changes
        this.fsBloc.subscribe(this.render.bind(this));
    }

    initEventListeners() {
        if (this.newFileBtn) {
            this.newFileBtn.onclick = () => {
                const filename = prompt("Enter new filename (e.g., src/newfile.c):");
                if (filename && filename.trim() !== "") {
                    this.fsBloc.createFile(filename.trim());
                }
            };
        }

        if (this.exampleSelector) {
            this.exampleSelector.onchange = () => {
                if (this.exampleSelector.value) {
                    // example list is defined globally or injected
                    // Assuming global dynamicExamples for now, or we can dispatch an event
                    if (window.dynamicExamples) {
                        this.fsBloc.loadExample(this.exampleSelector.value, window.dynamicExamples);
                    }
                }
            };
        }
    }

    render(state) {
        this.renderFileList(state.virtualFS, state.currentFile, state.binaryNames);
        this.updateProjectBadge(state.projectType, state.projectName);
        this.syncExampleSelector(state.projectType, state.projectId);
    }

    // Keeps the "EXAMPLES" dropdown showing the example that's actually loaded
    // (it used to silently fall back to the placeholder even when an example
    // was active, e.g. right after page load or after logging out).
    syncExampleSelector(projectType, projectId) {
        if (!this.exampleSelector) return;
        this.exampleSelector.value = projectType === 'example' && projectId ? projectId : '';
    }

    // --- Tree building -------------------------------------------------

    /**
     * Turns the flat { "src/drivers/uart.c": "...", "inc/uart.h": "..." }
     * virtualFS map into a real nested tree, folders included, so the UI
     * can render actual folders (with icons, indentation, collapse) instead
     * of a flat list grouped by hardcoded "src"/"inc" prefixes.
     *
     * `binaryNames` (Playground only) are names ConsoleUI compiled via the
     * manual terminal (e.g. "gcc main.c -o test") -- they're not in
     * virtualFS at all (their actual bytes never touch the file manager or
     * cloud save, see FileSystemBloc.setBinaryNames()), just their names,
     * so the tree can at least show that they exist instead of a compiled
     * program silently vanishing from view.
     */
    buildTree(virtualFS, binaryNames) {
        const root = { type: 'folder', name: '', path: '', children: new Map() };

        const insert = (filepath, type) => {
            const parts = filepath.split('/');
            let node = root;
            let currentPath = '';

            parts.forEach((part, i) => {
                currentPath = currentPath ? `${currentPath}/${part}` : part;
                const isLeaf = i === parts.length - 1;

                if (isLeaf) {
                    node.children.set(part, { type, name: part, path: currentPath });
                } else {
                    if (!node.children.has(part) || node.children.get(part).type !== 'folder') {
                        node.children.set(part, { type: 'folder', name: part, path: currentPath, children: new Map() });
                    }
                    node = node.children.get(part);
                }
            });
        };

        for (const filepath of Object.keys(virtualFS)) {
            insert(filepath, 'file');
        }
        for (const name of (binaryNames || [])) {
            // A real source file always wins the slot if the compiled
            // binary happens to share its name (shouldn't normally happen,
            // but a student could plausibly compile "-o main.c" by mistake).
            if (!virtualFS[name]) insert(name, 'binary');
        }

        return root;
    }

    sortedChildren(node) {
        // Folders first, then real files, compiled binaries last --
        // alphabetically within each group.
        const rank = { folder: 0, file: 1, binary: 2 };
        return [...node.children.values()].sort((a, b) => {
            if (a.type !== b.type) return rank[a.type] - rank[b.type];
            return a.name.localeCompare(b.name);
        });
    }

    renderFileList(virtualFS, currentFile, binaryNames) {
        if (!this.fileListEl) return;
        this.fileListEl.innerHTML = '';

        const isDark = !document.body.classList.contains('light-theme');
        const tree = this.buildTree(virtualFS, binaryNames);
        const fragment = document.createDocumentFragment();

        this.renderNodeChildren(tree, 0, currentFile, isDark, fragment);

        this.fileListEl.appendChild(fragment);
    }

    renderNodeChildren(node, depth, currentFile, isDark, fragment) {
        this.sortedChildren(node).forEach(child => {
            if (child.type === 'folder') {
                this.renderFolderRow(child, depth, currentFile, isDark, fragment);
            } else if (child.type === 'binary') {
                fragment.appendChild(this.renderBinaryRow(child, depth));
            } else {
                fragment.appendChild(this.renderFileRow(child, depth, currentFile, isDark));
            }
        });
    }

    renderFolderRow(node, depth, currentFile, isDark, fragment) {
        const isCollapsed = this.collapsedFolders.has(node.path);

        const row = document.createElement('div');
        row.className = "group py-2.5 px-2 cursor-pointer flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-[0.15em] transition-colors duration-150";
        row.style.paddingLeft = `${8 + depth * INDENT_PX}px`;
        row.style.paddingRight = '6px';
        row.style.color = "var(--header-text)";
        row.onmouseenter = () => { row.style.backgroundColor = "var(--track-bg)"; };
        row.onmouseleave = () => { row.style.backgroundColor = "transparent"; };
        row.onclick = () => {
            if (isCollapsed) this.collapsedFolders.delete(node.path);
            else this.collapsedFolders.add(node.path);
            this.render(this.fsBloc.state);
        };

        const labelContainer = document.createElement('div');
        labelContainer.className = "flex items-center gap-2 overflow-hidden pointer-events-none";

        const chevronWrap = document.createElement('span');
        chevronWrap.className = "flex-shrink-0 flex items-center";
        chevronWrap.innerHTML = CHEVRON_ICON;
        chevronWrap.firstElementChild.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)';

        const folderIcon = document.createElement('span');
        folderIcon.className = "text-[var(--header-text)] opacity-80 flex-shrink-0";
        folderIcon.innerHTML = FOLDER_ICON;

        const label = document.createElement('span');
        label.className = "truncate";
        label.innerText = node.name;

        labelContainer.appendChild(chevronWrap);
        labelContainer.appendChild(folderIcon);
        labelContainer.appendChild(label);
        row.appendChild(labelContainer);

        // Rename/Delete menu -- same pattern as file rows, but operating on
        // every file under this folder's path prefix (see FileSystemBloc).
        const actionsDiv = document.createElement('div');
        actionsDiv.className = "relative flex items-center opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0";

        const menuBtn = document.createElement('button');
        menuBtn.innerHTML = `
            <svg class="w-4 h-4 text-[var(--sidebar-text)] hover:text-[var(--active-text)]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
            </svg>`;
        menuBtn.className = "p-1 transition-colors normal-case";

        const dropdown = document.createElement('div');
        dropdown.className = "hidden absolute right-0 top-8 w-32 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-none z-50 py-1 file-menu normal-case";

        menuBtn.onclick = (e) => {
            e.stopPropagation(); // don't also toggle collapse/expand
            document.querySelectorAll('.file-menu').forEach(d => { if (d !== dropdown) d.classList.add('hidden'); });
            dropdown.classList.toggle('hidden');
        };

        const renameOpt = document.createElement('button');
        renameOpt.className = "w-full text-left px-4 py-2 text-[10px] text-[var(--sidebar-text)] hover:bg-[var(--active-bg)] hover:text-[var(--active-text)] flex items-center uppercase tracking-tight font-bold";
        renameOpt.innerText = 'Rename';
        renameOpt.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.add('hidden');
            const newBase = prompt("Rename folder to:", node.name);
            if (!newBase || newBase.trim() === node.name) return;

            const pathParts = node.path.split('/');
            pathParts.pop();
            const parent = pathParts.length > 0 ? pathParts.join('/') + '/' : '';
            this.fsBloc.renameFolder(node.path, parent + newBase.trim());
        };
        dropdown.appendChild(renameOpt);

        const deleteOpt = document.createElement('button');
        deleteOpt.className = "w-full text-left px-4 py-2 text-[10px] text-red-500 hover:bg-red-500/10 hover:text-red-600 flex items-center uppercase tracking-tight font-bold";
        deleteOpt.innerText = 'Delete';
        deleteOpt.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.add('hidden');
            if (confirm(`Delete folder "${node.name}" and everything inside it?`)) {
                this.fsBloc.deleteFolder(node.path);
            }
        };
        dropdown.appendChild(deleteOpt);

        actionsDiv.appendChild(menuBtn);
        actionsDiv.appendChild(dropdown);
        row.appendChild(actionsDiv);

        fragment.appendChild(row);

        if (!isCollapsed) {
            this.renderNodeChildren(node, depth + 1, currentFile, isDark, fragment);
        }
    }

    renderFileRow(node, depth, currentFile, isDark) {
        const filename = node.path;
        const displayName = node.name;
        const isActive = filename === currentFile;

        const div = document.createElement('div');
        div.className = `group cursor-pointer flex justify-between items-center text-xs transition-colors duration-150 border-l-2 py-2.5`;
        div.style.paddingLeft = `${8 + depth * INDENT_PX}px`;
        div.style.paddingRight = '10px';
        div.onclick = () => this.fsBloc.selectFile(filename); // Toda el área es clickeable

        // Aplicar estilos según estado activo -- flat fill, no inset shadow
        if (isActive) {
            div.style.backgroundColor = "var(--active-bg)";
            div.style.color = "var(--active-text)";
            div.style.borderColor = "var(--active-border)";
        } else {
            div.style.backgroundColor = "transparent";
            div.style.color = "var(--sidebar-text)";
            div.style.borderColor = "transparent";
        }

        // Hover effect
        div.onmouseenter = () => { if (!isActive) div.style.backgroundColor = "var(--track-bg)"; };
        div.onmouseleave = () => { if (!isActive) div.style.backgroundColor = "transparent"; };

        const nameContainer = document.createElement('div');
        nameContainer.className = "flex items-center gap-3 overflow-hidden pointer-events-none";

        // Carpetas y documentos blancos y unificados
        const iconColor = "text-[var(--header-text)] opacity-75";

        nameContainer.innerHTML = `
            <svg class="w-3.5 h-3.5 flex-shrink-0 ${iconColor} ${isActive ? 'opacity-100' : ''}" fill="currentColor" viewBox="0 0 20 20">${FILE_ICON_PATH}</svg>
            <span class="truncate font-medium tracking-wide">${displayName}</span>
        `;
        div.appendChild(nameContainer);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = "relative flex items-center opacity-0 group-hover:opacity-100 transition-opacity";

        const menuBtn = document.createElement('button');
        menuBtn.innerHTML = `
            <svg class="w-4 h-4 text-[var(--sidebar-text)] hover:text-[var(--active-text)]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
            </svg>`;
        menuBtn.className = "p-1 transition-colors";

        const dropdown = document.createElement('div');
        dropdown.className = "hidden absolute right-0 top-8 w-32 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-none z-50 py-1 file-menu";

        menuBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.file-menu').forEach(d => { if (d !== dropdown) d.classList.add('hidden'); });
            dropdown.classList.toggle('hidden');
        };

        const renameOpt = document.createElement('button');
        renameOpt.className = "w-full text-left px-4 py-2 text-[10px] text-[var(--sidebar-text)] hover:bg-[var(--active-bg)] hover:text-[var(--active-text)] flex items-center uppercase tracking-tight font-bold";
        renameOpt.innerText = 'Rename';
        renameOpt.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.add('hidden');
            const newName = prompt("Rename file to:", displayName);
            if (!newName || newName.trim() === displayName) return;

            const pathParts = filename.split('/');
            pathParts.pop();
            const parent = pathParts.length > 0 ? pathParts.join('/') + '/' : '';
            this.fsBloc.renameFile(filename, parent + newName.trim());
        };
        dropdown.appendChild(renameOpt);

        const deleteOpt = document.createElement('button');
        deleteOpt.className = "w-full text-left px-4 py-2 text-[10px] text-red-500 hover:bg-red-500/10 hover:text-red-600 flex items-center uppercase tracking-tight font-bold";
        deleteOpt.innerText = `Delete`;
        deleteOpt.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.add('hidden');
            if (confirm(`Delete ${displayName}?`)) {
                this.fsBloc.deleteFile(filename);
            }
        };
        dropdown.appendChild(deleteOpt);

        actionsDiv.appendChild(menuBtn);
        actionsDiv.appendChild(dropdown);
        div.appendChild(actionsDiv);

        return div;
    }

    // Compiled binaries from ConsoleUI's manual terminal (e.g. "gcc main.c
    // -o test"). No content to show (their bytes never touch virtualFS --
    // see FileSystemBloc.setBinaryNames()), so no click-to-open, no
    // rename/delete menu -- just a dimmed, informational row confirming it
    // exists. Clicking it explains itself instead of silently doing
    // nothing (selectFile() would no-op since it's not really in virtualFS).
    renderBinaryRow(node, depth) {
        const div = document.createElement('div');
        div.className = "flex items-center text-xs py-2.5 opacity-50 cursor-default";
        div.style.paddingLeft = `${8 + depth * INDENT_PX}px`;
        div.style.paddingRight = '10px';
        div.style.color = "var(--sidebar-text)";
        div.onclick = () => {
            globalEventBus.emit('LOG', {
                message: `${node.name} is a compiled binary from the Terminal tab -- not viewable/editable, but you can still run it (e.g. ./${node.name}).`,
                type: 'info'
            });
        };

        const nameContainer = document.createElement('div');
        nameContainer.className = "flex items-center gap-3 overflow-hidden";
        nameContainer.innerHTML = `
            ${BINARY_ICON}
            <span class="truncate font-medium tracking-wide">${node.name}</span>
            <span class="text-[8px] uppercase tracking-wider flex-shrink-0">[exe]</span>
        `;
        div.appendChild(nameContainer);

        return div;
    }

    // Flat bracketed text, not a colored pill -- matches the [OK]/[M01]
    // bracket convention used everywhere else instead of adding another
    // rounded/tinted badge surface.
    updateProjectBadge(type, name) {
        if (!this.projectBadge) return;
        // Preserve 'hidden' across the reassignment below -- that class is
        // added/removed externally by ModeSwitcherUI based on which mode is
        // active, not by this method. A plain `className =` here used to
        // wipe it out on every FileSystemBloc emit (e.g. right after login,
        // when loadProjectFromCloud() fires for whichever mode's bloc just
        // got wired up), making a hidden-by-mode badge pop back into view.
        const wasHidden = this.projectBadge.classList.contains('hidden');
        if (type === 'cloud') {
            this.projectBadge.innerText = `[ Project: ${name} ]`;
            this.projectBadge.className = 'mx-3 mt-3 px-1 text-[9px] text-[var(--success-text)] font-bold uppercase tracking-wider truncate';
        } else if (type === 'example') {
            this.projectBadge.innerText = `[ Example: ${name} ]`;
            this.projectBadge.className = 'mx-3 mt-3 px-1 text-[9px] text-[var(--success-text)] font-bold uppercase tracking-wider truncate';
        } else {
            this.projectBadge.innerText = '[ Project: Scratchpad ]';
            this.projectBadge.className = 'mx-3 mt-3 px-1 text-[9px] text-[var(--sidebar-text)] font-bold uppercase tracking-wider truncate';
        }
        if (wasHidden) this.projectBadge.classList.add('hidden');
    }
}

// Cierra los menús contextuales al hacer clic fuera
document.addEventListener('click', () => {
    document.querySelectorAll('.file-menu').forEach(m => m.classList.add('hidden'));
});
