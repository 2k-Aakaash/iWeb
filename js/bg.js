document.addEventListener('DOMContentLoaded', function() {
  document.querySelector('.change-bg').addEventListener('click', changeBackgroundManually);
})

var backgroundImages = [];
var backgroundDbIds = [];

// IndexedDB configuration
var dbName = "iWebDB";
var dbVersion = 1;
var storeName = "background_images";
var db = null;

// Initialize IndexedDB
function initDB(callback) {
  var request = indexedDB.open(dbName, dbVersion);

  request.onerror = function(event) {
    console.error("IndexedDB error:", event.target.error);
    if (callback) callback(event.target.error);
  };

  request.onsuccess = function(event) {
    db = event.target.result;
    if (callback) callback(null, db);
  };

  request.onupgradeneeded = function(event) {
    var dbInstance = event.target.result;
    if (!dbInstance.objectStoreNames.contains(storeName)) {
      dbInstance.createObjectStore(storeName, { keyPath: "id", autoIncrement: true });
    }
  };
}

// Save blob to IndexedDB
function saveImageToDB(blob, callback) {
  if (!db) {
    console.error("Database not initialized");
    if (callback) callback(new Error("Database not initialized"));
    return;
  }
  var transaction = db.transaction([storeName], "readwrite");
  var store = transaction.objectStore(storeName);
  var request = store.add({ blob: blob });

  request.onsuccess = function(event) {
    if (callback) callback(null, event.target.result);
  };

  request.onerror = function(event) {
    console.error("Error saving image to DB:", event.target.error);
    if (callback) callback(event.target.error);
  };
}

// Load all background records from IndexedDB
function loadImagesFromDB(callback) {
  if (!db) {
    console.error("Database not initialized");
    if (callback) callback(new Error("Database not initialized"));
    return;
  }
  var transaction = db.transaction([storeName], "readonly");
  var store = transaction.objectStore(storeName);
  var request = store.getAll();

  request.onsuccess = function(event) {
    if (callback) callback(null, event.target.result);
  };

  request.onerror = function(event) {
    console.error("Error loading images from DB:", event.target.error);
    if (callback) callback(event.target.error);
  };
}

// Delete background records by ID
function deleteImagesFromDB(ids, callback) {
  if (!db) {
    console.error("Database not initialized");
    if (callback) callback(new Error("Database not initialized"));
    return;
  }
  var transaction = db.transaction([storeName], "readwrite");
  var store = transaction.objectStore(storeName);

  ids.forEach(function(id) {
    store.delete(id);
  });

  transaction.oncomplete = function() {
    if (callback) callback(null);
  };

  transaction.onerror = function(event) {
    console.error("Error deleting images from DB:", event.target.error);
    if (callback) callback(event.target.error);
  };
}

// Convert legacy base64 Data URLs to Blobs for migration
function dataURLtoBlob(dataurl) {
  try {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
  } catch (e) {
    console.error("Failed to convert dataURL to Blob", e);
    return null;
  }
}

// Check and perform migration from localStorage to IndexedDB
function initBackgrounds() {
  initDB(function(err) {
    if (err) return;

    var legacyData = localStorage.getItem('backgroundImages');
    if (legacyData) {
      try {
        var legacyImages = JSON.parse(legacyData);
        if (Array.isArray(legacyImages) && legacyImages.length > 0) {
          console.log("Migrating " + legacyImages.length + " background images to IndexedDB...");
          
          var transaction = db.transaction([storeName], "readwrite");
          var store = transaction.objectStore(storeName);
          var migratedCount = 0;
          var totalToMigrate = legacyImages.length;
          
          legacyImages.forEach(function(dataurl) {
            var blob = dataURLtoBlob(dataurl);
            if (blob) {
              var request = store.add({ blob: blob });
              request.onsuccess = function() {
                migratedCount++;
                if (migratedCount === totalToMigrate) {
                  console.log("Migration complete!");
                  localStorage.removeItem('backgroundImages');
                  loadAndInitImages();
                }
              };
              request.onerror = function() {
                migratedCount++;
                if (migratedCount === totalToMigrate) {
                  localStorage.removeItem('backgroundImages');
                  loadAndInitImages();
                }
              };
            } else {
              migratedCount++;
              if (migratedCount === totalToMigrate) {
                localStorage.removeItem('backgroundImages');
                loadAndInitImages();
              }
            }
          });
          return;
        }
      } catch (e) {
        console.error("Failed parsing legacy backgrounds", e);
      }
      localStorage.removeItem('backgroundImages');
    }

    loadAndInitImages();
  });
}

