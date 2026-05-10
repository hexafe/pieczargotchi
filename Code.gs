function doGet() {
  const template = HtmlService.createTemplateFromFile('Index');
  template.clientConfigJson = JSON.stringify(getClientConfig());

  return template
    .evaluate()
    .setTitle(PIECZARGOTCHI_APP_TITLE)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
