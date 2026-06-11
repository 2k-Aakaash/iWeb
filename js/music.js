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
const FAVORITES_KEY = 'favorites-list';
const PLAYLISTS_KEY = 'playlists-data';

// ── GLOBAL STATE ────────────────────────────────────────────────────────────
let favorites = []; // Array of track IDs
let playlists = {}; // Object mapping playlist names to array of track IDs
let activeView = 'home'; // 'home', 'search', 'playlist'
let currentPlaylistTracks = [];
let currentPlaylistId = 'all'; // 'all', 'favorites', or custom playlist name
let navigationHistory = [{ view: 'home', playlistId: null }];
let navigationIndex = 0;
let isDraggingProgress = false;
let activeContextMenuCloseHandler = null;

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

async function saveFavorites(favIds) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(favIds, FAVORITES_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getFavorites() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(FAVORITES_KEY);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function savePlaylists(playlistsObj) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(playlistsObj, PLAYLISTS_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getPlaylists() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(PLAYLISTS_KEY);
    request.onsuccess = () => resolve(request.result || {});
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
      html5: false,
      volume: 0, // Start silent for fade-in
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
        // Smoothly fade in to 1 whenever playback starts/resumes
        this.sound.fade(this.sound.volume(), 1, 600);
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
      this.sound.off('fade'); // Clear pending fade pauses
      this.sound.play();
    } else if (this.playlist.length > 0) {
      // Find active track row or play first
      const idx = this.currentIndex >= 0 ? this.currentIndex : 0;
      this.playTrack(idx);
    }
  }

  pause() {
    if (this.sound) {
      this.sound.off('fade'); // Clear any active fade actions
      const currentVol = this.sound.volume();
      this.sound.fade(currentVol, 0, 300); // Fade out to silent
      this.sound.once('fade', () => {
        // Only pause if the volume actually reached 0 (fade-out completed)
        if (this.sound.volume() === 0) {
          this.sound.pause();
          // Do NOT reset volume to 1 here, keep it at 0 so it starts at 0 on resume!
        }
      });
      
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

// Render library DOM highlights
function renderLibraryUI() {
  // Highlight active row in Playlist view table
  const activeTrack = player.playlist[player.currentIndex];
  
  const playlistRows = document.querySelectorAll('#playlist-tracks-body tr');
  playlistRows.forEach((row) => {
    const titleEl = row.querySelector('.table-track-title');
    if (titleEl && activeTrack && activeTrack.title === titleEl.textContent) {
      row.classList.add('active-row');
    } else {
      row.classList.remove('active-row');
    }
  });

  // Highlight active row in Search results
  const searchRows = document.querySelectorAll('.search-results-list .track-row');
  searchRows.forEach((row) => {
    const titleEl = row.querySelector('.track-row-title');
    if (titleEl && activeTrack && activeTrack.title === titleEl.textContent) {
      row.classList.add('active-track');
    } else {
      row.classList.remove('active-track');
    }
  });
}

// ── NAVIGATION & VIEW ROUTING ────────────────────────────────────────────────
function navigateToView(viewId, playlistId = null) {
  // Truncate history after index if we navigate to a new page
  if (navigationIndex < navigationHistory.length - 1) {
    navigationHistory = navigationHistory.slice(0, navigationIndex + 1);
  }
  
  navigationHistory.push({ view: viewId, playlistId });
  navigationIndex = navigationHistory.length - 1;
  applyView(viewId, playlistId);
}

function navigateBack() {
  if (navigationIndex > 0) {
    navigationIndex--;
    const state = navigationHistory[navigationIndex];
    applyView(state.view, state.playlistId);
  }
}

function navigateForward() {
  if (navigationIndex < navigationHistory.length - 1) {
    navigationIndex++;
    const state = navigationHistory[navigationIndex];
    applyView(state.view, state.playlistId);
  }
}

function applyView(viewId, playlistId = null) {
  activeView = viewId;
  currentPlaylistId = playlistId;
  
  // Update nav arrows disabled state
  const backBtn = document.getElementById('nav-arrow-back');
  const forwardBtn = document.getElementById('nav-arrow-forward');
  if (backBtn) backBtn.disabled = navigationIndex <= 0;
  if (forwardBtn) forwardBtn.disabled = navigationIndex >= navigationHistory.length - 1;
  
  // Hide all views first
  document.querySelectorAll('.music-view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => item.classList.remove('active'));
  
  // Clean active states in sidebar playlists
  const favItem = document.getElementById('playlist-favorites');
  if (favItem) favItem.classList.remove('active');
  document.querySelectorAll('.sidebar-playlist-list .playlist-item').forEach(item => item.classList.remove('active'));
  
  const titleEl = document.getElementById('current-view-title');
  
  if (viewId === 'home') {
    document.getElementById('view-home').classList.add('active');
    document.getElementById('nav-home').classList.add('active');
    if (titleEl) titleEl.textContent = 'Home';
    renderHomeView();
  } else if (viewId === 'search') {
    document.getElementById('view-search').classList.add('active');
    document.getElementById('nav-search').classList.add('active');
    if (titleEl) titleEl.textContent = 'Search';
    renderSearchView();
  } else if (viewId === 'playlist') {
    document.getElementById('view-playlist').classList.add('active');
    if (playlistId === 'favorites') {
      const favEl = document.getElementById('playlist-favorites');
      if (favEl) favEl.classList.add('active');
      if (titleEl) titleEl.textContent = 'Favorites';
      renderPlaylistView('Favorites', getTracksFromIds(favorites), true, 'favorites');
    } else if (playlistId === 'all') {
      if (titleEl) titleEl.textContent = 'All Songs';
      renderPlaylistView('All Songs', activeLibrary, false, 'all');
    } else {
      // Custom playlist
      const targetItem = document.querySelector(`.playlist-item[data-id="${playlistId}"]`);
      if (targetItem) targetItem.classList.add('active');
      if (titleEl) titleEl.textContent = playlistId;
      const trackIds = playlists[playlistId] || [];
      renderPlaylistView(playlistId, getTracksFromIds(trackIds), false, playlistId);
    }
  }
}

function getTracksFromIds(ids) {
  return ids.map(id => activeLibrary.find(t => t.id === id)).filter(Boolean);
}

// ── RENDER SIDEBAR ───────────────────────────────────────────────────────────
function renderSidebar() {
  const sidebarPlaylistsEl = document.getElementById('sidebar-playlists');
  if (!sidebarPlaylistsEl) return;
  
  // Keep Favorites as the static top list item
  sidebarPlaylistsEl.innerHTML = `
    <li class="playlist-item ${currentPlaylistId === 'favorites' && activeView === 'playlist' ? 'active' : ''}" id="playlist-favorites" data-id="favorites">
      <span class="playlist-color-box fav-box">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
      </span>
      <div class="playlist-info">
        <span class="playlist-name">Favorites</span>
        <span class="playlist-desc">Playlist • You</span>
      </div>
    </li>
  `;
  
  // Re-bind favorites click handler
  document.getElementById('playlist-favorites').onclick = () => {
    navigateToView('playlist', 'favorites');
  };
  
  // Render custom playlists
  Object.keys(playlists).forEach(name => {
    const li = document.createElement('li');
    li.className = `playlist-item ${currentPlaylistId === name && activeView === 'playlist' ? 'active' : ''}`;
    li.setAttribute('data-id', name);
    
    li.innerHTML = `
      <span class="playlist-color-box custom-box">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
      </span>
      <div class="playlist-info">
        <span class="playlist-name">${name}</span>
        <span class="playlist-desc">Playlist • You</span>
      </div>
      <button class="playlist-item-delete" title="Delete Playlist">×</button>
    `;
    
    li.onclick = (e) => {
      if (e.target.closest('.playlist-item-delete')) return;
      navigateToView('playlist', name);
    };
    
    const delBtn = li.querySelector('.playlist-item-delete');
    if (delBtn) {
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`Are you sure you want to delete the playlist "${name}"?`)) {
          delete playlists[name];
          await savePlaylists(playlists);
          renderSidebar();
          if (currentPlaylistId === name) {
            navigateToView('home');
          }
        }
      };
    }
    
    sidebarPlaylistsEl.appendChild(li);
  });
}

