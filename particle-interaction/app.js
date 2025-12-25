import * as THREE from 'three';

// Access MediaPipe globals loaded via script tags
const Hands = window.Hands;
const Camera = window.Camera;
// HAND_CONNECTIONS might be global or under window
const HAND_CONNECTIONS = window.HAND_CONNECTIONS;

// --- Configuration ---
const TEXTS = ["BP Debate Union", "Aurora", "BPDU Team Presents"];

// Welcome Intro Sequence
const INTRO_TEXTS = ["Merry Christmas", "BP Debate Union Presents"];
const TUTORIAL_PROMPT = "Show Your Palms";
const TUTORIAL_SUCCESS = "Good Lets Go";
const TUTORIAL_FINGER_PROMPT = "Show 1 With Right Hand";
const TUTORIAL_FINGER_CC = "This is the finger you use for switching between scenes. There are different scenes built-in, and later you will have the chance to explore them all!";
const TUTORIAL_SWITCH_PROMPT = "Now with your right finger showing 1, you can switch scenes with your left hand. For example, with your right hand showing 1, show 1 with your left hand";
const TUTORIAL_SWITCH_SUCCESS = "Welldone";
const TUTORIAL_SCENE2_PROMPT = "Now try showing your left hand with 2 with righthand 1 and see what we have in scene 2!";
const TUTORIAL_DRAG_CC = "Pinch with your right index and thumb, and try to drag and move the element";
const TUTORIAL_ROTATE_CC = "Great! Now pinch with three fingers (thumb + index + middle) and rotate!";
const TUTORIAL_SCALE_CC = "Awesome! Finally, pinch with both hands and zoom in/out!";
// 3D Tutorial Constants
const TUTORIAL_3D_INTRO = "Now you've mastered all skills when interacting with texts, let's move on to 3D scenes...";
const TUTORIAL_3D_LOOK = "Pinch with three fingers on your RIGHT hand and drag to look around";
const TUTORIAL_3D_MOVE = "Great! Now pinch with three fingers on your LEFT hand and drag to move";
const TUTORIAL_3D_COMPLETE = "Excellent! You've mastered 3D navigation. Tutorial complete!";
const INTRO_FORMATION_TIME = 1000; // ms for particles to form the text (~1s)
const INTRO_STAY_TIME = 1500; // ms to stay after text is formed
const INTRO_FIRST_TEXT_STAY = 5000; // First text "Merry Christmas" stays 5 seconds
const INTRO_DURATION = INTRO_FORMATION_TIME + INTRO_STAY_TIME; // Total time per intro text (after first)
// Phases: 0-7=existing, 8-10=ParticleTutorial, 11=3DIntro, 12=3DLook, 13=3DMove, 14=3DComplete, 15=done
let introPhase = 0;
let introComplete = false;
let handRecognitionEnabled = false;
let waitingForPalms = false; // True when waiting for user to show palms
let palmDetectionStartTime = null; // Timestamp for palm detection confirmation
let waitingForFinger = false; // True when waiting for right hand "1" gesture
let waitingForLeftOne = false; // True when waiting for left hand "1" while right shows "1"
let waitingForLeftTwo = false; // True when waiting for left hand "2" while right shows "1"
// Interactive tutorial states
let waitingForDrag = false;
let waitingForRotate = false;
let waitingForScale = false;
// 3D Tutorial states
let waitingFor3DLook = false;
let waitingFor3DMove = false;
const PARTICLE_SIZE = 0.12;
const PARTICLE_COLOR = 0xffffff;
const CANVAS_WIDTH = 1024; // Resolution for text generation
const CANVAS_HEIGHT = 256;

// --- State ---
let currentModelIndex = -1; // Start at -1 so first changeText(0) triggers
let particles;
let geometry;
let scene, camera, renderer;
// Hand Scene Overlay
let handScene, handCamera;

let targetPositions = []; // Target positions for the current text
let currentPositions = []; // Current animation positions
const particleCount = 5000; // Fixed pool of particles
let textParticleCount = 0; // Number of particles that form the text

// Interaction State
let isDragging = false;
let isRotating = false;
let isScaling = false;
let previousDragPos = new THREE.Vector3();
let previousRotationAngle = 0;
let initialScaleDistance = 0;
let initialScale = 1;

// Gesture Debounce State
let pendingGestureIndex = -1;
let gestureStartTime = 0;
const GESTURE_CONFIRM_DELAY = 50; // Very fast response

// Transformations
let modelGroup;

// Cherry Blossom Scene State
let isCherryBlossomMode = false;
let cherryBlossomScene;
let cherryBlossomCamera;
let cherryBlossomTrees = [];
let cherryBlossomPetals = [];
let cherryBlossomTime = 0;

// Christmas Forest Scene State
let isChristmasMode = false;
let christmasScene;
let christmasCamera;
let christmasTrees = [];
let snowParticles = [];
let christmasTime = 0;

// Photo Tree Scene State
let isPhotoTreeMode = false;
let photoTreeScene;
let photoTreeCamera;
let photoTreeTime = 0;
let photoTreeSnow = []; // Snow particles for photo tree scene
let photoPlanes = []; // Photo frame groups for photo tree scene

// Empty Tree Scene State (unlocked by finding all gifts)
let isEmptyTreeMode = false;
let emptyTreeScene;
let emptyTreeCamera;
let emptyTreeTime = 0;
let emptyTreeSnow = [];


// Photo Interaction State
let photoInteraction = {
    hoveredPhoto: null,
    targetPhoto: null, // Locked when fist gesture starts
    fistStartTime: 0,
    isFisting: false,
    viewingPhoto: null // Currently viewing full-screen
};
const PHOTO_INTERACTION_DIST = 12.0; // Distance to interact with photo
const PHOTO_VIEW_TIME = 500; // ms to hold fist before viewing (0.5 seconds)

// Cherry Blossom Camera Controls (Free Look)
let cameraPosition = new THREE.Vector3(0, 5, 20);
let cameraYaw = 0;
let cameraPitch = 0;
let targetCameraPosition = new THREE.Vector3(0, 5, 20);
let targetCameraYaw = 0;
let targetCameraPitch = 0;

// Christmas Gift State
let gifts = [];
let giftInteraction = {
    hoveredGift: null,
    pinchStartTime: 0,
    isPinching: false
};
const GIFT_INTERACTION_DIST = 8.0; // Distance to be interactable
const GIFT_OPEN_TIME = 200; // ms

// Gift Tracking State (for unlocking secret scenes)
let totalGiftsSpawned = 0;
let giftsOpened = 0;

let previousScaleDistance = 0;
let previousRotationPos = null;
let previousGripPos = null; // For panning/strafing

// ==================== Media Library Configuration ====================
const SUPPORTED_FORMATS = {
    images: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'tiff', 'tif'],
    audio: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac', 'wma', 'opus', 'webm'],
    video: ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv', 'm4v', 'wmv', 'flv']
};

const MEDIA_LIBRARIES = {
    aurora: '/aurora_pics',
    tree: '/tree_pics'
};

// Tree Top Text Configuration
// Default empty, user sets them if they want text
let auroraTreeTopText = '';
let emptyTreeTopText = '';
let auroraTextParticles = null;
let emptyTreeTextParticles = null;

// Media state for both trees
let auroraMediaItems = []; // { path, type: 'image'|'audio'|'video', isUserUploaded, blob? }
let treeMediaItems = [];
let emptyTreeMediaPlanes = []; // For Empty Tree scene

// Currently playing media
let currentPlayingMedia = null;
let mediaInteraction = {
    hoveredMedia: null,
    targetMedia: null,
    fistStartTime: 0,
    isFisting: false,
    viewingMedia: null
};

// IndexedDB
let mediaDB = null;
const DB_NAME = 'ChristmasTreeMediaDB';
const DB_VERSION = 1;

// Initialize IndexedDB
function initIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            mediaDB = request.result;
            console.log('✅ IndexedDB initialized');
            resolve(mediaDB);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Media store
            if (!db.objectStoreNames.contains('media')) {
                const mediaStore = db.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
                mediaStore.createIndex('treeType', 'treeType', { unique: false });
                mediaStore.createIndex('mediaType', 'mediaType', { unique: false });
                mediaStore.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // Settings store
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'key' });
            }
        };
    });
}

// Save media to IndexedDB
function saveMediaToDB(file, treeType) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const ext = file.name.split('.').pop().toLowerCase();
            let mediaType = 'image';
            if (SUPPORTED_FORMATS.audio.includes(ext)) mediaType = 'audio';
            else if (SUPPORTED_FORMATS.video.includes(ext)) mediaType = 'video';

            const transaction = mediaDB.transaction(['media'], 'readwrite');
            const store = transaction.objectStore('media');

            const mediaItem = {
                name: file.name,
                treeType: treeType,
                mediaType: mediaType,
                data: reader.result,
                timestamp: Date.now()
            };

            const request = store.add(mediaItem);
            request.onsuccess = () => {
                console.log(`✅ Media saved: ${file.name} for ${treeType}`);
                resolve({ ...mediaItem, id: request.result });
            };
            request.onerror = () => reject(request.error);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

// Load user media from IndexedDB
function loadUserMedia(treeType) {
    return new Promise((resolve, reject) => {
        const transaction = mediaDB.transaction(['media'], 'readonly');
        const store = transaction.objectStore('media');
        const index = store.index('treeType');
        const request = index.getAll(treeType);

        request.onsuccess = () => {
            console.log(`📂 Loaded ${request.result.length} user media for ${treeType}`);
            resolve(request.result);
        };
        request.onerror = () => reject(request.error);
    });
}

