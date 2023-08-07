document.addEventListener('DOMContentLoaded', function() {
  loadBookmarks();
});

// Link Element to Add Bookmarks on the Page
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

  //Loading of Favicon from Google User content
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

//Shorten the Website name
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
document.addEventListener('DOMContentLoaded', function() {
  loadBookmarks();
});

function closeLinksBox() {
  // Code to close the links box
  const linksBox = document.getElementById("box");
  linksBox.style.display = "none";
}

function closeCustomizationBox() {
  // Code to close the customization box
  const customizationBox = document.getElementById("font-box-container");
  customizationBox.classList.add("hidden");
}

function closeNotesBox() {
  // Code to close the notes box
  const notesBox = document.getElementById("note-modal");
  notesBox.style.display = "none";
}

document.addEventListener("click", function(event) {
  // Check if the click target is inside the links box or its button
  const linksBox = document.getElementById("box");
  const linksButton = document.querySelector(".link-button");
  if (linksBox && !linksBox.contains(event.target) && !linksButton.contains(event.target)) {
    closeLinksBox();
  }

  // Check if the click target is inside the customization box or its button
  const customizationBox = document.getElementById("font-box-container");
  const customizationButton = document.getElementById("customization-button");
  if (customizationBox && !customizationBox.contains(event.target) && !customizationButton.contains(event.target)) {
    closeCustomizationBox();
  }

  // Check if the click target is inside the notes box or its button
  const notesBox = document.getElementById("note-modal");
  const notesButton = document.getElementById("add-note-btn");
  if (notesBox && !notesBox.contains(event.target) && !notesButton.contains(event.target)) {
    closeNotesBox();
  }
});