// ── RENDER HOME VIEW ─────────────────────────────────────────────────────────
function renderHomeView() {
  const allSongsCard = document.getElementById('card-all-songs');
  const favCard = document.getElementById('card-favorites');
  
  if (allSongsCard) {
    allSongsCard.onclick = () => navigateToView('playlist', 'all');
  }
  if (favCard) {
    favCard.onclick = () => navigateToView('playlist', 'favorites');
  }
}

// ── RENDER SEARCH VIEW ───────────────────────────────────────────────────────
function renderSearchView() {
  const searchInput = document.getElementById('music-search-field');
  const resultsContainer = document.querySelector('.search-results-list');
  const resultsHeader = document.getElementById('search-results-header');
  
  if (!searchInput || !resultsContainer) return;
  
  const handleSearch = () => {
    const query = searchInput.value.toLowerCase().trim();
    if (!query) {
      resultsHeader.textContent = "Start searching";
      resultsContainer.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.4); padding: 20px;">Type above to search songs, artists, or albums.</div>`;
      return;
    }
    
    const filtered = activeLibrary.filter(track => {
      return (track.title || '').toLowerCase().includes(query) ||
             (track.artist || '').toLowerCase().includes(query) ||
             (track.album || '').toLowerCase().includes(query);
    });
    
    resultsHeader.textContent = `Search results (${filtered.length})`;
    
    if (filtered.length === 0) {
      resultsContainer.innerHTML = `<div style="text-align: center; color: rgba(255,255,255,0.4); padding: 20px;">No tracks found matching "${query}"</div>`;
      return;
    }
    
    resultsContainer.innerHTML = '';
    filtered.forEach((track) => {
      const idxInLibrary = activeLibrary.findIndex(t => t.id === track.id);
      const row = document.createElement('div');
      row.className = `track-row ${player.currentIndex === idxInLibrary ? 'active-track' : ''}`;
      row.style.background = 'rgba(255,255,255,0.04)';
      row.style.border = '1px solid rgba(255,255,255,0.06)';
      row.style.padding = '8px 12px';
      row.style.borderRadius = '10px';
      row.style.cursor = 'pointer';
      
      row.onclick = () => {
        playTrackInContext(track.id, activeLibrary);
      };
      
      const isFav = favorites.includes(track.id);
      
      row.innerHTML = `
        <div class="track-row-left">
          <img class="track-row-art" src="${track.artwork}" onerror="this.src='${defaultArtwork}'">
          <div class="track-row-details">
            <span class="track-row-title">${track.title}</span>
            <span class="track-row-artist-album">${track.artist} • ${track.album}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-left: auto;">
          <button class="btn-row-action btn-fav ${isFav ? 'heart-active' : ''}" title="Favorite">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </button>
          <button class="btn-row-action btn-more" title="Add to Playlist">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
          <span class="track-row-duration" style="margin-left: 10px;">${formatTime(track.duration)}</span>
        </div>
      `;
      
      const favBtn = row.querySelector('.btn-fav');
      if (favBtn) {
        favBtn.onclick = async (e) => {
          e.stopPropagation();
          await toggleFavoriteTrack(track.id);
          handleSearch(); // Refresh search view
        };
      }
      
      const moreBtn = row.querySelector('.btn-more');
      if (moreBtn) {
        moreBtn.onclick = (e) => {
          e.stopPropagation();
          showPlaylistContextMenu(e, track.id, 'all');
        };
      }
      
      resultsContainer.appendChild(row);
    });
  };
  
  searchInput.oninput = handleSearch;
  handleSearch();
}

