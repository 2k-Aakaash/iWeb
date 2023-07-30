  function updateClock() {
    // Get the current date and time
    const now = new Date();
  
    // Get the date in American format (MM/DD/YYYY)
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const dateFormatted = `${month}/${day}/${year}`;
  
    // Get the day of the week (e.g., "Sunday", "Monday", etc.)
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = days[now.getDay()];
  
    // Update the date and day elements in the HTML
    document.getElementById('currentDate').textContent = dateFormatted;
    document.getElementById('currentDay').textContent = dayOfWeek;
  }
  // Initial update to show the current date and day immediately
  updateClock();