document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('linksButton').addEventListener('click', showBox);
  document.getElementById('delete-links-button').addEventListener('click', toggleDeleteMode);
  document.getElementById('confirm-delete-button').addEventListener('click', confirmDelete);
  document.getElementById('addBookmarkButton').addEventListener('click', addBookmark);
  loadBookmarks();
  loadFavoriteLinks();
});

function showBox() {
  var box = document.getElementById('box');
  box.style.display = (box.style.display === 'none' || box.style.display === '') ? 'block' : 'none';
}


function addBookmark() {
  var bookmarkInput = document.getElementById('bookmark-input').value.trim();
  
  if (!bookmarkInput) {
    alert('Please enter a valid URL.');
    return; // Exit the function if no URL is entered
  }

    // Check if the input starts with http://, https://, or www.
    if (!/^((ftp|http|https):\/\/|www\.)[^ "]+$/.test(bookmarkInput)) {
      // If no extension, add ".com" to the end
      bookmarkInput = "https://www." + bookmarkInput + ".com";
    }
 
    // Check if the input ends with a dot and doesn't have a valid extension
    if (/^(.*\.)?[a-z0-9-]+\.[a-z]+(\.[a-z]+)?$/i.test(bookmarkInput) && !/\.[a-z]+$/.test(bookmarkInput)) {
      bookmarkInput += ".com";
    }

      // Special handling for specific domains
      const specialDomains = ["mail.google.com", "drive.google.com", "chat.openai.com", "photos.google.com", "web.whatsapp.com"];
      const parsedDomain = getWebsiteName(bookmarkInput);
      if (specialDomains.includes(parsedDomain)) {
        bookmarkInput = "https://" + parsedDomain;
    }

  var websiteName = capitalizeWords(getWebsiteName(bookmarkInput));
  var newBookmark = document.createElement('a');
  newBookmark.href = bookmarkInput;
  newBookmark.textContent = websiteName;
  newBookmark.target = '_blank';

  var newFavicon = document.createElement('img');
  newFavicon.src = 'https://s2.googleusercontent.com/s2/favicons?domain=' + bookmarkInput + '&sz=128';
  newFavicon.alt = 'Favicon';

  var newBookmarkContainer = document.createElement('div');
  newBookmarkContainer.appendChild(newFavicon);
  newBookmarkContainer.appendChild(newBookmark);
  newBookmarkContainer.classList.add('bookmark-container');

  var box = document.getElementById('box');
  box.appendChild(newBookmarkContainer);
  var bookmarkData = {
    url: bookmarkInput,
    favicon: newFavicon.src,
    websiteName: websiteName,
    order: getLatestOrder() // Get the latest order for the new bookmark
  };
  saveBookmarkToLocalStorage(bookmarkData);

  document.getElementById('bookmark-input').value = '';

  // Add to favorite links bar
  addBookmarkToFavoriteBar(bookmarkData);
}


function addBookmarkToFavoriteBar(bookmarkData) {
  var favoriteBar = document.getElementById('favorite-links-bar');
  var favoriteLink = document.createElement('a');
  favoriteLink.href = bookmarkData.url;
  favoriteLink.className = 'favorite-link';
  favoriteLink.target = '_blank';

  var favoriteFavicon = document.createElement('img');
  favoriteFavicon.src = bookmarkData.favicon;
  favoriteFavicon.alt = 'Favicon';

  var favoriteName = document.createElement('div');
  favoriteName.textContent = bookmarkData.websiteName;

  favoriteLink.appendChild(favoriteFavicon);
  favoriteLink.appendChild(favoriteName);
  favoriteBar.appendChild(favoriteLink);
}

document.getElementById('bookmark-input').addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    addBookmark();
  }
});

// Get the latest order by finding the highest order value among existing bookmarks
function getLatestOrder() {
  const bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
  const orders = bookmarks.map(bookmark => bookmark.order || 0);
  return Math.max(...orders) + 1;
}

function getWebsiteName(url) {
  var parser = new URL(url);
  var websiteName = parser.hostname;
  return websiteName.replace(/^www\.|\.com$/g, '');
}