// Load images into memory and create Object URLs
function loadAndInitImages() {
  loadImagesFromDB(function(err, records) {
    if (err || !records) return;
    
    // Revoke old object URLs to avoid memory leaks
    backgroundImages.forEach(function(url) {
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
    });

    backgroundImages = [];
    backgroundDbIds = [];

    records.forEach(function(record) {
      if (record.blob) {
        var url = URL.createObjectURL(record.blob);
        backgroundImages.push(url);
        backgroundDbIds.push(record.id);
      }
    });
    console.log("Loaded " + backgroundImages.length + " background images from IndexedDB.");

    // Restore last used background!
    var lastIdStr = localStorage.getItem('lastUsedBackgroundId');
    var idx = -1;
    if (lastIdStr && backgroundDbIds.length > 0) {
      var lastId = parseInt(lastIdStr);
      idx = backgroundDbIds.indexOf(lastId);
    }
    if (idx === -1 && backgroundImages.length > 0) {
      idx = 0;
      var activeId = backgroundDbIds[0];
      if (activeId !== undefined) {
        localStorage.setItem('lastUsedBackgroundId', activeId);
      }
    }
    if (idx >= 0) {
      currentIndex = idx;
      setBackgroundAndTextColor(backgroundImages[currentIndex]);
    }
  });
}

// Call initialization
initBackgrounds();
var currentIndex = 0;
var isTransitioning = false;
var transitionDuration = 200; // 500 milliseconds
// var intervalDuration = 10800000; // 10800000 is 3 hours in milliseconds

function extractAverageColor(imagePath) {
  var image = new Image();
  if (imagePath && !imagePath.startsWith('blob:') && !imagePath.startsWith('data:')) {
    image.crossOrigin = 'anonymous';
  }
  image.onload = function() {
    var vibrant = new Vibrant(image);
    var swatches = vibrant.swatches();
    var dominantColor = swatches['Vibrant'] || swatches['Muted'] || swatches['DarkVibrant'] || swatches['DarkMuted'] || swatches['LightVibrant'] || swatches['LightMuted'];
   
    if (dominantColor) {
      var textColor = dominantColor.getHex();
      var textElements = document.querySelectorAll("#clock");
      textElements.forEach((element) => {
        // Apply the fade transition for the clock color change
        element.style.transition = `color ${transitionDuration}ms ease-in-out`;
        element.style.color = textColor;
      });
    }
  };
  image.onerror = function(e) {
    console.error("Failed to load image for color extraction:", imagePath, e);
  };
  image.src = imagePath;
}

function setBackgroundAndTextColor(imagePath) {
  var bodyElement = document.body;
  
  bodyElement.style.backgroundImage = "url('" + imagePath + "')";
  extractAverageColor(imagePath);
}

function changeBackground(timestamp) {
  if (!isTransitioning) {
    isTransitioning = true;
    currentIndex = (currentIndex + 1) % backgroundImages.length;
    setBackgroundAndTextColor(backgroundImages[currentIndex]);
    
    setTimeout(function () {
      isTransitioning = false;
    }, 500);
  }
}


function changeBackgroundManually() {
  if (backgroundImages.length === 0) return;
  currentIndex = (currentIndex + 1) % backgroundImages.length;
  setBackgroundAndTextColor(backgroundImages[currentIndex]);
  
  var dbId = backgroundDbIds[currentIndex];
  if (dbId !== undefined) {
    localStorage.setItem('lastUsedBackgroundId', dbId);
  }
}

// Function to open the Remove BG overlay window
function openRemoveBGWindow() {
  // Show the Remove BG overlay window
  var overlay = document.getElementById('remove-bg-window');
  overlay.style.display = 'block';

  // Populate the overlay with saved images
  var imageGrid = document.getElementById('image-grid');
  imageGrid.innerHTML = getSavedImagesHTML();
}

// Close the Remove BG overlay when the close button is clicked
document.getElementById('close-overlay').addEventListener('click', function() {
  var overlay = document.getElementById('remove-bg-window');
  overlay.style.display = 'none';
});

// Close the Remove BG overlay when the user clicks outside the overlay
window.addEventListener('click', function(event) {
  var overlay = document.getElementById('remove-bg-window');
  if (event.target == overlay) {
    overlay.style.display = 'none';
  }
});