// ── RENDER PLAYLIST / ALBUM VIEW ─────────────────────────────────────────────
function renderPlaylistView(title, tracks, isFavoritesView, playlistKey) {
  currentPlaylistTracks = tracks;
  
  const coverImg = document.getElementById('playlist-view-cover');
  const titleEl = document.getElementById('playlist-view-title');
  const categoryEl = document.getElementById('playlist-view-category');
  const artistEl = document.getElementById('playlist-view-artist');
  const statsEl = document.getElementById('playlist-view-stats');
  const descEl = document.getElementById('playlist-view-desc');
  const favBtn = document.getElementById('playlist-fav-btn');
  const tableBody = document.getElementById('playlist-tracks-body');
  
  if (coverImg) {
    if (isFavoritesView) {
      coverImg.src = defaultArtwork;
      coverImg.style.background = 'linear-gradient(135deg, #ff2a5f, #ff7e5f)';
    } else if (tracks.length > 0 && tracks[0].artwork !== defaultArtwork) {
      coverImg.src = tracks[0].artwork;
      coverImg.style.background = 'transparent';
    } else {
      coverImg.src = defaultArtwork;
      coverImg.style.background = 'transparent';
    }
  }
  
  if (titleEl) titleEl.textContent = title;
  if (categoryEl) categoryEl.textContent = isFavoritesView ? "Playlist" : "Album/Collection";
  if (artistEl) artistEl.textContent = isFavoritesView ? "You" : "Various Artists";
  
  // Calculate stats
  const totalDuration = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const totalMins = Math.floor(totalDuration / 60);
  const displayStats = `${tracks.length} songs, ~${totalMins} min`;
  if (statsEl) statsEl.textContent = displayStats;
  
  if (descEl) {
    if (isFavoritesView) {
      descEl.textContent = "Your absolute favorites, collected in one place. Press Play to start listening.";
    } else {
      descEl.textContent = "Explore and listen to tracks loaded directly from your folder structure.";
    }
  }
  
  // Favorite button state for the playlist itself
  if (favBtn) {
    if (isFavoritesView) {
      favBtn.style.display = 'none';
    } else {
      favBtn.style.display = 'flex';
      favBtn.classList.remove('active');
    }
  }
  
  // Render track rows in the table body
  if (tableBody) {
    tableBody.innerHTML = '';
    
    if (tracks.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.4); padding: 40px;">No songs in this playlist.</td></tr>`;
      return;
    }
    
    tracks.forEach((track, index) => {
      const idxInLibrary = activeLibrary.findIndex(t => t.id === track.id);
      const tr = document.createElement('tr');
      tr.className = player.currentIndex === idxInLibrary ? 'active-row' : '';
      
      tr.onclick = () => {
        playTrackInContext(track.id, tracks);
      };
      
      const isFav = favorites.includes(track.id);
      
      tr.innerHTML = `
        <td class="col-index">${index + 1}</td>
        <td class="col-title">
          <img class="table-track-art" src="${track.artwork}" onerror="this.src='${defaultArtwork}'">
          <div class="table-track-details">
            <span class="table-track-title">${track.title}</span>
            <span class="table-track-artist">${track.artist}</span>
          </div>
        </td>
        <td class="col-album">${track.album}</td>
        <td class="col-actions">
          <button class="btn-row-action btn-fav ${isFav ? 'heart-active' : ''}" title="Favorite">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
          </button>
          <button class="btn-row-action btn-more" title="Add to Playlist">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
        </td>
        <td class="col-duration">${formatTime(track.duration)}</td>
      `;
      
      const rowFavBtn = tr.querySelector('.btn-fav');
      if (rowFavBtn) {
        rowFavBtn.onclick = async (e) => {
          e.stopPropagation();
          await toggleFavoriteTrack(track.id);
          if (playlistKey === 'favorites') {
            renderPlaylistView('Favorites', getTracksFromIds(favorites), true, 'favorites');
          } else {
            const updatedFav = favorites.includes(track.id);
            rowFavBtn.className = `btn-row-action btn-fav ${updatedFav ? 'heart-active' : ''}`;
            rowFavBtn.querySelector('svg').setAttribute('fill', updatedFav ? 'currentColor' : 'none');
          }
        };
      }
      
      const rowMoreBtn = tr.querySelector('.btn-more');
      if (rowMoreBtn) {
        rowMoreBtn.onclick = (e) => {
          e.stopPropagation();
          showPlaylistContextMenu(e, track.id, playlistKey);
        };
      }
      
      tableBody.appendChild(tr);
    });
  }
}