function capitalizeWords(str) {
  return str.replace(/\b\w/g, function(char) {
    return char.toUpperCase();
  });
}

function saveBookmarkToLocalStorage(bookmarkData) {
  var bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
  bookmarks.push(bookmarkData);
  localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
}

function loadBookmarks() {
  var bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
  var linksTextContainer = document.querySelector('.links-text-container');
  linksTextContainer.innerHTML = '';

  for (var i = 0; i < bookmarks.length; i++) {
    var bookmarkData = bookmarks[i];
    var newBookmarkContainer = document.createElement('div');
    newBookmarkContainer.classList.add('bookmark-container');

    var newFavicon = document.createElement('img');
    newFavicon.src = bookmarkData.favicon;
    newFavicon.alt = 'Favicon';

    var newBookmark = document.createElement('a');
    newBookmark.href = bookmarkData.url;
    newBookmark.textContent = capitalizeWords(bookmarkData.websiteName);
    newBookmark.target = '_blank';

    newBookmarkContainer.appendChild(newFavicon);
    newBookmarkContainer.appendChild(newBookmark);

    linksTextContainer.appendChild(newBookmarkContainer);
  }
}

function loadFavoriteLinks() {
  var bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
  var favoriteBar = document.getElementById('favorite-links-bar');
  favoriteBar.innerHTML = '';

  bookmarks.forEach(bookmark => {
    addBookmarkToFavoriteBar(bookmark);
  });
}

function closeLinksBox() {
  const linksBox = document.getElementById("box");
  linksBox.style.display = "none";
}

// Add this function to open the website when the bookmark container is clicked
function openWebsite(url) {
  window.open(url, '_blank');
}

function attachClickEventListenersToBookmarks() {
  const bookmarkContainers = document.querySelectorAll('.bookmark-container');
  bookmarkContainers.forEach((container) => {
    container.addEventListener('click', () => {
      const url = container.querySelector('a').href; // Extract the URL
      openWebsite(url); // Open the website in a new tab/window
    });
  });
}

// Call the function to attach click event listeners when the page loads
document.addEventListener('DOMContentLoaded', () => {
  loadBookmarks();
  attachClickEventListenersToBookmarks(); // Attach click event listeners to existing bookmarks
});


document.addEventListener("click", function(event) {
  const linksBox = document.getElementById("box");
  const linksButton = document.getElementById("linksButton");
  if (linksBox && !linksBox.contains(event.target) && !linksButton.contains(event.target)) {
    closeLinksBox();
  }

  const customizationBox = document.getElementById("font-box-container");
  const customizationButton = document.getElementById("customization-button");
  if (customizationBox && !customizationBox.contains(event.target) && !customizationButton.contains(event.target)) {
    closeCustomizationBox();
  }
});

// Add this function to add the equals symbol to each link
function addEqualsSymbolToLinks() {
  const bookmarks = document.querySelectorAll('.bookmark-container');

  for (const bookmark of bookmarks) {
    const equalsSymbol = document.createElement('span');
    equalsSymbol.textContent = '=';
    equalsSymbol.className = 'equals-symbol';
    bookmark.insertBefore(equalsSymbol, bookmark.firstChild);
  }
}

let equalsSymbolAdded = false; // Add this variable to keep track of whether equals symbols are added
let dragAndDropActive = false; // Add this variable to track the active state of drag and drop

document.getElementById('drag-n-drop-button').addEventListener('click', function() {
  if (!equalsSymbolAdded && !dragAndDropActive) {
    addEqualsSymbolToLinks(); // Call the function to add equals symbols
    equalsSymbolAdded = true; // Mark equals symbols as added
    dragAndDropActive = true; // Mark drag and drop as active
  } else if (equalsSymbolAdded && dragAndDropActive) {
    removeEqualsSymbolFromLinks(); // Call the function to remove equals symbols
    removeDragAndDropListeners(); // Call the function to remove drag and drop event listeners
    removeDraggableAttribute(); // Call the function to remove draggable attribute
    equalsSymbolAdded = false; // Mark equals symbols as removed
    dragAndDropActive = false; // Mark drag and drop as inactive
    return; // Exit the function to stop further processing
  }
  
  const bookmarks = document.querySelectorAll('.bookmark-container');
  for (const bookmark of bookmarks) {
    if (dragAndDropActive) {
      bookmark.setAttribute('draggable', 'true'); // Enable drag and drop
      bookmark.addEventListener('dragstart', handleDragStart);
      bookmark.addEventListener('dragend', handleDragEnd);
    } else {
      bookmark.removeAttribute('draggable'); // Remove draggable attribute
      bookmark.removeEventListener('dragstart', handleDragStart);
      bookmark.removeEventListener('dragend', handleDragEnd);
    }
  }
});

