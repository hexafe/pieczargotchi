function exportState_(state) {
  return JSON.stringify({
    kind: 'pieczargotchi-state',
    exportedAt: new Date().toISOString(),
    state: state || {}
  }, null, 2);
}

function importState_(json) {
  const parsed = JSON.parse(json);
  const state = parsed && parsed.kind === 'pieczargotchi-state' ? parsed.state : parsed;
  if (!state || typeof state !== 'object' || !state.stats) {
    throw new Error('Plik nie wygląda jak zapis Pieczargotchi.');
  }

  state.version = PIECZARGOTCHI_STATE_VERSION;
  return state;
}