// Delete media from IndexedDB
function deleteMediaFromDB(id) {
    return new Promise((resolve, reject) => {
        const transaction = mediaDB.transaction(['media'], 'readwrite');
        const store = transaction.objectStore('media');
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log(`🗑️ Media deleted: ${id}`);
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
}

// Save settings to IndexedDB
function saveSettings() {
    const auroraText = document.getElementById('aurora-text')?.value || auroraTreeTopText;
    const treeText = document.getElementById('tree-text')?.value || emptyTreeTopText;

    const transaction = mediaDB.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');

    store.put({ key: 'auroraText', value: auroraText });
    store.put({ key: 'treeText', value: treeText });

    auroraTreeTopText = auroraText;
    emptyTreeTopText = treeText;

    // Update tree top text in scenes if active
    if (isPhotoTreeMode && auroraTextParticles) {
        updateTreeTopParticles(photoTreeScene, auroraTextParticles, auroraTreeTopText, new THREE.Vector3(0, 31, 0));
    }
    if (isEmptyTreeMode && emptyTreeTextParticles) {
        updateTreeTopParticles(emptyTreeScene, emptyTreeTextParticles, emptyTreeTopText, new THREE.Vector3(0, 16, 0));
    }

    console.log('💾 Settings saved');
}

// Load settings from IndexedDB
function loadSettings() {
    return new Promise((resolve) => {
        if (!mediaDB) { resolve(); return; }

        const transaction = mediaDB.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');

        store.get('auroraText').onsuccess = (e) => {
            if (e.target.result) {
                auroraTreeTopText = e.target.result.value;
                const input = document.getElementById('aurora-text');
                if (input) input.value = auroraTreeTopText;
            }
        };

        store.get('treeText').onsuccess = (e) => {
            if (e.target.result) {
                emptyTreeTopText = e.target.result.value;
                const input = document.getElementById('tree-text');
                if (input) input.value = emptyTreeTopText;
            }
        };

        transaction.oncomplete = () => resolve();
    });
}

// Get media type from file extension
function getMediaType(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    if (SUPPORTED_FORMATS.images.includes(ext)) return 'image';
    if (SUPPORTED_FORMATS.audio.includes(ext)) return 'audio';
    if (SUPPORTED_FORMATS.video.includes(ext)) return 'video';
    return null;
}

// Detect media files in a directory (via manifest or hardcoded for now)
async function loadMediaLibrary(libraryPath, treeType) {
    const mediaItems = [];

    // Try to fetch manifest file
    try {
        const response = await fetch(`${libraryPath}/manifest.json`);
        if (response.ok) {
            const manifest = await response.json();
            manifest.files.forEach(filename => {
                const type = getMediaType(filename);
                if (type) {
                    mediaItems.push({
                        path: `${libraryPath}/${filename}`,
                        type: type,
                        isUserUploaded: false,
                        name: filename
                    });
                }
            });
            console.log(`📂 Loaded ${mediaItems.length} media from manifest for ${treeType}`);
            return mediaItems;
        }
    } catch (e) {
        // No manifest, try to detect files
    }

    // Fallback: check for known files (for aurora_pics which has existing images)
    if (treeType === 'aurora') {
        const knownFiles = [
            'Weixin Image_20251203220250_1941_6.jpg',
            'Weixin Image_20251203220256_1942_6.jpg',
            'Weixin Image_20251203220300_1943_6.jpg',
            'Weixin Image_20251203220303_1944_6.jpg',
            'Weixin Image_20251203220306_1945_6.jpg',
            'Weixin Image_20251203220308_1946_6.jpg',
            'Weixin Image_20251203220309_1947_6.jpg',
            'Weixin Image_20251203220311_1948_6.jpg'
        ];

        for (const filename of knownFiles) {
            const type = getMediaType(filename);
            if (type) {
                mediaItems.push({
                    path: `${libraryPath}/${filename}`,
                    type: type,
                    isUserUploaded: false,
                    name: filename
                });
            }
        }
    }

    console.log(`📂 Loaded ${mediaItems.length} media files for ${treeType}`);
    return mediaItems;
}

// Update media list UI
async function updateMediaListUI(treeType) {
    const listEl = document.getElementById(`${treeType === 'aurora' ? 'aurora' : 'tree'}-media-list`);
    if (!listEl) return;

    listEl.innerHTML = '';

    const userMedia = await loadUserMedia(treeType);

    userMedia.forEach(item => {
        const div = document.createElement('div');
        div.className = 'media-item';
        div.innerHTML = `
            <span class="media-name">${item.name}</span>
            <span class="media-type ${item.mediaType}">${item.mediaType}</span>
            <button class="delete-btn" data-id="${item.id}">×</button>
        `;

        div.querySelector('.delete-btn').addEventListener('click', async () => {
            await deleteMediaFromDB(item.id);
            updateMediaListUI(treeType);
        });

        listEl.appendChild(div);
    });
}

// Initialize Settings Panel UI
function initSettingsUI() {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsPanel = document.getElementById('settings-panel');
    const settingsClose = document.getElementById('settings-close');
    const saveBtn = document.getElementById('save-settings');
    const auroraUpload = document.getElementById('aurora-upload');
    const treeUpload = document.getElementById('tree-upload');

    if (!settingsBtn || !settingsPanel) return;

    settingsBtn.addEventListener('click', () => {
        // Only allow settings in tree scenes
        if (!isPhotoTreeMode && !isEmptyTreeMode) {
            return; // Do nothing if not in a tree scene
        }

        // Update panel visibility based on current mode
        updateSettingsPanelVisibility();
        settingsPanel.classList.add('open');
    });

    settingsClose?.addEventListener('click', () => {
        settingsPanel.classList.remove('open');
    });

    saveBtn?.addEventListener('click', () => {
        saveSettings();
        settingsPanel.classList.remove('open');

        // Refresh the current scene to show updated media
        if (isPhotoTreeMode) {
            refreshPhotoTreeMedia();
        } else if (isEmptyTreeMode) {
            refreshEmptyTreeMedia();
        }
    });

    auroraUpload?.addEventListener('change', async (e) => {
        for (const file of e.target.files) {
            await saveMediaToDB(file, 'aurora');
        }
        auroraUpload.value = '';
        updateMediaListUI('aurora');
    });

    treeUpload?.addEventListener('change', async (e) => {
        for (const file of e.target.files) {
            await saveMediaToDB(file, 'tree');
        }
        treeUpload.value = '';
        updateMediaListUI('tree');
    });
}

// Update settings button visibility based on current scene
function updateSettingsButtonVisibility() {
    const settingsBtn = document.getElementById('settings-btn');
    if (!settingsBtn) return;

    // Only show settings button in tree scenes
    if (isPhotoTreeMode || isEmptyTreeMode) {
        settingsBtn.style.display = 'block';
    } else {
        settingsBtn.style.display = 'none';
    }
}

// Update settings panel visibility based on current scene
function updateSettingsPanelVisibility() {
    const noSceneMsg = document.getElementById('settings-no-scene');
    const auroraSettings = document.getElementById('aurora-settings');
    const treeSettings = document.getElementById('tree-settings');
    const settingsFooter = document.getElementById('settings-footer');
    const settingsTitle = document.getElementById('settings-title');

    // Hide all by default
    noSceneMsg.style.display = 'none';
    auroraSettings.style.display = 'none';
    treeSettings.style.display = 'none';
    settingsFooter.style.display = 'none';

    if (isPhotoTreeMode) {
        // Show Aurora Tree settings only
        settingsTitle.textContent = '🌌 Aurora Tree 设置';
        auroraSettings.style.display = 'block';
        settingsFooter.style.display = 'block';
        updateMediaListUI('aurora');
    } else if (isEmptyTreeMode) {
        // Show Empty Tree settings only
        settingsTitle.textContent = '🌲 Empty Tree 设置';
        treeSettings.style.display = 'block';
        settingsFooter.style.display = 'block';
        updateMediaListUI('tree');
    } else {
        // Not in any tree scene - show message
        settingsTitle.textContent = '🎄 场景设置';
        noSceneMsg.style.display = 'block';
    }
}

// Refresh Photo Tree media after settings change
function refreshPhotoTreeMedia() {
    // Clear existing media planes
    photoPlanes.forEach(plane => {
        photoTreeScene.remove(plane);
    });
    photoPlanes.length = 0;

    // Reload media
    loadAllAuroraMedia().then(allMedia => {
        auroraMediaItems = allMedia;
        createMediaOrnamentsFromItems(allMedia, photoTreeScene, photoPlanes, 'aurora');
    });

    // Update tree top text
    if (auroraTextParticles) {
        photoTreeScene.remove(auroraTextParticles);
        createTreeTopParticleText(photoTreeScene, auroraTreeTopText, new THREE.Vector3(0, 31, 0), 'aurora');
    }

    console.log('🔄 Aurora Tree media refreshed');
}

// Refresh Empty Tree media after settings change
function refreshEmptyTreeMedia() {
    // Clear existing media planes
    emptyTreeMediaPlanes.forEach(plane => {
        emptyTreeScene.remove(plane);
    });
    emptyTreeMediaPlanes.length = 0;

    // Reload media
    loadAllTreeMedia().then(allMedia => {
        treeMediaItems = allMedia;
        createMediaOrnamentsFromItems(allMedia, emptyTreeScene, emptyTreeMediaPlanes, 'tree');
    });

    // Update tree top text
    if (emptyTreeTextParticles) {
        emptyTreeScene.remove(emptyTreeTextParticles);
        createTreeTopParticleText(emptyTreeScene, emptyTreeTopText, new THREE.Vector3(0, 16, 0), 'empty');
    }

    console.log('🔄 Empty Tree media refreshed');
}

// ==================== Tree Top Particle Text ====================

// Create flowing particle sphere for tree top
function createTreeTopParticleText(targetScene, text, position, treeType) {
    // Group to hold both sphere and text
    const group = new THREE.Group();
    group.userData = {
        treeType: treeType,
        text: text,
        basePosition: position.clone(),
        baseRadius: 3.0
    };

    // 1. Create Cylinder Sphere (The romantic cloud)
    const sphereCount = 1500;
    const sPositions = new Float32Array(sphereCount * 3);
    const sColors = new Float32Array(sphereCount * 3);
    const sPhases = new Float32Array(sphereCount);
    const sSpeeds = new Float32Array(sphereCount);
    const sRadiusOffsets = new Float32Array(sphereCount);

    const baseRadius = 3.0;

    for (let i = 0; i < sphereCount; i++) {
        // Spherical distribution
        const phi = Math.acos(-1 + (2 * i) / sphereCount);
        const theta = Math.sqrt(sphereCount * Math.PI) * phi;

        const x = baseRadius * Math.cos(theta) * Math.sin(phi);
        const y = baseRadius * Math.sin(theta) * Math.sin(phi);
        const z = baseRadius * Math.cos(phi);

        sPositions[i * 3] = x; // Local to group
        sPositions[i * 3 + 1] = y;
        sPositions[i * 3 + 2] = z;

        // More romantic colors: Pink, Magenta, Soft Gold, White
        const colorType = Math.random();
        if (colorType > 0.7) { // Soft Gold
            sColors[i * 3] = 1.0; sColors[i * 3 + 1] = 0.9; sColors[i * 3 + 2] = 0.5;
        } else if (colorType > 0.4) { // Romantic Pink/Magenta
            sColors[i * 3] = 1.0; sColors[i * 3 + 1] = 0.4 + Math.random() * 0.4; sColors[i * 3 + 2] = 0.6 + Math.random() * 0.4;
        } else { // Sparkle White
            sColors[i * 3] = 1.0; sColors[i * 3 + 1] = 1.0; sColors[i * 3 + 2] = 1.0;
        }

        sPhases[i] = Math.random() * Math.PI * 2;
        sSpeeds[i] = 0.2 + Math.random() * 0.8; // Slower, more dreamy
        sRadiusOffsets[i] = Math.random() * 1.5;
    }

    const sGeometry = new THREE.BufferGeometry();
    sGeometry.setAttribute('position', new THREE.BufferAttribute(sPositions, 3));
    sGeometry.setAttribute('color', new THREE.BufferAttribute(sColors, 3));
    sGeometry.setAttribute('phase', new THREE.BufferAttribute(sPhases, 1));
    sGeometry.setAttribute('speed', new THREE.BufferAttribute(sSpeeds, 1));
    sGeometry.setAttribute('radiusOffset', new THREE.BufferAttribute(sRadiusOffsets, 1));

    const sMaterial = new THREE.PointsMaterial({
        size: 0.2, // Slightly smaller for finer cloud
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        map: createSoftParticleTexture(),
        depthWrite: false
    });

    const sphereParticles = new THREE.Points(sGeometry, sMaterial);
    sphereParticles.name = "sphere";
    group.add(sphereParticles);

    // 2. Create Text Particles (If text exists)
    if (text && text.trim() !== '') {
        const textPoints = generateTextParticlesForTreeTop(text); // Need to restore this function!
        const tCount = Math.floor(textPoints.length / 3);

        if (tCount > 0) {
            const tPositions = new Float32Array(tCount * 3);
            const tColors = new Float32Array(tCount * 3);

            for (let i = 0; i < tCount; i++) {
                tPositions[i * 3] = textPoints[i * 3] * 0.8; // Local scale
                tPositions[i * 3 + 1] = textPoints[i * 3 + 1] * 0.8;
                tPositions[i * 3 + 2] = textPoints[i * 3 + 2];

                // Text color: Bright Gold/White to stand out
                tColors[i * 3] = 1.0; tColors[i * 3 + 1] = 0.95; tColors[i * 3 + 2] = 0.8;
            }

            const tGeometry = new THREE.BufferGeometry();
            tGeometry.setAttribute('position', new THREE.BufferAttribute(tPositions, 3));
            tGeometry.setAttribute('color', new THREE.BufferAttribute(tColors, 3));

            const tMaterial = new THREE.PointsMaterial({
                size: 0.15,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending,
                vertexColors: true
            });

            const textParticles = new THREE.Points(tGeometry, tMaterial);
            textParticles.name = "text";
            group.add(textParticles);
        }
    }

    // Set group position
    group.position.copy(position);
    targetScene.add(group);

    // Store reference (needs to be the group now)
    if (treeType === 'aurora') {
        auroraTextParticles = group;
    } else if (treeType === 'empty') {
        emptyTreeTextParticles = group;
    }

    console.log(`✨ Created flowing sphere${text ? ' + text' : ''} for ${treeType}`);
    return group;
}

// Restore: Generate text particles for tree top
function generateTextParticlesForTreeTop(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Arial'; // Slightly larger
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const positions = [];

    for (let y = 0; y < canvas.height; y += 2) { // Dense sampling
        for (let x = 0; x < canvas.width; x += 2) {
            const index = (y * canvas.width + x) * 4;
            if (data[index] > 128) {
                const pX = -(x - canvas.width / 2) * 0.04;
                const pY = -(y - canvas.height / 2) * 0.04;
                const pZ = 0;
                positions.push(pX, pY, pZ);
            }
        }
    }

    return positions;
}

// Helper for soft particle texture
function createSoftParticleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // Radial gradient
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

// Animate flowing particle sphere
function animateTreeTopParticles(group, time) {
    if (!group) return;

    // Group contains 'sphere' and optionally 'text'
    // Animate Sphere
    const sphere = group.getObjectByName('sphere');
    if (sphere) {
        const positions = sphere.geometry.attributes.position.array;
        const phases = sphere.geometry.attributes.phase.array;
        const speeds = sphere.geometry.attributes.speed.array;
        const radiusOffsets = sphere.geometry.attributes.radiusOffset.array;
        const count = phases.length;

        const baseRadius = group.userData.baseRadius || 3.0;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const phase = phases[i];
            const speed = speeds[i];
            const rOffset = radiusOffsets[i];

            // Re-calculate distribution to keep shape stable but flowing
            const phi = Math.acos(-1 + (2 * i) / count);
            const theta = Math.sqrt(count * Math.PI) * phi + time * speed * 0.1; // Slower rotation

            // Heartbeat breathing effect + independent radius pulse
            const breathing = Math.sin(time * 0.8) * 0.3 + 1.0;
            const currentRadius = (baseRadius + rOffset * Math.sin(time * 1.0 + phase)) * breathing;

            // Sphere coordinates
            positions[i3] = currentRadius * Math.cos(theta) * Math.sin(phi);
            positions[i3 + 1] = currentRadius * Math.sin(theta) * Math.sin(phi) + Math.sin(time * 1.5 + phase) * 0.3; // Vertical sway
            positions[i3 + 2] = currentRadius * Math.cos(phi);
        }

        sphere.geometry.attributes.position.needsUpdate = true;

        // Gentle rotation
        sphere.rotation.y = time * 0.05;
        sphere.rotation.z = Math.sin(time * 0.1) * 0.05;
    }

    // Animate Text (Subtle float)
    const text = group.getObjectByName('text');
    if (text) {
        text.position.y = Math.sin(time * 1.5) * 0.2;
        text.rotation.y = Math.sin(time * 0.5) * 0.1;
    }
}



// Update tree top particles with new text
function updateTreeTopParticles(targetScene, particlesObj, newText, position) {
    if (!particlesObj) return;

    // Remove old particles
    targetScene.remove(particlesObj);

    // Create new ones
    const treeType = particlesObj.userData.treeType;
    createTreeTopParticleText(targetScene, newText, position, treeType);
}

// --- Initialization ---
async function init() {
    // 0. Initialize IndexedDB and Settings UI
    try {
        await initIndexedDB();
        await loadSettings();
        initSettingsUI();
    } catch (err) {
        console.warn('IndexedDB initialization failed:', err);
    }

    // 1. Three.js Setup
    scene = new THREE.Scene();

    // Orthographic camera for 2D-like overlay but capable of 3D depth
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.z = 20;

    // Hand Overlay Scene
    handScene = new THREE.Scene();
    handCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    handCamera.position.z = 20;

    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('output_canvas'),
        alpha: true, // Important so we can see the video background if we drew it separately, but here we might render video to plane
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.autoClear = false; // Important for overlay

    // Create a group to hold particles so we can transform the whole text easily
    modelGroup = new THREE.Group();
    scene.add(modelGroup);

    // 2. Background Video - Handled via CSS (see style.css) and MediaPipe Camera
    const videoElement = document.getElementById('input_video');

    // 3. Initialize Particles
    initParticles();

    // 4. MediaPipe Setup
    const hands = new Hands({
        locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    hands.onResults((results) => {
        // Only process hand results if hand recognition is enabled
        if (handRecognitionEnabled) {
            // Check if we're waiting for palms during tutorial
            if (waitingForPalms && results.multiHandLandmarks && results.multiHandLandmarks.length >= 2) {
                // Require BOTH hands for "show your palms" with confirmation delay
                if (!palmDetectionStartTime) {
                    palmDetectionStartTime = Date.now();
                    console.log('👐 Both hands detected, confirming...');
                } else if (Date.now() - palmDetectionStartTime >= 500) {
                    // Confirmed for 0.5 seconds
                    onPalmsDetected();
                }
            } else {
                // Reset if hands lost
                palmDetectionStartTime = null;
            }

            // Check if we're waiting for right hand "1" gesture during tutorial
            if (waitingForFinger && results.multiHandLandmarks && results.multiHandedness) {
                for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                    const label = results.multiHandedness[i].label;
                    // MediaPipe labels are mirrored - "Left" in MediaPipe = right hand in reality
                    if (label === 'Left') { // This is the user's right hand
                        const hand = results.multiHandLandmarks[i];
                        if (isRightHandShowingOne(hand)) {
                            onFingerOneDetected();
                            break;
                        }
                    }
                }
            }

            // Check for left hand gestures while right hand shows "1" during tutorial
            if ((waitingForLeftOne || waitingForLeftTwo) && results.multiHandLandmarks && results.multiHandedness) {
                let rightHandShowingOne = false;
                let leftHand = null;

                // First, find both hands and check right hand state
                for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                    const label = results.multiHandedness[i].label;
                    if (label === 'Left') { // User's right hand (mirrored)
                        if (isRightHandShowingOne(results.multiHandLandmarks[i])) {
                            rightHandShowingOne = true;
                        }
                    } else if (label === 'Right') { // User's left hand (mirrored)
                        leftHand = results.multiHandLandmarks[i];
                    }
                }

                // Only check left hand if right hand is showing "1"
                if (rightHandShowingOne && leftHand) {
                    if (waitingForLeftOne && isHandShowingNumber(leftHand, 1)) {
                        onLeftOneDetected();
                    } else if (waitingForLeftTwo && isHandShowingNumber(leftHand, 2)) {
                        onLeftTwoDetected();
                    }
                }
            }

            // Process gesture interactions during tutorial (phases 8-10) or when intro is complete
            if (introComplete || (introPhase >= 8 && introPhase <= 10)) {
                onHandsResults(results);

                // Check for tutorial gesture completions
                if (!introComplete) {
                    // Check if drag was detected during this frame
                    if (waitingForDrag && isDragging) {
                        onDragDetected();
                    }
                    // Check if rotate was detected during this frame
                    if (waitingForRotate && isRotating) {
                        onRotateDetected();
                    }
                    // Check if scale was detected during this frame
                    if (waitingForScale && isScaling) {
                        onScaleDetected();
                    }
                    // Check if 3D look was detected (left 3-finger pinch causes isRotating in CB mode)
                    if (waitingFor3DLook && isRotating) {
                        on3DLookDetected();
                    }
                    // Check if 3D move was detected (right 3-finger pinch causes movement)
                    if (waitingFor3DMove && previousGripPos !== null) {
                        on3DMoveDetected();
                    }
                }
            } else if (introPhase >= 12 && introPhase <= 13) {
                // During 3D tutorial phases, process Cherry Blossom gestures
                onHandsResults(results);

                // Check for 3D tutorial gesture completions
                if (waitingFor3DLook && isRotating) {
                    on3DLookDetected();
                }
                if (waitingFor3DMove && previousGripPos !== null) {
                    on3DMoveDetected();
                }
            } else {
                // During early tutorial phases, still show hand visuals for feedback
                updateHandVisuals(results.multiHandLandmarks, results.multiHandedness);
            }
        }
    });

    // Check if Camera utils are available
    if (typeof Camera === 'undefined') {
        console.error("MediaPipe Camera utils not loaded");
        return;
    }

    const cameraUtils = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 1280,
        height: 720
    });

    // Start Camera
    cameraUtils.start()
        .then(() => {
            document.getElementById('loading').style.display = 'none';
            // Start the welcome intro sequence
            startIntroSequence();
        })
        .catch(err => console.error("Camera error:", err));

    // 5. Animation Loop
    animate();

    window.addEventListener('resize', onWindowResize);

    // 6. Keyboard listener for Modes
    let secretBuffer = '';
    let secretTimeout = null;
    const SECRET_PHRASE_CHRISTMAS = 'merrychristmas'; // Triggers Christmas Forest
    const SECRET_PHRASE_PHOTO = 'aurora'; // Triggers Photo Tree (requires prerequisites)
    const SECRET_PHRASE_TREE = 'tree'; // Triggers Empty Tree (requires prerequisites)
    const MAX_BUFFER_LENGTH = Math.max(SECRET_PHRASE_CHRISTMAS.length, SECRET_PHRASE_PHOTO.length, SECRET_PHRASE_TREE.length);

    // Prerequisite check function for secret scenes
    function canAccessSecretScenes() {
        // Must be in Christmas Mode AND all gifts found
        if (!isChristmasMode) {
            console.log('⚠️ Must be in Christmas Forest to access secret scenes. Type "merrychristmas" first!');
            return false;
        }
        if (totalGiftsSpawned === 0) {
            console.log('⚠️ No gifts spawned yet. Try re-entering Christmas Forest.');
            return false;
        }
        if (giftsOpened < totalGiftsSpawned) {
            console.log(`⚠️ Find all gifts first! (${giftsOpened}/${totalGiftsSpawned} opened)`);
            return false;
        }
        return true;
    }

    window.addEventListener('keydown', (e) => {
        // Secret phrase detection for scene modes
        // Only track letter keys
        if (e.key.length === 1 && e.key.match(/[a-zA-Z]/)) {
            secretBuffer += e.key.toLowerCase();

            // Keep buffer reasonable length
            if (secretBuffer.length > MAX_BUFFER_LENGTH) {
                secretBuffer = secretBuffer.slice(-MAX_BUFFER_LENGTH);
            }

            // Check if phrase matches for Christmas Forest (no prerequisite)
            if (secretBuffer.endsWith(SECRET_PHRASE_CHRISTMAS)) {
                toggleChristmasMode();
                secretBuffer = '';
                console.log('🎄 Secret phrase activated: Merry Christmas! Entering Christmas Forest.');
            }
            // Check if phrase matches for Photo Tree (requires prerequisites)
            else if (secretBuffer.endsWith(SECRET_PHRASE_PHOTO)) {
                if (canAccessSecretScenes()) {
                    togglePhotoTreeMode();
                    secretBuffer = '';
                    console.log('🌌 Secret phrase activated: Aurora! Entering Photo Tree.');
                } else {
                    secretBuffer = '';
                }
            }
            // Check if phrase matches for Empty Tree (requires prerequisites)
            else if (secretBuffer.endsWith(SECRET_PHRASE_TREE)) {
                if (canAccessSecretScenes()) {
                    toggleEmptyTreeMode();
                    secretBuffer = '';
                    console.log('🌲 Secret phrase activated: Tree! Entering Empty Tree scene.');
                } else {
                    secretBuffer = '';
                }
            }


            // Clear buffer after 3 seconds of no typing
            if (secretTimeout) clearTimeout(secretTimeout);
            secretTimeout = setTimeout(() => {
                secretBuffer = '';
            }, 3000);
        }
    });

    // 7. Initialize Scenes (hidden initially)
    initCherryBlossomScene();
    initChristmasScene();
    initPhotoTreeScene();
    initEmptyTreeScene();

    // 8. Spawn Gifts (Initial set)
    spawnGifts();
}