// Add this function to remove the draggable attribute
function removeDraggableAttribute() {
  const bookmarks = document.querySelectorAll('.bookmark-container');
  for (const bookmark of bookmarks) {
    bookmark.removeAttribute('draggable');
  }
}

// Add this function to remove the equals symbols
function removeEqualsSymbolFromLinks() {
  const equalsSymbols = document.querySelectorAll('.equals-symbol');
  for (const equalsSymbol of equalsSymbols) {
    equalsSymbol.remove();
  }
}

// Add this function to remove the drag and drop event listeners
function removeDragAndDropListeners() {
  const bookmarks = document.querySelectorAll('.bookmark-container');
  for (const bookmark of bookmarks) {
    bookmark.removeEventListener('dragstart', handleDragStart);
    bookmark.removeEventListener('dragend', handleDragEnd);
  }
}

// Add this event listener to the links text container to handle drag over
document.querySelector('.links-text-container').addEventListener('dragover', handleDragOver);
  
function handleDragOver(event) {
  event.preventDefault();
  const targetBookmark = event.target.closest('.bookmark-container');
  if (targetBookmark && targetBookmark !== draggedBookmark) {
    const targetIndex = Array.from(targetBookmark.parentNode.children).indexOf(targetBookmark);
    const draggedIndex = Array.from(draggedBookmark.parentNode.children).indexOf(draggedBookmark);
    if (targetIndex < draggedIndex) {
      targetBookmark.parentNode.insertBefore(draggedBookmark, targetBookmark);
    } else {
      targetBookmark.parentNode.insertBefore(draggedBookmark, targetBookmark.nextSibling);
    }
  }
}


// Add this at the top to keep track of drag state
let draggedBookmark = null;

function handleDragStart(event) {
  if (!event.target.classList.contains('bookmark-container')) return;
  draggedBookmark = event.target;
  event.dataTransfer.setData('text/plain', ''); // Necessary for Firefox to allow drag
  event.target.style.transform = 'scale(1.2)';
  event.target.classList.add('dragged'); // Add a class for styling
}

function handleDragEnd(event) {
  if (!event.target.classList.contains('bookmark-container')) return;
  event.target.style.transform = '';
  event.target.classList.remove('dragged');
  draggedBookmark = null;

  updateBookmarkOrder(); // Update the bookmark order after dragging ends
}


function updateBookmarkOrder() {
  const bookmarks = document.querySelectorAll('.bookmark-container');
  const updatedOrder = Array.from(bookmarks).map(bookmark => bookmark.querySelector('a').textContent);

  const storedBookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
  const updatedBookmarks = storedBookmarks.map(bookmark => {
    const newOrder = updatedOrder.indexOf(bookmark.websiteName);
    return { ...bookmark, order: newOrder };
  });

  localStorage.setItem('bookmarks', JSON.stringify(updatedBookmarks));

  // After updating the order, re-render bookmarks
  loadBookmarks();
  attachClickEventListenersToBookmarks(); // Attach click event listeners to existing bookmarks
}

