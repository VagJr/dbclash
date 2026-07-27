const fs = require('fs');
const files = [
  'js/ui-manager.js','js/game-engine.js','js/card-database.js','js/audio.js',
  'js/fx-engine.js','js/tutorial-manager.js','js/asset-loader.js','js/character-unlocks.js',
  'js/cutscene-engine.js','js/multiplayer-manager.js','js/deck-builder.js','js/pack-opener.js',
  'js/chat-manager.js','js/auth-database.js','js/i18n.js'
];
files.forEach(f => {
  try {
    new Function('"use strict";' + fs.readFileSync(f, 'utf8').replace(/\bimport\b/g, '//import').replace(/\bexport\b/g, '//export'));
    console.log('OK: ' + f);
  } catch (e) {
    console.log('ERR: ' + f + ': ' + e.message);
  }
});
