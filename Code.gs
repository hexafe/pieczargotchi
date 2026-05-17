function doGet(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  if (parameters.bundle === 'core') {
    return serveClientBundle_(['ClientCore']);
  }
  if (parameters.bundle === 'client') {
    return serveClientBundle_(['Client']);
  }

  const template = HtmlService.createTemplateFromFile('Index');
  template.clientConfigJson = JSON.stringify(getClientConfig());

  return template
    .evaluate()
    .setTitle(PIECZARGOTCHI_APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

function serveClientBundle_(fileNames) {
  const source = fileNames.map(function(fileName) {
    return stripScriptTag_(include(fileName));
  }).join('\n');

  return ContentService
    .createTextOutput(source)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function stripScriptTag_(content) {
  return String(content || '')
    .replace(/^\s*<script[^>]*>\s*/i, '')
    .replace(/\s*<\/script>\s*$/i, '');
}
