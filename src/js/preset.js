const presetPostsArray = [];

for (let i = 0; i <= 30; i++) {
  presetPostsArray.push({
    id: `${i}`,
    timestamp: new Date().getTime(),
    coordinates: {
      latitude: '56.32843', 
      longitude: '44.00315',
    },
    text: `Lazy load demo text post ${i}`,
    status: {
      pinned: false,
      favorite: false,
    }
  });
}

presetPostsArray.push({
  id: '31',
  timestamp: new Date().getTime(),
  coordinates: {
    latitude: '56.32843', 
    longitude: '44.00315',
  },
  file: {
    url: 'http://localhost:7071/31/unsplash.com.jpg',
    name: 'unsplash.com.jpg',
    type: 'image',
  },
  status: {
    pinned: true,
    favorite: false,
  }
});

presetPostsArray.push({
  id: '32',
  timestamp: new Date().getTime(),
  coordinates: {
    latitude: '56.32843', 
    longitude: '44.00315',
  },
  text: 'Link demo: https://antis85.github.io/ahj-chaos-organizer/',
  status: {
    pinned: false,
    favorite: false,
  }
});

// console.log('preset_presetPostsArray: ', presetPostsArray);
module.exports = presetPostsArray;