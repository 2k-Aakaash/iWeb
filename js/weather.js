document.addEventListener('DOMContentLoaded', function() {
  // Setup search event listeners
  var getWeatherBtn = document.querySelector('.get-weather');
  if (getWeatherBtn) {
    getWeatherBtn.addEventListener('click', getWeather);
  }

  var locationInput = document.getElementById('locationInput');
  if (locationInput) {
    locationInput.addEventListener('keyup', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        getWeather();
      }
    });
  }

  // Load initial weather
  initWeather();
});

// Format weather symbol codes to user-friendly text
function formatConditionText(symbolCode) {
  if (!symbolCode) return "";
  // Remove day/night suffix
  var cleanCode = symbolCode.replace(/_(day|night|polartwilight)$/, "");
  // Replace underscores with spaces and capitalize words
  var words = cleanCode.split('_');
  for (var i = 0; i < words.length; i++) {
    if (words[i] === "lightsleetshowersandthunder") {
      words[i] = "Light Sleet Showers & Thunder";
    } else if (words[i] === "lightssnowshowersandthunder") {
      words[i] = "Light Snow Showers & Thunder";
    } else {
      words[i] = words[i].charAt(0).toUpperCase() + words[i].slice(1);
    }
  }
  return words.join(' ');
}

// Initialize weather on page load
function initWeather() {
  var cachedLocation = localStorage.getItem('weatherLocation');
  if (cachedLocation) {
    try {
      var loc = JSON.parse(cachedLocation);
      if (loc && loc.lat && loc.lon && loc.name) {
        fetchWeatherData(loc.lat, loc.lon, loc.name);
        return;
      }
    } catch (e) {
      console.error("Error parsing cached weather location:", e);
    }
  }

  // Ask for Geolocation permission
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function(position) {
        var lat = position.coords.latitude;
        var lon = position.coords.longitude;
        // Reverse geocoding to get city name (added email parameter to avoid CORS rate-limit blocks)
        var reverseGeocodeUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&email=admin@iweb-dashboard.local`;
        fetch(reverseGeocodeUrl)
          .then(res => res.json())
          .then(geo => {
            var city = geo.address.city || geo.address.town || geo.address.village || geo.address.suburb || "Current Location";
            fetchWeatherData(lat, lon, city);
          })
          .catch(() => {
            fetchWeatherData(lat, lon, "Current Location");
          });
      },
      function(error) {
        console.log("Geolocation error or denied, falling back to IP geolocation:", error);
        fetchIPLocation();
      }
    );
  } else {
    console.log("Geolocation not supported by browser, falling back to IP geolocation");
    fetchIPLocation();
  }
}

// Fetch location by IP address
function fetchIPLocation() {
  fetch("https://ipapi.co/json/")
    .then(res => res.json())
    .then(data => {
      if (data.latitude && data.longitude) {
        fetchWeatherData(data.latitude, data.longitude, data.city || "Current Location");
      } else {
        // Fallback to New York default
        fetchWeatherData(40.7128, -74.0060, "New York");
      }
    })
    .catch(error => {
      console.error("Error fetching IP location:", error);
      // Fallback to New York default
      fetchWeatherData(40.7128, -74.0060, "New York");
    });
}

// Handle manual search
function getWeather() {
  var locationInput = document.getElementById('locationInput');
  if (!locationInput) return;
  var location = locationInput.value.trim();
  if (!location) {
    alert("Please enter a location name.");
    return;
  }

  // Added email parameter to avoid CORS/rate-limit blocks
  var geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1&email=admin@iweb-dashboard.local`;

  fetch(geocodeUrl)
    .then(response => response.json())
    .then(data => {
      if (data && data.length > 0) {
        var lat = parseFloat(data[0].lat);
        var lon = parseFloat(data[0].lon);
        // Extract simplified city name
        var displayName = data[0].display_name.split(',')[0];
        
        // Save to cache
        localStorage.setItem('weatherLocation', JSON.stringify({ lat: lat, lon: lon, name: displayName }));
        
        fetchWeatherData(lat, lon, displayName);
        locationInput.value = ''; // clear input
      } else {
        alert("Location not found. Please try another search.");
      }
    })
    .catch(error => {
      console.error('Geocoding error:', error);
      alert("Error finding location. Please try again.");
    });
}

// Fetch weather from met.no using coordinates
function fetchWeatherData(lat, lon, locationName) {
  var url = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lon}`;

  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }
      return response.json();
    })
    .then(data => {
      displayWeather(data, locationName);
    })
    .catch(error => {
      console.error('Weather API error:', error);
      var weatherInfo = document.getElementById('weatherInfo');
      if (weatherInfo) {
        weatherInfo.innerHTML = `<p class="weather-error">Failed to fetch weather data.</p>`;
      }
    });
}

// Map Met.no symbol codes to beautiful bottom-to-top weather gradients
function getWeatherGradient(symbol) {
  if (!symbol) return 'linear-gradient(to top, rgba(20, 24, 45, 0.85), rgba(10, 11, 20, 0.9))';
  
  var s = symbol.toLowerCase();
  
  // 1. Check night state (if symbol contains night)
  if (s.endsWith('_night') || s.includes('night')) {
    if (s.includes('thunder')) {
      return 'linear-gradient(to top, rgba(30, 15, 50, 0.85), rgba(12, 6, 22, 0.9))'; // Thunder Night
    } else if (s.includes('rain') || s.includes('shower') || s.includes('sleet') || s.includes('snow')) {
      return 'linear-gradient(to top, rgba(15, 32, 67, 0.85), rgba(7, 15, 33, 0.9))'; // Rainy Night
    } else if (s.includes('cloud') || s.includes('fog') || s.includes('mist') || s.includes('haze') || s.includes('smog')) {
      return 'linear-gradient(to top, rgba(23, 27, 44, 0.85), rgba(11, 13, 21, 0.9))'; // Cloudy/Foggy Night
    }
    return 'linear-gradient(to top, rgba(20, 24, 45, 0.85), rgba(10, 11, 20, 0.9))'; // Clear/Fair Night
  }
  
  // 2. Day state conditions
  if (s.includes('thunder')) {
    // Thunderstorm: Deep majestic purple
    return 'linear-gradient(to top, rgba(74, 30, 112, 0.85), rgba(29, 11, 46, 0.9))';
  }
  
  if (s.includes('sand') || s.includes('dust') || s.includes('ash')) {
    // Sandstorm/dust: Light sandal/sandy beige
    return 'linear-gradient(to top, rgba(160, 130, 90, 0.8), rgba(210, 180, 140, 0.85))';
  }
  
  if (s.includes('fog') || s.includes('mist') || s.includes('haze') || s.includes('smog')) {
    // Mist/Foggy/Smog/Haze: Slate grey/misty blue-grey
    return 'linear-gradient(to top, rgba(90, 103, 120, 0.8), rgba(150, 163, 180, 0.85))';
  }
  
  if (s.includes('rain') || s.includes('shower') || s.includes('sleet') || s.includes('snow') || s.includes('sleetshowers') || s.includes('snowshowers')) {
    // Rainy/Cool/Bad Weather: Cool blues
    return 'linear-gradient(to top, rgba(35, 75, 120, 0.8), rgba(20, 45, 75, 0.85))';
  }
  
  if (s.includes('partlycloudy') || s.includes('fair') || s.includes('cloudy') || s.includes('heavycloudy')) {
    // Partly Cloudy / Partly Sunny: Soft, bright sky blue with gentle cloud tones
    return 'linear-gradient(to top, rgba(60, 120, 195, 0.8), rgba(135, 185, 230, 0.85))';
  }
  
  if (s.includes('clearsky') || s.includes('sun') || s.includes('sunny')) {
    // Very Sunny / Hot: Bright orange/warm gold
    return 'linear-gradient(to top, rgba(211, 84, 0, 0.8), rgba(243, 156, 18, 0.85))';
  }
  
  // Fallback
  return 'linear-gradient(to top, rgba(60, 120, 195, 0.8), rgba(135, 185, 230, 0.85))';
}

// GSAP smooth expand/collapse transition (Apple iOS style)
function toggleWeatherCard() {
  var container = document.querySelector('.weather-container');
  var search = document.querySelector('.weather-search');
  var divider = document.querySelector('.weather-divider');
  var forecast = document.querySelector('.weather-forecast-container');
  
  if (!container || !search || !forecast || !divider) return;

  var locText = container.querySelector('.weather-location');
  var tempText = container.querySelector('.weather-temp');
  var iconImg = container.querySelector('.weather-condition-icon');
  var condText = container.querySelector('.weather-condition-text');
  var hlText = container.querySelector('.weather-hl-temp');
  
  var isExpanded = container.classList.contains('expanded');
  var expandedWidth = window.innerWidth <= 480 ? '100%' : 320;
  
  // Snappy iOS-style spring ease
  var springEase = 'cubic-bezier(0.32, 0.72, 0, 1)';
  
  if (!isExpanded) {
    // ── EXPAND ──────────────────────────────────────────────────────────────
    container.classList.add('expanded');
    
    // Make all hidden elements visible immediately at height 0 so GSAP can measure them
    gsap.set(search, { display: 'flex', height: 0, opacity: 0, overflow: 'hidden' });
    gsap.set(divider, { display: 'block', height: 0, opacity: 0, overflow: 'hidden' });
    gsap.set(forecast, { display: 'flex', height: 0, opacity: 0, overflow: 'hidden' });
    
    var tl = gsap.timeline({ defaults: { ease: springEase } });
    
    // Everything fires at t=0 simultaneously — container, text, icon, search, divider, forecast
    tl
      .to(container, { width: expandedWidth, height: 'auto', padding: 16, duration: 0.38 }, 0)
      .to(locText,   { fontSize: 20, duration: 0.3 }, 0)
      .to(tempText,  { fontSize: 56, duration: 0.3 }, 0)
      .to(iconImg,   { width: 46, height: 46, marginRight: 0, duration: 0.3 }, 0)
      .to(condText,  { fontSize: 14, duration: 0.3 }, 0)
      .to(hlText,    { fontSize: 12, duration: 0.3 }, 0)
      // Search bar fades in with a tiny 30ms delay so it doesn't fight the container width expansion
      .to(search,    { height: 'auto', opacity: 1, duration: 0.32 }, 0.03)
      .to(divider,   { height: 1, opacity: 0.5, duration: 0.25 }, 0.03)
      // Forecast slides in at same time as everything else
      .to(forecast,  { height: 'auto', opacity: 1, duration: 0.35 }, 0.03);

  } else {
    // ── COLLAPSE ─────────────────────────────────────────────────────────────
    container.classList.remove('expanded');
    
    var tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });

    // Collapse everything together, container last
    tl
      .to([search, divider, forecast], {
        height: 0,
        opacity: 0,
        duration: 0.22,
        onComplete: function () {
          gsap.set([search, divider, forecast], { display: 'none' });
        }
      }, 0)
      .to(container, { width: 150, height: 150, padding: 12, duration: 0.28 }, 0)
      .to(locText,   { fontSize: 13, duration: 0.22 }, 0)
      .to(tempText,  { fontSize: 32, duration: 0.22 }, 0)
      .to(iconImg,   { width: 24, height: 24, marginRight: 0, duration: 0.22 }, 0)
      .to(condText,  { fontSize: 11, duration: 0.22 }, 0)
      .to(hlText,    { fontSize: 10, duration: 0.22 }, 0);
  }
}

// Display the weather using the New York mockup layout
function displayWeather(data, locationName) {
  var weatherInfo = document.getElementById('weatherInfo');
  var container = document.querySelector('.weather-container');
  if (!weatherInfo || !container) return;

  // Check if it was previously expanded
  var wasExpanded = container.classList.contains('expanded');
  var expandedWidth = window.innerWidth <= 480 ? '100%' : 320;

  var timeseries = data.properties.timeseries;
  if (!timeseries || timeseries.length === 0) {
    weatherInfo.innerHTML = `<p class="weather-error">No forecast data available.</p>`;
    return;
  }

  // Get current weather details
  var currentInstant = timeseries[0].data.instant.details;
  var currentTemp = Math.round(currentInstant.air_temperature);

  var next1H = timeseries[0].data.next_1_hours;
  var next6H = timeseries[0].data.next_6_hours;
  var currentSymbol = next1H ? next1H.summary.symbol_code : (next6H ? next6H.summary.symbol_code : 'clearsky_day');
  var conditionText = formatConditionText(currentSymbol);
  var iconUrl = `https://cdn.jsdelivr.net/gh/metno/weathericons@master/weather/svg/${currentSymbol}.svg`;

  // Calculate High/Low temperature over the next 24 hours of timeseries
  var temps = [];
  for (var i = 0; i < Math.min(24, timeseries.length); i++) {
    var t = timeseries[i].data.instant.details.air_temperature;
    if (t !== undefined) {
      temps.push(t);
    }
  }
  var highTemp = Math.round(Math.max(...temps));
  var lowTemp = Math.round(Math.min(...temps));

  // Build horizontal forecast items (next 12 hours)
  var forecastItemsHTML = '';
  for (var k = 1; k <= 12 && k < timeseries.length; k++) {
    var item = timeseries[k];
    var date = new Date(item.time);
    var hour = date.getHours();
    var ampm = hour >= 12 ? 'PM' : 'AM';
    var hourNum = hour % 12;
    hourNum = hourNum ? hourNum : 12;
    var timeStr = hourNum + ' ' + ampm;

    var forecastInstant = item.data.instant.details;
    var forecastTemp = Math.round(forecastInstant.air_temperature);
    var forecastNext1H = item.data.next_1_hours;
    var forecastSymbol = forecastNext1H ? forecastNext1H.summary.symbol_code : 'clearsky_day';
    var forecastIconUrl = `https://cdn.jsdelivr.net/gh/metno/weathericons@master/weather/svg/${forecastSymbol}.svg`;

    forecastItemsHTML += `
      <div class="forecast-item">
        <span class="forecast-time">${timeStr}</span>
        <img src="${forecastIconUrl}" alt="weather icon" class="forecast-icon">
        <span class="forecast-temp">${forecastTemp}°</span>
      </div>
    `;
  }

  // Set the dynamic weather gradient background
  container.style.background = getWeatherGradient(currentSymbol);

  // Render main layout (no chevron button anymore, entire card is clickable)
  weatherInfo.innerHTML = `
    <div class="weather-card">
      <div class="weather-info-main">
        <div class="weather-info-left">
          <span class="weather-location">${locationName}</span>
          <span class="weather-temp">${currentTemp}°</span>
        </div>
        <div class="weather-info-right">
          <img src="${iconUrl}" alt="${conditionText}" class="weather-condition-icon">
          <span class="weather-condition-text">${conditionText}</span>
          <span class="weather-hl-temp">H:${highTemp}° L:${lowTemp}°</span>
        </div>
      </div>
      <div class="weather-divider" style="display: ${wasExpanded ? 'block' : 'none'}; opacity: ${wasExpanded ? 1 : 0}; height: ${wasExpanded ? '1px' : '0px'};"></div>
      <div class="weather-forecast-container" style="display: ${wasExpanded ? 'flex' : 'none'}; opacity: ${wasExpanded ? 1 : 0}; height: ${wasExpanded ? 'auto' : '0px'};">
        ${forecastItemsHTML}
      </div>
    </div>
  `;

  // Attach card-level click toggle listener
  container.onclick = function(e) {
    toggleWeatherCard();
  };

  // Prevent click propagation inside search bar so user can search
  var search = document.querySelector('.weather-search');
  if (search) {
    search.onclick = function(e) {
      e.stopPropagation();
    };
  }

  // Prevent click propagation inside forecast container and add mouse wheel scroll translation
  var forecast = weatherInfo.querySelector('.weather-forecast-container');
  if (forecast) {
    forecast.onclick = function(e) {
      e.stopPropagation();
    };
    
    // Translate vertical scroll wheel movements to horizontal scroll
    forecast.addEventListener('wheel', function(e) {
      if (e.deltaY !== 0) {
        e.preventDefault();
        forecast.scrollLeft += e.deltaY;
      }
    });
  }

  // Get text and dimension elements
  var locText = weatherInfo.querySelector('.weather-location');
  var tempText = weatherInfo.querySelector('.weather-temp');
  var iconImg = weatherInfo.querySelector('.weather-condition-icon');
  var condText = weatherInfo.querySelector('.weather-condition-text');
  var hlText = weatherInfo.querySelector('.weather-hl-temp');

  // Restore states
  if (wasExpanded) {
    gsap.set(container, { width: expandedWidth, height: 'auto', padding: 16 });
    if (locText) gsap.set(locText, { fontSize: 20 });
    if (tempText) gsap.set(tempText, { fontSize: 56 });
    if (iconImg) gsap.set(iconImg, { width: 46, height: 46, marginRight: 0 });
    if (condText) gsap.set(condText, { fontSize: 14 });
    if (hlText) gsap.set(hlText, { fontSize: 12 });
  } else {
    gsap.set(container, { width: 150, height: 150, padding: 12 });
    if (locText) gsap.set(locText, { fontSize: 13 });
    if (tempText) gsap.set(tempText, { fontSize: 32 });
    if (iconImg) gsap.set(iconImg, { width: 24, height: 24, marginRight: 0 });
    if (condText) gsap.set(condText, { fontSize: 11 });
    if (hlText) gsap.set(hlText, { fontSize: 10 });
  }

  // Restore search bar state based on expand state
  var search = document.querySelector('.weather-search');
  if (search) {
    if (wasExpanded) {
      gsap.set(search, { display: 'flex', height: 'auto', opacity: 1 });
    } else {
      gsap.set(search, { display: 'none', height: 0, opacity: 0 });
    }
  }
}