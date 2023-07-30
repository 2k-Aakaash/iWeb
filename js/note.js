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
  document.getElementById("note-modal").style.display = "none";
  document.getElementById("note-textarea").value = "";
  }
  });
  
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
    document.getElementById("note-modal").style.display = "none";
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
  cancelButton.textContent = "No";
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