// ── FAVORITES & CONTEXT MENU HANDLERS ────────────────────────────────────────
async function toggleFavoriteTrack(trackId) {
  const idx = favorites.indexOf(trackId);
  if (idx >= 0) {
    favorites.splice(idx, 1);
  } else {
    favorites.push(trackId);
  }
  await saveFavorites(favorites);
  renderHomeView();
}

function showPlaylistContextMenu(e, trackId, playlistKey) {
  const menu = document.getElementById('playlist-context-menu');
  const list = document.getElementById('context-playlists-list');
  if (!menu || !list) return;
  
  list.innerHTML = '';
  
  // 1. Remove/Delete option if in Favorites
  if (favorites.includes(trackId)) {
    const removeItem = document.createElement('div');
    removeItem.className = 'context-item remove-action';
    removeItem.style.color = '#ff5f56';
    removeItem.innerHTML = `<span>Remove from Favorites</span>`;
    removeItem.onclick = async () => {
      await toggleFavoriteTrack(trackId);
      if (currentPlaylistId === 'favorites') {
        applyView('playlist', 'favorites');
      }
      menu.classList.add('hidden');
      menu.style.display = 'none';
    };
    list.appendChild(removeItem);
  }
  
  // 2. Remove/Delete option if in custom playlist view
  if (playlistKey && playlistKey !== 'all' && playlistKey !== 'favorites') {
    const removeItem = document.createElement('div');
    removeItem.className = 'context-item remove-action';
    removeItem.style.color = '#ff5f56';
    removeItem.innerHTML = `<span>Remove from Playlist</span>`;
    removeItem.onclick = async () => {
      const idx = playlists[playlistKey].indexOf(trackId);
      if (idx >= 0) {
        playlists[playlistKey].splice(idx, 1);
        await savePlaylists(playlists);
        applyView('playlist', playlistKey);
      }
      menu.classList.add('hidden');
      menu.style.display = 'none';
    };
    list.appendChild(removeItem);
  }
  
  // Divider if delete option was added
  if (favorites.includes(trackId) || (playlistKey && playlistKey !== 'all' && playlistKey !== 'favorites')) {
    const divider = document.createElement('div');
    divider.style.height = '1px';
    divider.style.background = 'rgba(255, 255, 255, 0.08)';
    divider.style.margin = '4px 0';
    list.appendChild(divider);
  }
  
  // Custom playlists options for "Add to"
  const playlistNames = Object.keys(playlists);
  playlistNames.forEach(name => {
    if (name === playlistKey) return;
    const item = document.createElement('div');
    item.className = 'context-item';
    item.textContent = name;
    item.onclick = async () => {
      if (!playlists[name].includes(trackId)) {
        playlists[name].push(trackId);
        await savePlaylists(playlists);
        alert(`Added to playlist "${name}"`);
      } else {
        alert(`Song is already in playlist "${name}"`);
      }
      menu.classList.add('hidden');
      menu.style.display = 'none';
    };
    list.appendChild(item);
  });
  
  if (playlistNames.length === 0 && !favorites.includes(trackId) && (!playlistKey || playlistKey === 'all' || playlistKey === 'favorites')) {
    list.innerHTML = `<div class="context-no-playlists">No custom playlists. Click + in sidebar to create.</div>`;
  }
  
  menu.style.display = 'block';
  menu.classList.remove('hidden');
  
  const menuWidth = menu.offsetWidth || 170;
  const menuHeight = menu.offsetHeight || 120;
  
  let left = e.clientX;
  let top = e.clientY;
  
  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 10;
  }
  if (top + menuHeight > window.innerHeight) {
    top = window.innerHeight - menuHeight - 10;
  }
  if (left < 0) left = 10;
  if (top < 0) top = 10;
  
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  
  if (activeContextMenuCloseHandler) {
    document.removeEventListener('click', activeContextMenuCloseHandler);
  }

  const hideMenu = () => {
    menu.classList.add('hidden');
    menu.style.display = 'none';
    document.removeEventListener('click', hideMenu);
    if (activeContextMenuCloseHandler === hideMenu) {
      activeContextMenuCloseHandler = null;
    }
  };
  
  activeContextMenuCloseHandler = hideMenu;
  
  setTimeout(() => {
    document.addEventListener('click', hideMenu);
  }, 100);
}

