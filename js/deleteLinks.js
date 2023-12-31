// Add an event listener for DOMContentLoaded to register your event handlers
document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('delete-links-button').addEventListener('click', toggleDeleteMode);
    document.getElementById('confirm-delete-button').addEventListener('click', confirmDelete);
  });

  
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

