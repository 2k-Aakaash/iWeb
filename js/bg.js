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

  // localStorage.setItem('lastBackgroundImage', imagePath);

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