async function handleCreatePlaylist() {
  const name = prompt("Enter a name for your new playlist:");
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  
  if (playlists[trimmed]) {
    alert("A playlist with that name already exists.");
    return;
  }
  
  playlists[trimmed] = [];
  await savePlaylists(playlists);
  renderSidebar();
  navigateToView('playlist', trimmed);
}

function playTrackInContext(trackId, playlistTracks) {
  player.setPlaylist(playlistTracks);
  const idx = playlistTracks.findIndex(t => t.id === trackId);
  if (idx >= 0) {
    player.playTrack(idx);
  }
}

// Update current track details across UI
function updateActiveTrackUI(track) {
  // Mini player details if exist
  const miniArt = document.getElementById('music-mini-art');
  const miniTitle = document.getElementById('music-mini-title');
  const miniArtist = document.getElementById('music-mini-artist');
  if (miniArt) miniArt.src = track.artwork;
  if (miniTitle) miniTitle.textContent = track.title;
  if (miniArtist) miniArtist.textContent = track.artist;

  // Dynamic Island
  const collapsedArt = document.getElementById('island-collapsed-art');
  const hoveredArt = document.getElementById('island-hovered-art');
  const expandedArt = document.getElementById('island-expanded-art');
  
  const hoveredTitle = document.getElementById('island-hovered-title');
  const hoveredArtist = document.getElementById('island-hovered-artist');
  
  const expandedTitle = document.getElementById('island-expanded-title');
  const expandedArtist = document.getElementById('island-expanded-artist');

  if (collapsedArt) collapsedArt.src = track.artwork;
  if (hoveredArt) hoveredArt.src = track.artwork;
  if (expandedArt) expandedArt.src = track.artwork;

  if (hoveredTitle) hoveredTitle.textContent = track.title;
  if (hoveredArtist) hoveredArtist.textContent = track.artist;

  if (expandedTitle) expandedTitle.textContent = track.title;
  if (expandedArtist) expandedArtist.textContent = track.artist;

  // Bottom Playback Bar Details
  const bottomArt = document.getElementById('bottom-bar-art');
  const bottomTitle = document.getElementById('bottom-bar-title');
  const bottomArtist = document.getElementById('bottom-bar-artist');
  if (bottomArt) bottomArt.src = track.artwork;
  if (bottomTitle) bottomTitle.textContent = track.title;
  if (bottomArtist) bottomArtist.textContent = track.artist;

  // Activate Dynamic Island when music is loaded
  const island = document.getElementById('dynamic-island');
  if (island) {
    island.classList.add('active');
  }

  // Render modal to highlight active
  renderLibraryUI();
}

function checkLibraryStatusAndToggleIsland() {
  const island = document.getElementById('dynamic-island');
  if (island) {
    if (activeLibrary.length > 0) {
      island.classList.add('active');
      
      // If no track is currently active, populate UI with first track details (don't play it)
      if (player.currentIndex < 0) {
        const firstTrack = activeLibrary[0];
        
        const collapsedArt = document.getElementById('island-collapsed-art');
        const hoveredArt = document.getElementById('island-hovered-art');
        const expandedArt = document.getElementById('island-expanded-art');
        
        const hoveredTitle = document.getElementById('island-hovered-title');
        const hoveredArtist = document.getElementById('island-hovered-artist');
        
        const expandedTitle = document.getElementById('island-expanded-title');
        const expandedArtist = document.getElementById('island-expanded-artist');

        if (collapsedArt) collapsedArt.src = firstTrack.artwork;
        if (hoveredArt) hoveredArt.src = firstTrack.artwork;
        if (expandedArt) expandedArt.src = firstTrack.artwork;

        if (hoveredTitle) hoveredTitle.textContent = firstTrack.title;
        if (hoveredArtist) hoveredArtist.textContent = firstTrack.artist;

        if (expandedTitle) expandedTitle.textContent = firstTrack.title;
        if (expandedArtist) expandedArtist.textContent = firstTrack.artist;
        
        updateProgressUI(0, firstTrack.duration);
      }
    } else {
      island.classList.remove('active');
    }
  }
}

// Sync play/pause buttons and waveform animation
function updatePlayStateUI(isPlaying) {
  const miniPlay = document.getElementById('music-mini-play');
  if (miniPlay) {
    miniPlay.innerHTML = isPlaying 
      ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
      : `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  }

  // Dynamic Island Play Button
  const islandPlay = document.getElementById('island-expanded-play');
  if (islandPlay) {
    islandPlay.innerHTML = isPlaying
      ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
      : `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  }

  const waveIndicator = document.getElementById('music-wave-indicator');
  if (waveIndicator) {
    if (isPlaying) {
      waveIndicator.classList.add('playing');
    } else {
      waveIndicator.classList.remove('playing');
    }
  }

  // Dynamic Island Waveforms
  const collapsedWave = document.getElementById('island-collapsed-waveform');
  const hoveredWave = document.getElementById('island-hovered-waveform');
  const expandedWave = document.getElementById('island-expanded-waveform');

  [collapsedWave, hoveredWave, expandedWave].forEach(wave => {
    if (wave) {
      if (isPlaying) {
        wave.classList.add('playing');
      } else {
        wave.classList.remove('playing');
      }
    }
  });
}