// --- Particle System ---

function initParticles() {
    geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3); // RGB for each particle

    // Initialize random positions and colors
    for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 1] = (Math.random() - 0.5) * 50;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 50;

        // Initial color: dim gray for background particles
        colors[i * 3] = 0.3;     // R
        colors[i * 3 + 1] = 0.3; // G
        colors[i * 3 + 2] = 0.3; // B
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: PARTICLE_SIZE,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        vertexColors: true // Enable per-vertex colors
    });

    particles = new THREE.Points(geometry, material);
    modelGroup.add(particles);

    // Init current positions array for lerping
    currentPositions = Array.from(positions);

    // Initialize targetPositions to match current positions to prevent NaN in animation loop
    targetPositions = new Float32Array(particleCount * 3);
    targetPositions.set(positions);

    // Don't set initial text here - intro sequence will handle it
}

function generateTextParticles(text) {
    // Create a 2D canvas to draw text
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const newPositions = [];

    // Scan pixel data
    for (let y = 0; y < canvas.height; y += 4) { // Step to reduce density
        for (let x = 0; x < canvas.width; x += 4) {
            const index = (y * canvas.width + x) * 4;
            if (data[index] > 128) { // If pixel is bright
                // Map 2D canvas x,y to 3D world coordinates
                // Center the text
                const pX = -(x - canvas.width / 2) * 0.05; // Invert X to fix mirroring
                const pY = -(y - canvas.height / 2) * 0.05; // Invert Y
                const pZ = 0;
                newPositions.push(pX, pY, pZ);
            }
        }
    }

    return newPositions;
}

function changeText(index) {
    if (index < 0 || index >= TEXTS.length) return;
    if (currentModelIndex === index) return;
    currentModelIndex = index;
    const points = generateTextParticles(TEXTS[index]);
    textParticleCount = Math.floor(points.length / 3); // Track how many particles form the text

    // Update target positions. 
    // If we have more particles than points, hide the extras (move to center or random).
    // If we have fewer particles, we only use available ones (some points missing).

    targetPositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        if (i < points.length / 3) {
            targetPositions[i * 3] = points[i * 3];
            targetPositions[i * 3 + 1] = points[i * 3 + 1];
            targetPositions[i * 3 + 2] = points[i * 3 + 2];
        } else {
            // Background particles - initial random positions
            targetPositions[i * 3] = (Math.random() - 0.5) * 60;
            targetPositions[i * 3 + 1] = (Math.random() - 0.5) * 40;
            targetPositions[i * 3 + 2] = (Math.random() - 0.5) * 30;
        }
    }
}

// --- Welcome Intro Sequence ---

// Set text directly (bypasses index check for intro texts)
function setTextDirect(text) {
    const points = generateTextParticles(text);
    textParticleCount = Math.floor(points.length / 3);

    targetPositions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
        if (i < points.length / 3) {
            targetPositions[i * 3] = points[i * 3];
            targetPositions[i * 3 + 1] = points[i * 3 + 1];
            targetPositions[i * 3 + 2] = points[i * 3 + 2];
        } else {
            targetPositions[i * 3] = (Math.random() - 0.5) * 60;
            targetPositions[i * 3 + 1] = (Math.random() - 0.5) * 40;
            targetPositions[i * 3 + 2] = (Math.random() - 0.5) * 30;
        }
    }
}

function startIntroSequence() {
    console.log('🎄 Starting welcome intro sequence...');
    introPhase = 0;
    introComplete = false;
    handRecognitionEnabled = false;
    waitingForPalms = false;
    palmDetectionStartTime = null;
    waitingForFinger = false;
    waitingForLeftOne = false;
    waitingForLeftTwo = false;
    waitingForDrag = false;
    waitingForRotate = false;
    waitingForScale = false;
    waitingFor3DLook = false;
    waitingFor3DMove = false;
    hideCC();

    // Show first intro text: "Merry Christmas"
    setTextDirect(INTRO_TEXTS[0]);
    console.log(`📝 Showing: "${INTRO_TEXTS[0]}"`);

    // After 3 seconds (formation + stay), show second text
    setTimeout(() => {
        introPhase = 1;
        setTextDirect(INTRO_TEXTS[1]);
        console.log(`📝 Showing: "${INTRO_TEXTS[1]}"`);

        // After another INTRO_DURATION, show tutorial prompt
        setTimeout(() => {
            introPhase = 2;
            waitingForPalms = true;
            handRecognitionEnabled = true; // Enable detection to look for palms
            setTextDirect(TUTORIAL_PROMPT);
            console.log('👋 Waiting for user to show palms...');
        }, INTRO_DURATION);
    }, INTRO_FIRST_TEXT_STAY); // First text stays 3 seconds
}

// Called when palms are detected during intro
function onPalmsDetected() {
    if (!waitingForPalms || introPhase !== 2) return;

    console.log('✅ Palms detected!');
    waitingForPalms = false;
    introPhase = 3;

    // Show success message immediately (no wait for formation)
    setTextDirect(TUTORIAL_SUCCESS);

    // Move to step 5 immediately after brief display
    setTimeout(() => {
        introPhase = 4;
        waitingForFinger = true;
        setTextDirect(TUTORIAL_FINGER_PROMPT);
        console.log('☝️ Waiting for right hand "1" gesture...');
    }, INTRO_DURATION);
}

// Called when right hand "1" gesture is detected during intro
function onFingerOneDetected() {
    if (!waitingForFinger || introPhase !== 4) return;

    console.log('✅ Right finger "1" detected!');
    waitingForFinger = false;
    introPhase = 5;

    // Show CC message with explanation
    showCC(TUTORIAL_FINGER_CC);

    // After 4 seconds, show the switch prompt and wait for left hand "1"
    setTimeout(() => {
        introPhase = 6;
        waitingForLeftOne = true;
        showCC(TUTORIAL_SWITCH_PROMPT);
        console.log('👆 Waiting for left hand "1" while right hand shows "1"...');
    }, 4000);
}

// Called when left hand "1" is detected while right hand shows "1"
function onLeftOneDetected() {
    if (!waitingForLeftOne || introPhase !== 6) return;

    console.log('✅ Left hand "1" detected!');
    waitingForLeftOne = false;
    introPhase = 7;

    // Show "Welldone" as particle text
    setTextDirect(TUTORIAL_SWITCH_SUCCESS);

    // Show next prompt in CC
    showCC(TUTORIAL_SCENE2_PROMPT);
    waitingForLeftTwo = true;
    console.log('✌️ Waiting for left hand "2" while right hand shows "1"...');
}

// Called when left hand "2" is detected while right hand shows "1"
function onLeftTwoDetected() {
    if (!waitingForLeftTwo || introPhase !== 7) return;

    console.log('✅ Left hand "2" detected!');
    waitingForLeftTwo = false;
    introPhase = 8;
    hideCC();

    // Show "Welldone" for 3 seconds
    setTextDirect(TUTORIAL_SWITCH_SUCCESS);
    console.log('👏 Showing Welldone for 3 seconds...');

    setTimeout(() => {
        // Switch to "Merry Christmas" and show drag tutorial CC
        setTextDirect(INTRO_TEXTS[0]); // "Merry Christmas"
        showCC(TUTORIAL_DRAG_CC);
        waitingForDrag = true;
        console.log('🎯 Waiting for drag gesture...');
    }, 3000);
}

// Called when drag gesture is detected during tutorial
function onDragDetected() {
    if (!waitingForDrag || introPhase !== 8) return;

    console.log('✅ Drag gesture detected!');
    waitingForDrag = false;
    introPhase = 9;

    // Show rotate tutorial CC
    showCC(TUTORIAL_ROTATE_CC);
    waitingForRotate = true;
    console.log('🔄 Waiting for rotate gesture...');
}

// Called when rotate gesture is detected during tutorial
function onRotateDetected() {
    if (!waitingForRotate || introPhase !== 9) return;

    console.log('✅ Rotate gesture detected!');
    waitingForRotate = false;
    introPhase = 10;

    // Show scale tutorial CC
    showCC(TUTORIAL_SCALE_CC);
    waitingForScale = true;
    console.log('🔍 Waiting for scale gesture...');
}

// Called when scale gesture is detected during tutorial
function onScaleDetected() {
    if (!waitingForScale || introPhase !== 10) return;

    console.log('✅ Scale gesture detected!');
    waitingForScale = false;
    introPhase = 11;

    // Show success feedback and let user experience the zoom effect
    showCC("Awesome! You've mastered zooming!");
    console.log('🔍 Scale success - letting user experience zoom effect...');

    // After 2 seconds of enjoying the zoom, show 3D intro
    setTimeout(() => {
        showCC(TUTORIAL_3D_INTRO);
        console.log('🌐 Transitioning to 3D tutorial...');

        // After another 3 seconds, enter Cherry Blossom for 3D tutorial
        setTimeout(() => {
            introPhase = 12;

            // Enter Cherry Blossom mode for 3D tutorial
            if (!isCherryBlossomMode) {
                toggleCherryBlossomMode();
            }

            // Show look tutorial CC
            showCC(TUTORIAL_3D_LOOK);
            waitingFor3DLook = true;
            console.log('👁️ Waiting for 3D look gesture (left 3-finger pinch)...');
        }, 3000);
    }, 2000);
}

// Called when 3D look gesture is detected during tutorial
function on3DLookDetected() {
    if (!waitingFor3DLook || introPhase !== 12) return;

    console.log('✅ 3D look gesture detected!');
    waitingFor3DLook = false;
    introPhase = 13;

    // Show move tutorial CC
    showCC(TUTORIAL_3D_MOVE);
    waitingFor3DMove = true;
    console.log('🚶 Waiting for 3D move gesture (right 3-finger pinch)...');
}

// Called when 3D move gesture is detected during tutorial
function on3DMoveDetected() {
    if (!waitingFor3DMove || introPhase !== 13) return;

    console.log('✅ 3D move gesture detected!');
    waitingFor3DMove = false;
    introPhase = 14;

    // Show completion CC
    showCC(TUTORIAL_3D_COMPLETE);

    // Complete tutorial after 3 seconds
    setTimeout(() => {
        onTutorialComplete();
    }, 3000);
}

// Called when entire tutorial is complete
function onTutorialComplete() {
    introPhase = 15;
    introComplete = true;
    hideCC();

    // Exit Cherry Blossom mode back to particle mode
    if (isCherryBlossomMode) {
        toggleCherryBlossomMode();
    }

    // Set to first regular text model
    currentModelIndex = -1;
    changeText(0);

    console.log('🎉 Full tutorial complete! All interactions enabled.');
}



// CC Overlay Functions
function showCC(text) {
    const overlay = document.getElementById('cc-overlay');
    const textEl = document.getElementById('cc-text');
    if (overlay && textEl) {
        textEl.textContent = text;
        overlay.classList.add('visible');
    }
}

function hideCC() {
    const overlay = document.getElementById('cc-overlay');
    if (overlay) {
        overlay.classList.remove('visible');
    }
}

// Check if right hand is showing "1" (only index finger extended)
function isRightHandShowingOne(hand) {
    if (!hand) return false;
    const wrist = hand[0];

    const EXTENSION_MARGIN = 1.15;

    // Check each finger extension
    const indexExtended = dist(hand[8], wrist) > dist(hand[6], wrist) * EXTENSION_MARGIN;
    const middleExtended = dist(hand[12], wrist) > dist(hand[10], wrist) * EXTENSION_MARGIN;
    const ringExtended = dist(hand[16], wrist) > dist(hand[14], wrist) * EXTENSION_MARGIN;
    const pinkyExtended = dist(hand[20], wrist) > dist(hand[18], wrist) * EXTENSION_MARGIN;

    // Check thumb is tucked
    const thumbTip = hand[4];
    const indexMCP = hand[5];
    const thumbDist = dist(thumbTip, indexMCP);
    const thumbExtended = thumbDist > 0.08;

    // Only index finger should be extended
    return indexExtended && !middleExtended && !ringExtended && !pinkyExtended && !thumbExtended;
}

// Check if a hand is showing a specific number (1-5)
function isHandShowingNumber(hand, number) {
    if (!hand || number < 1 || number > 5) return false;
    const wrist = hand[0];
    const EXTENSION_MARGIN = 1.15;

    // Check each finger extension
    const indexExtended = dist(hand[8], wrist) > dist(hand[6], wrist) * EXTENSION_MARGIN;
    const middleExtended = dist(hand[12], wrist) > dist(hand[10], wrist) * EXTENSION_MARGIN;
    const ringExtended = dist(hand[16], wrist) > dist(hand[14], wrist) * EXTENSION_MARGIN;
    const pinkyExtended = dist(hand[20], wrist) > dist(hand[18], wrist) * EXTENSION_MARGIN;

    // Check thumb extension
    const thumbTip = hand[4];
    const indexMCP = hand[5];
    const thumbDist = dist(thumbTip, indexMCP);
    const thumbExtended = thumbDist > 0.08;

    // Count extended fingers (excluding thumb for 1-4)
    const extendedCount = (indexExtended ? 1 : 0) + (middleExtended ? 1 : 0) + (ringExtended ? 1 : 0) + (pinkyExtended ? 1 : 0);

    if (number === 1) {
        return indexExtended && !middleExtended && !ringExtended && !pinkyExtended && !thumbExtended;
    } else if (number === 2) {
        return indexExtended && middleExtended && !ringExtended && !pinkyExtended && !thumbExtended;
    } else if (number === 3) {
        return indexExtended && middleExtended && ringExtended && !pinkyExtended && !thumbExtended;
    } else if (number === 4) {
        return indexExtended && middleExtended && ringExtended && pinkyExtended && !thumbExtended;
    } else if (number === 5) {
        return indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended;
    }
    return false;
}

// Helper to calculate distance between two landmarks
function dist(p1, p2) {
    return Math.sqrt(
        Math.pow(p1.x - p2.x, 2) +
        Math.pow(p1.y - p2.y, 2) +
        Math.pow(p1.z - p2.z, 2)
    );
}

// Helper to get 3D world position from normalized landmark (approximate)
function getHandPos(landmark) {
    // Map normalized coordinates (0-1) to approximate world units relative to camera
    // Camera Z is 20. Screen width approx 30 units at that depth.
    // x: 0..1 -> -15..15
    const range = 25;
    return new THREE.Vector3(
        (landmark.x - 0.5) * range,
        -(landmark.y - 0.5) * range * (window.innerHeight / window.innerWidth), // Aspect ratio fix
        0 //landmark.z * range // Depth is tricky with single cam, ignore Z drag for now or map lightly
    );
}

