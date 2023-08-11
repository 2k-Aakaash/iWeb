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
      
function setBackgroundAndTextColor(imagePath) {
  var bodyElement = document.body;
  var newImageElement = document.createElement("div");
  newImageElement.style.backgroundImage = "url('" + imagePath + "')";
  newImageElement.className = "fade-transition";

  bodyElement.insertBefore(newImageElement, bodyElement.firstChild);

  newImageElement.style.opacity = 1;

  localStorage.setItem('lastBackgroundImage', imagePath);

  setTimeout(function () {
    bodyElement.style.backgroundImage = "url('" + imagePath + "')";
    bodyElement.removeChild(newImageElement);
    isTransitioning = false;
  }, 500);

  extractAverageColor(imagePath);
}

function changeBackground(timestamp) {
  if (!isTransitioning) {
    isTransitioning = true;
    currentIndex = (currentIndex + 1) % backgroundImages.length;
    setBackgroundAndTextColor(backgroundImages[currentIndex]);
  }
}

function changeBackgroundManually() {
  currentIndex = (currentIndex + 1) % backgroundImages.length;
  setBackgroundAndTextColor(backgroundImages[currentIndex]);
}

function initializeBackground() {
  // Retrieve the last applied image from local storage
  var lastBackgroundImage = localStorage.getItem('lastBackgroundImage');

  if (lastBackgroundImage) {
    setBackgroundAndTextColor(lastBackgroundImage);
  } else {
    setBackgroundAndTextColor(backgroundImages[currentIndex]);
  }
}

// Call the function to initialize the background image on page load
initializeBackground();

// Start the animation loop
setTimeout(function () {
  requestAnimationFrame(changeBackground);
}, intervalDuration);

// Add event listener to open the "Add or Remove BG" window
document.getElementById("bg-button").addEventListener("click", function () {
  document.getElementById("add-remove-bg-window").style.display = "block";
});

// Add event listener to close the window
document.getElementById("close-window-button").addEventListener("click", function () {
  document.getElementById("add-remove-bg-window").style.display = "none";
});

// Add event listener to "Add BG" button
document.getElementById("add-bg-button").addEventListener("click", function () {
  var fileInput = document.getElementById("fileInput");
  fileInput.click();
  
  fileInput.addEventListener("change", function () {
    var selectedFile = fileInput.files[0];
    if (selectedFile) {
      var reader = new FileReader();
      
      reader.onload = function (e) {
        var imageSrc = e.target.result;
        // Implement code to save the image source and display it as a background
        // You can use localStorage to store the image sources
        // Display the grabbed images in the grid similar to YouTube's homepage
      };
      
      reader.readAsDataURL(selectedFile);
    }
  });
});

// Add event listener to "Remove BG" button
document.getElementById("remove-bg-button").addEventListener("click", function () {
  var imageGrid = document.getElementById("image-grid");
  imageGrid.innerHTML = ""; // Clear the grid
  
  // Display checkboxes and images for each background image
  for (var i = 0; i < backgroundImages.length; i++) {
    var imageContainer = document.createElement("div");
    imageContainer.className = "image-container";
    
    var checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bg-checkbox";
    checkbox.value = i; // Set the value to identify the image
    
    var image = document.createElement("img");
    image.src = backgroundImages[i]; // Get the image path from your array
    image.className = "bg-image";
    
    imageContainer.appendChild(checkbox);
    imageContainer.appendChild(image);
    imageGrid.appendChild(imageContainer);
  }
  
  // Show the "Delete BGs" button
  document.getElementById("delete-bgs-button").style.display = "block";
});

// Add event listener to "Delete BGs" button
document.getElementById("delete-bgs-button").addEventListener("click", function () {
  var selectedCheckboxes = document.querySelectorAll(".bg-checkbox:checked");
  
  if (selectedCheckboxes.length > 0) {
    // Show a confirmation dialog
    var confirmed = confirm("Are you sure you want to remove the selected backgrounds? This action cannot be undone.");
    
    if (confirmed) {
      // Implement code to delete selected background images
      var selectedIndexes = Array.from(selectedCheckboxes).map(function (checkbox) {
        return parseInt(checkbox.value);
      });
      
      // Remove the selected images from the backgroundImages array
      for (var i = selectedIndexes.length - 1; i >= 0; i--) {
        backgroundImages.splice(selectedIndexes[i], 1);
      }
      
      // Update the display of background images (clear and re-display)
      var imageGrid = document.getElementById("image-grid");
      imageGrid.innerHTML = "";
      // ... code to display the images again (similar to the "Remove BG" button logic)
    }
  }
});

const addRemoveBgWindow = document.getElementById('add-remove-bg-window');
  const bgButton = document.getElementById('bg-button');
  const closeWindowButton = document.getElementById('close-window-button');

  bgButton.addEventListener('click', () => {
    addRemoveBgWindow.style.display = 'block'; // Show the window
  });

  closeWindowButton.addEventListener('click', () => {
    addRemoveBgWindow.style.display = 'none'; // Hide the window
  });

// You'll need to adjust and complete these functions based on your existing code and structure

const imageGrid = document.querySelector('.image-grid');

bgButton.addEventListener('click', () => {
  addRemoveBgWindow.style.display = 'block'; // Show the window
  displayStoredImages(); // Display stored images
});

closeWindowButton.addEventListener('click', () => {
  addRemoveBgWindow.style.display = 'none'; // Hide the window
});

function displayStoredImages() {
  imageGrid.innerHTML = ''; // Clear existing images
  const storedImages = JSON.parse(localStorage.getItem('backgroundImages')) || [];

  storedImages.forEach((imageBase64, index) => {
    const imageContainer = document.createElement('div');
    imageContainer.classList.add('image-container');

    const image = document.createElement('img');
    image.src = imageBase64; // Set the base64 string as the image source
    image.alt = 'Background Image ' + (index + 1);
    image.classList.add('bg-image');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add('image-checkbox');

    imageContainer.appendChild(image);
    imageContainer.appendChild(checkbox);
    imageGrid.appendChild(imageContainer);
  });
}

