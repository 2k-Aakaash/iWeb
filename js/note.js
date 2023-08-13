// Open the note modal
document.getElementById("add-note-btn").addEventListener("click", function() {
  document.getElementById("note-modal").style.display = "block";
  });
  
  // Close the note modal
  document.getElementsByClassName("close")[0].addEventListener("click", function() {
  document.getElementById("note-modal").style.display = "none";
  });
  
  // Save the note to local storage
  document.getElementById("save-note-btn").addEventListener("click", function() {
  var noteText = document.getElementById("note-textarea").value;
  if (noteText.trim() !== "") {
  var notes = JSON.parse(localStorage.getItem("notes") || "[]");
  notes.push(noteText);
  localStorage.setItem("notes", JSON.stringify(notes));
  displayNotes();
  // document.getElementById("note-modal").style.display = "none";
  document.getElementById("note-textarea").value = "";
  }
  });

  // Add an event listener to the note textarea to capture key presses
document.getElementById('note-textarea').addEventListener('keydown', function (event) {
  // Check if the Ctrl key is pressed along with the 'S' key
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault(); // Prevent the default browser save action
    saveNote(); // Call the function to save the note
  }
});

// Function to save the note
function saveNote() {
  var noteText = document.getElementById('note-textarea').value;
  if (noteText.trim() !== '') {
    var notes = JSON.parse(localStorage.getItem('notes') || '[]');
    notes.push(noteText);
    localStorage.setItem('notes', JSON.stringify(notes));
    displayNotes();
    document.getElementById('note-textarea').value = '';
  }
}
  
  // Delete the selected notes
  document.getElementById("delete-note-btn").addEventListener("click", function() {
  var checkboxes = document.getElementsByClassName("checkbox");
  var selectedNotes = [];
  for (var i = 0; i < checkboxes.length; i++) {
  if (checkboxes[i].checked) {
    selectedNotes.push(i);
  }
  }
  if (selectedNotes.length > 0) {
  showConfirmationDialog(selectedNotes);
  }
  });

  // Add an event listener to the document to capture key presses
  document.addEventListener('keydown', function (event) {
  // Check if the 'Delete' key is pressed
  if (event.key === 'Delete') {
    var checkboxes = document.getElementsByClassName('checkbox');
    var selectedNotes = [];
    for (var i = 0; i < checkboxes.length; i++) {
      if (checkboxes[i].checked) {
        selectedNotes.push(i);
      }
    }
    if (selectedNotes.length > 0) {
      showConfirmationDialog(selectedNotes); // Call the function to show the confirmation dialog
    }
  }
});

  
  // Edit the selected note
  document.getElementById("edit-note-btn").addEventListener("click", function() {
  var checkboxes = document.getElementsByClassName("checkbox");
  var selectedNoteIndex = -1;
  for (var i = 0; i < checkboxes.length; i++) {
  if (checkboxes[i].checked) {
    selectedNoteIndex = i;
    break;
  }
  }
  if (selectedNoteIndex !== -1) {
  var notes = JSON.parse(localStorage.getItem("notes"));
  if (notes && selectedNoteIndex < notes.length) {
    var selectedNote = notes[selectedNoteIndex];
    document.getElementById("note-textarea").value = selectedNote;
    notes.splice(selectedNoteIndex, 1);
    localStorage.setItem("notes", JSON.stringify(notes));
    displayNotes();
  }
  }
  });
  
  // Display the notes
  function displayNotes() {
  var notesContainer = document.getElementById("notes-container");
  notesContainer.innerHTML = "";
  
  var notes = JSON.parse(localStorage.getItem("notes") || "[]");
  for (var i = 0; i < notes.length; i++) {
  var noteDiv = document.createElement("div");
  noteDiv.className = "note";
  
  var checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "checkbox";
  noteDiv.appendChild(checkbox);
  
  var noteText = document.createElement("span");
  noteText.textContent = notes[i];
  noteDiv.appendChild(noteText);
  
  notesContainer.appendChild(noteDiv);
  }
  }
  
  // Show the confirmation dialog
  function showConfirmationDialog(selectedNotes) {
  var confirmationDialog = document.createElement("div");
  confirmationDialog.className = "confirmation-dialog";
  
  var confirmationText = document.createElement("p");
  confirmationText.textContent = "Are you sure you want to delete the selected notes? This action cannot be undone.";
  confirmationDialog.appendChild(confirmationText);
  
  var deleteButton = document.createElement("button");
  deleteButton.textContent = "Delete";
  deleteButton.className = "delete-button"; // Add the class here
  deleteButton.addEventListener("click", function() {
  var notes = JSON.parse(localStorage.getItem("notes"));
  selectedNotes.sort(function(a, b) {
    return b - a;
  });
  for (var i = 0; i < selectedNotes.length; i++) {
    var noteIndex = selectedNotes[i];
    if (noteIndex < notes.length) {
      notes.splice(noteIndex, 1);
    }
  }
  localStorage.setItem("notes", JSON.stringify(notes));
  displayNotes();
  confirmationDialog.remove();
  });
  confirmationDialog.appendChild(deleteButton);
  
  var cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";
  cancelButton.className = 'cancel-button';
  cancelButton.addEventListener("click", function() {
  confirmationDialog.remove();
  });
  confirmationDialog.appendChild(cancelButton);
  
  document.body.appendChild(confirmationDialog);
  }
  
  // Initialize the app
  displayNotes();
  
  
  function showBox() {
  var box = document.getElementById('box');
  if (box.style.display === 'none') {
  box.style.display = 'block';
  } else {
  box.style.display = 'none';
  }
  }

// Add an event listener to the document to capture key presses
document.addEventListener('keydown', function (event) {
  // Check if the 'Esc' key is pressed
  if (event.key === 'Escape') {
    closeNotesWindow(); // Call the function to close the notes window
  }
});

// Function to close the notes window
function closeNotesWindow() {
  var notesModal = document.getElementById('note-modal');
  notesModal.style.display = 'none';
}
