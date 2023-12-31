document.addEventListener('DOMContentLoaded', function () {
  const addNoteButton = document.getElementById('add-note-btn');
  const saveNoteButton = document.getElementById('save-note-btn');
  const deleteNoteButton = document.getElementById('delete-note-btn');
  const editNoteButton = document.getElementById('edit-note-btn');

  // Open the note modal
  addNoteButton.addEventListener('click', openNoteModal);

  // Close the note modal
  document.querySelector('.close-notes').addEventListener('click', closeNoteModal);
  document.addEventListener('keydown', function (event) {
    // Check if the 'Esc' key is pressed
    if (event.key === 'Escape') {
      closeNoteModal();
    }
  });

  // Save the note to local storage
  saveNoteButton.addEventListener('click', saveNote);
  document.getElementById('note-textarea').addEventListener('keydown', function (event) {
    // Check if the Ctrl key is pressed along with the 'S' key
    if (event.ctrlKey && event.key === 's') {
      event.preventDefault();
      saveNote();
    }
  });

  // Delete the selected notes
  deleteNoteButton.addEventListener('click', deleteSelectedNotes);
  document.addEventListener('keydown', function (event) {
    // Check if the 'Delete' key is pressed
    if (event.key === 'Delete') {
      deleteSelectedNotes();
    }
  });

  // Edit the selected note
  editNoteButton.addEventListener('click', editSelectedNote);

  // Display the notes
  displayNotes();

  // Add an event listener to the document to capture key presses
  document.addEventListener('click', function (event) {
    const notesBox = document.getElementById('note-modal');
    const notesButton = document.getElementById('add-note-btn');

    if (event && event.target) {
      if (!notesBox.contains(event.target) && !notesButton.contains(event.target)) {
        closeNoteModal();
      }
    }
  });
});

function openNoteModal() {
  document.getElementById('note-modal').style.display = 'block';
}

function closeNoteModal() {
  document.getElementById('note-modal').style.display = 'none';
}

function saveNote() {
  const noteText = document.getElementById('note-textarea').value.trim();
  if (noteText !== '') {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.push(noteText);
    localStorage.setItem('notes', JSON.stringify(notes));
    displayNotes();
    document.getElementById('note-textarea').value = '';
    closeNoteModal();
  }
}

function deleteSelectedNotes() {
  const checkboxes = document.getElementsByClassName('checkbox');
  const selectedNotes = Array.from(checkboxes).reduce((acc, checkbox, index) => {
    if (checkbox.checked) {
      acc.push(index);
    }
    return acc;
  }, []);

  if (selectedNotes.length > 0) {
    showConfirmationDialog(selectedNotes);
  }
}

function editSelectedNote() {
  const checkboxes = document.getElementsByClassName('checkbox');
  let selectedNoteIndex = -1;
  for (let i = 0; i < checkboxes.length; i++) {
    if (checkboxes[i].checked) {
      selectedNoteIndex = i;
      break;
    }
  }

  if (selectedNoteIndex !== -1) {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    if (notes && selectedNoteIndex < notes.length) {
      const selectedNote = notes[selectedNoteIndex];
      document.getElementById('note-textarea').value = selectedNote;
      notes.splice(selectedNoteIndex, 1);
      localStorage.setItem('notes', JSON.stringify(notes));
      displayNotes();
    }
  }
}

function displayNotes() {
  const notesContainer = document.getElementById('notes-container');
  notesContainer.innerHTML = '';

  const notes = JSON.parse(localStorage.getItem('notes') || '[]');
  for (let i = 0; i < notes.length; i++) {
    const noteDiv = createNoteElement(i, notes[i]);
    notesContainer.appendChild(noteDiv);
  }
}

function createNoteElement(index, noteText) {
  const noteDiv = document.createElement('div');
  noteDiv.className = 'note';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'checkbox';
  noteDiv.appendChild(checkbox);

  const noteTextElement = document.createElement('span');
  noteTextElement.textContent = noteText;
  noteTextElement.className = 'note-content';
  noteDiv.appendChild(noteTextElement);

  return noteDiv;
}

function showConfirmationDialog(selectedNotes) {
  const confirmationDialog = document.createElement('div');
  confirmationDialog.className = 'confirmation-dialog';

  const confirmationText = document.createElement('p');
  confirmationText.textContent =
    'Are you sure you want to delete the selected notes? This action cannot be undone.';
  confirmationDialog.appendChild(confirmationText);

  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Delete';
  deleteButton.className = 'delete-button';
  deleteButton.addEventListener('click', function () {
    const notes = JSON.parse(localStorage.getItem('notes'));
    selectedNotes.sort((a, b) => b - a);
    for (let i = 0; i < selectedNotes.length; i++) {
      const noteIndex = selectedNotes[i];
      if (noteIndex < notes.length) {
        notes.splice(noteIndex, 1);
      }
    }
    localStorage.setItem('notes', JSON.stringify(notes));
    displayNotes();
    confirmationDialog.remove();
  });
  confirmationDialog.appendChild(deleteButton);

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.className = 'cancel-button';
  cancelButton.addEventListener('click', function () {
    confirmationDialog.remove();
  });
  confirmationDialog.appendChild(cancelButton);

  document.body.appendChild(confirmationDialog);
}