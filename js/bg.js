var backgroundImages = [
  // Here where the BG image are stored and goes for interval
];
var backgroundImages = JSON.parse(localStorage.getItem('backgroundImages')) || [];
var currentIndex = 0;
var isTransitioning = false;
var intervalDuration = 10800000; // 10800000 is 3 hours in milliseconds

function extractAverageColor(imagePath) {
  var image = new Image();
  image.src = imagePath;
  image.crossOrigin = 'anonymous';
  image.onload = function() {
    var vibrant = new Vibrant(image);
    var swatches = vibrant.swatches();
    var dominantColor = swatches['Vibrant'] || swatches['Muted'] || swatches['DarkVibrant'] || swatches['DarkMuted'] || swatches['LightVibrant'] || swatches['LightMuted'];
   
    if (dominantColor) {
      var textColor = dominantColor.getHex();
      var textElements = document.querySelectorAll("#clock");
      textElements.forEach((element) => {
        element.style.color = textColor;
      });
    }
  }
}
      
// function setBackgroundAndTextColor(imagePath) {
//   var bodyElement = document.body;
//   var newImageElement = document.createElement("div");
//   newImageElement.style.backgroundImage = "url('" + imagePath + "')";
//   newImageElement.className = "fade-transition";

//   bodyElement.insertBefore(newImageElement, bodyElement.firstChild);

//   newImageElement.style.opacity = 1;

//   // localStorage.setItem('lastBackgroundImage', imagePath);

//   setTimeout(function () {
//     bodyElement.style.backgroundImage = "url('" + imagePath + "')";
//     bodyElement.removeChild(newImageElement);
//     isTransitioning = false;
//   }, 500);

//   extractAverageColor(imagePath);
// }

function setBackgroundAndTextColor(imagePath) {
  var bodyElement = document.body;
  
  bodyElement.style.backgroundImage = "url('" + imagePath + "')";
  extractAverageColor(imagePath);
}

// function changeBackground(timestamp) {
//   if (!isTransitioning) {
//     isTransitioning = true;
//     currentIndex = (currentIndex + 1) % backgroundImages.length;
//     setBackgroundAndTextColor(backgroundImages[currentIndex]);
//   }
// }

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
  currentIndex = (currentIndex + 1) % backgroundImages.length;
  setBackgroundAndTextColor(backgroundImages[currentIndex]);
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
  var checkboxes = document.querySelectorAll('input[type="checkbox"]');
  
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
    // Delete selected images from local storage
    for (var i = selectedImages.length - 1; i >= 0; i--) {
      backgroundImages.splice(selectedImages[i], 1);
    }
    // Save the updated array to local storage
    localStorage.setItem('backgroundImages', JSON.stringify(backgroundImages));
    
    // Close the Remove BG overlay
    closeRemoveBGWindow();

    // After deleting, you can repopulate the image grid
    var imageGrid = document.getElementById('image-grid');
    imageGrid.innerHTML = getSavedImagesHTML();
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