function onHandsResults(results) {
    // Draw Hand Overlay (Skeleton) using Three.js lines
    // Moved to end of function to reflect current frame's interaction state
    // updateHandVisuals(results.multiHandLandmarks, results.multiHandedness);

    const hands = results.multiHandLandmarks;
    const handedness = results.multiHandedness;

    if (!hands || hands.length === 0) {
        // Reset states if no hands
        isDragging = false;
        isRotating = false;
        isScaling = false;
        previousDragPos = null;
        pendingGestureIndex = -1;
        updateHandVisuals(null, null); // Clear visuals

        // Also reset cherry blossom states if needed
        previousScaleDistance = 0;
        previousRotationPos = null;
        return;
    }

    // Identify Hands
    let leftHand = null;
    let rightHand = null;

    for (let i = 0; i < hands.length; i++) {
        const label = handedness[i].label; // "Left" or "Right"
        if (label === 'Right') rightHand = hands[i];
        if (label === 'Left') leftHand = hands[i];
    }

    // --- GLOBAL GESTURES (Mode Switching) ---

    // Helper: Check if left hand is showing "1" (only index finger extended)
    function isLeftHandShowingOne(hand) {
        if (!hand) return false;
        const wrist = hand[0];

        // Check each finger: tip to wrist distance > pip to wrist distance means extended
        const indexExtended = dist(hand[8], wrist) > dist(hand[6], wrist);
        const middleExtended = dist(hand[12], wrist) > dist(hand[10], wrist);
        const ringExtended = dist(hand[16], wrist) > dist(hand[14], wrist);
        const pinkyExtended = dist(hand[20], wrist) > dist(hand[18], wrist);

        // Check thumb is tucked (not extended)
        const thumbTip = hand[4];
        const indexMCP = hand[5];
        const thumbDist = dist(thumbTip, indexMCP);
        const thumbExtended = thumbDist > 0.08;

        // Only index finger should be extended, all others tucked
        return indexExtended && !middleExtended && !ringExtended && !pinkyExtended && !thumbExtended;
    }

    // Check if left hand is showing "1" as activation key
    const leftHandActivated = isLeftHandShowingOne(leftHand);

    // 1. Model Switching / Mode Toggling (Requires: Left Hand "1" + Right Hand number)
    if (rightHand && leftHandActivated) {
        // Optimization: Disable switching if any interaction is active to prevent ghost triggers
        if (isDragging || isRotating || isScaling) {
            pendingGestureIndex = -1;
        } else {
            const fingers = [8, 12, 16, 20]; // Index, Middle, Ring, Pinky tips
            const pips = [6, 10, 14, 18];    // Corresponding PIP joints
            const wrist = rightHand[0];

            let count = 0;
            // Robust Check: Distance from Tip to Wrist > Distance from PIP to Wrist
            // This works regardless of hand rotation.
            // Added EXTENSION_MARGIN to require fingers to be CLEARLY extended (not just barely)
            // This prevents "3" from being detected as "4" due to pinky naturally lifting

            const EXTENSION_MARGIN = 1.15; // Tip must be 15% further than PIP from wrist

            const indexExtended = dist(rightHand[8], wrist) > dist(rightHand[6], wrist) * EXTENSION_MARGIN;
            const middleExtended = dist(rightHand[12], wrist) > dist(rightHand[10], wrist) * EXTENSION_MARGIN;
            const ringExtended = dist(rightHand[16], wrist) > dist(rightHand[14], wrist) * EXTENSION_MARGIN;
            const pinkyExtended = dist(rightHand[20], wrist) > dist(rightHand[18], wrist) * EXTENSION_MARGIN;

            if (indexExtended) count++;
            if (middleExtended) count++;
            if (ringExtended) count++;
            if (pinkyExtended) count++;

            // Check Thumb Extension (Strict check for "4")
            // Thumb tip (4) vs Index MCP (5). If distance is large, thumb is extended.
            const thumbTip = rightHand[4];
            const indexMCP = rightHand[5]; // Palm base of index
            const thumbDist = dist(thumbTip, indexMCP);

            // For "4", we want thumb TOCKED (Close).
            // For "5", we want thumb EXTENDED (Far).

            const THUMB_EXTENDED_THRESHOLD = 0.08; // Significantly relaxed (was 0.06, orig 0.05). 
            // This means the thumb has to be REALLY far out to count as "extended". 
            // So "tucked" (dist < 0.08) is easier.

            if (thumbDist > THUMB_EXTENDED_THRESHOLD) {
                // Thumb is extended -> Count as 5th finger
                count++;
            }

            // Map count to target action
            // 1->Index 0, 2->Index 1, 3->Index 2
            // 4 (Thumb tucked) -> Toggle Mode
            // 5 (Open Hand) -> Ignore (or could be reset)

            let targetAction = -1; // -1: None, 0-2: Model, 3: Toggle Mode

            if (count >= 1 && count <= 3) {
                targetAction = count - 1; // 0, 1, 2
            } else if (count === 4) {
                targetAction = 3; // Toggle Mode
            }

            // Debounce logic
            if (targetAction !== -1) {
                // Check if we are already in this state?
                // For Toggle (3), we just check if gesture is held.
                // For Models (0-2), check if currentModelIndex matches.

                let isSameState = false;
                if (targetAction < 3) {
                    if (!isCherryBlossomMode && !isChristmasMode && currentModelIndex === targetAction) isSameState = true;
                }

                if (!isSameState) {
                    if (pendingGestureIndex === targetAction) {
                        // Same gesture being held
                        if (Date.now() - gestureStartTime >= GESTURE_CONFIRM_DELAY) {
                            if (targetAction === 3) {
                                // Left 1 + Right 4 -> Only enter Cherry Blossom mode (after tutorial)
                                if (!isCherryBlossomMode && introComplete) {
                                    // Exit any other mode first
                                    if (isChristmasMode) toggleChristmasMode();
                                    if (isPhotoTreeMode) togglePhotoTreeMode();
                                    toggleCherryBlossomMode(); // Enter CB
                                }
                                pendingGestureIndex = -2; // Wait for release
                            } else if (!isCherryBlossomMode && !isChristmasMode && introComplete) {
                                // Switch Model (only in particle mode and after tutorial)
                                changeText(targetAction);
                                pendingGestureIndex = -1;
                            }
                        }
                    } else if (pendingGestureIndex === -2) {
                        // Waiting for release, do nothing
                    } else {
                        // New detection
                        pendingGestureIndex = targetAction;
                        gestureStartTime = Date.now();
                    }
                } else {
                    pendingGestureIndex = -1;
                }
            } else {
                // No valid gesture (0 or 5+)
                pendingGestureIndex = -1;
            }
        }
    } else {
        // Left hand not showing "1" or no right hand - reset gesture state
        pendingGestureIndex = -1;
    }

    // --- MODE SPECIFIC LOGIC ---

    if (isCherryBlossomMode) {
        // Handle CB gestures (Zoom/Rotate)
        const interactionState = handleSceneGestures(results, cherryBlossomCamera);
        isDragging = false;
        isRotating = interactionState.isRotating;
        isScaling = interactionState.isScaling;

    } else if (isChristmasMode) {
        // Handle Christmas gestures (Same as CB + Gift Interaction)
        const interactionState = handleSceneGestures(results, christmasCamera);

        // Handle Gift Interaction (Right Hand Pinch)
        handleGiftInteraction(results);

        isDragging = false; // No drag in scene mode yet
        isRotating = interactionState.isRotating;
        isScaling = interactionState.isScaling;

    } else if (isPhotoTreeMode) {
        // Handle Photo Tree gestures (Same as CB)
        const interactionState = handleSceneGestures(results, photoTreeCamera);

        // Handle Photo Interaction (Right Hand Fist to view)
        handlePhotoInteraction(results);

        isDragging = false;
        isRotating = interactionState.isRotating;
        isScaling = interactionState.isScaling;

    } else if (isEmptyTreeMode) {
        // Handle Empty Tree gestures (Same as CB + Media Interaction)
        const interactionState = handleSceneGestures(results, emptyTreeCamera);

        // Handle Media Interaction (Right Hand Fist to view)
        handlePhotoInteraction(results);

        isDragging = false;
        isRotating = interactionState.isRotating;
        isScaling = interactionState.isScaling;

    } else {
        // --- PARTICLE INTERACTION MODE ---

        // 2. Drag (Left Hand: Index + Thumb pinch)
        if (leftHand) {
            const thumbTip = leftHand[4];
            const indexTip = leftHand[8];
            const middleTip = leftHand[12];

            const pinchDist = dist(thumbTip, indexTip);
            const threeFingerDist = dist(thumbTip, middleTip);

            const PINCH_THRESHOLD = 0.05;

            // Reset states
            const wasDragging = isDragging;
            isDragging = false;
            isRotating = false;

            const isIndexPinch = pinchDist < PINCH_THRESHOLD;
            const isMiddlePinch = threeFingerDist < PINCH_THRESHOLD;

            if (isIndexPinch && isMiddlePinch) {
                // 3-finger pinch -> Rotate
                isRotating = true;
                const currentPos = getHandPos(indexTip);

                if (previousDragPos) {
                    const deltaX = currentPos.x - previousDragPos.x;
                    const deltaY = currentPos.y - previousDragPos.y;
                    modelGroup.rotation.y += deltaX * 0.2;
                    modelGroup.rotation.x -= deltaY * 0.2;
                }
                previousDragPos = currentPos;

            } else if (isIndexPinch) {
                // 2-finger pinch -> Drag
                isDragging = true;
                const currentPos = getHandPos(indexTip);

                if (wasDragging) {
                    const deltaX = currentPos.x - previousDragPos.x;
                    const deltaY = currentPos.y - previousDragPos.y;
                    modelGroup.position.x += deltaX;
                    modelGroup.position.y += deltaY;
                }
                previousDragPos = currentPos;
            } else {
                previousDragPos = null;
            }
        } else {
            isDragging = false;
            isRotating = false;
            previousDragPos = null;
        }

        // 3. Scale (Two Hands: Pinch on both)
        if (leftHand && rightHand) {
            const lThumb = leftHand[4];
            const lIndex = leftHand[8];
            const rThumb = rightHand[4];
            const rIndex = rightHand[8];

            const lPinch = dist(lThumb, lIndex) < 0.05;
            const rPinch = dist(rThumb, rIndex) < 0.05;

            if (lPinch && rPinch) {
                const leftPos = getHandPos(lIndex);
                const rightPos = getHandPos(rIndex);
                const currentDist = leftPos.distanceTo(rightPos);

                if (!isScaling) {
                    isScaling = true;
                    initialScaleDistance = currentDist;
                    initialScale = modelGroup.scale.x;
                } else {
                    const scaleFactor = currentDist / initialScaleDistance;
                    const newScale = initialScale * scaleFactor;
                    modelGroup.scale.set(newScale, newScale, newScale);
                }
            } else {
                isScaling = false;
            }
        } else {
            isScaling = false;
        }
    }

    // Update Visuals NOW (works for both modes)
    updateHandVisuals(results.multiHandLandmarks, results.multiHandedness);
}


// --- Visuals (Hand Skeleton) ---
let handLines = [];
const defaultMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.5 });
const activeMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, depthTest: false, transparent: true, opacity: 0.8 });
const leftHandMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, depthTest: false, transparent: true, opacity: 0.5 }); // Blue
const rightHandMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, depthTest: false, transparent: true, opacity: 0.5 }); // Green

// Glow Sprite Stuff
let glowTexture;
let glowMaterial;
let tipSprites = []; // Pool of sprites

function createGlowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Gradient: Center (Blue/White) -> Edge (Transparent)
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(200, 240, 255, 1)'); // Core: lighter blue/white
    gradient.addColorStop(0.2, 'rgba(0, 150, 255, 0.8)'); // Inner glow
    gradient.addColorStop(0.5, 'rgba(0, 100, 255, 0.3)'); // Outer mist
    gradient.addColorStop(1, 'rgba(0, 0, 255, 0)'); // Fade out

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function getTipSprite() {
    if (!glowTexture) {
        glowTexture = createGlowTexture();
        glowMaterial = new THREE.SpriteMaterial({
            map: glowTexture,
            color: 0x00aaff, // Make it explicitly blue tint
            transparent: true,
            opacity: 1.0, // Full opacity
            blending: THREE.AdditiveBlending, // Keep additive for glow, but base opacity higher
            depthTest: false
        });
    }

    // Check if we have unused sprite in pool (hidden one)
    // Actually, let's just create new if needed, reuse logic is simpler if we just iterate
    // This function will just create a new one, we manage pool in updateVis
    const sprite = new THREE.Sprite(glowMaterial);
    sprite.renderOrder = 1000; // Ensure on top of lines (999)
    sprite.scale.set(3.0, 3.0, 3.0); // Initial scale
    return sprite;
}

