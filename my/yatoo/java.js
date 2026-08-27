// Load YouTube API
function loadYouTubeAPI() {
  const script = document.createElement('script');
  script.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(script);
}

// Initialize players when API is ready
window.onYouTubeIframeAPIReady = function() {
  // Create players for each video
  // Track states
};

// Track player states
const playerStates = {};
function onPlayerStateChange(event, index) {
  playerStates[index] = event.data;
  checkPlayingState();
}

function checkPlayingState() {
  const isPlaying = Object.values(playerStates).some(state => state === 1);
  if (isPlaying) {
    document.getElementById('header').style.display = 'none';
    document.getElementById('comments').style.display = 'none';
  } else {
    document.getElementById('header').style.display = 'block';
    document.getElementById('comments').style.display = 'block';
  }
}