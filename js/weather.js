document.addEventListener('DOMContentLoaded', function() {
  document.querySelector('.get-weather').addEventListener('click', getWeather);
})

function getWeather() {
  var location = document.getElementById('locationInput').value;
  var url = `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=bc3896442fb1b6f7c4efe516c9a3d57f&units=metric`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      displayWeather(data);
    })
    .catch(error => {
      console.log('Error:', error);
    });
}

function displayWeather(data) {
  var weatherInfo = document.getElementById('weatherInfo');
  var temperature = Math.round(data.main.temp);
  var location = data.name;
  var fullWeatherInfo = `
    <div class="expanded-weather">
      <div>
      <h2 id="clock">Weather in ${location}</h2>
      <p>Temperature: ${temperature}°C</p>
      <p>Humidity: ${data.main.humidity}%</p>
      <p>Description: ${data.weather[0].description}</p>
      </div>
    </div>
  `;

  const locationInput = document.getElementById('locationInput');

// Trigger getWeather function on enter key press
locationInput.addEventListener('keyup', function(event) {
  if (event.key === 'Enter') {
    event.preventDefault(); // Prevent form submission
    getWeather();
  }
});

var expandButton = document.createElement('button');
expandButton.textContent = '>';
expandButton.classList.add('expand-button'); // Add the expand-button class
expandButton.addEventListener('click', function() {
  weatherInfo.innerHTML = fullWeatherInfo;
  addCollapseButton();
});

function addCollapseButton() {
  var collapseButton = document.createElement('button');
  collapseButton.textContent = '<';
  collapseButton.classList.add('collapse-button'); // Add the collapse-button class
  collapseButton.addEventListener('click', function() {
    displayMinimalWeather();
  });
  if (weatherInfo.contains(expandButton)) {
    weatherInfo.removeChild(expandButton);
  }

  weatherInfo.appendChild(collapseButton);
}
  function displayMinimalWeather() {
    weatherInfo.innerHTML = `
      <div class="mini-weather">
        <p class="mini-location">${location}: ${temperature}°C</p>
      </div>
    `;
    weatherInfo.appendChild(expandButton);
  }

  // Display minimal weather information
  displayMinimalWeather();
}