function updateHandVisuals(landmarksData, handednessData) {
    // Clear old lines from HAND SCENE
    handLines.forEach(line => handScene.remove(line));
    handLines = [];

    // Hide all existing tip sprites
    tipSprites.forEach(sprite => sprite.visible = false);
    // Ensure sprites are in hand scene
    tipSprites.forEach(sprite => {
        if (sprite.parent !== handScene) handScene.add(sprite);
    });

    let spriteIdx = 0; // Iterator for reusing sprites

    if (!landmarksData) return;

    landmarksData.forEach((handLm, i) => {
        const points = handLm.map(lm => getHandPos(lm));

        // Define connections manually if global is missing, or use it
        // MediaPipe HAND_CONNECTIONS is usually an array of [start, end]
        let connections = window.HAND_CONNECTIONS;

        if (!connections) {
            // Fallback manual connections
            connections = [
                [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
                [0, 5], [5, 6], [6, 7], [7, 8], // Index
                [0, 9], [9, 10], [10, 11], [11, 12], // Middle
                [0, 13], [13, 14], [14, 15], [15, 16], // Ring
                [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
                [5, 9], [9, 13], [13, 17], [0, 17] // Palm
            ];
        }

        // Choose material based on interaction/hand
        let material = defaultMaterial;
        let label = 'Unknown';
        if (handednessData && handednessData[i]) {
            label = handednessData[i].label;
        }

        // 1. Interaction Priority: Red
        // Check if THIS hand is involved in interaction
        let isInteractionHand = false;

        if (label === 'Left') {
            if (isDragging || isRotating || isScaling) isInteractionHand = true;
        } else if (label === 'Right') {
            if (isScaling) isInteractionHand = true;
            // Visual Feedback for Pending Gesture (Yellow)
            if (pendingGestureIndex !== -1 && pendingGestureIndex !== -2) {
                material = new THREE.LineBasicMaterial({ color: 0xffff00, depthTest: false, transparent: true, opacity: 0.8 }); // Yellow
                // Force this material
                isInteractionHand = false; // Override red if just pending? Or maybe Yellow is fine.
                // Actually, let's keep Red priority if scaling, but if just gesturing "4", show Yellow.
            }
        }

        if (isInteractionHand) {
            material = activeMaterial;
        } else if (label === 'Right' && pendingGestureIndex !== -1 && pendingGestureIndex !== -2) {
            // Pending Gesture -> Yellow
            material = new THREE.LineBasicMaterial({ color: 0xffff00, depthTest: false, transparent: true, opacity: 0.8 });
        } else {
            // 2. Handedness Color
            if (label === 'Left') {
                material = leftHandMaterial;
            } else if (label === 'Right') {
                material = rightHandMaterial;
            }
        }

        const geometry = new THREE.BufferGeometry();
        const positions = [];

        connections.forEach(conn => {
            // Check if conn is array [a,b] or object {start, end} depending on version
            const startIdx = conn.length ? conn[0] : conn.start;
            const endIdx = conn.length ? conn[1] : conn.end;

            if (points[startIdx] && points[endIdx]) {
                positions.push(points[startIdx].x, points[startIdx].y, points[startIdx].z);
                positions.push(points[endIdx].x, points[endIdx].y, points[endIdx].z);
            }
        });

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        const line = new THREE.LineSegments(geometry, material);
        line.renderOrder = 999; // On top
        handScene.add(line); // Add to Hand Scene
        handLines.push(line);

        // --- Render Interaction Point (at pinch location when active) ---
        let showPoint = false;
        let pointPos = new THREE.Vector3();

        if (label === 'Left') {
            if (isRotating) {
                // Centroid of Thumb (4), Index (8), Middle (12)
                const p4 = points[4];
                const p8 = points[8];
                const p12 = points[12];
                if (p4 && p8 && p12) {
                    pointPos.set(
                        (p4.x + p8.x + p12.x) / 3,
                        (p4.y + p8.y + p12.y) / 3,
                        (p4.z + p8.z + p12.z) / 3
                    );
                    showPoint = true;
                }
            } else if (isDragging || isScaling) {
                // Midpoint of Thumb (4) and Index (8)
                const p4 = points[4];
                const p8 = points[8];
                if (p4 && p8) {
                    pointPos.set(
                        (p4.x + p8.x) / 2,
                        (p4.y + p8.y) / 2,
                        (p4.z + p8.z) / 2
                    );
                    showPoint = true;
                }
            }
        } else if (label === 'Right') {
            if (isScaling) {
                // Midpoint of Thumb (4) and Index (8)
                const p4 = points[4];
                const p8 = points[8];
                if (p4 && p8) {
                    pointPos.set(
                        (p4.x + p8.x) / 2,
                        (p4.y + p8.y) / 2,
                        (p4.z + p8.z) / 2
                    );
                    showPoint = true;
                }
            }
        }

        if (showPoint) {
            // Get or create sprite
            if (spriteIdx >= tipSprites.length) {
                const newSprite = getTipSprite();
                handScene.add(newSprite); // Add to Hand Scene
                tipSprites.push(newSprite);
            }
            const sprite = tipSprites[spriteIdx];
            sprite.visible = true;
            sprite.position.copy(pointPos);

            // Make it larger and more visible
            sprite.scale.set(3.0, 3.0, 3.0);

            spriteIdx++;
        }
    });
}


// --- Main Loop ---

function animate() {
    requestAnimationFrame(animate);

    renderer.clear(); // Clear buffers manually

    // Check active mode
    if (isCherryBlossomMode) {
        animateCherryBlossom();
        renderer.render(cherryBlossomScene, cherryBlossomCamera);
    } else if (isChristmasMode) {
        animateChristmasScene();
        renderer.render(christmasScene, christmasCamera);
    } else if (isPhotoTreeMode) {
        animatePhotoTreeScene();
        renderer.render(photoTreeScene, photoTreeCamera);
    } else if (isEmptyTreeMode) {
        animateEmptyTreeScene();
        renderer.render(emptyTreeScene, emptyTreeCamera);
    } else {
        // Particle Animation (Lerp to target)
        const positions = geometry.attributes.position.array;
        const colors = geometry.attributes.color.array;
        const lerpSpeed = 0.10; // Lerp speed for ~1s formation
        const time = Date.now() * 0.001;

        for (let i = 0; i < particleCount; i++) {
            const idx = i * 3;

            if (i < textParticleCount) {
                // Text particles: move directly to target
                positions[idx] += (targetPositions[idx] - positions[idx]) * lerpSpeed;
                positions[idx + 1] += (targetPositions[idx + 1] - positions[idx + 1]) * lerpSpeed;
                positions[idx + 2] += (targetPositions[idx + 2] - positions[idx + 2]) * lerpSpeed;

                // Bright white color for text particles
                colors[idx] = 1.0;     // R
                colors[idx + 1] = 1.0; // G
                colors[idx + 2] = 1.0; // B
            } else {
                // Background particles: float around gently
                positions[idx] += (targetPositions[idx] - positions[idx]) * lerpSpeed * 0.3;
                positions[idx + 1] += (targetPositions[idx + 1] - positions[idx + 1]) * lerpSpeed * 0.3;
                positions[idx + 2] += (targetPositions[idx + 2] - positions[idx + 2]) * lerpSpeed * 0.3;

                // Add gentle floating motion
                const floatOffset = i * 0.1;
                positions[idx] += Math.sin(time + floatOffset) * 0.02;
                positions[idx + 1] += Math.cos(time * 0.7 + floatOffset) * 0.02;
                positions[idx + 2] += Math.sin(time * 0.5 + floatOffset) * 0.01;

                // Dim gray color for background particles
                colors[idx] = 0.3;     // R
                colors[idx + 1] = 0.3; // G
                colors[idx + 2] = 0.3; // B
            }
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;

        renderer.render(scene, camera);
    }

    // Render Hand Overlay on top
    renderer.clearDepth(); // Clear depth so hands are drawn on top
    renderer.render(handScene, handCamera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    // Update hand camera too
    handCamera.aspect = window.innerWidth / window.innerHeight;
    handCamera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

    // Also update cherry blossom camera if initialized
    if (cherryBlossomCamera) {
        cherryBlossomCamera.aspect = window.innerWidth / window.innerHeight;
        cherryBlossomCamera.updateProjectionMatrix();
    }
    // Update Christmas camera
    if (christmasCamera) {
        christmasCamera.aspect = window.innerWidth / window.innerHeight;
        christmasCamera.updateProjectionMatrix();
    }
    // Update Photo Tree camera
    if (photoTreeCamera) {
        photoTreeCamera.aspect = window.innerWidth / window.innerHeight;
        photoTreeCamera.updateProjectionMatrix();
    }
}

// Start
init();

// ==================== Cherry Blossom Scene ====================

function initCherryBlossomScene() {
    // Create separate scene for cherry blossom
    cherryBlossomScene = new THREE.Scene();
    cherryBlossomScene.fog = new THREE.FogExp2(0xffb6c1, 0.012);

    // Create camera for cherry blossom scene
    cherryBlossomCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    cherryBlossomCamera.position.set(0, 5, 20);

    // Add lights
    addCherryBlossomLights();

    // Create ground
    createCherryBlossomGround();

    // Create forest
    createCherryBlossomForest();

    // Create falling petals
    createCherryBlossomPetals();

    // Create mountains
    createCherryBlossomMountains();

    // Create moon
    createCherryBlossomMoon();
}

function addCherryBlossomLights() {
    // Ambient light - pink tint
    const ambientLight = new THREE.AmbientLight(0xffc0cb, 0.4);
    cherryBlossomScene.add(ambientLight);

    // Main light - moonlight
    const moonLight = new THREE.DirectionalLight(0xffffff, 0.6);
    moonLight.position.set(50, 100, 50);
    moonLight.castShadow = true;
    cherryBlossomScene.add(moonLight);

    // Pink point lights for romantic atmosphere
    const pinkLight1 = new THREE.PointLight(0xff69b4, 0.8, 50);
    pinkLight1.position.set(-10, 10, 0);
    cherryBlossomScene.add(pinkLight1);

    const pinkLight2 = new THREE.PointLight(0xff1493, 0.6, 40);
    pinkLight2.position.set(10, 8, -10);
    cherryBlossomScene.add(pinkLight2);

    // Purple point light
    const purpleLight = new THREE.PointLight(0xda70d6, 0.5, 60);
    purpleLight.position.set(0, 15, 10);
    cherryBlossomScene.add(purpleLight);
}

function createCherryBlossomGround() {
    // Grass ground
    const groundGeometry = new THREE.PlaneGeometry(200, 200, 50, 50);

    const vertices = groundGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i + 2] += Math.sin(vertices[i] * 0.1) * Math.cos(vertices[i + 1] * 0.1) * 0.5;
    }
    groundGeometry.computeVertexNormals();

    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x2d5016,
        roughness: 0.9,
        metalness: 0.1
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    cherryBlossomScene.add(ground);

    // Petal ground layer
    const petalGroundGeometry = new THREE.PlaneGeometry(200, 200);
    const petalGroundMaterial = new THREE.MeshStandardMaterial({
        color: 0xffb6c1,
        transparent: true,
        opacity: 0.3,
        roughness: 1
    });
    const petalGround = new THREE.Mesh(petalGroundGeometry, petalGroundMaterial);
    petalGround.rotation.x = -Math.PI / 2;
    petalGround.position.y = -0.4;
    cherryBlossomScene.add(petalGround);
}

function createCherryBlossomTree(x, z, scale = 1) {
    const treeGroup = new THREE.Group();

    // Trunk
    const trunkGeometry = new THREE.CylinderGeometry(0.3 * scale, 0.5 * scale, 4 * scale, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a3728,
        roughness: 0.9
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 2 * scale;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Branches
    const branchMaterial = new THREE.MeshStandardMaterial({
        color: 0x3d2b1f,
        roughness: 0.8
    });

    for (let layer = 0; layer < 3; layer++) {
        const layerHeight = 3 * scale + layer * 1.5 * scale;
        const numBranches = 5 + layer * 2;

        for (let i = 0; i < numBranches; i++) {
            const angle = (i / numBranches) * Math.PI * 2 + layer * 0.3;
            const branchLength = (2 + Math.random()) * scale;

            const branchGeometry = new THREE.CylinderGeometry(0.05 * scale, 0.15 * scale, branchLength, 6);
            const branch = new THREE.Mesh(branchGeometry, branchMaterial);

            branch.position.set(
                Math.cos(angle) * 0.3 * scale,
                layerHeight,
                Math.sin(angle) * 0.3 * scale
            );
            branch.rotation.z = Math.PI / 4 + Math.random() * 0.3;
            branch.rotation.y = angle;
            branch.castShadow = true;
            treeGroup.add(branch);
        }
    }

    // Blossom crowns
    const blossomColors = [0xffb6c1, 0xffc0cb, 0xff69b4, 0xffd1dc, 0xffb7c5];

    // Main crown
    for (let i = 0; i < 8; i++) {
        const radius = (1.5 + Math.random() * 1.5) * scale;
        const blossomGeometry = new THREE.SphereGeometry(radius, 16, 16);
        const blossomMaterial = new THREE.MeshStandardMaterial({
            color: blossomColors[Math.floor(Math.random() * blossomColors.length)],
            roughness: 0.8,
            metalness: 0.1,
            transparent: true,
            opacity: 0.9
        });

        const blossom = new THREE.Mesh(blossomGeometry, blossomMaterial);

        const angle = (i / 8) * Math.PI * 2;
        const distance = (1.5 + Math.random()) * scale;
        blossom.position.set(
            Math.cos(angle) * distance,
            (5 + Math.random() * 2) * scale,
            Math.sin(angle) * distance
        );

        blossom.castShadow = true;
        treeGroup.add(blossom);
    }

    // Top crown
    for (let i = 0; i < 4; i++) {
        const radius = (1 + Math.random()) * scale;
        const blossomGeometry = new THREE.SphereGeometry(radius, 12, 12);
        const blossomMaterial = new THREE.MeshStandardMaterial({
            color: blossomColors[Math.floor(Math.random() * blossomColors.length)],
            roughness: 0.7,
            transparent: true,
            opacity: 0.85
        });

        const blossom = new THREE.Mesh(blossomGeometry, blossomMaterial);

        const angle = (i / 4) * Math.PI * 2;
        blossom.position.set(
            Math.cos(angle) * 0.8 * scale,
            (7 + Math.random()) * scale,
            Math.sin(angle) * 0.8 * scale
        );

        treeGroup.add(blossom);
    }

    // Central top
    const topBlossomGeometry = new THREE.SphereGeometry(1.2 * scale, 16, 16);
    const topBlossomMaterial = new THREE.MeshStandardMaterial({
        color: 0xffd1dc,
        roughness: 0.6,
        transparent: true,
        opacity: 0.9
    });
    const topBlossom = new THREE.Mesh(topBlossomGeometry, topBlossomMaterial);
    topBlossom.position.y = 8 * scale;
    treeGroup.add(topBlossom);

    treeGroup.position.set(x, 0, z);
    treeGroup.rotation.y = Math.random() * Math.PI * 2;

    return treeGroup;
}

function createCherryBlossomForest() {
    // Main trees in center
    const mainTreePositions = [
        { x: 0, z: 0, scale: 1.2 },
        { x: -6, z: -5, scale: 1.0 },
        { x: 6, z: -4, scale: 1.1 },
        { x: -8, z: 3, scale: 0.9 },
        { x: 8, z: 2, scale: 1.0 },
        { x: 3, z: -8, scale: 0.95 },
        { x: -4, z: -9, scale: 1.05 },
    ];

    mainTreePositions.forEach(pos => {
        const tree = createCherryBlossomTree(pos.x, pos.z, pos.scale);
        cherryBlossomTrees.push(tree);
        cherryBlossomScene.add(tree);
    });

    // Background trees - dense forest
    for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 15 + Math.random() * 35;
        const x = Math.cos(angle) * distance;
        const z = Math.sin(angle) * distance - 10;
        const scale = 0.6 + Math.random() * 0.5;

        const tree = createCherryBlossomTree(x, z, scale);
        cherryBlossomTrees.push(tree);
        cherryBlossomScene.add(tree);
    }

    // Side fill
    for (let i = 0; i < 25; i++) {
        const x = (Math.random() - 0.5) * 60;
        const z = -20 - Math.random() * 30;
        const scale = 0.5 + Math.random() * 0.6;

        const tree = createCherryBlossomTree(x, z, scale);
        cherryBlossomTrees.push(tree);
        cherryBlossomScene.add(tree);
    }
}

function createCherryBlossomPetals() {
    const petalCount = 500;

    for (let i = 0; i < petalCount; i++) {
        const petalGeometry = new THREE.PlaneGeometry(0.15, 0.2);
        const petalMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.95 + Math.random() * 0.05, 0.6 + Math.random() * 0.3, 0.8 + Math.random() * 0.15),
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8 + Math.random() * 0.2
        });

        const petal = new THREE.Mesh(petalGeometry, petalMaterial);

        petal.position.set(
            (Math.random() - 0.5) * 80,
            Math.random() * 30,
            (Math.random() - 0.5) * 80 - 10
        );

        petal.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        petal.userData = {
            fallSpeed: 0.01 + Math.random() * 0.02,
            swaySpeed: 1 + Math.random() * 2,
            swayAmount: 0.5 + Math.random() * 1,
            rotateSpeed: 0.01 + Math.random() * 0.03,
            initialX: petal.position.x,
            phase: Math.random() * Math.PI * 2
        };

        cherryBlossomPetals.push(petal);
        cherryBlossomScene.add(petal);
    }
}

function createCherryBlossomMountains() {
    const mountainMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a3050,
        roughness: 1,
        metalness: 0
    });

    for (let layer = 0; layer < 3; layer++) {
        const points = [];
        const segments = 20;

        for (let i = 0; i <= segments; i++) {
            const x = (i / segments - 0.5) * 200;
            const height = 10 + Math.sin(i * 0.5 + layer) * 8 + Math.random() * 5;
            points.push(new THREE.Vector2(x, height));
        }

        points.push(new THREE.Vector2(100, 0));
        points.push(new THREE.Vector2(-100, 0));

        const shape = new THREE.Shape(points);
        const extrudeSettings = {
            steps: 1,
            depth: 10 + layer * 5,
            bevelEnabled: false
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const material = mountainMaterial.clone();
        material.color = new THREE.Color().setHSL(0.8 - layer * 0.05, 0.3, 0.25 - layer * 0.05);

        const mountain = new THREE.Mesh(geometry, material);
        mountain.rotation.x = Math.PI / 2;
        mountain.position.z = -60 - layer * 20;
        mountain.position.y = -5;
        cherryBlossomScene.add(mountain);
    }
}

function createCherryBlossomMoon() {
    const moonGeometry = new THREE.SphereGeometry(8, 32, 32);
    const moonMaterial = new THREE.MeshBasicMaterial({ color: 0xfffef0 });
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.position.set(40, 60, -80);
    cherryBlossomScene.add(moon);

    // Moon glow
    const glowGeometry = new THREE.SphereGeometry(12, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xfff8e7,
        transparent: true,
        opacity: 0.3
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(moon.position);
    cherryBlossomScene.add(glow);

    // Outer glow
    const outerGlowGeometry = new THREE.SphereGeometry(18, 32, 32);
    const outerGlowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffeedd,
        transparent: true,
        opacity: 0.15
    });
    const outerGlow = new THREE.Mesh(outerGlowGeometry, outerGlowMaterial);
    outerGlow.position.copy(moon.position);
    cherryBlossomScene.add(outerGlow);
}

function toggleCherryBlossomMode() {
    isCherryBlossomMode = !isCherryBlossomMode;
    if (isCherryBlossomMode) {
        isChristmasMode = false; // Mutual exclusive
        isPhotoTreeMode = false;
        isEmptyTreeMode = false;
    }

    // Reset camera controls
    resetSceneCamera(isCherryBlossomMode ? cherryBlossomCamera : null);
    updateSettingsButtonVisibility();

    console.log("Cherry Blossom Mode:", isCherryBlossomMode ? "ON" : "OFF");
}

function resetSceneCamera(cam) {
    targetCameraPosition.set(0, 5, 20);
    targetCameraYaw = 0;
    targetCameraPitch = 0;
    cameraPosition.copy(targetCameraPosition);
    cameraYaw = 0;
    cameraPitch = 0;

    if (cam) {
        cam.position.copy(cameraPosition);
        cam.rotation.set(0, 0, 0);
    }
}

function animateCherryBlossom() {
    cherryBlossomTime += 0.01;

    // Smooth camera transitions -> REMOVED INERTIA
    cameraPosition.copy(targetCameraPosition);
    cameraYaw = targetCameraYaw;
    cameraPitch = targetCameraPitch;

    // Apply rotation
    cherryBlossomCamera.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');
    // Apply position
    cherryBlossomCamera.position.copy(cameraPosition);

    // Tree sway animation
    cherryBlossomTrees.forEach((tree, index) => {
        tree.rotation.z = Math.sin(cherryBlossomTime * 0.5 + index) * 0.02;
        tree.rotation.x = Math.sin(cherryBlossomTime * 0.3 + index * 0.5) * 0.01;
    });

    // Petal falling animation
    cherryBlossomPetals.forEach(petal => {
        const data = petal.userData;

        petal.position.y -= data.fallSpeed;
        petal.position.x = data.initialX + Math.sin(cherryBlossomTime * data.swaySpeed + data.phase) * data.swayAmount;

        petal.rotation.x += data.rotateSpeed;
        petal.rotation.y += data.rotateSpeed * 0.7;
        petal.rotation.z += data.rotateSpeed * 0.5;

        if (petal.position.y < -1) {
            petal.position.y = 25 + Math.random() * 10;
            petal.position.x = (Math.random() - 0.5) * 80;
            petal.position.z = (Math.random() - 0.5) * 80 - 10;
            data.initialX = petal.position.x;
        }
    });
}

function handleCherryBlossomGestures(results) {
    const hands = results.multiHandLandmarks;
    const handedness = results.multiHandedness;

    let scaling = false;
    let rotating = false;

    if (!hands || hands.length === 0) {
        previousScaleDistance = 0;
        previousRotationPos = null;
        return { isScaling: false, isRotating: false };
    }

    let leftHand = null;
    let rightHand = null;

    for (let i = 0; i < hands.length; i++) {
        const label = handedness[i].label;
        if (label === 'Right') rightHand = hands[i];
        if (label === 'Left') leftHand = hands[i];
    }

    // 1. Two-hand pinch to Move Forward/Backward (Zoom)
    if (leftHand && rightHand) {
        const lThumb = leftHand[4];
        const lIndex = leftHand[8];
        const rThumb = rightHand[4];
        const rIndex = rightHand[8];

        const lPinchDist = dist(lThumb, lIndex);
        const rPinchDist = dist(rThumb, rIndex);

        const PINCH_THRESHOLD = 0.08;

        if (lPinchDist < PINCH_THRESHOLD && rPinchDist < PINCH_THRESHOLD) {
            // Both hands pinching - Move Mode
            scaling = true; // Still call it scaling for checking
            const leftPos = getHandPos(lIndex);
            const rightPos = getHandPos(rIndex);
            const currentDist = leftPos.distanceTo(rightPos);

            if (previousScaleDistance > 0) {
                const delta = currentDist - previousScaleDistance;

                // Move camera forward along its view vector
                const forward = new THREE.Vector3(0, 0, -1);
                forward.applyEuler(new THREE.Euler(targetCameraPitch, targetCameraYaw, 0, 'YXZ'));

                // Sensitivity
                const moveSpeed = 5.0;
                targetCameraPosition.addScaledVector(forward, delta * moveSpeed);
            }
            previousScaleDistance = currentDist;
        } else {
            previousScaleDistance = 0;
        }
    } else {
        previousScaleDistance = 0;
    }

    // 2. Left hand three-finger pinch to LOOK (Rotate)
    if (leftHand) {
        const thumbTip = leftHand[4];
        const indexTip = leftHand[8];
        const middleTip = leftHand[12];

        const thumbIndexDist = dist(thumbTip, indexTip);
        const thumbMiddleDist = dist(thumbTip, middleTip);

        const PINCH_THRESHOLD = 0.08;

        if (thumbIndexDist < PINCH_THRESHOLD && thumbMiddleDist < PINCH_THRESHOLD) {
            // Three-finger pinch detected - Look Mode
            rotating = true;
            const currentPos = getHandPos(indexTip);

            if (previousRotationPos) {
                const deltaX = currentPos.x - previousRotationPos.x;
                const deltaY = currentPos.y - previousRotationPos.y;

                // Look Logic
                // Hand Horizontal -> Yaw (Turn Left/Right)
                // Hand Vertical -> Pitch (Look Up/Down)

                // Reversed as per user request (Right now: Drag Left -> Yaw Decreases -> Rotate Right?)
                // User said "Left/Right reversed".
                // Previously: targetCameraYaw -= deltaX * 0.15;
                // Now:
                targetCameraYaw += deltaX * 0.15;
                targetCameraPitch -= deltaY * 0.15;

                // Limit Pitch
                const maxPitch = Math.PI / 2 - 0.1;
                targetCameraPitch = Math.max(-maxPitch, Math.min(maxPitch, targetCameraPitch));
            }
            previousRotationPos = currentPos;
        } else {
            previousRotationPos = null;
        }
    } else {
        previousRotationPos = null;
    }

    // 3. Right hand three-finger pinch to MOVE (Strafe Horizontal/Vertical)
    if (rightHand) {
        const thumbTip = rightHand[4];
        const indexTip = rightHand[8];
        const middleTip = rightHand[12];

        const thumbIndexDist = dist(thumbTip, indexTip);
        const thumbMiddleDist = dist(thumbTip, middleTip);

        const PINCH_THRESHOLD = 0.08;

        if (thumbIndexDist < PINCH_THRESHOLD && thumbMiddleDist < PINCH_THRESHOLD) {
            // Three-finger pinch detected - Strafe Mode
            const currentPos = getHandPos(indexTip);

            if (previousGripPos) {
                const deltaX = currentPos.x - previousGripPos.x;
                const deltaY = currentPos.y - previousGripPos.y;

                // Calculate right vector (perpendicular to forward on XZ plane)
                const right = new THREE.Vector3(1, 0, 0);
                right.applyEuler(new THREE.Euler(0, targetCameraYaw, 0, 'YXZ'));

                // Calculate up vector (world up)
                const up = new THREE.Vector3(0, 1, 0);

                // Move
                const moveSpeed = 2.0;
                targetCameraPosition.addScaledVector(right, -deltaX * moveSpeed);
                targetCameraPosition.addScaledVector(up, deltaY * moveSpeed);
            }
            previousGripPos = currentPos;
        } else {
            previousGripPos = null;
        }
    } else {
        previousGripPos = null;
    }

    return { isScaling: scaling, isRotating: rotating };
}