// Watch the active output device (buds, headphones, speakers)
async function updateAudioOutputIndicator() {
  const deviceIcon = document.getElementById('music-mini-output-device');
  const islandDeviceIcon = document.getElementById('island-expanded-output');
  if (!deviceIcon && !islandDeviceIcon) return;

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

    const setIcon = (el) => {
      if (!el) return;
      if (isBuds) {
        el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.5c-1.38 0-2.5-1.12-2.5-2.5V13c0-1.1.9-2 2-2h1V7.5c0-1.38-1.12-2.5-2.5-2.5S6.5 6.12 6.5 7.5c0 .28-.22.5-.5.5s-.5-.22-.5-.5C5.5 5.01 7.51 3 10 3s4.5 2.01 4.5 4.5V11h1c1.1 0 2 .9 2 2v2c0 1.38-1.12 2.5-2.5 2.5h-1c-.28 0-.5-.22-.5-.5V13c0-.28-.22-.5-.5-.5h-2c-.28 0-.5.22-.5.5v4c0 .28-.22.5-.5.5h-1z"/></svg>`;
        el.title = "Bluetooth / Buds Output";
      } else if (isHeadphones) {
        el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>`;
        el.title = "Headphones Output";
      } else {
        el.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><circle cx="12" cy="14" r="4"/><line x1="12" y1="6" x2="12.01" y2="6"/></svg>`;
        el.title = "Speakers Output";
      }
    };

    setIcon(deviceIcon);
    setIcon(islandDeviceIcon);
  } catch (err) {
    console.error("Audio output detection error:", err);
    const fallback = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><circle cx="12" cy="14" r="4"/><line x1="12" y1="6" x2="12.01" y2="6"/></svg>`;
    if (deviceIcon) deviceIcon.innerHTML = fallback;
    if (islandDeviceIcon) islandDeviceIcon.innerHTML = fallback;
  }
}

// Progress Updates
function updateProgressUI(seek, duration) {
  // Overhauled bottom bar progress elements
  const bottomElapsed = document.getElementById('bottom-bar-elapsed');
  const bottomDuration = document.getElementById('bottom-bar-duration');
  const bottomProgressInput = document.getElementById('bottom-bar-progress');

  if (bottomElapsed) bottomElapsed.textContent = formatTime(seek);
  if (bottomDuration) bottomDuration.textContent = formatTime(duration);
  if (bottomProgressInput && duration > 0 && !isDraggingProgress) {
    const pct = (seek / duration) * 100;
    bottomProgressInput.value = pct;
    bottomProgressInput.style.background = `linear-gradient(to right, #ffffff 0%, #ffffff ${pct}%, rgba(255, 255, 255, 0.16) ${pct}%, rgba(255, 255, 255, 0.16) 100%)`;
  }

  // Dynamic Island Progress
  const islandElapsedEl = document.getElementById('island-collapsed-elapsed');
  const islandExpandedElapsedEl = document.getElementById('island-expanded-elapsed');
  const islandRemainingEl = document.getElementById('island-expanded-remaining');
  const islandProgressInput = document.getElementById('island-expanded-progress');

  if (islandElapsedEl) islandElapsedEl.textContent = formatTime(seek);
  if (islandExpandedElapsedEl) islandExpandedElapsedEl.textContent = formatTime(seek);
  if (islandRemainingEl) islandRemainingEl.textContent = `-${formatTime(duration - seek)}`;
  if (islandProgressInput && duration > 0 && !isDraggingProgress) {
    const pct = (seek / duration) * 100;
    islandProgressInput.value = pct;
    islandProgressInput.style.background = `linear-gradient(to right, #ffffff 0%, #ffffff ${pct}%, rgba(255, 255, 255, 0.16) ${pct}%, rgba(255, 255, 255, 0.16) 100%)`;
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
    checkLibraryStatusAndToggleIsland();

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
    checkLibraryStatusAndToggleIsland();

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
    if (window.location.search.includes('mock=true')) {
      const db = await getDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const mockTracks = [
        { id: 'song1-12345', path: 'Music/Song1.mp3', title: 'Midnight City', artist: 'M83', album: 'Hurry Up, We\'re Dreaming', duration: 243, artworkBlob: null },
        { id: 'song2-23456', path: 'Music/Song2.mp3', title: 'Blinding Lights', artist: 'The Weeknd', album: 'After Hours', duration: 200, artworkBlob: null },
        { id: 'song3-34567', path: 'Music/Song3.mp3', title: 'Get Lucky', artist: 'Daft Punk', album: 'Random Access Memories', duration: 248, artworkBlob: null },
        { id: 'song4-45678', path: 'Music/Song4.mp3', title: 'Starboy', artist: 'The Weeknd', album: 'Starboy', duration: 230, artworkBlob: null },
        { id: 'song5-56789', path: 'Music/Song5.mp3', title: 'Instant Crush', artist: 'Daft Punk', album: 'Random Access Memories', duration: 337, artworkBlob: null }
      ];
      const mockFavorites = ['song1-12345', 'song3-34567'];
      const mockPlaylists = {
        'Chill Vibes': ['song2-23456', 'song5-56789'],
        'Workout': ['song3-34567']
      };
      store.put(mockTracks, 'tracks-list');
      store.put(mockFavorites, 'favorites-list');
      store.put(mockPlaylists, 'playlists-data');
      await new Promise((resolve) => {
        tx.oncomplete = () => resolve();
      });
      window.location.href = window.location.pathname;
      return;
    }

    const savedTracks = await getSavedTracks();
    savedDirectoryHandle = await getDirectoryHandle();

    if (savedDirectoryHandle) {
      const rescanBtn = document.getElementById('music-modal-rescan');
      if (rescanBtn) rescanBtn.style.display = 'block';
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

    favorites = await getFavorites();
    playlists = await getPlaylists();

    player.setPlaylist(activeLibrary);
    renderLibraryUI();
    renderSidebar();
    navigateToView('home');

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
      } else {
        checkLibraryStatusAndToggleIsland();
      }
    } else {
      checkLibraryStatusAndToggleIsland();
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

  // Sidebar navigation click listeners
  const navHome = document.getElementById('nav-home');
  if (navHome) navHome.onclick = () => navigateToView('home');

  const navSearch = document.getElementById('nav-search');
  if (navSearch) navSearch.onclick = () => navigateToView('search');

  // Playlist creation
  const createPlaylistBtn = document.getElementById('playlist-create-btn');
  if (createPlaylistBtn) createPlaylistBtn.onclick = handleCreatePlaylist;

  // Header Arrows back/forward navigation
  const arrowBack = document.getElementById('nav-arrow-back');
  if (arrowBack) arrowBack.onclick = navigateBack;

  const arrowForward = document.getElementById('nav-arrow-forward');
  if (arrowForward) arrowForward.onclick = navigateForward;

  // Bottom controls click listeners
  const bottomPlay = document.getElementById('bottom-bar-play');
  if (bottomPlay) {
    bottomPlay.onclick = () => {
      if (player.sound && player.sound.playing()) {
        player.pause();
      } else {
        player.play();
      }
    };
  }

  const bottomPrev = document.getElementById('bottom-bar-prev');
  if (bottomPrev) bottomPrev.onclick = () => player.prev();

  const bottomNext = document.getElementById('bottom-bar-next');
  if (bottomNext) bottomNext.onclick = () => player.next();

  const bottomShuffle = document.getElementById('bottom-bar-shuffle');
  if (bottomShuffle) {
    bottomShuffle.onclick = () => {
      player.isShuffle = !player.isShuffle;
      bottomShuffle.classList.toggle('active', player.isShuffle);
    };
  }

  const bottomRepeat = document.getElementById('bottom-bar-repeat');
  if (bottomRepeat) {
    bottomRepeat.onclick = () => {
      if (player.isRepeat === 'off') {
        player.isRepeat = 'all';
      } else if (player.isRepeat === 'all') {
        player.isRepeat = 'one';
      } else {
        player.isRepeat = 'off';
      }
      bottomRepeat.classList.toggle('active', player.isRepeat !== 'off');
      bottomRepeat.title = `Repeat: ${player.isRepeat.toUpperCase()}`;
    };
  }

  // Playlist page action buttons (Play All and Shuffle All)
  const playlistPlayBtn = document.getElementById('playlist-play-btn');
  if (playlistPlayBtn) {
    playlistPlayBtn.onclick = () => {
      if (currentPlaylistTracks.length > 0) {
        playTrackInContext(currentPlaylistTracks[0].id, currentPlaylistTracks);
      }
    };
  }

  const playlistShuffleBtn = document.getElementById('playlist-shuffle-btn');
  if (playlistShuffleBtn) {
    playlistShuffleBtn.onclick = () => {
      if (currentPlaylistTracks.length > 0) {
        player.isShuffle = true;
        const bottomShuffle = document.getElementById('bottom-bar-shuffle');
        if (bottomShuffle) bottomShuffle.classList.add('active');
        
        const randIndex = Math.floor(Math.random() * currentPlaylistTracks.length);
        playTrackInContext(currentPlaylistTracks[randIndex].id, currentPlaylistTracks);
      }
    };
  }

  // Volume slider control
  const bottomVolume = document.getElementById('bottom-bar-volume');
  const bottomVolumeBtn = document.getElementById('bottom-bar-volume-btn');
  let lastVolume = 80;

  if (bottomVolume) {
    bottomVolume.oninput = (e) => {
      const vol = parseFloat(e.target.value) / 100;
      // Also adjust volume of Howler if sound is playing
      if (player.sound) {
        player.sound.volume(vol);
      }
    };
  }

  if (bottomVolumeBtn) {
    bottomVolumeBtn.onclick = () => {
      if (bottomVolume) {
        const currentVal = parseFloat(bottomVolume.value);
        if (currentVal > 0) {
          lastVolume = currentVal;
          bottomVolume.value = 0;
          if (player.sound) player.sound.volume(0);
        } else {
          bottomVolume.value = lastVolume;
          if (player.sound) player.sound.volume(parseFloat(lastVolume) / 100);
        }
      }
    };
  }

  // Seek bar controls (bottom bar & dynamic island progress slider)
  const bottomProgressInput = document.getElementById('bottom-bar-progress');
  const islandProgressInput = document.getElementById('island-expanded-progress');

  const handleProgressInput = (e) => {
    if (player.currentIndex >= 0) {
      const track = player.playlist[player.currentIndex];
      const pct = parseFloat(e.target.value) / 100;
      const target = track.duration * pct;
      updateProgressUI(target, track.duration);
    }
  };

  const handleProgressChange = (e) => {
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

  if (bottomProgressInput) {
    bottomProgressInput.addEventListener('mousedown', () => { isDraggingProgress = true; });
    bottomProgressInput.addEventListener('touchstart', () => { isDraggingProgress = true; });
    bottomProgressInput.oninput = handleProgressInput;
    bottomProgressInput.addEventListener('change', (e) => {
      handleProgressChange(e);
      isDraggingProgress = false;
    });
  }
  if (islandProgressInput) {
    islandProgressInput.addEventListener('mousedown', () => { isDraggingProgress = true; });
    islandProgressInput.addEventListener('touchstart', () => { isDraggingProgress = true; });
    islandProgressInput.oninput = handleProgressInput;
    islandProgressInput.addEventListener('change', (e) => {
      handleProgressChange(e);
      isDraggingProgress = false;
    });
  }

  // Dynamic Island click handlers
  const islandPill = document.getElementById('island-pill');
  const modal = document.getElementById('music-player-modal');

  if (islandPill) {
    islandPill.addEventListener('click', (e) => {
      if (e.target.closest('.expanded-control-btn') || e.target.closest('.expanded-slider')) {
        return;
      }

      const isArtwork = e.target.classList.contains('island-art') || e.target.classList.contains('island-art-large');
      const isText = e.target.id === 'island-hovered-title' || e.target.id === 'island-expanded-title' || e.target.classList.contains('island-title') || e.target.classList.contains('expanded-title');

      if (islandPill.classList.contains('expanded')) {
        if (isArtwork || isText) {
          if (modal) modal.style.display = 'block';
          return;
        }
      } else {
        if (isArtwork) {
          if (player.sound && player.sound.playing()) {
            player.pause();
          } else {
            player.play();
          }
          return;
        }
      }

      islandPill.classList.toggle('expanded');
    });
  }

  // Click outside to collapse Dynamic Island
  document.addEventListener('click', (e) => {
    const islandContainer = document.getElementById('dynamic-island');
    if (islandPill && islandContainer && !islandContainer.contains(e.target)) {
      islandPill.classList.remove('expanded');
    }
  });

  // Dynamic Island Controls
  const islandPlayBtn = document.getElementById('island-expanded-play');
  const islandPrevBtn = document.getElementById('island-expanded-prev');
  const islandNextBtn = document.getElementById('island-expanded-next');

  if (islandPlayBtn) {
    islandPlayBtn.onclick = (e) => {
      e.stopPropagation();
      if (player.sound && player.sound.playing()) {
        player.pause();
      } else {
        player.play();
      }
    };
  }
  if (islandPrevBtn) {
    islandPrevBtn.onclick = (e) => {
      e.stopPropagation();
      player.prev();
    };
  }
  if (islandNextBtn) {
    islandNextBtn.onclick = (e) => {
      e.stopPropagation();
      player.next();
    };
  }

  // Opening the library modal via Customization Panel Shortcut Button
  const musicLibraryBtn = document.getElementById('musicLibraryButton');
  if (musicLibraryBtn) {
    musicLibraryBtn.onclick = () => {
      if (modal) modal.style.display = 'block';
    };
  }

  // Opening the library modal via Bottom mini active track card or bottom details
  const miniArt = document.getElementById('music-mini-art');
  if (miniArt) {
    miniArt.onclick = () => {
      if (modal) modal.style.display = 'block';
    };
  }

  const textDetails = document.querySelector('.music-text-details');
  if (textDetails) {
    textDetails.onclick = () => {
      if (modal) modal.style.display = 'block';
    };
  }

  // Close buttons for modal
  const closeBtn = document.getElementById('close-music-player-modal');
  if (closeBtn) {
    closeBtn.onclick = () => {
      if (modal) modal.style.display = 'none';
    };
  }

  const sidebarCloseDot = document.getElementById('sidebar-dot-close');
  if (sidebarCloseDot) {
    sidebarCloseDot.onclick = () => {
      if (modal) modal.style.display = 'none';
    };
  }

  // Folder actions
  const selectFolderBtn = document.getElementById('music-modal-select-folder');
  if (selectFolderBtn) selectFolderBtn.onclick = handleFolderSelection;

  const rescanBtn = document.getElementById('music-modal-rescan');
  if (rescanBtn) rescanBtn.onclick = handleFolderRescan;

  // Audio output device watcher
  updateAudioOutputIndicator();
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', updateAudioOutputIndicator);
  }

  // Load saved library
  init();
});
