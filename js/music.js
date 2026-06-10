import { directoryOpen } from 'https://cdn.jsdelivr.net/npm/browser-fs-access@0.35.0/+esm';
import { parseBlob } from 'https://cdn.jsdelivr.net/npm/music-metadata@latest/+esm';

// Supported formats
const SUPPORTED_FORMATS = ['mp3', 'ogg', 'wav', 'm4a', 'aac', 'flac', 'alac', 'aiff', 'opus'];

function isSupportedAudio(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return SUPPORTED_FORMATS.includes(ext);
}

// ── INDEXEDDB PERSISTENCE ───────────────────────────────────────────────────
const DB_NAME = 'iweb-music-player';
const STORE_NAME = 'settings';
const HANDLE_KEY = 'directory-handle';
const TRACKS_KEY = 'tracks-list';

function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

async function saveDirectoryHandle(handle) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(handle, HANDLE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getDirectoryHandle() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(HANDLE_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveTracks(tracks) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const serialized = tracks.map(t => ({
      id: t.id,
      path: t.path,
      title: t.title,
      artist: t.artist,
      album: t.album,
      duration: t.duration,
      artworkBlob: t.artworkBlob // Store raw Blob natively
    }));
    const request = store.put(serialized, TRACKS_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getSavedTracks() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(TRACKS_KEY);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

const LAST_PLAYED_KEY = 'last-played-state';

async function savePlaybackState(trackId, seekTime) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put({ trackId, seekTime }, LAST_PLAYED_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getPlaybackState() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(LAST_PLAYED_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── PLAYBACK SERVICE ────────────────────────────────────────────────────────
class PlaybackService {
  constructor() {
    this.playlist = [];
    this.currentIndex = -1;
    this.sound = null;
    this.isShuffle = false;
    this.isRepeat = 'off'; // 'off', 'one', 'all'
    this.pendingSeekTime = 0;
    this.onTrackChange = null;
    this.onPlayStateChange = null;
    this.onProgressUpdate = null;
    this.progressInterval = null;
  }

  setPlaylist(tracks) {
    this.playlist = tracks;
  }

  async playTrack(index) {
    if (index < 0 || index >= this.playlist.length) return;
    
    const connected = await ensureFilesConnected();
    if (!connected) return;

    this.stop();
    this.currentIndex = index;
    const track = this.playlist[this.currentIndex];

    if (!track.file) {
      console.warn("Track file reference is missing.");
      return;
    }

    const objectURL = URL.createObjectURL(track.file);
    const ext = track.file.name.split('.').pop().toLowerCase();

    const startPos = this.pendingSeekTime || 0;
    this.pendingSeekTime = 0; // Clear

    this.sound = new Howl({
      src: [objectURL],
      format: [ext],
      html5: true,
      onload: () => {
        if (this.onTrackChange) this.onTrackChange(track);
        if (startPos > 0) {
          this.sound.seek(startPos);
        }
        // Save state immediately on load
        savePlaybackState(track.id, startPos);
      },
      onplay: () => {
        if (this.onPlayStateChange) this.onPlayStateChange(true);
        this.startProgressTimer();
      },
      onpause: () => {
        if (this.onPlayStateChange) this.onPlayStateChange(false);
        this.stopProgressTimer();
      },
      onstop: () => {
        if (this.onPlayStateChange) this.onPlayStateChange(false);
        this.stopProgressTimer();
      },
      onend: () => {
        this.handleTrackEnd();
      }
    });

    this.sound.play();
  }

  play() {
    if (this.sound) {
      this.sound.play();
    } else if (this.playlist.length > 0) {
      // Find active track row or play first
      const idx = this.currentIndex >= 0 ? this.currentIndex : 0;
      this.playTrack(idx);
    }
  }

  pause() {
    if (this.sound) {
      this.sound.pause();
      // Save state immediately on pause
      const seek = this.sound.seek() || 0;
      const track = this.playlist[this.currentIndex];
      if (track) {
        savePlaybackState(track.id, seek);
      }
    }
  }

  stop() {
    if (this.sound) {
      this.sound.unload();
      this.sound = null;
    }
    this.stopProgressTimer();
    if (this.onPlayStateChange) this.onPlayStateChange(false);
  }

  next() {
    if (this.playlist.length === 0) return;
    if (this.isShuffle) {
      const rand = Math.floor(Math.random() * this.playlist.length);
      this.playTrack(rand);
    } else {
      let nextIndex = this.currentIndex + 1;
      if (nextIndex >= this.playlist.length) {
        nextIndex = this.isRepeat === 'all' ? 0 : this.playlist.length - 1;
      }
      this.playTrack(nextIndex);
    }
  }

  prev() {
    if (this.playlist.length === 0) return;
    let prevIndex = this.currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = this.isRepeat === 'all' ? this.playlist.length - 1 : 0;
    }
    this.playTrack(prevIndex);
  }

  seek(pct) {
    if (this.sound && this.sound.state() === 'loaded') {
      const duration = this.sound.duration();
      const target = duration * pct;
      this.sound.seek(target);
      
      const track = this.playlist[this.currentIndex];
      if (track) {
        savePlaybackState(track.id, target);
      }
    }
  }

  seekBySeconds(secs) {
    if (this.sound && this.sound.state() === 'loaded') {
      const current = this.sound.seek();
      const duration = this.sound.duration();
      let target = current + secs;
      if (target < 0) target = 0;
      if (target > duration) target = duration;
      this.sound.seek(target);
      
      const track = this.playlist[this.currentIndex];
      if (track) {
        savePlaybackState(track.id, target);
      }
    }
  }

  handleTrackEnd() {
    if (this.isRepeat === 'one') {
      this.playTrack(this.currentIndex);
    } else {
      this.next();
    }
  }

  startProgressTimer() {
    this.stopProgressTimer();
    let lastSaveTime = Date.now();
    this.progressInterval = setInterval(() => {
      if (this.sound && this.sound.playing()) {
        const seek = this.sound.seek() || 0;
        const duration = this.sound.duration() || 0;
        if (this.onProgressUpdate) {
          this.onProgressUpdate(seek, duration);
        }
        
        // Save state only every 10 seconds (10000ms) during playback to optimize performance
        const now = Date.now();
        if (now - lastSaveTime >= 10000) {
          const track = this.playlist[this.currentIndex];
          if (track) {
            savePlaybackState(track.id, seek);
          }
          lastSaveTime = now;
        }
      }
    }, 250);
  }

  stopProgressTimer() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }
}

// ── APP INITIALIZATION & CONTROLLERS ───────────────────────────────────────
const player = new PlaybackService();
let activeLibrary = [];
let savedDirectoryHandle = null;
const defaultArtwork = 'https://ik.imagekit.io/026k2i7ys/iWeb%20Favicon.svg?updatedAt=1700227200100';

// Format seconds into MM:SS
function formatTime(secs) {
  if (isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Extract track meta
async function extractMetadata(fileObj) {
  const file = fileObj.file;
  let title = file.name;
  let artist = 'Unknown Artist';
  let album = 'Unknown Album';
  let duration = 0;
  let artwork = defaultArtwork;
  let artworkBlob = null;

  try {
    const metadata = await parseBlob(file);
    if (metadata.common) {
      if (metadata.common.title) title = metadata.common.title;
      if (metadata.common.artist) artist = metadata.common.artist;
      if (metadata.common.album) album = metadata.common.album;
      
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const pic = metadata.common.picture[0];
        artworkBlob = new Blob([pic.data], { type: pic.format });
        artwork = URL.createObjectURL(artworkBlob);
      }
    }
    if (metadata.format && metadata.format.duration) {
      duration = metadata.format.duration;
    }
  } catch (err) {
    console.error('Metadata parsing error:', file.name, err);
  }

  return {
    id: `${file.name}-${file.size}`,
    file: file,
    path: fileObj.path,
    title: title,
    artist: artist,
    album: album,
    duration: duration,
    artwork: artwork,
    artworkBlob: artworkBlob
  };
}

// Build list of all files in handles recursively
async function scanDirectoryRecursive(dirHandle, path = '') {
  let list = [];
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file') {
      if (isSupportedAudio(entry.name)) {
        try {
          const file = await entry.getFile();
          list.push({
            file: file,
            path: path ? `${path}/${entry.name}` : entry.name
          });
        } catch (e) {
          console.error("Failed to read file from handle:", entry.name, e);
        }
      }
    } else if (entry.kind === 'directory') {
      const sub = await scanDirectoryRecursive(entry, path ? `${path}/${entry.name}` : entry.name);
      list.push(...sub);
    }
  }
  return list;
}

// Render library DOM
function renderLibraryUI() {
  const trackListEl = document.querySelector('.music-track-list');
  if (!trackListEl) return;

  trackListEl.innerHTML = '';
  if (activeLibrary.length === 0) {
    trackListEl.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.5); padding: 20px;">No music tracks found.</div>`;
    return;
  }

  activeLibrary.forEach((track, index) => {
    const row = document.createElement('div');
    row.className = `track-row ${player.currentIndex === index ? 'active-track' : ''}`;
    row.onclick = () => {
      player.playTrack(index);
    };

    row.innerHTML = `
      <div class="track-row-left">
        <img class="track-row-art" src="${track.artwork}" alt="Art" onerror="this.src='${defaultArtwork}'">
        <div class="track-row-details">
          <span class="track-row-title">${track.title}</span>
          <span class="track-row-artist-album">${track.artist} • ${track.album}</span>
        </div>
      </div>
      <span class="track-row-duration">${formatTime(track.duration)}</span>
    `;
    trackListEl.appendChild(row);
  });
}

// Update current track details across UI
function updateActiveTrackUI(track) {
  // Mini player
  const miniArt = document.getElementById('music-mini-art');
  const miniTitle = document.getElementById('music-mini-title');
  const miniArtist = document.getElementById('music-mini-artist');
  if (miniArt) miniArt.src = track.artwork;
  if (miniTitle) miniTitle.textContent = track.title;
  if (miniArtist) miniArtist.textContent = track.artist;

  // Render modal to highlight active
  renderLibraryUI();
}

// Sync play/pause buttons and waveform animation
function updatePlayStateUI(isPlaying) {
  const miniPlay = document.getElementById('music-mini-play');
  if (miniPlay) {
    miniPlay.innerHTML = isPlaying 
      ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
      : `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  }

  const waveIndicator = document.getElementById('music-wave-indicator');
  if (waveIndicator) {
    if (isPlaying) {
      waveIndicator.classList.add('playing');
    } else {
      waveIndicator.classList.remove('playing');
    }
  }
}

// Watch the active output device (buds, headphones, speakers)
async function updateAudioOutputIndicator() {
  const deviceIcon = document.getElementById('music-mini-output-device');
  if (!deviceIcon) return;

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
    
    let isHeadphones = false;
    let isBuds = false;

    for (const d of audioOutputs) {
      const label = d.label.toLowerCase();
      if (label.includes('headphone') || label.includes('headset') || label.includes('audio jack') || label.includes('wired')) {
        isHeadphones = true;
      }
      if (label.includes('buds') || label.includes('airpods') || label.includes('bluetooth') || label.includes('wireless')) {
        isBuds = true;
      }
    }

    if (isBuds) {
      deviceIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.5c-1.38 0-2.5-1.12-2.5-2.5V13c0-1.1.9-2 2-2h1V7.5c0-1.38-1.12-2.5-2.5-2.5S6.5 6.12 6.5 7.5c0 .28-.22.5-.5.5s-.5-.22-.5-.5C5.5 5.01 7.51 3 10 3s4.5 2.01 4.5 4.5V11h1c1.1 0 2 .9 2 2v2c0 1.38-1.12 2.5-2.5 2.5h-1c-.28 0-.5-.22-.5-.5V13c0-.28-.22-.5-.5-.5h-2c-.28 0-.5.22-.5.5v4c0 .28-.22.5-.5.5h-1z"/></svg>`;
      deviceIcon.title = "Bluetooth / Buds Output";
    } else if (isHeadphones) {
      deviceIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`;
      deviceIcon.title = "Headphones Output";
    } else {
      deviceIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><circle cx="12" cy="14" r="4"/><line x1="12" y1="6" x2="12.01" y2="6"/></svg>`;
      deviceIcon.title = "Speakers Output";
    }
  } catch (err) {
    console.error("Audio output detection error:", err);
    deviceIcon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><circle cx="12" cy="14" r="4"/><line x1="12" y1="6" x2="12.01" y2="6"/></svg>`;
  }
}

// Progress Updates
function updateProgressUI(seek, duration) {
  const elapsedEl = document.getElementById('music-mini-time-elapsed');
  const remainingEl = document.getElementById('music-mini-time-remaining');
  const progressInput = document.getElementById('music-mini-progress');

  if (elapsedEl) elapsedEl.textContent = formatTime(seek);
  if (remainingEl) remainingEl.textContent = formatTime(duration - seek);
  if (progressInput && duration > 0) {
    progressInput.value = (seek / duration) * 100;
  }
}

// Handle folder selection
async function handleFolderSelection() {
  try {
    const statusEl = document.getElementById('music-modal-status');
    if (statusEl) statusEl.textContent = "Selecting folder...";

    let filesList = [];
    
    // Check if we can use native File System Access API
    if ('showDirectoryPicker' in window) {
      savedDirectoryHandle = await window.showDirectoryPicker();
      await saveDirectoryHandle(savedDirectoryHandle);
      filesList = await scanDirectoryRecursive(savedDirectoryHandle);
      document.getElementById('music-modal-rescan').style.display = 'block';
    } else {
      // Fallback via browser-fs-access
      const files = await directoryOpen({ recursive: true });
      filesList = files.filter(f => isSupportedAudio(f.name)).map(f => ({
        file: f,
        path: f.webkitRelativePath || f.name
      }));
    }

    if (statusEl) statusEl.textContent = `Scanning ${filesList.length} files...`;

    const newLibrary = [];
    for (const fileObj of filesList) {
      const track = await extractMetadata(fileObj);
      newLibrary.push(track);
    }

    activeLibrary = newLibrary;
    player.setPlaylist(activeLibrary);
    await saveTracks(activeLibrary);
    renderLibraryUI();

    if (statusEl) statusEl.textContent = `Loaded ${activeLibrary.length} tracks.`;
  } catch (err) {
    console.error("Folder selection failed:", err);
    const statusEl = document.getElementById('music-modal-status');
    if (statusEl) statusEl.textContent = "Selection cancelled or failed.";
  }
}

// Handle Folder Rescanning
async function handleFolderRescan() {
  if (!savedDirectoryHandle) {
    alert("No directory handle stored. Please select folder again.");
    return;
  }

  const statusEl = document.getElementById('music-modal-status');
  if (statusEl) statusEl.textContent = "Verifying permission...";

  try {
    // Request read permission if not already granted
    const opt = { mode: 'read' };
    if (await savedDirectoryHandle.queryPermission(opt) !== 'granted') {
      if (await savedDirectoryHandle.requestPermission(opt) !== 'granted') {
        alert("Permission denied to access folder.");
        return;
      }
    }

    if (statusEl) statusEl.textContent = "Scanning directory...";
    const filesList = await scanDirectoryRecursive(savedDirectoryHandle);

    if (statusEl) statusEl.textContent = `Comparing ${filesList.length} files...`;

    // Map existing tracks by unique path/id
    const existingMap = new Map(activeLibrary.map(t => [t.path, t]));
    const updatedLibrary = [];

    for (const fileObj of filesList) {
      const id = `${fileObj.file.name}-${fileObj.file.size}`;
      const existing = existingMap.get(fileObj.path);

      if (existing) {
        // Match found: preserve metadata, update the file object reference
        existing.file = fileObj.file;
        updatedLibrary.push(existing);
        existingMap.delete(fileObj.path);
      } else {
        // New file: extract metadata
        const track = await extractMetadata(fileObj);
        updatedLibrary.push(track);
      }
    }

    // Any remaining tracks in existingMap are files that were deleted
    activeLibrary = updatedLibrary;
    player.setPlaylist(activeLibrary);
    await saveTracks(activeLibrary);
    renderLibraryUI();

    if (statusEl) statusEl.textContent = `Library updated. Total tracks: ${activeLibrary.length}.`;
  } catch (err) {
    console.error("Rescan failed:", err);
    if (statusEl) statusEl.textContent = "Rescan failed.";
  }
}

// Ensure file references are loaded from the stored directory handle
async function ensureFilesConnected() {
  if (activeLibrary.length === 0) return false;
  
  const connected = activeLibrary.some(t => t.file !== null);
  if (connected) return true;

  if (!savedDirectoryHandle) {
    alert("Please open the Music Library and select a folder first.");
    return false;
  }

  try {
    const opt = { mode: 'read' };
    const permission = await savedDirectoryHandle.requestPermission(opt);
    if (permission === 'granted') {
      const statusEl = document.getElementById('music-modal-status');
      if (statusEl) statusEl.textContent = "Connecting files...";
      
      const filesList = await scanDirectoryRecursive(savedDirectoryHandle);
      const fileMap = new Map(filesList.map(f => [f.path, f.file]));
      
      activeLibrary.forEach(track => {
        if (fileMap.has(track.path)) {
          track.file = fileMap.get(track.path);
        }
      });
      
      player.setPlaylist(activeLibrary);
      renderLibraryUI();
      
      if (statusEl) {
        statusEl.textContent = `Library connected (${activeLibrary.length} tracks).`;
      }
      return true;
    }
  } catch (err) {
    console.error("Auto-connect permission error:", err);
  }
  
  alert("Folder access permission denied. Please grant permission to play local tracks.");
  return false;
}

// Load saved data on startup
async function init() {
  try {
    const savedTracks = await getSavedTracks();
    savedDirectoryHandle = await getDirectoryHandle();

    if (savedDirectoryHandle) {
      document.getElementById('music-modal-rescan').style.display = 'block';
    }

    // Convert raw artwork blobs back into Object URLs
    activeLibrary = savedTracks.map(t => {
      let artwork = defaultArtwork;
      if (t.artworkBlob) {
        artwork = URL.createObjectURL(t.artworkBlob);
      }
      return {
        ...t,
        artwork: artwork,
        file: null // Will be reconnected on permission grant
      };
    });

    player.setPlaylist(activeLibrary);
    renderLibraryUI();

    // Try to silently reconnect files if permission is already granted
    if (savedDirectoryHandle) {
      try {
        const hasPermission = await savedDirectoryHandle.queryPermission({ mode: 'read' }) === 'granted';
        if (hasPermission) {
          const filesList = await scanDirectoryRecursive(savedDirectoryHandle);
          const fileMap = new Map(filesList.map(f => [f.path, f.file]));
          activeLibrary.forEach(track => {
            if (fileMap.has(track.path)) {
              track.file = fileMap.get(track.path);
            }
          });
          player.setPlaylist(activeLibrary);
          renderLibraryUI();
        }
      } catch (err) {
        console.error("Silent auto-reconnect failed:", err);
      }
    }

    // Restore last played track & seek time
    const lastPlayed = await getPlaybackState();
    if (lastPlayed) {
      const lastIndex = activeLibrary.findIndex(t => t.id === lastPlayed.trackId);
      if (lastIndex >= 0) {
        player.currentIndex = lastIndex;
        const track = activeLibrary[lastIndex];
        
        // Update UI with the stored track and position
        updateActiveTrackUI(track);
        updateProgressUI(lastPlayed.seekTime, track.duration);
        
        // Store pending seek offset
        player.pendingSeekTime = lastPlayed.seekTime;
      }
    }

    const statusEl = document.getElementById('music-modal-status');
    if (statusEl) {
      const connected = activeLibrary.some(t => t.file !== null);
      if (activeLibrary.length > 0) {
        statusEl.textContent = connected 
          ? `Library loaded & connected (${activeLibrary.length} tracks).`
          : `Library loaded (${activeLibrary.length} tracks). Click play or Rescan to connect files.`;
      } else {
        statusEl.textContent = "No folder loaded. Select a folder to start.";
      }
    }
  } catch (e) {
    console.error("Startup restore failed:", e);
  }
}

// ── EVENT BINDINGS ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Bind player callbacks
  player.onTrackChange = updateActiveTrackUI;
  player.onPlayStateChange = updatePlayStateUI;
  player.onProgressUpdate = updateProgressUI;

  // Mini controls
  document.getElementById('music-mini-play').onclick = () => {
    if (player.sound && player.sound.playing()) {
      player.pause();
    } else {
      player.play();
    }
  };

  document.getElementById('music-mini-prev').onclick = () => player.prev();
  document.getElementById('music-mini-next').onclick = () => player.next();

  // Seek bar
  const progressInput = document.getElementById('music-mini-progress');
  if (progressInput) {
    // oninput updates the text UI and slider smoothly (highly responsive, 0 DB writes)
    progressInput.oninput = (e) => {
      if (player.currentIndex >= 0) {
        const track = player.playlist[player.currentIndex];
        const pct = parseFloat(e.target.value) / 100;
        const target = track.duration * pct;
        updateProgressUI(target, track.duration);
      }
    };

    // onchange actually seeks the audio and saves to IndexedDB (fired once when slider is released)
    progressInput.onchange = (e) => {
      const pct = parseFloat(e.target.value) / 100;
      if (player.sound) {
        player.seek(pct);
      } else if (player.currentIndex >= 0) {
        const track = player.playlist[player.currentIndex];
        const target = track.duration * pct;
        player.pendingSeekTime = target;
        savePlaybackState(track.id, target);
      }
    };
  }

  // Library modal toggle
  const modal = document.getElementById('music-player-modal');
  
  // Clicking artwork or text details opens the library modal
  const miniArt = document.getElementById('music-mini-art');
  if (miniArt) {
    miniArt.onclick = () => {
      modal.style.display = 'block';
    };
  }

  const textDetails = document.querySelector('.music-text-details');
  if (textDetails) {
    textDetails.onclick = () => {
      modal.style.display = 'block';
    };
  }

  document.getElementById('close-music-player-modal').onclick = () => {
    modal.style.display = 'none';
  };

  // Select folder & Rescan buttons
  document.getElementById('music-modal-select-folder').onclick = handleFolderSelection;
  document.getElementById('music-modal-rescan').onclick = handleFolderRescan;

  // Shuffle & Repeat buttons
  const shuffleBtn = document.getElementById('music-modal-shuffle');
  if (shuffleBtn) {
    shuffleBtn.onclick = () => {
      player.isShuffle = !player.isShuffle;
      shuffleBtn.textContent = `Shuffle: ${player.isShuffle ? 'On' : 'Off'}`;
    };
  }

  const repeatBtn = document.getElementById('music-modal-repeat');
  if (repeatBtn) {
    repeatBtn.onclick = () => {
      if (player.isRepeat === 'off') {
        player.isRepeat = 'all';
      } else if (player.isRepeat === 'all') {
        player.isRepeat = 'one';
      } else {
        player.isRepeat = 'off';
      }
      repeatBtn.textContent = `Repeat: ${player.isRepeat.toUpperCase()}`;
    };
  }

  // Audio output device watcher
  updateAudioOutputIndicator();
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', updateAudioOutputIndicator);
  }

  // Load saved library
  init();
});