// Rename/Alias for generic use, passing camera if needed (but logic is shared via global targetCamera vars)
function handleSceneGestures(results, activeCamera) {
    return handleCherryBlossomGestures(results);
}



// ==================== Christmas Forest Scene ====================

function initChristmasScene() {
    christmasScene = new THREE.Scene();
    // Cold, snowy fog
    christmasScene.fog = new THREE.FogExp2(0xeef2f3, 0.015);

    christmasCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    christmasCamera.position.set(0, 5, 20);

    addChristmasLights();
    createChristmasGround();
    createChristmasForest();
    createSnow();
    createChristmasMountains();
    createChristmasMoon();
}

function spawnGifts() {
    // Clear existing
    gifts.forEach(g => christmasScene.remove(g.mesh));
    gifts = [];

    // Reset gift tracking
    totalGiftsSpawned = 0;
    giftsOpened = 0;

    if (christmasTrees.length === 0) return;

    // Pick one random tree to put gifts under
    // Prefer "main" trees (first 5 in the array) which are closer to center
    const mainTreeCount = Math.min(5, christmasTrees.length);
    const chosenTree = christmasTrees[Math.floor(Math.random() * mainTreeCount)];

    // Spawn 2-4 gifts around this tree
    const giftCount = 2 + Math.floor(Math.random() * 3);
    totalGiftsSpawned = giftCount;

    for (let i = 0; i < giftCount; i++) {
        // Evenly distribute around tree base
        const angle = (i / giftCount) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 1.5 + Math.random() * 1.0;

        const gx = chosenTree.position.x + Math.cos(angle) * dist;
        const gz = chosenTree.position.z + Math.sin(angle) * dist;

        createGift(gx, gz);
    }

    console.log(`🎁 Spawned ${giftCount} gifts under tree. Find them all to unlock secret scenes!`);
}

function createGift(x, z) {
    const giftGroup = new THREE.Group();

    // Box
    const size = 0.6 + Math.random() * 0.4;
    const boxGeo = new THREE.BoxGeometry(size, size, size);
    const boxColor = new THREE.Color().setHSL(Math.random(), 0.8, 0.5);
    const boxMat = new THREE.MeshStandardMaterial({ color: boxColor, roughness: 0.3 });
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.y = size / 2;
    box.castShadow = true;
    giftGroup.add(box);

    // Ribbon (Horizontal)
    const ribMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const rib1 = new THREE.Mesh(new THREE.BoxGeometry(size * 1.05, size * 0.2, size * 1.05), ribMat);
    rib1.position.y = size / 2;
    giftGroup.add(rib1);

    const rib2 = new THREE.Mesh(new THREE.BoxGeometry(size * 0.2, size * 1.05, size * 1.05), ribMat);
    rib2.position.y = size / 2;
    giftGroup.add(rib2);

    // Bow
    const bowGeo = new THREE.TorusGeometry(size * 0.15, size * 0.05, 8, 16);
    const bow1 = new THREE.Mesh(bowGeo, ribMat);
    bow1.position.set(0, size, 0);
    bow1.rotation.y = Math.PI / 4;
    giftGroup.add(bow1);

    const bow2 = new THREE.Mesh(bowGeo, ribMat);
    bow2.position.set(0, size, 0);
    bow2.rotation.y = -Math.PI / 4;
    giftGroup.add(bow2);

    giftGroup.position.set(x, 0, z);

    // User data
    giftGroup.userData = {
        isOpened: false,
        baseY: 0,
        floatOffset: Math.random() * 10,
        originalScale: size
    };

    christmasScene.add(giftGroup);
    gifts.push({ mesh: giftGroup, position: new THREE.Vector3(x, 0, z) });
}

function handleGiftInteraction(results) {
    // 1. Check Camera Proximity
    let closestGift = null;
    let minDist = Infinity;

    // Use christmasCamera position (world space)
    const camPos = christmasCamera.position;

    gifts.forEach(gift => {
        if (gift.mesh.userData.isOpened) return;

        const d = camPos.distanceTo(gift.position);
        if (d < GIFT_INTERACTION_DIST && d < minDist) {
            minDist = d;
            closestGift = gift;
        }
    });

    giftInteraction.hoveredGift = closestGift;

    // Visual Highlight for Hovered Gift
    gifts.forEach(g => {
        if (g.mesh.userData.isOpened) return;

        if (g === closestGift) {
            // Pulse effect handled in animate
            g.mesh.userData.isHovered = true;
        } else {
            g.mesh.userData.isHovered = false;
            g.mesh.scale.setScalar(1);
        }
    });

    // 2. Check Right Hand Pinch
    const hands = results.multiHandLandmarks;
    const handedness = results.multiHandedness;
    if (!hands || !closestGift) {
        giftInteraction.isPinching = false;
        giftInteraction.pinchStartTime = 0;
        return;
    }

    let rightHand = null;
    for (let i = 0; i < hands.length; i++) {
        if (handedness[i].label === 'Right') rightHand = hands[i];
    }

    if (rightHand) {
        const thumb = rightHand[4];
        const index = rightHand[8];
        const pinchDist = dist(thumb, index);

        const PINCH_THRESHOLD = 0.08;

        if (pinchDist < PINCH_THRESHOLD) {
            // Pinching
            if (!giftInteraction.isPinching) {
                giftInteraction.isPinching = true;
                giftInteraction.pinchStartTime = Date.now();
            } else {
                // Held
                if (Date.now() - giftInteraction.pinchStartTime > GIFT_OPEN_TIME) {
                    openGift(closestGift);

                    // Reset to avoid double triggering immediately (though isOpened check prevents it)
                    giftInteraction.isPinching = false;
                    giftInteraction.pinchStartTime = 0;
                }
            }
        } else {
            // Released
            giftInteraction.isPinching = false;
            giftInteraction.pinchStartTime = 0;
        }
    }
}

function openGift(gift) {
    if (!gift || gift.mesh.userData.isOpened) return;

    gift.mesh.userData.isOpened = true;
    gift.mesh.visible = false; // Hide

    // Track opened gifts
    giftsOpened++;

    // Spawn Explosion
    createParticleExplosion(gift.position, 0xffd700); // Gold particles
    createParticleExplosion(gift.position, 0xff0000); // Red particles

    console.log(`🎁 Gift Opened! (${giftsOpened}/${totalGiftsSpawned})`);

    // Check if all gifts found
    if (giftsOpened >= totalGiftsSpawned && totalGiftsSpawned > 0) {
        console.log('✨ All gifts found! Secret phrases "aurora" and "tree" are now unlocked!');
    }
}

function createParticleExplosion(pos, color) {
    const pCount = 50;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
        color: color,
        size: 0.2,
        transparent: true
    });

    const points = new THREE.Points(geo, mat);
    points.position.copy(pos);
    points.position.y += 0.5; // Lift up a bit

    // Animate
    const velocities = [];
    for (let i = 0; i < pCount; i++) {
        velocities.push({
            x: (Math.random() - 0.5) * 0.2,
            y: (Math.random() * 0.2) + 0.1,
            z: (Math.random() - 0.5) * 0.2
        });
    }

    // We need to add this to a list to animate in the loop, 
    // but for simplicity let's just make a quick self-contained animation object 
    // or push to a global explosions array.
    // Let's add to 'snowParticles' but mark as explosion? No, hacky.
    // Let's add 'explosionParticles' array.

    // Quick Hack: Just add to christmasScene and assume we don't need complex management for now 
    // or add to a new array.
    if (!window.explosions) window.explosions = [];

    const explosion = {
        mesh: points,
        velocities: velocities,
        life: 1.0 // seconds
    };

    christmasScene.add(points);
    window.explosions.push(explosion);
}

function toggleChristmasMode() {
    isChristmasMode = !isChristmasMode;
    if (isChristmasMode) {
        isCherryBlossomMode = false; // Mutual exclusive
        isPhotoTreeMode = false;
        isEmptyTreeMode = false;
        // Respawn gifts on entry? Optional.
        // spawnGifts(); 
    }

    resetSceneCamera(isChristmasMode ? christmasCamera : null);
    updateSettingsButtonVisibility();
    console.log("Christmas Mode:", isChristmasMode ? "ON" : "OFF");
}

function animateChristmasScene() {
    christmasTime += 0.01;

    // Camera Physics (Shared with CB)
    cameraPosition.copy(targetCameraPosition);
    cameraYaw = targetCameraYaw;
    cameraPitch = targetCameraPitch;

    christmasCamera.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');
    christmasCamera.position.copy(cameraPosition);

    // Tree sway (less than CB, fir trees are stiffer)
    christmasTrees.forEach((tree, index) => {
        // Very subtle sway
        tree.rotation.z = Math.sin(christmasTime * 0.3 + index) * 0.005;
    });

    // Gift Animations (Hover)
    gifts.forEach(gift => {
        if (gift.mesh.userData.isOpened) return;

        if (gift.mesh.userData.isHovered) {
            // Bounce
            gift.mesh.position.y = Math.abs(Math.sin(christmasTime * 10)) * 0.2;
            gift.mesh.scale.setScalar(1.2);
        } else {
            gift.mesh.position.y = 0;
            gift.mesh.scale.setScalar(1);
        }
    });

    // Handle Explosions
    if (window.explosions) {
        for (let i = window.explosions.length - 1; i >= 0; i--) {
            const exp = window.explosions[i];
            exp.life -= 0.02;

            const positions = exp.mesh.geometry.attributes.position.array;
            for (let j = 0; j < positions.length / 3; j++) {
                positions[j * 3] += exp.velocities[j].x;
                positions[j * 3 + 1] += exp.velocities[j].y;
                positions[j * 3 + 2] += exp.velocities[j].z;

                // Gravity
                exp.velocities[j].y -= 0.005;
            }
            exp.mesh.geometry.attributes.position.needsUpdate = true;
            exp.mesh.material.opacity = exp.life;

            if (exp.life <= 0) {
                christmasScene.remove(exp.mesh);
                window.explosions.splice(i, 1);
            }
        }
    }

    // Snow animation
    snowParticles.forEach(flake => {
        const data = flake.userData;
        flake.position.y -= data.fallSpeed;
        flake.position.x += Math.sin(christmasTime * data.swaySpeed + data.phase) * data.swayAmount;
        flake.position.z += Math.cos(christmasTime * data.swaySpeed + data.phase) * data.swayAmount;

        // Reset
        if (flake.position.y < -0.5) {
            flake.position.y = 25 + Math.random() * 10;
            flake.position.x = (Math.random() - 0.5) * 80;
            flake.position.z = (Math.random() - 0.5) * 80 - 10;
        }
    });
}

function addChristmasLights() {
    // Cold Ambient
    const ambientLight = new THREE.AmbientLight(0xddeeff, 0.3);
    christmasScene.add(ambientLight);

    // Moonlight (Cold blue/white)
    const moonLight = new THREE.DirectionalLight(0xffffff, 0.5);
    moonLight.position.set(50, 100, 50);
    moonLight.castShadow = true;
    christmasScene.add(moonLight);

    // Warm glow from "village" or decorations (Orange/Gold)
    const warmLight1 = new THREE.PointLight(0xffaa00, 0.8, 40);
    warmLight1.position.set(-10, 5, -5);
    christmasScene.add(warmLight1);

    const redLight = new THREE.PointLight(0xff0000, 0.5, 30);
    redLight.position.set(10, 8, 0);
    christmasScene.add(redLight);

    const greenLight = new THREE.PointLight(0x00ff00, 0.4, 30);
    greenLight.position.set(0, 10, 10);
    christmasScene.add(greenLight);
}

function createChristmasGround() {
    // Snow Geometry
    const groundGeometry = new THREE.PlaneGeometry(200, 200, 60, 60);
    const vertices = groundGeometry.attributes.position.array;
    // Add bumps for snow drifts
    for (let i = 0; i < vertices.length; i += 3) {
        vertices[i + 2] += Math.sin(vertices[i] * 0.05) * Math.cos(vertices[i + 1] * 0.05) * 1.5;
    }
    groundGeometry.computeVertexNormals();

    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.8,
        metalness: 0.1
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    christmasScene.add(ground);
}

function createChristmasTree(x, z, scale = 1) {
    const treeGroup = new THREE.Group();

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.5 * scale, 0.8 * scale, 3 * scale, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2817 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5 * scale;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Leaves (Cones layers)
    const leaveMat = new THREE.MeshStandardMaterial({ color: 0x0f4d19, roughness: 0.8 });

    // Layer 1 (Bottom)
    const l1 = new THREE.Mesh(new THREE.ConeGeometry(3.5 * scale, 4 * scale, 8), leaveMat);
    l1.position.y = 3.5 * scale;
    l1.castShadow = true;
    treeGroup.add(l1);

    // Layer 2
    const l2 = new THREE.Mesh(new THREE.ConeGeometry(2.8 * scale, 3.5 * scale, 8), leaveMat);
    l2.position.y = 5.5 * scale;
    l2.castShadow = true;
    treeGroup.add(l2);

    // Layer 3 (Top)
    const l3 = new THREE.Mesh(new THREE.ConeGeometry(1.8 * scale, 3 * scale, 8), leaveMat);
    l3.position.y = 7.5 * scale;
    l3.castShadow = true;
    treeGroup.add(l3);

    // Ornaments (Random colored spheres)
    const colors = [0xff0000, 0xffd700, 0xc0c0c0, 0x0000ff]; // Red, Gold, Silver, Blue

    for (let i = 0; i < 12; i++) {
        const ornamentGeo = new THREE.SphereGeometry(0.25 * scale, 12, 12);
        const ornamentMat = new THREE.MeshStandardMaterial({
            color: colors[Math.floor(Math.random() * colors.length)],
            roughness: 0.3,
            metalness: 0.8
        });
        const ornament = new THREE.Mesh(ornamentGeo, ornamentMat);

        // Random placement on cone surface (approximate)
        const angle = Math.random() * Math.PI * 2;
        const height = 3 * scale + Math.random() * 5 * scale; // along the tree height
        // Radius decreases as height increases
        // Base radius approx 3.5 at y=3.5, 0 at y=9
        const rRatio = (9 * scale - height) / (6 * scale);
        const radius = Math.max(0.5, 3.0 * scale * rRatio + 0.3);

        ornament.position.set(
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius
        );
        treeGroup.add(ornament);
    }

    // Star on top
    const starGeo = new THREE.OctahedronGeometry(0.6 * scale);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.y = 9 * scale;
    treeGroup.add(star);

    // Light for the star
    const starLight = new THREE.PointLight(0xffd700, 0.5, 10);
    starLight.position.y = 9 * scale;
    treeGroup.add(starLight);


    treeGroup.position.set(x, 0, z);
    return treeGroup;
}

function createChristmasForest() {
    // Main trees
    const positions = [
        { x: 0, z: -5, scale: 1.5 }, // Hero tree
        { x: -7, z: 0, scale: 1.2 },
        { x: 7, z: -2, scale: 1.3 },
        { x: -5, z: -10, scale: 1.0 },
        { x: 5, z: -8, scale: 1.1 },
    ];

    positions.forEach(pos => {
        const tree = createChristmasTree(pos.x, pos.z, pos.scale);
        christmasTrees.push(tree);
        christmasScene.add(tree);
    });

    // Filling background
    for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 40;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist - 10;
        const scale = 0.8 + Math.random() * 0.8;

        const tree = createChristmasTree(x, z, scale);
        christmasTrees.push(tree);
        christmasScene.add(tree);
    }
}

function createSnow() {
    const flakeCount = 2000;
    const flakeGeo = new THREE.BufferGeometry();
    // Using sprites for snow might be better, or small meshes. 
    // Let's use small Tetrahadrons for sparkle or just Points? 
    // Points are cheapest.

    // Actually reusing the Mesh approach from petals gives individual rotation control which looks nice.
    // But for 2000 flakes, Points is faster. Let's use small Sphere meshes for quality close up, 
    // or just many small planes.

    for (let i = 0; i < flakeCount; i++) {
        // Small white sphere
        const geo = new THREE.SphereGeometry(0.05 + Math.random() * 0.05, 4, 4);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
        const flake = new THREE.Mesh(geo, mat);

        flake.position.set(
            (Math.random() - 0.5) * 100,
            Math.random() * 40,
            (Math.random() - 0.5) * 80 - 10
        );

        flake.userData = {
            fallSpeed: 0.02 + Math.random() * 0.05,
            swaySpeed: 0.5 + Math.random() * 1.0,
            swayAmount: 0.01 + Math.random() * 0.03,
            phase: Math.random() * Math.PI * 2
        };

        snowParticles.push(flake);
        christmasScene.add(flake);
    }
}

