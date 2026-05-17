function doGet(event) {
  const parameters = event && event.parameter ? event.parameter : {};
  if (parameters.smoke === '1') {
    return serveDeploymentSmokePage_();
  }
  if (parameters.bundle === 'config') {
    return serveClientConfigScript_();
  }
  if (parameters.bundle === 'core') {
    return serveClientBundle_(['ClientCore']);
  }
  if (parameters.bundle === 'client') {
    return serveClientBundle_(['Client']);
  }

  const template = HtmlService.createTemplateFromFile('Index');

  return template
    .evaluate()
    .setTitle(PIECZARGOTCHI_APP_TITLE)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) {
  return HtmlService.createTemplateFromFile(filename).evaluate().getContent();
}

function serveDeploymentSmokePage_() {
  return HtmlService
    .createHtmlOutput(
      '<!doctype html><html lang="pl"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Pieczargotchi smoke</title>' +
      '<style>body{margin:0;padding:24px;font:16px sans-serif;background:#e7f0d0;color:#221814}' +
      '.box{display:grid;gap:8px;max-width:420px;padding:18px;border:3px solid #3c2b20;background:#fff8ea}' +
      'strong{font-size:22px}</style></head>' +
      '<body><div class="box"><strong>Pieczargotchi smoke OK</strong>' +
      '<span>Minimalny HTML Apps Script został wyrenderowany.</span></div></body></html>'
    )
    .setTitle('Pieczargotchi smoke')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function serveClientConfigScript_() {
  const json = JSON.stringify(getClientConfig()).replace(/<\/script/gi, '<\\/script');
  return ContentService
    .createTextOutput('window.PIECZARGOTCHI_CONFIG = ' + json + ';')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
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
