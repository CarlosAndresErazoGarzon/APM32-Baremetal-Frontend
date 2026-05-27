require.config({ paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.30.1/min/vs' }});

let editor;

let virtualFS = {
    'src/main.c': `#include "apm32f10x.h"\n#include "apm32_config.h"\n\n/* USER CODE BEGIN Includes */\n/* USER CODE END Includes */\n\nint main(void) {\n    // Configures clocks and selected components\n    APM32_Init();\n    \n    /* USER CODE BEGIN Init */\n    /* USER CODE END Init */\n\n    while(1) {\n        /* USER CODE BEGIN While */\n        GPIOB->ODATA ^= (1 << 2); // Toggle LED PB2\n        delay_ms(500);\n\n        /* USER CODE END While */\n    }\n    \n    return 0;\n}`,
    'src/apm32_config.c': `#include "apm32_config.h"\n\n/* USER CODE BEGIN Includes */\n/* USER CODE END Includes */\n\nvoid APM32_Init(void) {\n    // System Initialization (Main Clocks)\n    SystemInit();\n    \n    // Initialization of selected components\n    SysTick_Init(); // Inicializar timer de delay\n    RCM->APB2CLKEN |= (1 << 3); // Habilitar reloj GPIOB\n    \n    // Configurar LED en PB2 como salida Push-Pull (50MHz)\n    GPIOB->CFGLOW = (GPIOB->CFGLOW & ~(0xF << 8)) | (0x3 << 8);\n\n    /* USER CODE BEGIN APM32_Init */\n    /* USER CODE END APM32_Init */\n}\n\n/* USER CODE BEGIN Private Functions */\n/* USER CODE END Private Functions */`,
    'inc/apm32_config.h': `#ifndef APM_CFG\n#define APM_CFG\n#include "apm32f10x.h"\n\nvoid APM32_Init(void);\n\n#endif`,
    'src/delay.c': `#include "delay.h"\n#include "apm32f10x.h"\n\nvolatile uint32_t msTicks = 0;\n\nvoid SysTick_Init(void) {\n    // Update SystemCoreClock variable in case HSE fails and HSI (8MHz) is used\n    SystemCoreClockUpdate();\n    \n    // Configure SysTick for 1ms intervals\n    if (SysTick_Config(SystemCoreClock / 1000)) {\n        while (1); // Error trap\n    }\n    \n    // Set SysTick to the highest priority (0) to prevent delay_ms() from deadlocking\n    NVIC_SetPriority(SysTick_IRQn, 0);\n}\n\nvoid delay_ms(uint32_t ms) {\n    uint32_t start = msTicks;\n    while ((msTicks - start) < ms);\n}\n\nvoid SysTick_Handler(void) {\n    msTicks++;\n}`,
    'inc/delay.h': `#ifndef DELAY_H\n#define DELAY_H\n\n#include <stdint.h>\n\nextern volatile uint32_t msTicks;\n\n// Prototipos\nvoid SysTick_Init(void);\nvoid delay_ms(uint32_t ms);\n\n// Aliases for common naming conventions\n#define DelayMs     delay_ms\n#define Delay_ms    delay_ms\n#define delayMs     delay_ms\n#define DELAY_MS    delay_ms\n\n#endif`
};

// Configuración Global
const CONFIG = {
    API_URL: (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '') ? 'http://localhost:3000' : 'https://apm32-baremetal-backend.onrender.com'
};

// --- Firebase Initialization ---
let auth = null;
let db = null;

function updateProjectBadge(type, name) {
    const badge = document.getElementById('projectBadge');
    if (!badge) return;
    if (type === 'cloud') {
        badge.innerText = 'Project: ' + name;
        badge.className = 'mx-3 mt-3 px-2 py-1 bg-cyan-900/30 border border-cyan-500/30 rounded text-[9px] text-cyan-400 font-bold uppercase text-center tracking-wider truncate';
    } else if (type === 'example') {
        badge.innerText = 'Example: ' + name;
        badge.className = 'mx-3 mt-3 px-2 py-1 bg-purple-900/30 border border-purple-500/30 rounded text-[9px] text-purple-400 font-bold uppercase text-center tracking-wider truncate';
    } else {
        badge.innerText = 'Project: Scratchpad';
        badge.className = 'mx-3 mt-3 px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] text-white/50 font-bold uppercase text-center tracking-wider truncate';
    }
}

let currentUser = null;

let currentFile = 'src/main.c';
let lastCompileMarkers = {};
let isProgramming = false;
let originalExampleContent = JSON.stringify(virtualFS); // Initialize with default code

// Configuración de Temas
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
let isDark = localStorage.getItem('theme') !== 'light';

// Mobile Sidebar Toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

function toggleSidebar(show) {
    if (show) {
        sidebar.classList.remove('w-0', 'border-0', 'opacity-0', 'pointer-events-none');
        sidebar.classList.add('w-64', 'border-r', 'lg:border-2');
        if (window.innerWidth < 1024) {
            sidebarOverlay.classList.remove('hidden');
        }
    } else {
        sidebar.classList.add('w-0', 'border-0', 'opacity-0', 'pointer-events-none');
        sidebar.classList.remove('w-64', 'border-r', 'lg:border-2');
        sidebarOverlay.classList.add('hidden');
    }
}

mobileMenuBtn.onclick = () => {
    const isClosed = sidebar.classList.contains('w-0');
    toggleSidebar(isClosed);
};
sidebarOverlay.onclick = () => toggleSidebar(false);

// Inicialización: Abierto por defecto en desktop
if (window.innerWidth >= 1024) {
    sidebar.classList.remove('w-0', 'border-0', '-translate-x-full'); 
    sidebar.classList.add('w-64', 'border-r', 'lg:border-2');
} else {
    toggleSidebar(false);
}

function applyTheme() {
    if (!isDark) {
        document.body.classList.add('light-theme');
        themeIcon.innerHTML = `<path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"></path>`;
        if (editor) monaco.editor.setTheme('vs');
    } else {
        document.body.classList.remove('light-theme');
        themeIcon.innerHTML = `<path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"></path>`;
        if (editor) monaco.editor.setTheme('vs-dark');
    }
}

themeToggle.onclick = () => {
    isDark = !isDark;
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    applyTheme();
    renderFileList();
};

// Cargar Monaco Editor
require(['vs/editor/editor.main'], function () {
    editor = monaco.editor.create(document.getElementById('editor'), {
        value: virtualFS[currentFile],
        language: 'c',
        theme: isDark ? 'vs-dark' : 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
        fontSize: 14
    });
    applyTheme(); // Asegurar que el tema de monaco coincida
    renderFileList();
    
    // Wake up Render Backend (Free Tier) on load to avoid cold-start delays
    fetch(`${CONFIG.API_URL}/health`).catch(() => {});
});



const logDiv = document.getElementById('logBox');
const connectBtn = document.getElementById('connectBtn');
const disconnectBtn = document.getElementById('disconnectBtn');
const flashBtn = document.getElementById('flashBtn');
const exampleSelector = document.getElementById('exampleSelector');
const downloadBtn = document.getElementById('downloadBtn');
const downloadZipBtn = document.getElementById('downloadZipBtn');
const newFileBtn = document.getElementById('newFileBtn');
const fileList = document.getElementById('fileList');

// Firebase Auth & Cloud Save Logic
const authBtn = document.getElementById('authBtn');
const cloudSaveBtn = document.getElementById('cloudSaveBtn');
const cloudLoadBtn = document.getElementById('cloudLoadBtn');

async function initFirebase() {
    try {
        const res = await fetch(`${CONFIG.API_URL}/api/config`);
        if (!res.ok) throw new Error("Failed to fetch Firebase config");
        const configData = await res.json();
        
        firebase.initializeApp(configData);
        auth = firebase.auth();
        db = firebase.firestore();

        auth.onAuthStateChanged((user) => {
            currentUser = user;
            if (user) {
                authBtn.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/></svg> LOGOUT`;
                authBtn.title = user.email;
                cloudSaveBtn.disabled = false;
                cloudSaveBtn.classList.remove('opacity-50', 'hidden');
                cloudLoadBtn.disabled = false;
                cloudLoadBtn.classList.remove('opacity-50', 'hidden');
            } else {
                authBtn.innerHTML = `<svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg> LOGIN`;
                authBtn.title = "Login with Google";
                cloudSaveBtn.disabled = true;
                cloudSaveBtn.classList.add('opacity-50', 'hidden');
                cloudLoadBtn.disabled = true;
                cloudLoadBtn.classList.add('opacity-50', 'hidden');
                updateProjectBadge('scratchpad', '');
            }
        });
    } catch (e) {
        console.error("Firebase init failed:", e);
    }
}
initFirebase();

authBtn.onclick = () => {
    if (currentUser) {
        auth.signOut();
        if (dynamicExamples.length > 0) {
            loadExample(dynamicExamples[0].id);
        }
        logmsg("Logged out successfully.", "info");
    } else {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).then((result) => {
            logmsg(`Welcome, ${result.user.email}!`, "success");
        }).catch((error) => {
            logmsg("Login failed: " + error.message, "error");
        });
    }
};

cloudSaveBtn.onclick = async () => {
    if (!currentUser) return;
    saveCurrentFile(); // Sync editor content to virtualFS before saving
    try {
        logmsg("Saving project to cloud...", "warn");
        await db.collection("users").doc(currentUser.uid).set({
            email: currentUser.email,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            project: virtualFS
        });
        updateProjectBadge('cloud', 'Cloud');
        exampleSelector.value = '';
        logmsg("Project saved successfully!", "success");
    } catch (e) {
        logmsg("Cloud Save failed: " + e.message, "error");
    }
};

cloudLoadBtn.onclick = async () => {
    if (!currentUser) return;
    try {
        logmsg("Loading project from cloud...", "warn");
        const doc = await db.collection("users").doc(currentUser.uid).get();
        if (doc.exists && doc.data().project) {
            virtualFS = doc.data().project;
            delete virtualFS["null"];
            delete virtualFS["undefined"];
            activeExampleId = "cloud-project";
            exampleSelector.value = "";
            updateProjectBadge('cloud', 'Cloud');
            renderFileList();
            if (Object.keys(virtualFS).length > 0) {
                const targetFile = virtualFS['src/main.c'] ? 'src/main.c' : Object.keys(virtualFS)[0];
                currentFile = null; // Force reload
                loadFile(targetFile);
            }
            logmsg("Project loaded successfully!", "success");
        } else {
            logmsg("No saved project found in the cloud.", "info");
        }
    } catch (e) {
        logmsg("Cloud Load failed: " + e.message, "error");
    }
};

let lastCompiledBinary = null;

let dynamicExamples = [];
let activeExampleId = "default";
let sizeCache = JSON.parse(localStorage.getItem('apm32_size_cache') || '{}'); // Key: Content Hash, Value: {flash, ram}

async function getContentHash(fs) {
    const msgUint8 = new TextEncoder().encode(JSON.stringify(fs));
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

exampleSelector.onchange = () => {
    if (exampleSelector.value) {
        loadExample(exampleSelector.value);
    }
};



function updateResourceUsage(flashUsed, ramUsed) {
    const flashMax = 128 * 1024;
    const ramMax = 20 * 1024;

    const flashPercent = (flashUsed / flashMax * 100).toFixed(1);
    const ramPercent = (ramUsed / ramMax * 100).toFixed(1);

    console.log(`[Memory Update] Flash: ${flashUsed}B (${flashPercent}%), RAM: ${ramUsed}B (${ramPercent}%)`);

    const flashBar = document.getElementById('flashUsageBar');
    const flashText = document.getElementById('flashUsageText');
    const ramBar = document.getElementById('ramUsageBar');
    const ramText = document.getElementById('ramUsageText');

    if (flashBar) flashBar.style.width = flashPercent + '%';
    if (flashText) flashText.innerText = flashPercent + '%';
    if (ramBar) ramBar.style.width = ramPercent + '%';
    if (ramText) ramText.innerText = ramPercent + '%';
}



// Resource and Dashboard Logic
const rightSidebar = document.getElementById('rightSidebar');
let registerPollingInterval = null;

let isPollingActive = false;

async function startRegisterPolling() {
    if (isPollingActive || !processor) return;
    
    isPollingActive = true;
    let pollStep = 0;
    
    const pollLoop = async () => {
        if (!isPollingActive || !processor) {
            updateCoreStateUI("Idle");
            return;
        }

        // Pause polling while flashing, but keep the loop alive
        if (isProgramming) {
            updateCoreStateUI("Wait...");
            setTimeout(pollLoop, 1000);
            return;
        }

        try {
            if (!processor.transport.device.opened) throw new Error("Offline");

            const dhcsr = await processor.readMem32(0xE000EDF0);
            updateCoreStateUI((dhcsr & 0x00020000) ? "Halted" : "Running");
            
            setTimeout(pollLoop, 200);
        } catch (e) {
            setTimeout(pollLoop, 1000);
        }
    };

    pollLoop();
}

function stopRegisterPolling() {
    isPollingActive = false;
    updateCoreStateUI("Idle");
}

function updateCoreStateUI(state) {
    const stateTag = document.getElementById('coreStateTag');
    if (!stateTag) return;
    
    stateTag.innerText = state.toUpperCase();
    stateTag.className = "text-[10px] px-1.5 py-0.5 rounded font-bold transition-all duration-300";
    
    if (state === "Running") stateTag.classList.add('bg-emerald-500/20', 'text-emerald-400', 'border', 'border-emerald-500/30');
    else if (state === "Halted") stateTag.classList.add('bg-amber-500/20', 'text-amber-400', 'border', 'border-amber-500/30');
    else if (state === "Wait...") stateTag.classList.add('bg-blue-500/20', 'text-blue-400', 'border', 'border-blue-500/30');
    else stateTag.classList.add('bg-slate-500/20', 'text-slate-400', 'border', 'border-slate-500/30');
}



async function loadExample(val) {
    const exampleDef = dynamicExamples.find(e => e.id === val);
    
    if (exampleDef) {
        try {
            logmsg(`Fetching '${exampleDef.name}'...`, "warn");
            if (exampleDef.description) logmsg(`Project Info: ${exampleDef.description}`, "info");
            updateProjectBadge('example', exampleDef.name);
            const fetchedFiles = {};
            
            const cacheBuster = `?t=${Date.now()}`;
            for (const file of exampleDef.files) {
                const res = await fetch(`examples/${exampleDef.id}/${file}${cacheBuster}`);
                if (!res.ok) throw new Error(`Failed to load ${file}`);
                fetchedFiles[file] = await res.text();
            }
            
            virtualFS = fetchedFiles;
            originalExampleContent = JSON.stringify(fetchedFiles); // Save original for 'Flash Cache'
            activeExampleId = exampleDef.id;
            
            currentFile = Object.keys(fetchedFiles).find(f => f === 'main.c' || f.endsWith('/main.c')) || Object.keys(fetchedFiles)[0];
            
            if (editor) {
                const model = editor.getModel();
                if (model) {
                    editor.setValue(virtualFS[currentFile]);
                    monaco.editor.setModelLanguage(model, 'c');
                }
                lastCompileMarkers = {};
                monaco.editor.setModelMarkers(editor.getModel(), "compiler", []);
                renderFileList();
            }
            renderFileList();
            logmsg(`Workspace loaded: ${exampleDef.name}`, 'success');
        } catch (err) {
            logmsg(`Error loading workspace: ${err.message}`, "error");
        } finally {
            exampleSelector.value = "";
        }
    }
}

async function loadExampleRegistry() {
    try {
        const response = await fetch('examples/index.json');
        if (!response.ok) throw new Error("Index not found");
        dynamicExamples = await response.json();
        
        dynamicExamples.forEach(ex => {
            const opt = document.createElement('option');
            opt.value = ex.id;
            opt.textContent = ex.name;
            exampleSelector.appendChild(opt);
        });
        
        // Autoload the first example as the initial boilerplate
        if (dynamicExamples.length > 0) {
            await loadExample(dynamicExamples[0].id);
        }
    } catch (err) {
        console.warn("Could not load examples registry:", err);
    }
}
loadExampleRegistry();

function saveCurrentFile() {
    if (editor && currentFile) virtualFS[currentFile] = editor.getValue();
}

function loadFile(filename) {
    if (filename === currentFile) return;
    saveCurrentFile();
    currentFile = filename;
    editor.setValue(virtualFS[filename]);
    
    const ext = filename.split('.').pop();
    const lang = (ext === 'h' || ext === 'c' || ext === 'cpp') ? 'c' : 'plaintext';
    monaco.editor.setModelLanguage(editor.getModel(), lang);
    
    monaco.editor.setModelMarkers(editor.getModel(), "compiler", lastCompileMarkers[filename] || []);
    
    renderFileList();
    if (window.innerWidth < 1024) toggleSidebar(false); // Solo cerrar en mobile/tablet
}
function renderFileList() {
    fileList.innerHTML = '';
    
    // Group files by folder
    const groups = { 'src': [], 'inc': [], 'others': [] };
    for (const filename in virtualFS) {
        if (filename.startsWith('src/')) groups.src.push(filename);
        else if (filename.startsWith('inc/')) groups.inc.push(filename);
        else groups.others.push(filename);
    }

    const renderGroup = (title, files) => {
        if (files.length === 0) return;
        
        const fragment = document.createDocumentFragment();
        
        const header = document.createElement('div');
        header.className = "flex items-center gap-2 text-[9px] font-bold uppercase mt-5 mb-2 px-1 tracking-[0.2em]";
        header.style.color = "var(--header-text)"; // Usar variable de tema
        header.innerHTML = `<span class="w-1.5 h-1.5 rounded-sm" style="background-color: var(--active-border)"></span> ${title}`;
        fragment.appendChild(header);

        files.sort().forEach(filename => {
            const div = document.createElement('div');
            const isActive = filename === currentFile;
            
            div.className = `group p-2.5 cursor-pointer rounded-sm flex justify-between items-center text-xs transition-all duration-200 border-l-2`;
            div.onclick = () => loadFile(filename); // Toda el área es clickeable
            
            // Aplicar estilos según estado activo
            if (isActive) {
                div.style.backgroundColor = "var(--active-bg)";
                div.style.color = "var(--active-text)";
                div.style.borderColor = "var(--active-border)";
                div.style.boxShadow = "inset 4px 0 10px rgba(0,0,0,0.05)";
            } else {
                div.style.backgroundColor = "transparent";
                div.style.color = "var(--sidebar-text)";
                div.style.borderColor = "transparent";
            }

            // Hover effect
            div.onmouseenter = () => { if(!isActive) div.style.backgroundColor = "rgba(100,100,100,0.1)"; };
            div.onmouseleave = () => { if(!isActive) div.style.backgroundColor = "transparent"; };
            
            const displayName = filename.split('/').pop();
            
            const nameContainer = document.createElement('div');
            nameContainer.className = "flex items-center gap-3 overflow-hidden pointer-events-none";
            
            const isH = filename.endsWith('.h');
            const iconColor = isH ? (isDark ? 'text-amber-500' : 'text-amber-600') : (isDark ? 'text-cyan-500' : 'text-cyan-600');
            
            nameContainer.innerHTML = `
                <svg class="w-3.5 h-3.5 flex-shrink-0 ${iconColor} ${isActive ? 'animate-pulse' : ''}" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"></path></svg>
                <span class="truncate font-medium tracking-wide">${displayName}</span>
            `;
            div.appendChild(nameContainer);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = "relative flex items-center opacity-0 group-hover:opacity-100 transition-opacity";
            
            const menuBtn = document.createElement('button');
            menuBtn.innerHTML = `
                <svg class="w-4 h-4 text-indigo-400 hover:text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
                </svg>`;
            menuBtn.className = "p-1 rounded hover:bg-white/10 transition-colors";
            
            const dropdown = document.createElement('div');
            dropdown.className = "hidden absolute right-0 top-8 w-32 bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded shadow-2xl z-50 py-1 backdrop-blur-md file-dropdown";
            
            menuBtn.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.file-dropdown').forEach(d => { if(d !== dropdown) d.classList.add('hidden'); });
                dropdown.classList.toggle('hidden');
            };

            const renameOpt = document.createElement('button');
            renameOpt.className = "w-full text-left px-4 py-2 text-[10px] text-[var(--sidebar-text)] hover:bg-indigo-500/10 hover:text-[var(--active-text)] flex items-center uppercase tracking-tight font-bold";
            renameOpt.innerText = `Rename`;
            renameOpt.onclick = (e) => {
                e.stopPropagation();
                dropdown.classList.add('hidden');
                let newBase = prompt("Rename to:", displayName);
                if (!newBase || newBase.trim() === displayName) return;
                
                const pathParts = filename.split('/');
                pathParts.pop();
                const folder = pathParts.length > 0 ? pathParts.join('/') + '/' : '';
                const newFilename = folder + newBase.trim();
                
                if (virtualFS[newFilename]) {
                    alert("File already exists!");
                    return;
                }
                
                if (currentFile === filename) saveCurrentFile();
                virtualFS[newFilename] = virtualFS[filename];
                delete virtualFS[filename];
                if (currentFile === filename) currentFile = newFilename;
                renderFileList();
            };
            dropdown.appendChild(renameOpt);

            if (displayName !== 'main.c') {
                const deleteOpt = document.createElement('button');
                deleteOpt.className = "w-full text-left px-4 py-2 text-[10px] text-red-500 hover:bg-red-500/10 hover:text-red-600 flex items-center uppercase tracking-tight font-bold";
                deleteOpt.innerText = `Delete`;
                deleteOpt.onclick = (e) => {
                    e.stopPropagation();
                    dropdown.classList.add('hidden');
                    if(confirm(`Delete ${displayName}?`)) {
                        delete virtualFS[filename];
                        if (currentFile === filename) {
                            currentFile = null;
                            const nextFile = Object.keys(virtualFS)[0];
                            if (nextFile) loadFile(nextFile);
                            else { editor.setValue(""); renderFileList(); }
                        } else {
                            renderFileList();
                        }
                    }
                };
                dropdown.appendChild(deleteOpt);
            }

            actionsDiv.appendChild(menuBtn);
            actionsDiv.appendChild(dropdown);
            div.appendChild(actionsDiv);
            fragment.appendChild(div);
        });
        
        fileList.appendChild(fragment);
    };

    document.addEventListener('click', () => {
        document.querySelectorAll('.file-dropdown').forEach(d => d.classList.add('hidden'));
    });

    renderGroup('Source Files (src)', groups.src);
    renderGroup('Header Files (inc)', groups.inc);
    renderGroup('Others', groups.others);
}

newFileBtn.onclick = () => {
    let filename = prompt("Enter file name (e.g., utils.c, config.h):");
    if (!filename) return;
    filename = filename.trim();
    
    // Validate filename
    if (!filename) {
        alert("Filename cannot be empty.");
        return;
    }

    // Validate extension
    const ext = filename.split('.').pop().toLowerCase();
    if (!['c', 'h', 'cpp', 's'].includes(ext)) {
        alert("Invalid file extension. Use .c, .h, .cpp, or .s");
        return;
    }

    // Sanitize: remove invalid characters
    const baseName = filename.replace(/[^a-zA-Z0-9_\-\.\/]/g, '_');
    filename = baseName;

    // Auto-organize into folders if not specified
    if (!filename.includes('/')) {
        filename = (ext === 'h') ? 'inc/' + filename : 'src/' + filename;
    }

    if (virtualFS[filename] !== undefined) {
        alert("File already exists!");
        return;
    }
    virtualFS[filename] = '// ' + filename + '\n';
    loadFile(filename);
    logmsg(`Created file: ${filename}`, 'success');
};

if (downloadBtn) {
    downloadBtn.onclick = () => {
        if (!lastCompiledBinary) return;
        const blob = new Blob([lastCompiledBinary], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'firmware.bin';
        a.click();
        URL.revokeObjectURL(url);
    };
}

downloadZipBtn.onclick = async () => {
    saveCurrentFile();
    const zip = new JSZip();
    for (const filename in virtualFS) {
        zip.file(filename, virtualFS[filename]);
    }
    const blob = await zip.generateAsync({type: "blob"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'apm32_project.zip';
    a.click();
    URL.revokeObjectURL(url);
    logmsg("Downloaded project as ZIP successfully.", "success");
};

function logmsg(msg, type='info') {
    let color = isDark ? '#d4d4d4' : '#1e1b4b';
    if(type === 'error') color = isDark ? '#ff5b5b' : '#991b1b';
    if(type === 'success') color = isDark ? '#a3be8c' : '#065f46';
    if(type === 'warn') color = isDark ? '#ebcb8b' : '#92400e';
    logDiv.innerHTML += `<div style="color: ${color}">>> ${msg}</div>`;
    
    setTimeout(() => {
        logDiv.scrollTop = logDiv.scrollHeight;
    }, 10);
}

let processor = null;

// Unified Link Function (USB + Serial)
const handleLink = async (requestPermissions = true) => {
    if (processor) {
        logmsg("Hardware already linked.", "info");
        flashBtn.disabled = false;
        disconnectBtn.classList.remove('hidden');
        flashBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        return;
    }

    try {
        let device;
        const devices = await navigator.usb.getDevices();
        
        if (devices.length > 0) {
            device = devices[0]; 
        } else if (requestPermissions) {
            device = await navigator.usb.requestDevice({
                filters: [
                    { classCode: 255 },
                    { vendorId: 0x0D28 }
                ]
            });
        }

        if (!device) return;

        // === PHASE 1: Test DAP-Link transport layer ===
        const transport = new DAPjs.WebUSB(device);
        
        try {
            await transport.open();
        } catch (transportErr) {
            logmsg("[DIAG] TRANSPORT FAILED — DAP-Link is not responding!", 'error');
            logmsg("[DIAG] This means the DAP-Link adapter is faulty or its firmware is corrupted.", 'error');
            logmsg("[DIAG] Solution: Try re-flashing the DAP-Link firmware, or use a different adapter.", 'info');
            throw transportErr;
        }

        // === PHASE 2: Connect to Cortex-M target (APM32) ===
        try {
            const tempProcessor = new DAPjs.CortexM(transport, 0, 100000);
            await tempProcessor.connect();
            processor = tempProcessor;
            
            logmsg(`Connected to USB Support (SWD: 100kHz)`, 'success');
            
            flashBtn.disabled = false;
            disconnectBtn.classList.remove('hidden');
            flashBtn.classList.remove('opacity-50', 'cursor-not-allowed');

            // Start telemetry IMMEDIATELY
            startRegisterPolling();

            // Sequence Serial initialization in background
            setTimeout(async () => {
                try {
                    await handleSerialConnect(requestPermissions);
                } catch(e) { console.warn("Serial auto-connect skipped"); }
            }, 1500);

            return;
        } catch (targetErr) {
            // Transport worked but target failed — APM32 might be the issue
            try { await transport.close(); } catch(e) {}
            
            if (requestPermissions) {
                logmsg("[DIAG] DAP-Link OK but TARGET connection failed!", 'error');
                logmsg("[DIAG] Error: " + targetErr.message, 'error');
                
                if (targetErr.message.includes('Transfer count mismatch')) {
                    logmsg("─── Possible causes ───", 'warn');
                    logmsg("1. SWD pins (SWDIO/SWCLK) not connected or loose", 'warn');
                    logmsg("2. APM32 is in deep sleep / lockup / Read Protection", 'warn');
                    logmsg("3. Target VCC not powered (check 3.3V)", 'warn');
                    logmsg("4. Wrong wiring (SWDIO ↔ SWCLK swapped)", 'warn');
                    logmsg("─── Try this ───", 'info');
                    logmsg("• Power-cycle the entire board (unplug, wait 5s, replug)", 'info');
                    logmsg("• Hold RESET while clicking LINK, release after 1s", 'info');
                    logmsg("• Check that SWDIO, SWCLK, GND, and VCC are wired correctly", 'info');
                }
            }
            throw targetErr;
        }

    } catch(err) {
        processor = null;
        if (requestPermissions) {
            logmsg("Connection error: " + err.message, 'error');
        }
    }
};

connectBtn.onclick = (e) => {
    if (e) e.stopPropagation();
    handleLink(true);
};

disconnectBtn.onclick = async () => {
    if (processor) {
        try {
            if (isProgramming) {
                throw new Error("Cannot disconnect while firmware is flashing.");
            }
            await processor.disconnect();
            logmsg("USB device disconnected.", "info");
        } catch(e) {
            logmsg("Forced disconnection.", "warn");
        }
        processor = null;
        flashBtn.disabled = true;
        disconnectBtn.classList.add('hidden');
        flashBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
};

async function flashAPM32(processor, binArrayBuffer) {
    const FLASH_KEYR = 0x40022004;
    const FLASH_SR   = 0x4002200C;
    const FLASH_CR   = 0x40022010;
    
    logmsg(">> [FMC] Unlocking flash...", "info");
    await processor.writeMem32(FLASH_KEYR, 0x45670123);
    await processor.writeMem32(FLASH_KEYR, 0xCDEF89AB);
    
    let cr = await processor.readMem32(FLASH_CR);
    if ((cr & 0x80) !== 0) throw new Error("Failed to unlock Flash");

    logmsg(">> [FMC] Erasing memory (Mass Erase)...", "info");
    await processor.writeMem32(FLASH_CR, 0x00000004); // Set MER
    await processor.writeMem32(FLASH_CR, 0x00000044); // Set STRT + MER
    
    // Wait for BSY
    let sr = await processor.readMem32(FLASH_SR);
    while(sr & 0x01) sr = await processor.readMem32(FLASH_SR);
    
    await processor.writeMem32(FLASH_CR, 0x00000000); // Clear MER
    
    logmsg(">> [FMC] Writing binary (" + binArrayBuffer.byteLength + " bytes)...", "info");
    await processor.writeMem32(FLASH_CR, 0x00000001); // Set PG
    
    const data16 = new Uint16Array(binArrayBuffer);
    let address = 0x08000000;
    
    for (let i = 0; i < data16.length; i++) {
        await processor.writeMem16(address, data16[i]);
        sr = await processor.readMem32(FLASH_SR);
        while(sr & 0x01) sr = await processor.readMem32(FLASH_SR);
        address += 2;

        if (i > 0 && i % 512 === 0) {
            logmsg(">> Write progress: " + Math.round((i / data16.length) * 100) + "%");
        }
    }
    
    await processor.writeMem32(FLASH_CR, 0x00000000); // Clear PG
    logmsg(">> [FMC] Programming completed successfully.", "success");
}

// Compilar y Flashear
flashBtn.onclick = async () => {
    if (!processor) {
        logmsg("Please connect the USB device first.", "error");
        return;
    }

    try {
        logmsg("---------------------------------------");
        
        lastCompileMarkers = {};
        if (editor) monaco.editor.setModelMarkers(editor.getModel(), "compiler", []);
        
        saveCurrentFile();
        
        let binaryData = null;
        let isModified = false;
        const originalFS = JSON.parse(originalExampleContent || '{}');
        
        for (const path in virtualFS) {
            const current = (virtualFS[path] || "").replace(/\r\n/g, '\n').trim();
            const original = (originalFS[path] || "").replace(/\r\n/g, '\n').trim();
            if (current !== original) {
                logmsg(`Cache Miss: Changes in ${path}`, "info");
                isModified = true;
                break;
            }
        }

        const currentHash = await getContentHash(virtualFS);

        if (!isModified && sizeCache[currentHash]) {
            const cacheExampleId = activeExampleId;
            logmsg(`Unmodified code detected. Loading cache for [${cacheExampleId}]...`, "warn");
            try {
                const binRes = await fetch(`examples/${cacheExampleId}/firmware.bin`);
                if (binRes.ok) {
                    binaryData = await binRes.arrayBuffer();
                    if (sizeCache[currentHash]) {
                        updateResourceUsage(sizeCache[currentHash].flash, sizeCache[currentHash].ram);
                    } else {
                        updateResourceUsage(binaryData.byteLength, 0); 
                    }
                } else {
                    logmsg("⚠️ Cache bin not found on server, compiling...", "warn");
                }
            } catch (e) {
                logmsg("⚠️ Cache fetch failed, compiling...", "warn");
            }
        }

        if (!binaryData) {
            logmsg("1/3 Sending code to Compiler API...", "warn");
            const res = await fetch(`${CONFIG.API_URL}/compile`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ files: virtualFS })
            });
            
            if(!res.ok) {
                const errLog = await res.json();
                const rawError = errLog.details || '';
                
                const lines = rawError.split('\n');
                const regex = /(?:src|inc)\/([a-zA-Z0-9_\-\.]+):(\d+):.*?(error|warning):\s+(.*)/i;
                
                for (let line of lines) {
                    const match = line.match(regex);
                    if (match) {
                        const [, filename, lineNum, severity, message] = match;
                        if (!lastCompileMarkers[filename]) lastCompileMarkers[filename] = [];
                        
                        lastCompileMarkers[filename].push({
                            startLineNumber: parseInt(lineNum, 10),
                            startColumn: 1,
                            endLineNumber: parseInt(lineNum, 10),
                            endColumn: 1000,
                            message: message,
                            severity: severity.toLowerCase() === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Error
                        });
                    }
                }

                const errorFiles = Object.keys(lastCompileMarkers);
                if (errorFiles.length > 0) {
                    if (!errorFiles.includes(currentFile)) {
                        loadFile(errorFiles[0]);
                    } else {
                        monaco.editor.setModelMarkers(editor.getModel(), "compiler", lastCompileMarkers[currentFile]);
                    }
                }
                
                logmsg("Error Reason:\n" + rawError, "error");
                throw new Error("Compilation Failed");
            }

            const tSize = parseInt(res.headers.get('X-Size-Text') || 0);
            const dSize = parseInt(res.headers.get('X-Size-Data') || 0);
            const bSize = parseInt(res.headers.get('X-Size-Bss') || 0);
            
            updateResourceUsage(tSize + dSize, dSize + bSize);
            
            const compileHash = await getContentHash(virtualFS);
            sizeCache[compileHash] = { flash: tSize + dSize, ram: dSize + bSize };
            localStorage.setItem('apm32_size_cache', JSON.stringify(sizeCache));

            binaryData = await res.arrayBuffer();
        }

        isProgramming = true;
        logmsg("2/3 Flash initialization...", "warn");
        logmsg("Program Size: " + binaryData.byteLength + " bytes.", "info");
        
        let safeBuffer = binaryData;
        if (binaryData.byteLength % 2 !== 0) {
            safeBuffer = new ArrayBuffer(binaryData.byteLength + 1);
            new Uint8Array(safeBuffer).set(new Uint8Array(binaryData));
        }

        logmsg(`2/3 Compilation Successful! Received ${safeBuffer.byteLength} bytes.`, "success");

        logmsg("3/3 Injecting Firmware via WebUSB...", "warn");
        
        await processor.halt(); 
        await flashAPM32(processor, safeBuffer);
        
        await processor.reset();
        logmsg("Rebooting device...", "info");
        await processor.writeMem32(0xE000ED0C, 0x05FA0004);
        
        logmsg("Device restarted successfully with your new code!", "success");

    } catch(err) {
        logmsg("Process failed: " + err.message, "error");
    } finally {
        isProgramming = false;
        startRegisterPolling();
    }
};

// Documentation Logic
const docsModal = document.getElementById('docsModal');
const showDocsBtn = document.getElementById('showDocsBtn');
const closeDocsBtn = document.getElementById('closeDocsBtn');
const docContent = document.getElementById('docContent');

// Recovery Modal Logic
const recoveryModal = document.getElementById('recoveryModal');
const recoveryModeBtn = document.getElementById('recoveryModeBtn');
const closeRecoveryBtn = document.getElementById('closeRecoveryBtn');

if(recoveryModeBtn) recoveryModeBtn.onclick = () => recoveryModal.classList.remove('hidden');
if(closeRecoveryBtn) closeRecoveryBtn.onclick = () => recoveryModal.classList.add('hidden');

showDocsBtn.onclick = () => {
    docsModal.classList.remove('hidden');
    loadDoc('PINOUT_APM32.md');
};

const closeDocs = () => docsModal.classList.add('hidden');
closeDocsBtn.onclick = closeDocs;

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDocs();
});

async function loadDoc(file, el) {
    // Handle tab styling
    if (el) {
        document.querySelectorAll('.doc-tab').forEach(tab => tab.classList.remove('active'));
        el.classList.add('active');
    }

    try {
        docContent.innerHTML = "<div class='text-center py-10 opacity-50 uppercase tracking-widest text-xs animate-pulse font-mono'>Decrypting Reference...</div>";
        const res = await fetch(`docs/${file}`);
        let md = await res.text();
        
        // Rewrite image paths to point to docs/img/ correctly
        md = md.replace(/\.\/img\//g, 'docs/img/');
        
        docContent.innerHTML = `<article class='prose prose-invert'>${marked.parse(md)}</article>`;
    } catch(err) {
        docContent.innerHTML = "<div class='text-red-400 font-bold'>Error loading documentation. Please ensure the backend is running.</div>";
    }
}

// Random ASCII Title Logic
const fonts = [
    'ansi_compact.txt', 'ansi_regular.txt', 'ansi_shadow.txt', 'big_money.txt', 
    'big_money_ne.txt', 'big_money_nw.txt', 'big_money_se.txt', 'big_money_sw.txt', 
    'diam_font.txt', 'dos.txt', 'emboss.txt', 'emboss2.txt', 'future.txt', 
    'hex.txt', 'larry_3d.txt', 'lean.txt', 'morse.txt', 'old_banner.txt', 
    'os2.txt', 'pagga.txt', 'pawp.txt', 'rowan.txt', 'rubiFont.txt', 
    'shadow.txt', 'speed.txt', 'star_strips.txt', 'terrance.txt', 
    'ticks.txt', 'ticks2.txt'
];

async function initTitle() {
    const titleEl = document.getElementById('projectTitle');
    if (!titleEl) return;
    try {
        const fonts = ['future.txt', 'larry_3d.txt', 'speed.txt', 'shadow.txt', 'dos.txt', 'rowan.txt'];
        const randomFont = fonts[Math.floor(Math.random() * fonts.length)];
        const res = await fetch(`fonts/${randomFont}`);
        if (!res.ok) throw new Error();
        const art = await res.text();
        titleEl.textContent = art.trimRight();
    } catch (err) {
        titleEl.textContent = "APM32_STATION";
        titleEl.classList.add('text-lg', 'lg:text-xl');
    }
}

// Global Initialization
window.addEventListener('DOMContentLoaded', () => {
    initTitle();
    
    // Start polling if sidebar is already open
    if (rightSidebar && !rightSidebar.classList.contains('w-0')) {
        startRegisterPolling();
    }
});

// Web Serial Logic
const terminalPane = document.getElementById('terminalPane');
const toggleTerminalBtn = document.getElementById('toggleTerminalBtn');
const openTerminalBtn = document.getElementById('openTerminalBtn');
const serialOutput = document.getElementById('serialOutput');
const serialConnectBtn = document.getElementById('serialConnectBtn');
const baudRateSelect = document.getElementById('baudRate');
const serialClearBtn = document.getElementById('serialClearBtn');
const serialStatusLed = document.getElementById('serialStatusLed');
const serialInputField = document.getElementById('serialInput');
const serialSendBtn = document.getElementById('serialSendBtn');

let isTerminalOpen = true;

function toggleTerminal() {
    isTerminalOpen = !isTerminalOpen;
    if (isTerminalOpen) {
        terminalPane.classList.remove('h-8');
        terminalPane.classList.add('h-64');
        if (toggleTerminalBtn) toggleTerminalBtn.querySelector('svg').style.transform = 'rotate(0deg)';
    } else {
        terminalPane.classList.remove('h-64');
        terminalPane.classList.add('h-8');
        if (toggleTerminalBtn) toggleTerminalBtn.querySelector('svg').style.transform = 'rotate(180deg)';
    }
}

const terminalHeader = document.getElementById('terminalHeader');
if (terminalHeader) terminalHeader.onclick = toggleTerminal;
if (openTerminalBtn) openTerminalBtn.onclick = toggleTerminal;
if (toggleTerminalBtn) toggleTerminalBtn.onclick = toggleTerminal;

let serialPort = null;
let serialReader = null;

serialClearBtn.onclick = () => { serialOutput.innerHTML = ''; };

const updateSerialLed = (connected) => {
    if (connected) {
        serialStatusLed.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)] transition-all duration-300';
    } else {
        serialStatusLed.className = 'w-2.5 h-2.5 rounded-full bg-slate-600 shadow-[0_0_5px_rgba(71,85,105,0.5)] transition-all duration-300';
    }
};

const handleSerialDisconnect = async () => {
    if (serialPort) {
        if (serialReader) {
            await serialReader.cancel();
            serialReader = null;
        }
        await serialPort.close();
        serialPort = null;
        serialConnectBtn.innerText = 'Connect';
        serialConnectBtn.classList.remove('text-red-400');
        updateSerialLed(false);
    }
};

const handleSerialConnect = async () => {
    if (serialPort) {
        await handleSerialDisconnect();
        return;
    }

    try {
        logmsg("Requesting Serial permissions (Browser Security)...", 'warn');
        serialPort = await navigator.serial.requestPort();

        const baudRate = parseInt(baudRateSelect.value);
        await serialPort.open({ baudRate });
        
        serialConnectBtn.innerText = 'Disconnect';
        serialConnectBtn.classList.add('text-red-400');
        updateSerialLed(true);
        
        // Auto-show terminal
        terminalPane.classList.remove('h-8');
        terminalPane.classList.add('h-48');
        toggleTerminalBtn.querySelector('svg').style.transform = 'rotate(0deg)';

        const decoder = new TextDecoderStream();
        const inputDone = serialPort.readable.pipeTo(decoder.writable);
        serialReader = decoder.readable.getReader();

        while (true) {
            const { value, done } = await serialReader.read();
            if (done) break;
            if (value) {
                serialOutput.innerText += value;
                serialOutput.scrollTop = serialOutput.scrollHeight;
            }
        }
    } catch (err) {
        logmsg("Serial Error: " + err.message, "error");
        updateSerialLed(false);
    }
};

serialConnectBtn.onclick = handleSerialConnect;

const sendSerialData = async () => {
    if (!serialPort || !serialPort.writable) {
        logmsg("Serial not connected or not writable", "error");
        return;
    }
    const text = serialInputField.value;
    if (!text) return;

    const encoder = new TextEncoder();
    const writer = serialPort.writable.getWriter();
    await writer.write(encoder.encode(text + '\n'));
    writer.releaseLock();
    serialInputField.value = '';
};

if (serialSendBtn) serialSendBtn.onclick = (e) => { e.stopPropagation(); sendSerialData(); };
if (serialInputField) {
    serialInputField.onclick = (e) => e.stopPropagation();
    serialInputField.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') sendSerialData();
    };
}

// Removed redundant connectBtn override since it's consolidated above

// Update disconnectBtn to also handle Serial
const originalDisconnectBtnClick = disconnectBtn.onclick;
disconnectBtn.onclick = async (e) => {
    if (e) e.stopPropagation();
    await originalDisconnectBtnClick();
    await handleSerialDisconnect();
};

// Prevent header toggle when clicking controls
[baudRateSelect, serialConnectBtn, serialClearBtn].forEach(el => {
    if (el) el.addEventListener('click', (e) => e.stopPropagation());
});

// Initialize UI on Load (no auto-link to avoid confusing messages when no board is connected)
window.addEventListener('load', () => {
});