function loadBookmarks() {
  var bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
  var linksTextContainer = document.querySelector('.links-text-container');
  linksTextContainer.innerHTML = '';

  // Sort bookmarks based on order
  bookmarks.sort((a, b) => (a.order || 0) - (b.order || 0));

  for (var i = 0; i < bookmarks.length; i++) {
    var bookmarkData = bookmarks[i];
    var newBookmarkContainer = document.createElement('div');
    newBookmarkContainer.classList.add('bookmark-container');

    var newFavicon = document.createElement('img');
    newFavicon.src = bookmarkData.favicon;
    newFavicon.alt = 'Favicon';

    var newBookmark = document.createElement('a');
    newBookmark.href = bookmarkData.url;
    newBookmark.textContent = bookmarkData.websiteName;
    newBookmark.target = '_blank';

    newBookmarkContainer.appendChild(newFavicon);
    newBookmarkContainer.appendChild(newBookmark);

    linksTextContainer.appendChild(newBookmarkContainer);
  }
}

function toggleDeleteMode() {
  var deleteMode = document.body.classList.toggle('delete-mode');
  var deleteButtons = document.querySelectorAll('.delete-button');
  deleteButtons.forEach(button => button.style.display = deleteMode ? 'block' : 'none');
}

function confirmDelete() {
  if (!confirm('Are you sure you want to delete the selected bookmarks?')) return;

  var bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
  var selectedBookmarks = document.querySelectorAll('.bookmark-container input[type="checkbox"]:checked');
  var urlsToDelete = Array.from(selectedBookmarks).map(input => input.dataset.url);

  bookmarks = bookmarks.filter(bookmark => !urlsToDelete.includes(bookmark.url));
  localStorage.setItem('bookmarks', JSON.stringify(bookmarks));

  loadBookmarks();
  loadFavoriteLinks();
}

function attachDeleteButtons() {
  var bookmarkContainers = document.querySelectorAll('.bookmark-container');
  bookmarkContainers.forEach(container => {
    var deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.classList.add('delete-button');
    deleteButton.style.display = 'none';

    var checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.url = container.querySelector('a').href;

    container.appendChild(checkbox);
    container.appendChild(deleteButton);
    deleteButton.addEventListener('click', function() {
      var bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
      bookmarks = bookmarks.filter(bookmark => bookmark.url !== checkbox.dataset.url);
      localStorage.setItem('bookmarks', JSON.stringify(bookmarks));

      loadBookmarks();
      loadFavoriteLinks();
    });
  });
}


document.addEventListener('DOMContentLoaded', function() {
  var container = document.getElementById('favorite-links-container');
  var bar = document.getElementById('favorite-links-bar');
  var isMouseDown = false;
  var startX;
  var scrollLeft;

  container.addEventListener('mousedown', function(e) {
    isMouseDown = true;
    startX = e.pageX - container.offsetLeft;
    scrollLeft = container.scrollLeft;
    container.style.cursor = 'grabbing'; /* Cursor changes to grabbing on click */
  });

  container.addEventListener('mouseup', function(e) {
    isMouseDown = false;
    container.style.cursor = 'grab'; /* Cursor changes back to grab on release */
  });

  container.addEventListener('mouseleave', function(e) {
    isMouseDown = false;
    container.style.cursor = 'grab'; /* Cursor changes back to grab if mouse leaves container */
  });

  container.addEventListener('mousemove', function(e) {
    if (!isMouseDown) return;
    e.preventDefault();
    var x = e.pageX - container.offsetLeft;
    var walk = (x - startX) * 2; // Adjust the scroll speed
    container.scrollLeft = scrollLeft - walk;
  });
});

const container = document.querySelector('.favorite-links-container');
  let targetScrollLeft = container.scrollLeft;
  let isAnimating = false;

  function smoothScroll() {
    const distance = targetScrollLeft - container.scrollLeft;
    if (Math.abs(distance) < 1) {
      isAnimating = false;
      return;
    }

    container.scrollLeft += distance * 0.2; // easing factor (adjust for smoothness)
    requestAnimationFrame(smoothScroll);
  }

  container.addEventListener('wheel', (e) => {
    e.preventDefault();

    // Update target scroll left based on vertical scroll delta
    targetScrollLeft += e.deltaY;

    // Clamp targetScrollLeft within scroll bounds
    targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, container.scrollWidth - container.clientWidth));

    if (!isAnimating) {
      isAnimating = true;
      requestAnimationFrame(smoothScroll);
    }
  });