function createChristmasMountains() {
    // Similar to CB mountains but white/snowy
    const mountainMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.1
    });

    for (let layer = 0; layer < 3; layer++) {
        const points = [];
        const segments = 20;

        for (let i = 0; i <= segments; i++) {
            const x = (i / segments - 0.5) * 200;
            const height = 15 + Math.sin(i * 0.8 + layer) * 10 + Math.random() * 5; // Higher mountains
            points.push(new THREE.Vector2(x, height));
        }

        points.push(new THREE.Vector2(100, 0));
        points.push(new THREE.Vector2(-100, 0));

        const shape = new THREE.Shape(points);
        const extrudeSettings = { steps: 1, depth: 10 + layer * 10, bevelEnabled: false };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const material = mountainMaterial.clone();
        // Darker white/blue for distance
        material.color = new THREE.Color().setHSL(0.6, 0.2, 0.9 - layer * 0.15);

        const mountain = new THREE.Mesh(geometry, material);
        mountain.rotation.x = Math.PI / 2;
        mountain.position.z = -50 - layer * 25;
        mountain.position.y = -5;
        christmasScene.add(mountain);
    }
}

function createChristmasMoon() {
    // A large bright moon
    const moonGeo = new THREE.SphereGeometry(10, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xffffee });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(-40, 50, -60); // Different pos than CB
    christmasScene.add(moon);

    const glowGeo = new THREE.SphereGeometry(15, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(moon.position);
    christmasScene.add(glow);
}

// ==================== Photo Tree Scene ====================

function initPhotoTreeScene() {
    photoTreeScene = new THREE.Scene();
    // Magical purple/blue gradient fog
    photoTreeScene.fog = new THREE.FogExp2(0x1a0a2e, 0.012);

    // Set background color
    photoTreeScene.background = new THREE.Color(0x0d0a1f);

    photoTreeCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    photoTreeCamera.position.set(0, 8, 25);

    addPhotoTreeLights();
    createPhotoTreeGround();
    createMainPhotoTree();
    createPhotoOrnaments();
    createPhotoTreeSnow();
    createPhotoTreeStars();
    createTreeTopParticleText(photoTreeScene, auroraTreeTopText, new THREE.Vector3(0, 31, 0), 'aurora'); // Tree top text (Aligned to star Y=30)
}

function addPhotoTreeLights() {
    // Ambient light - soft purple
    const ambientLight = new THREE.AmbientLight(0x6644aa, 0.4);
    photoTreeScene.add(ambientLight);

    // Main directional light - warm
    const dirLight = new THREE.DirectionalLight(0xffd4a0, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    photoTreeScene.add(dirLight);

    // Colored point lights for magical atmosphere
    const colors = [0xff6b9d, 0x4ecdc4, 0xffe66d, 0x9b59b6];
    colors.forEach((color, i) => {
        const light = new THREE.PointLight(color, 0.5, 30);
        const angle = (i / colors.length) * Math.PI * 2;
        light.position.set(Math.cos(angle) * 8, 6 + i * 2, Math.sin(angle) * 8);
        photoTreeScene.add(light);
    });
}

function createPhotoTreeGround() {
    // Snow-covered ground with gradient
    const groundGeo = new THREE.CircleGeometry(80, 64);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0xe8eaed,
        roughness: 0.9,
        metalness: 0.1
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    photoTreeScene.add(ground);
}

function createMainPhotoTree() {
    const treeGroup = new THREE.Group();
    const scale = 2.0; // Large central tree

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.6 * scale, 1.0 * scale, 4 * scale, 12);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 2 * scale;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Leaves (Multiple cone layers for fuller look)
    const leaveMat = new THREE.MeshStandardMaterial({ color: 0x0b5d1e, roughness: 0.8 });

    const layers = [
        { radius: 5, height: 5, y: 4.5 },
        { radius: 4, height: 4.5, y: 7 },
        { radius: 3, height: 4, y: 9.5 },
        { radius: 2, height: 3.5, y: 11.5 },
        { radius: 1.2, height: 2.5, y: 13 }
    ];

    layers.forEach(layer => {
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(layer.radius * scale, layer.height * scale, 12),
            leaveMat
        );
        cone.position.y = layer.y * scale;
        cone.castShadow = true;
        treeGroup.add(cone);
    });

    // Star on top
    const starGeo = new THREE.OctahedronGeometry(0.8 * scale);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.y = 15 * scale;
    treeGroup.add(star);

    // Star light
    const starLight = new THREE.PointLight(0xffd700, 1, 20);
    starLight.position.y = 15 * scale;
    treeGroup.add(starLight);

    // Add some traditional ornaments too
    const ornamentColors = [0xff0000, 0xffd700, 0x00ff88, 0xff69b4];
    for (let i = 0; i < 20; i++) {
        const ornGeo = new THREE.SphereGeometry(0.2 * scale, 12, 12);
        const ornMat = new THREE.MeshStandardMaterial({
            color: ornamentColors[Math.floor(Math.random() * ornamentColors.length)],
            roughness: 0.3,
            metalness: 0.8
        });
        const ornament = new THREE.Mesh(ornGeo, ornMat);

        const angle = Math.random() * Math.PI * 2;
        const height = 4 * scale + Math.random() * 10 * scale;
        const radiusAtHeight = (15 * scale - height) / (15 * scale) * 4 * scale + 0.5;

        ornament.position.set(
            Math.cos(angle) * radiusAtHeight,
            height,
            Math.sin(angle) * radiusAtHeight
        );
        treeGroup.add(ornament);
    }

    // Light strings (small glowing spheres)
    for (let i = 0; i < 30; i++) {
        const lightGeo = new THREE.SphereGeometry(0.08 * scale, 8, 8);
        const lightMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.8, 0.6)
        });
        const lightBall = new THREE.Mesh(lightGeo, lightMat);

        const angle = Math.random() * Math.PI * 2;
        const height = 5 * scale + Math.random() * 9 * scale;
        const radiusAtHeight = (15 * scale - height) / (15 * scale) * 4 * scale + 0.8;

        lightBall.position.set(
            Math.cos(angle) * radiusAtHeight,
            height,
            Math.sin(angle) * radiusAtHeight
        );
        lightBall.userData = { phase: Math.random() * Math.PI * 2 };
        treeGroup.add(lightBall);
    }

    photoTreeScene.add(treeGroup);
}

function createPhotoOrnaments() {
    // Load media asynchronously
    loadAllAuroraMedia().then(allMedia => {
        auroraMediaItems = allMedia;
        createMediaOrnamentsFromItems(allMedia, photoTreeScene, photoPlanes, 'aurora');
    });
}

// Load all media for Aurora Tree (static + user uploaded)
async function loadAllAuroraMedia() {
    const staticMedia = await loadMediaLibrary(MEDIA_LIBRARIES.aurora, 'aurora');
    let userMedia = [];

    if (mediaDB) {
        const userItems = await loadUserMedia('aurora');
        userMedia = userItems.map(item => ({
            path: item.data, // data URL
            type: item.mediaType,
            isUserUploaded: true,
            name: item.name,
            id: item.id
        }));
    }

    return [...staticMedia, ...userMedia];
}

// Load all media for Empty Tree
async function loadAllTreeMedia() {
    const staticMedia = await loadMediaLibrary(MEDIA_LIBRARIES.tree, 'tree');
    let userMedia = [];

    if (mediaDB) {
        const userItems = await loadUserMedia('tree');
        userMedia = userItems.map(item => ({
            path: item.data,
            type: item.mediaType,
            isUserUploaded: true,
            name: item.name,
            id: item.id
        }));
    }

    return [...staticMedia, ...userMedia];
}

// Create media ornaments from item list
function createMediaOrnamentsFromItems(mediaItems, targetScene, planesArray, treeType) {
    if (mediaItems.length === 0) {
        console.log(`📂 No media items for ${treeType}`);
        return;
    }

    // Calculate scene scale based on media count
    const baseRadius = 8;
    const mediaCount = mediaItems.length;
    const scaleMultiplier = Math.max(1, Math.sqrt(mediaCount / 8)); // Scale up for more media

    console.log(`📸 Creating ${mediaCount} media ornaments for ${treeType} (scale: ${scaleMultiplier.toFixed(2)})`);

    mediaItems.forEach((item, index) => {
        // Create media frame group
        const mediaGroup = new THREE.Group();

        // Calculate position in spiral around tree
        const spiralRotations = Math.max(2, Math.ceil(mediaCount / 6)); // More media = more spirals
        const spiralAngle = (index / mediaCount) * Math.PI * 2 * spiralRotations;
        const heightRange = 5 + mediaCount * 1.5; // Taller range for more media
        const height = 5 + (index / mediaCount) * heightRange;
        const radius = (baseRadius + Math.sin(index * 0.8) * 2) * scaleMultiplier;

        const x = Math.cos(spiralAngle) * radius;
        const z = Math.sin(spiralAngle) * radius;

        // Media plane size
        const mediaWidth = 3;
        const mediaHeight = 2.25; // 4:3 aspect ratio
        const mediaGeo = new THREE.PlaneGeometry(mediaWidth, mediaHeight);

        // Placeholder color based on media type
        let placeholderColor;
        switch (item.type) {
            case 'audio':
                placeholderColor = new THREE.Color(0x4488ff); // Blue for audio
                break;
            case 'video':
                placeholderColor = new THREE.Color(0xff8844); // Orange for video
                break;
            default:
                placeholderColor = new THREE.Color().setHSL(index / mediaCount, 0.7, 0.5);
        }

        const mediaMat = new THREE.MeshStandardMaterial({
            color: placeholderColor,
            side: THREE.DoubleSide,
            roughness: 0.3,
            metalness: 0.1
        });
        const mediaMesh = new THREE.Mesh(mediaGeo, mediaMat);
        mediaMesh.scale.x = -1; // Flip for mirror effect
        mediaGroup.add(mediaMesh);

        // Load content based on type
        if (item.type === 'image') {
            const loader = new THREE.TextureLoader();
            loader.load(item.path,
                (loadedTexture) => {
                    mediaMesh.material.color.setHex(0xffffff);
                    mediaMesh.material.map = loadedTexture;
                    mediaMesh.material.needsUpdate = true;
                },
                undefined,
                (err) => console.warn('Failed to load texture:', item.path)
            );
        } else if (item.type === 'audio') {
            // Create audio icon overlay
            createMediaTypeIcon(mediaGroup, '🎵', mediaWidth, mediaHeight);
        } else if (item.type === 'video') {
            // Create video icon overlay, try to load video thumbnail
            createMediaTypeIcon(mediaGroup, '🎬', mediaWidth, mediaHeight);

            // Try to create video thumbnail
            if (!item.isUserUploaded) {
                createVideoThumbnail(item.path, mediaMesh);
            }
        }

        // Frame
        const frameThickness = 0.15;
        const frameDepth = 0.1;

        // Frame color based on media type
        let frameColor = 0xffd700; // Gold default
        if (item.type === 'audio') frameColor = 0x4488ff;
        if (item.type === 'video') frameColor = 0xff6644;

        const frameMat = new THREE.MeshStandardMaterial({
            color: frameColor,
            roughness: 0.3,
            metalness: 0.7
        });

        // Top frame
        const topFrame = new THREE.Mesh(
            new THREE.BoxGeometry(mediaWidth + frameThickness * 2, frameThickness, frameDepth),
            frameMat
        );
        topFrame.position.y = mediaHeight / 2 + frameThickness / 2;
        mediaGroup.add(topFrame);

        // Bottom frame
        const bottomFrame = new THREE.Mesh(
            new THREE.BoxGeometry(mediaWidth + frameThickness * 2, frameThickness, frameDepth),
            frameMat
        );
        bottomFrame.position.y = -mediaHeight / 2 - frameThickness / 2;
        mediaGroup.add(bottomFrame);

        // Left frame
        const leftFrame = new THREE.Mesh(
            new THREE.BoxGeometry(frameThickness, mediaHeight + frameThickness * 2, frameDepth),
            frameMat
        );
        leftFrame.position.x = -mediaWidth / 2 - frameThickness / 2;
        mediaGroup.add(leftFrame);

        // Right frame
        const rightFrame = new THREE.Mesh(
            new THREE.BoxGeometry(frameThickness, mediaHeight + frameThickness * 2, frameDepth),
            frameMat
        );
        rightFrame.position.x = mediaWidth / 2 + frameThickness / 2;
        mediaGroup.add(rightFrame);

        // Position the group
        mediaGroup.position.set(x, height, z);

        // Store animation data and media info
        mediaGroup.userData = {
            mediaIndex: index,
            mediaType: item.type,
            mediaPath: item.path,
            mediaName: item.name,
            isUserUploaded: item.isUserUploaded,
            imagePath: item.path, // For backward compatibility
            photoMesh: mediaMesh,
            baseAngle: spiralAngle,
            baseHeight: height,
            baseRadius: radius,
            orbitSpeed: 0.1 + Math.random() * 0.1,
            floatSpeed: 0.5 + Math.random() * 0.5,
            floatAmount: 0.3 + Math.random() * 0.2,
            phase: Math.random() * Math.PI * 2
        };

        planesArray.push(mediaGroup);
        targetScene.add(mediaGroup);
    });

    console.log(`✅ Created ${planesArray.length} media ornaments for ${treeType}`);
}

// Create media type icon
function createMediaTypeIcon(group, emoji, width, height) {
    // Create a canvas texture with the emoji
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 128, 128);

    ctx.font = '64px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const iconMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
    });
    const sprite = new THREE.Sprite(iconMat);
    sprite.scale.set(1.5, 1.5, 1);
    sprite.position.z = 0.1;
    group.add(sprite);
}

// Create video thumbnail
function createVideoThumbnail(videoPath, mesh) {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    video.onloadeddata = () => {
        video.currentTime = 1; // Seek to 1 second for thumbnail
    };

    video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 240;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const texture = new THREE.CanvasTexture(canvas);
        mesh.material.color.setHex(0xffffff);
        mesh.material.map = texture;
        mesh.material.needsUpdate = true;

        video.remove();
    };

    video.onerror = () => {
        console.warn('Could not load video thumbnail:', videoPath);
    };

    video.src = videoPath;
}

function createPhotoTreeSnow() {
    const flakeCount = 1500;

    for (let i = 0; i < flakeCount; i++) {
        const geo = new THREE.SphereGeometry(0.03 + Math.random() * 0.04, 4, 4);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.7 + Math.random() * 0.3
        });
        const flake = new THREE.Mesh(geo, mat);

        flake.position.set(
            (Math.random() - 0.5) * 80,
            Math.random() * 50,
            (Math.random() - 0.5) * 60
        );

        flake.userData = {
            fallSpeed: 0.02 + Math.random() * 0.04,
            swaySpeed: 0.5 + Math.random() * 1.0,
            swayAmount: 0.01 + Math.random() * 0.02,
            phase: Math.random() * Math.PI * 2
        };

        photoTreeSnow.push(flake);
        photoTreeScene.add(flake);
    }
}

function createPhotoTreeStars() {
    // Background stars
    const starCount = 500;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.5; // Upper hemisphere
        const radius = 100 + Math.random() * 50;

        starPositions[i] = Math.cos(theta) * Math.sin(phi) * radius;
        starPositions[i + 1] = Math.cos(phi) * radius + 20;
        starPositions[i + 2] = Math.sin(theta) * Math.sin(phi) * radius - 50;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.5,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    const stars = new THREE.Points(starGeo, starMat);
    photoTreeScene.add(stars);
}

function togglePhotoTreeMode() {
    isPhotoTreeMode = !isPhotoTreeMode;
    if (isPhotoTreeMode) {
        isCherryBlossomMode = false;
        isChristmasMode = false;
        isEmptyTreeMode = false;
    }

    resetSceneCamera(isPhotoTreeMode ? photoTreeCamera : null);
    updateSettingsButtonVisibility();
    console.log("Photo Tree Mode:", isPhotoTreeMode ? "ON" : "OFF");
}

function animatePhotoTreeScene() {
    photoTreeTime += 0.01;

    // Camera Physics (Shared with other scenes)
    cameraPosition.copy(targetCameraPosition);
    cameraYaw = targetCameraYaw;
    cameraPitch = targetCameraPitch;

    photoTreeCamera.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');
    photoTreeCamera.position.copy(cameraPosition);

    // Animate photos - gentle orbit and float
    photoPlanes.forEach(photo => {
        const data = photo.userData;

        // Gentle orbit around tree
        const currentAngle = data.baseAngle + photoTreeTime * data.orbitSpeed;
        photo.position.x = Math.cos(currentAngle) * data.baseRadius;
        photo.position.z = Math.sin(currentAngle) * data.baseRadius;

        // Float up and down
        photo.position.y = data.baseHeight + Math.sin(photoTreeTime * data.floatSpeed + data.phase) * data.floatAmount;

        // Always face camera (billboard effect)
        photo.lookAt(photoTreeCamera.position);
    });

    // Snow animation
    photoTreeSnow.forEach(flake => {
        const data = flake.userData;
        flake.position.y -= data.fallSpeed;
        flake.position.x += Math.sin(photoTreeTime * data.swaySpeed + data.phase) * data.swayAmount;
        flake.position.z += Math.cos(photoTreeTime * data.swaySpeed + data.phase) * data.swayAmount;

        // Reset when below ground
        if (flake.position.y < -0.5) {
            flake.position.y = 40 + Math.random() * 10;
            flake.position.x = (Math.random() - 0.5) * 80;
            flake.position.z = (Math.random() - 0.5) * 60;
        }
    });

    // Animate Tree Top Sphere
    if (auroraTextParticles) {
        animateTreeTopParticles(auroraTextParticles, photoTreeTime);
    }
}

// ==================== Photo Interaction ====================

