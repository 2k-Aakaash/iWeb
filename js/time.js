// Function to format the time as h:mm AM/PM
function formatTime(date) {
  let hours = date.getHours();
  let minutes = date.getMinutes();
  let period = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12 || 12;
  minutes = minutes < 10 ? `0${minutes}` : minutes;
  
  return `${hours}:${minutes} ${period}`;
  }
  
  // Function to update the clock
  function updateClock() {
  const clockElement = document.getElementById('clock');
  const currentTime = new Date();
  const formattedTime = formatTime(currentTime);
  clockElement.textContent = formattedTime;
  }

  updateClock();

  // Call the updateClock function every minute
  setInterval(updateClock, 1000);