// Function to display saved images in a grid view with checkboxes
function getSavedImagesHTML() {
  var savedImagesHTML = '';
  for (var i = 0; i < backgroundImages.length; i++) {
    savedImagesHTML += `
      <div class="image-item">
        <input type="checkbox" id="image-checkbox-${i}">
        <img src="${backgroundImages[i]}" alt="Saved Image">
      </div>
    `;
  }
  return savedImagesHTML;
}

// Add an event listener to open the Remove BG overlay
document.getElementById('remove-bg-button').addEventListener('click', openRemoveBGWindow);
// Function to open the Remove BG overlay window
function openRemoveBGWindow() {
  // Show the Remove BG overlay window
  var overlay = document.getElementById('remove-bg-window');
  overlay.style.display = 'block';

  // Populate the overlay with saved images
  var imageGrid = document.querySelector('.image-grid'); // Use the correct selector
  imageGrid.innerHTML = getSavedImagesHTML();
}

// Function to display saved images in a grid view with checkboxes
function getSavedImagesHTML() {
  var savedImagesHTML = '';
  for (var i = 0; i < backgroundImages.length; i++) {
    savedImagesHTML += `
      <div class="image-item">
        <input type="checkbox" id="image-checkbox-${i}">
        <img src="${backgroundImages[i]}" alt="Saved Image">
      </div>
    `;
  }
  return savedImagesHTML;
}


// Function to close the Remove BG overlay
function closeRemoveBGWindow() {
  var overlay = document.getElementById('remove-bg-window');
  overlay.style.display = 'none';
}

// Function to show the delete confirmation dialog
function showDeleteConfirmation() {
  var selectedImages = [];
  var checkboxes = document.querySelectorAll('.image-grid input[type="checkbox"]');
  
  for (var i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].checked) {
      selectedImages.push(i);
    }
  }

  if (selectedImages.length === 0) {
    alert('Please select at least one image to delete.');
    return;
  }

  var confirmDelete = confirm("Are you sure you want to delete selected images that won't be retrieved in the future?");

  if (confirmDelete) {
    var idsToDelete = [];
    // Delete selected images from IndexedDB and local arrays
    for (var i = selectedImages.length - 1; i >= 0; i--) {
      var index = selectedImages[i];
      var dbId = backgroundDbIds[index];
      if (dbId !== undefined) {
        idsToDelete.push(dbId);
      }
      if (backgroundImages[index] && backgroundImages[index].startsWith('blob:')) {
        URL.revokeObjectURL(backgroundImages[index]);
      }
      backgroundImages.splice(index, 1);
      backgroundDbIds.splice(index, 1);
    }
    
    deleteImagesFromDB(idsToDelete, function(err) {
      // Close the Remove BG overlay
      closeRemoveBGWindow();

      // After deleting, you can repopulate the image grid using the correct class selector
      var imageGrid = document.querySelector('.image-grid');
      if (imageGrid) {
        imageGrid.innerHTML = getSavedImagesHTML();
      }

      // If active background was deleted, reset background or clamp index
      if (backgroundImages.length === 0) {
        localStorage.removeItem('lastUsedBackgroundId');
        document.body.style.backgroundImage = '';
        var clock = document.getElementById('clock');
        if (clock) clock.style.color = '';
      } else {
        if (currentIndex >= backgroundImages.length) {
          currentIndex = 0;
        }
        setBackgroundAndTextColor(backgroundImages[currentIndex]);
        var activeId = backgroundDbIds[currentIndex];
        if (activeId !== undefined) {
          localStorage.setItem('lastUsedBackgroundId', activeId);
        }
      }
    });
  }
}

// Add an event listener to open the Remove BG overlay
document.getElementById('remove-bg-button').addEventListener('click', openRemoveBGWindow);

// Add an event listener to close the Remove BG overlay
document.getElementById('close-overlay').addEventListener('click', closeRemoveBGWindow);

// Add an event listener to close the Remove BG overlay when clicking outside
window.addEventListener('click', function(event) {
  var overlay = document.getElementById('remove-bg-window');
  if (event.target == overlay) {
    closeRemoveBGWindow();
  }
});

// Add an event listener to trigger the delete confirmation
document.getElementById('delete-bg-button').addEventListener('click', showDeleteConfirmation);