function handlePhotoInteraction(results) {
    // Determine which media planes and camera to use based on current mode
    const activePlanes = isEmptyTreeMode ? emptyTreeMediaPlanes : photoPlanes;
    const activeCamera = isEmptyTreeMode ? emptyTreeCamera : photoTreeCamera;

    // If currently viewing any media, check for open palm to close
    if (photoInteraction.viewingPhoto || mediaInteraction.viewingMedia) {
        const hands = results.multiHandLandmarks;
        const handedness = results.multiHandedness;

        if (hands) {
            let rightHand = null;
            for (let i = 0; i < hands.length; i++) {
                if (handedness[i].label === 'Right') rightHand = hands[i];
            }

            if (rightHand && isOpenPalm(rightHand)) {
                hidePhotoViewer();
            }
        }
        return; // Don't process other interactions while viewing
    }

    // 1. Check Camera Proximity to Photos (with view angle filtering)
    let closestPhoto = null;
    let minDist = Infinity;

    const camPos = activeCamera.position;

    // Get camera's forward direction
    const camForward = new THREE.Vector3(0, 0, -1);
    camForward.applyQuaternion(activeCamera.quaternion);

    activePlanes.forEach(photo => {
        const d = camPos.distanceTo(photo.position);

        // Check if within interaction distance
        if (d >= PHOTO_INTERACTION_DIST) return;

        // Check if photo is in FRONT of camera (within view cone)
        const toPhoto = new THREE.Vector3().subVectors(photo.position, camPos).normalize();
        const dotProduct = camForward.dot(toPhoto);

        // dotProduct = 1 means directly in front, 0 means perpendicular, -1 means behind
        // Only consider photos within ~60° cone in front (cos(60°) ≈ 0.5)
        if (dotProduct < 0.5) return;

        // Weight by both distance AND how centered it is (prefer photos directly ahead)
        const score = d / (dotProduct * dotProduct); // Lower score = better (closer + more centered)

        if (score < minDist) {
            minDist = score;
            closestPhoto = photo;
        }
    });

    // Debug: Log when hovered photo changes
    if (closestPhoto !== photoInteraction.hoveredPhoto) {
        if (closestPhoto) {
            console.log(`🎯 Hovered photo changed: index=${closestPhoto.userData.photoIndex}, path=${closestPhoto.userData.imagePath}`);
        } else {
            console.log(`🎯 No photo in range`);
        }
    }

    photoInteraction.hoveredPhoto = closestPhoto;

    // Visual Highlight for Hovered Photo
    photoPlanes.forEach(photo => {
        if (photo === closestPhoto) {
            photo.userData.isHovered = true;
            // Scale up slightly
            photo.scale.setScalar(1.2);
        } else {
            photo.userData.isHovered = false;
            photo.scale.setScalar(1.0);
        }
    });

    // Show/hide hover indicator
    updatePhotoHoverIndicator(closestPhoto);

    // 2. Check Right Hand Fist Gesture
    const hands = results.multiHandLandmarks;
    const handedness = results.multiHandedness;

    if (!hands || !closestPhoto) {
        photoInteraction.isFisting = false;
        photoInteraction.fistStartTime = 0;
        return;
    }

    let rightHand = null;
    for (let i = 0; i < hands.length; i++) {
        if (handedness[i].label === 'Right') rightHand = hands[i];
    }

    if (rightHand) {
        const fistDetected = isRightHandFist(rightHand);

        if (fistDetected) {
            // Making fist
            if (!photoInteraction.isFisting) {
                photoInteraction.isFisting = true;
                photoInteraction.fistStartTime = Date.now();
                // LOCK the target photo when fist gesture STARTS
                photoInteraction.targetPhoto = closestPhoto;

                if (closestPhoto) {
                    console.log(`🔒 Locked photo target: index=${closestPhoto.userData.photoIndex}, path=${closestPhoto.userData.imagePath}`);
                } else {
                    console.log(`⚠️ Fist detected but no closestPhoto available`);
                }
            }

            // Use the LOCKED target photo, not current closest
            const targetPhoto = photoInteraction.targetPhoto;

            // Calculate progress (0 to 1)
            const elapsed = Date.now() - photoInteraction.fistStartTime;
            const progress = Math.min(elapsed / PHOTO_VIEW_TIME, 1);

            // Update indicator with progress
            updatePhotoHoverIndicator(targetPhoto, progress);

            // Check if complete
            if (elapsed >= PHOTO_VIEW_TIME && targetPhoto) {
                showPhotoViewer(targetPhoto);

                // Reset
                photoInteraction.isFisting = false;
                photoInteraction.fistStartTime = 0;
                photoInteraction.targetPhoto = null;
            }
        } else {
            // Released - reset progress
            photoInteraction.isFisting = false;
            photoInteraction.fistStartTime = 0;
            photoInteraction.targetPhoto = null;
            updatePhotoHoverIndicator(closestPhoto, 0);
        }
    } else {
        // No right hand - reset
        photoInteraction.targetPhoto = null;
        updatePhotoHoverIndicator(closestPhoto, 0);
    }
}

function isRightHandFist(hand) {
    // Strict fist detection - requires all fingers curled tightly
    // A fist means fingertips are close to or below the PIP joints (curled toward palm)
    const wrist = hand[0];
    const middleMCP = hand[9]; // Center of palm

    const fingerData = [
        { tip: 8, pip: 6, mcp: 5 },   // Index
        { tip: 12, pip: 10, mcp: 9 }, // Middle  
        { tip: 16, pip: 14, mcp: 13 }, // Ring
        { tip: 20, pip: 18, mcp: 17 }  // Pinky
    ];

    let curledCount = 0;

    for (const finger of fingerData) {
        const tipToWrist = dist(hand[finger.tip], wrist);
        const pipToWrist = dist(hand[finger.pip], wrist);
        const mcpToWrist = dist(hand[finger.mcp], wrist);

        // For a fist: tip should be CLOSER to wrist than PIP
        // This means the finger is bent backward (curled)
        // Stricter threshold: tip must be at most equal to PIP distance
        if (tipToWrist < pipToWrist * 1.1) {
            curledCount++;
        }
    }

    // Require ALL 4 fingers curled for a proper fist
    return curledCount >= 4;
}

function isOpenPalm(hand) {
    // Open palm = all fingers extended
    const wrist = hand[0];

    const fingers = [
        { tip: 8, pip: 6 },   // Index
        { tip: 12, pip: 10 }, // Middle
        { tip: 16, pip: 14 }, // Ring
        { tip: 20, pip: 18 }  // Pinky
    ];

    let extendedCount = 0;

    for (const finger of fingers) {
        if (dist(hand[finger.tip], wrist) > dist(hand[finger.pip], wrist)) {
            extendedCount++;
        }
    }

    return extendedCount >= 4;
}

function showPhotoViewer(photo) {
    if (!photo || !photo.userData.imagePath) {
        console.warn("showPhotoViewer called with invalid photo:", photo);
        return;
    }

    const mediaType = photo.userData.mediaType || 'image';
    const path = photo.userData.imagePath;
    const index = photo.userData.mediaIndex || photo.userData.photoIndex;

    console.log(`🖼️ Opening media viewer: type=${mediaType}, index=${index}, path=${path}`);

    if (mediaType === 'image') {
        // Show image viewer
        photoInteraction.viewingPhoto = photo;
        const viewer = document.getElementById('photo-viewer');
        const img = document.getElementById('photo-viewer-image');
        img.src = path;
        viewer.style.display = 'flex';
    } else if (mediaType === 'audio') {
        // Show audio player
        mediaInteraction.viewingMedia = photo;
        const viewer = document.getElementById('media-viewer');
        const audioEl = document.getElementById('media-viewer-audio');
        const videoEl = document.getElementById('media-viewer-video');

        videoEl.style.display = 'none';
        audioEl.style.display = 'block';
        audioEl.src = path;
        audioEl.play();
        currentPlayingMedia = audioEl;
        viewer.style.display = 'flex';
    } else if (mediaType === 'video') {
        // Show video player
        mediaInteraction.viewingMedia = photo;
        const viewer = document.getElementById('media-viewer');
        const audioEl = document.getElementById('media-viewer-audio');
        const videoEl = document.getElementById('media-viewer-video');

        audioEl.style.display = 'none';
        videoEl.style.display = 'block';
        videoEl.src = path;
        videoEl.play();
        currentPlayingMedia = videoEl;
        viewer.style.display = 'flex';
    }
}

function hidePhotoViewer() {
    photoInteraction.viewingPhoto = null;
    mediaInteraction.viewingMedia = null;

    const photoViewer = document.getElementById('photo-viewer');
    photoViewer.style.display = 'none';

    const mediaViewer = document.getElementById('media-viewer');
    mediaViewer.style.display = 'none';

    // Stop any playing media
    const audioEl = document.getElementById('media-viewer-audio');
    const videoEl = document.getElementById('media-viewer-video');

    if (audioEl) {
        audioEl.pause();
        audioEl.src = '';
    }
    if (videoEl) {
        videoEl.pause();
        videoEl.src = '';
    }
    currentPlayingMedia = null;

    console.log("Closed media viewer");
}

let hoverIndicator = null;
let progressRing = null;

function updatePhotoHoverIndicator(photo, progress = 0) {
    if (photo && !photoInteraction.viewingPhoto) {
        if (!hoverIndicator) {
            // Create minimal circular indicator with progress ring
            hoverIndicator = document.createElement('div');
            hoverIndicator.className = 'photo-hover-indicator';
            hoverIndicator.innerHTML = `
                <svg class="progress-ring" width="60" height="60">
                    <circle class="progress-ring-bg" cx="30" cy="30" r="26" />
                    <circle class="progress-ring-fill" cx="30" cy="30" r="26" />
                </svg>
                <span class="fist-emoji">👊</span>
            `;
            document.body.appendChild(hoverIndicator);
            progressRing = hoverIndicator.querySelector('.progress-ring-fill');
        }
        hoverIndicator.style.display = 'flex';

        // Update progress ring (0 to 1)
        if (progressRing) {
            const circumference = 2 * Math.PI * 26; // r = 26
            const offset = circumference * (1 - progress);
            progressRing.style.strokeDasharray = circumference;
            progressRing.style.strokeDashoffset = offset;
        }
    } else {
        if (hoverIndicator) {
            hoverIndicator.style.display = 'none';
        }
    }
}

// ==================== Empty Tree Scene (Unlockable) ====================

function initEmptyTreeScene() {
    emptyTreeScene = new THREE.Scene();
    // Dark night sky with subtle fog
    emptyTreeScene.fog = new THREE.FogExp2(0x0a0a15, 0.02);
    emptyTreeScene.background = new THREE.Color(0x0a0a15);

    emptyTreeCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    emptyTreeCamera.position.set(0, 5, 15);

    addEmptyTreeLights();
    createEmptyTreeGround();
    createSingleChristmasTree();
    createEmptyTreeSnow();
    createEmptyTreeStars();
    createEmptyTreeMediaOrnaments(); // Add media ornaments
    createTreeTopParticleText(emptyTreeScene, emptyTreeTopText, new THREE.Vector3(0, 16, 0), 'empty'); // Tree top text (Aligned to star Y=15.3)
}

// Create media ornaments for Empty Tree
function createEmptyTreeMediaOrnaments() {
    loadAllTreeMedia().then(allMedia => {
        treeMediaItems = allMedia;
        createMediaOrnamentsFromItems(allMedia, emptyTreeScene, emptyTreeMediaPlanes, 'tree');
    });
}

function addEmptyTreeLights() {
    // Soft ambient light
    const ambientLight = new THREE.AmbientLight(0x334455, 0.3);
    emptyTreeScene.add(ambientLight);

    // Moonlight from upper left
    const moonLight = new THREE.DirectionalLight(0xaabbcc, 0.4);
    moonLight.position.set(-30, 50, 30);
    emptyTreeScene.add(moonLight);

    // Warm glow from tree
    const treeGlow = new THREE.PointLight(0xffaa66, 0.6, 20);
    treeGlow.position.set(0, 6, 0);
    emptyTreeScene.add(treeGlow);
}

function createEmptyTreeGround() {
    // Snow-covered ground
    const groundGeo = new THREE.CircleGeometry(50, 64);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0xeeeeff,
        roughness: 0.95,
        metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    emptyTreeScene.add(ground);
}

function createSingleChristmasTree() {
    const treeGroup = new THREE.Group();
    const scale = 1.8;

    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.4 * scale, 0.6 * scale, 2.5 * scale, 10);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.25 * scale;
    trunk.castShadow = true;
    treeGroup.add(trunk);

    // Leaves (Cones layers)
    const leaveMat = new THREE.MeshStandardMaterial({ color: 0x0f4d19, roughness: 0.8 });

    // Layer 1 (Bottom)
    const l1 = new THREE.Mesh(new THREE.ConeGeometry(3.0 * scale, 3.5 * scale, 10), leaveMat);
    l1.position.y = 3.0 * scale;
    l1.castShadow = true;
    treeGroup.add(l1);

    // Layer 2
    const l2 = new THREE.Mesh(new THREE.ConeGeometry(2.3 * scale, 3.0 * scale, 10), leaveMat);
    l2.position.y = 5.0 * scale;
    l2.castShadow = true;
    treeGroup.add(l2);

    // Layer 3 (Top)
    const l3 = new THREE.Mesh(new THREE.ConeGeometry(1.5 * scale, 2.5 * scale, 10), leaveMat);
    l3.position.y = 7.0 * scale;
    l3.castShadow = true;
    treeGroup.add(l3);

    // Ornaments
    const colors = [0xff0000, 0xffd700, 0xc0c0c0, 0x0000ff, 0xff00ff, 0x00ffff];
    for (let i = 0; i < 15; i++) {
        const ornamentGeo = new THREE.SphereGeometry(0.2 * scale, 12, 12);
        const ornamentMat = new THREE.MeshStandardMaterial({
            color: colors[Math.floor(Math.random() * colors.length)],
            roughness: 0.3,
            metalness: 0.8,
            emissive: colors[Math.floor(Math.random() * colors.length)],
            emissiveIntensity: 0.2
        });
        const ornament = new THREE.Mesh(ornamentGeo, ornamentMat);

        const angle = Math.random() * Math.PI * 2;
        const height = 2.5 * scale + Math.random() * 5.5 * scale;
        const rRatio = (8 * scale - height) / (5.5 * scale);
        const radius = Math.max(0.3, 2.5 * scale * rRatio + 0.2);

        ornament.position.set(
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius
        );
        treeGroup.add(ornament);
    }

    // Star on top
    const starGeo = new THREE.OctahedronGeometry(0.5 * scale);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.y = 8.5 * scale;
    star.userData = { phase: 0 };
    treeGroup.add(star);

    // Star light
    const starLight = new THREE.PointLight(0xffd700, 0.8, 15);
    starLight.position.y = 8.5 * scale;
    treeGroup.add(starLight);

    emptyTreeScene.add(treeGroup);
}

function createEmptyTreeSnow() {
    const flakeCount = 1000;

    for (let i = 0; i < flakeCount; i++) {
        const geo = new THREE.SphereGeometry(0.03 + Math.random() * 0.03, 6, 6);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8 + Math.random() * 0.2
        });
        const flake = new THREE.Mesh(geo, mat);

        flake.position.set(
            (Math.random() - 0.5) * 60,
            Math.random() * 30,
            (Math.random() - 0.5) * 60
        );

        flake.userData = {
            fallSpeed: 0.02 + Math.random() * 0.04,
            swaySpeed: 0.5 + Math.random() * 1.0,
            swayAmount: 0.01 + Math.random() * 0.02,
            phase: Math.random() * Math.PI * 2
        };

        emptyTreeSnow.push(flake);
        emptyTreeScene.add(flake);
    }
}

function createEmptyTreeStars() {
    // Background stars
    const starCount = 300;
    const starGeo = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI * 0.4;
        const radius = 80 + Math.random() * 40;

        starPositions[i] = Math.cos(theta) * Math.sin(phi) * radius;
        starPositions[i + 1] = Math.cos(phi) * radius + 30;
        starPositions[i + 2] = Math.sin(theta) * Math.sin(phi) * radius - 40;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.4,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });

    const stars = new THREE.Points(starGeo, starMat);
    emptyTreeScene.add(stars);
}

function toggleEmptyTreeMode() {
    isEmptyTreeMode = !isEmptyTreeMode;
    if (isEmptyTreeMode) {
        isCherryBlossomMode = false;
        isChristmasMode = false;
        isPhotoTreeMode = false;
    }

    resetSceneCamera(isEmptyTreeMode ? emptyTreeCamera : null);
    updateSettingsButtonVisibility();
    console.log("Empty Tree Mode:", isEmptyTreeMode ? "ON" : "OFF");
}

function animateEmptyTreeScene() {
    emptyTreeTime += 0.01;

    // Camera position (static for this peaceful scene)
    emptyTreeCamera.position.copy(cameraPosition);
    emptyTreeCamera.rotation.set(cameraPitch, cameraYaw, 0, 'YXZ');

    // Snow animation
    emptyTreeSnow.forEach(flake => {
        const data = flake.userData;
        flake.position.y -= data.fallSpeed;
        flake.position.x += Math.sin(emptyTreeTime * data.swaySpeed + data.phase) * data.swayAmount;
        flake.position.z += Math.cos(emptyTreeTime * data.swaySpeed + data.phase) * data.swayAmount;

        // Reset when below ground
        if (flake.position.y < -0.5) {
            flake.position.y = 25 + Math.random() * 10;
            flake.position.x = (Math.random() - 0.5) * 60;
            flake.position.z = (Math.random() - 0.5) * 60;
        }
    });

    // Animate Tree Top Sphere
    if (emptyTreeTextParticles) {
        animateTreeTopParticles(emptyTreeTextParticles, emptyTreeTime);
    }
}
