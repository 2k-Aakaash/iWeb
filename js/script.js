document.addEventListener('DOMContentLoaded', function() {
  loadBookmarks();
});

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
    
      // // Special handling for specific TLDs
      // const specialTLDs = ["org", "tu", "edu", "gov", "net", "mil", "int", "io", "co", "ai", "uk", "ca", "dev", "me", "de", "app", "in", "eu", "gg", "to", "ph", "nl", "id", "inc", "website", "xyz", "club", "online", "info", "store", "best", "live", "tv", "us", "tech", "pw", "pro", "cx", "mx", "fm", "cc", "world", "space", "vip", "life", "shop", "host", "fun", "biz", "icu", "design", "art"];
      // const parsedTLD = bookmarkInput.split('.').pop(); // Get the last part after the last dot
      // if (specialTLDs.includes(parsedTLD)) {
      //   bookmarkInput = bookmarkInput.slice(0, -4); // Remove the ".com" from the end
      // }

      // Special handling for specific domains
      const specialDomains = ["mail.google.com", "drive.google.com", "chat.openai.com", "photos.google.com", "web.whatsapp.com"];
      const parsedDomain = getWebsiteName(bookmarkInput);
      if (specialDomains.includes(parsedDomain)) {
        bookmarkInput = "https://" + parsedDomain;
    }

  var websiteName = getWebsiteName(bookmarkInput);
  var newBookmark = document.createElement('a');
  newBookmark.href = bookmarkInput;
  newBookmark.textContent = websiteName;
  newBookmark.target = '_blank';

  var newFavicon = document.createElement('img');
  newFavicon.src = 'https://s2.googleusercontent.com/s2/favicons?domain=' + bookmarkInput;
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
}

document.getElementById('bookmark-input').addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault(); // Prevent the default behavior of the Enter key
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
    newBookmark.textContent = bookmarkData.websiteName;
    newBookmark.target = '_blank';

    newBookmarkContainer.appendChild(newFavicon);
    newBookmarkContainer.appendChild(newBookmark);

    linksTextContainer.appendChild(newBookmarkContainer);
  }
}

// document.addEventListener('DOMContentLoaded', function() {
//   loadBookmarks();
// });

function closeLinksBox() {
  const linksBox = document.getElementById("box");
  linksBox.style.display = "none";
}

function closeCustomizationBox() {
  const customizationBox = document.getElementById("font-box-container");
  customizationBox.classList.add("hidden");
}


document.addEventListener("click", function(event) {
  const linksBox = document.getElementById("box");
  const linksButton = document.querySelector(".link-button");
  if (linksBox && !linksBox.contains(event.target) && !linksButton.contains(event.target)) {
    closeLinksBox();
  }

  const customizationBox = document.getElementById("font-box-container");
  const customizationButton = document.getElementById("customization-button");
  if (customizationBox && !customizationBox.contains(event.target) && !customizationButton.contains(event.target)) {
    closeCustomizationBox();
  }

  const notesBox = document.getElementById("note-modal");
  const notesButton = document.getElementById("add-note-btn");
  if (notesBox && !notesBox.contains(event.target) && !notesButton.contains(event.target)) {
    closeNotesBox();
  }
});


function closeNotesBox() {
  const notesBox = document.getElementById("note-modal");
  notesBox.style.display = "none";
}

let deleteMode = false;

function toggleDeleteMode() {
  deleteMode = !deleteMode;
  const bookmarks = document.querySelectorAll('.bookmark-container');

  for (const bookmark of bookmarks) {
    let checkbox = bookmark.querySelector('input[type="checkbox"]');
    
    if (deleteMode && !checkbox) {
      checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      // console.log(bookmarks)
      checkbox.setAttribute("id",bookmark?.outerText)

      bookmark.insertBefore(checkbox, bookmark.firstChild);
    } else if (!deleteMode && checkbox) {
      checkbox.remove();
    }
    bookmark.classList.toggle('delete-mode', deleteMode);
  }

  const confirmDeleteButton = document.getElementById('confirm-delete-button');
  confirmDeleteButton.style.display = deleteMode ? 'block' : 'none';
}


function confirmDelete() {
  const checkboxes = document.querySelectorAll('.bookmark-container input[type="checkbox"]');
  const selectedBookmarks = Array.from(checkboxes).filter(checkbox => checkbox.checked);

  if (selectedBookmarks.length === 0) {
    alert('No bookmarks selected.');
    return;
  }

  const isSingular = selectedBookmarks.length === 1;
  const confirmationMessage = isSingular
    ? 'Are you sure you want to delete the selected link? This action cannot be undone.'
    : 'Are you sure you want to delete the selected links? This action cannot be undone.';

  const confirmationDialog = createConfirmationDialog(confirmationMessage, () => {
    const bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
    // const updatedBookmarks = bookmarks.filter(bookmark =>{
    //   !selectedBookmarks.some(checkbox => checkbox.closest('.bookmark-container').querySelector('a').href === bookmark.url)
    // });

    let ids = selectedBookmarks.map((book) => book.id)
  
    const updatedData = bookmarks.filter(data=>{
      if(!ids.includes(data?.websiteName)){
        return data
      }  
    }) 

    localStorage.setItem('bookmarks', JSON.stringify(updatedData));
    
    selectedBookmarks.forEach(checkbox => {
      const bookmarkContainer = checkbox.closest('.bookmark-container');
      bookmarkContainer.remove();
    });

    toggleDeleteMode();
    confirmationDialog.remove();
  });
  document.body.appendChild(confirmationDialog);
}

function createConfirmationDialog(message, onConfirm) {
  const confirmationDialog = document.createElement('div');
  confirmationDialog.className = 'confirmation-dialog';

  const confirmationText = document.createElement('p');
  confirmationText.textContent = message;
  confirmationDialog.appendChild(confirmationText);

  const confirmButton = document.createElement('button');
  confirmButton.textContent = 'Delete';
  confirmButton.className = 'delete-button';
  confirmButton.addEventListener('click', onConfirm);
  confirmationDialog.appendChild(confirmButton);

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'cancel-button'
  cancelButton.addEventListener('click', () => {
    confirmationDialog.remove();
  });
  confirmationDialog.appendChild(cancelButton);

  return confirmationDialog;
}

function removeBookmarkFromLocalStorage(checkbox) {
  const bookmarks = JSON.parse(localStorage.getItem('bookmarks')) || [];
  const websiteName = checkbox.nextElementSibling.textContent;
  const updatedBookmarks = bookmarks.filter(bookmark => bookmark.websiteName !== websiteName);

  localStorage.setItem('bookmarks', JSON.stringify(updatedBookmarks));
}

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

  //  // Add the "=" symbol to the left of the dragged bookmark
  //  const equalsSymbol = document.createElement('span');
  //  equalsSymbol.textContent = '=';
  //  equalsSymbol.className = 'equals-symbol';
  //  draggedBookmark.insertBefore(equalsSymbol, draggedBookmark.firstChild);
}

function handleDragEnd(event) {
  if (!event.target.classList.contains('bookmark-container')) return;
  event.target.style.transform = '';
  event.target.classList.remove('dragged');
  draggedBookmark = null;

  updateBookmarkOrder();
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