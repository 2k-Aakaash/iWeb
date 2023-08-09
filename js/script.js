document.addEventListener('DOMContentLoaded', function() {
  loadBookmarks();
});

function addBookmark() {
  var bookmarkInput = document.getElementById('bookmark-input').value;
  var urlPattern = /^(ftp|http|https):\/\/[^ "]+$/;
  if (!urlPattern.test(bookmarkInput)) {
    alert('Please enter a valid URL.');
    return;
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
    websiteName: websiteName
  };
  saveBookmarkToLocalStorage(bookmarkData);

  document.getElementById('bookmark-input').value = '';
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
  confirmButton.addEventListener('click', onConfirm);
  confirmationDialog.appendChild(confirmButton);

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
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


