document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('bgButton').addEventListener('click', showFileInput);
})

// Function to show the file input when the "Customization" button is clicked
function showFileInput() {
    var fileInput = document.getElementById('fileInput');
    fileInput.click();
  }
  
  // Function to handle file selection
  function handleFileSelect(event) {
    var file = event.target.files[0];
    if (file) {
      // Check if the selected file is an image (jpg, jpeg, png, or gif)
      if (file.type.match('image/jpeg') || file.type.match('image/png') || file.type.match('image/gif')) {
        var reader = new FileReader();
        reader.onload = function(e) {
          var imageUrl = e.target.result;
          // Add the image URL to the backgroundImages array
          backgroundImages.push(imageUrl);
          // Save the updated array to local storage
          localStorage.setItem('backgroundImages', JSON.stringify(backgroundImages));
          // If this is the first custom image, start the animation loop
          if (backgroundImages.length === 1) {
            requestAnimationFrame(changeBackground);
          }
        };
        reader.readAsDataURL(file);
      } else {
        alert('Invalid file format. Please select an image (jpg, jpeg, png, or gif).');
      }
    }
  }
  
  // Add an event listener to the file input to handle file selection
  document.getElementById('fileInput').addEventListener('change', handleFileSelect, false);
  
  
  const clockText = document.getElementById('clock');
  const fontButton = document.getElementById('fontButton');
  const fontBox = document.getElementById('fontBox');
  const fontOptions = document.querySelectorAll('.font-option');
  
  // Load the last saved font from local storage, if available
  const lastSavedFont = localStorage.getItem('selectedFont');
  if (lastSavedFont) {
    clockText.style.fontFamily = lastSavedFont;
    // Find and highlight the last selected font option
    fontOptions.forEach((option) => {
      if (option.dataset.fontFamily === lastSavedFont) {
        option.classList.add('selected-font');
      }
    });
  }
  
  // Toggle the font box visibility when the button is clicked
  fontButton.addEventListener('click', () => {
    fontBox.style.display = fontBox.style.display === 'block' ? 'none' : 'block';
  });
  
  // Apply the selected font to the clock text when a font option is clicked
  fontOptions.forEach((option) => {
    option.addEventListener('click', () => {
      const fontFamily = option.dataset.fontFamily;
      clockText.style.fontFamily = fontFamily;
  
      // Save the selected font to local storage
      localStorage.setItem('selectedFont', fontFamily);
  
      // Remove the 'selected-font' class from all options
      fontOptions.forEach((el) => el.classList.remove('selected-font'));
  
      // Add the 'selected-font' class to the clicked option
      option.classList.add('selected-font');
  
      fontBox.style.display = 'none'; // Hide the font box after selection
    });
  });
  
  const customNameBtn = document.getElementById('custom-name-btn');
  const inputContainer = document.getElementById('input-container');
  const nameInput = document.getElementById('name-input');
  const customName = document.getElementById('custom-name');
  
  // Retrieve the custom name from local storage (if available) and update the span tag
  const storedName = localStorage.getItem('customName');
  if (storedName) {
      customName.textContent = storedName;
  }
  
  customNameBtn.addEventListener('click', () => {
      inputContainer.classList.toggle('show-input');
      nameInput.focus();
  });
  
  nameInput.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
          const newName = nameInput.value.trim();
          if (newName !== '') {
              customName.textContent = newName;
              localStorage.setItem('customName', newName); // Save the custom name to local storage
          }
          inputContainer.classList.remove('show-input');
      }
  });
  
  // Close the input container when clicking outside the input field
  window.addEventListener('click', (e) => {
      if (e.target !== customNameBtn && e.target !== nameInput) {
          inputContainer.classList.remove('show-input');
      }
  });

    // Function to apply the selected font to the clock
function applyFontToClock(fontUrl) {
  const clockElement = document.getElementById('clock');
  clockElement.style.fontFamily = `url('${fontUrl}')`;
}

// Function to toggle the font container visibility
function toggleFontBox() {
  const fontBoxContainer = document.getElementById('font-box-container');
  fontBoxContainer.classList.toggle('hidden');
}

// Event listener for the customization button
document.getElementById('customization-button').addEventListener('click', toggleFontBox);

// Event listener for selecting a font from the font container
document.querySelectorAll('.font-option').forEach(fontOption => {
  fontOption.addEventListener('click', () => {
    const selectedFont = fontOption.getAttribute('data-font');
    applyFontToClock(selectedFont);
  });
});

fontButton.addEventListener('click', () => {
  fontBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

function closeCustomizationBox() {
  const customizationBox = document.getElementById("font-box-container");
  customizationBox.classList.add("hidden");
}
