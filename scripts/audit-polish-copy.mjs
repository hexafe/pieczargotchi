#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DOC_DIR = path.join(ROOT, 'docs');

const markdownFiles = [
  'README.md',
  'AGENTS.md',
  'assets/README.md',
  ...fs
    .readdirSync(DOC_DIR)
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join('docs', name)),
];

const runtimeFiles = [
  'Index.html',
  ...fs
    .readdirSync(ROOT)
    .filter((name) => /^Client.*\.html$/.test(name) || /^[A-Z][A-Za-z]+\.gs$/.test(name))
    .sort(),
];

const visibleTermRules = [
  { pattern: /\bcare mistakes\b/i, suggestion: 'błędy opieki' },
  { pattern: /\bmycelium\b/i, suggestion: 'grzybnia' },
  { pattern: /\bhabitat\b/i, suggestion: 'siedlisko' },
  { pattern: /\bpatch\b/i, suggestion: 'podłoże/grządka' },
  { pattern: /\bfallback\b/i, suggestion: 'tryb zapasowy/mechanizm zastępczy' },
  { pattern: /\bruntime\b/i, suggestion: 'czas działania/uruchomienie' },
  { pattern: /\bAI\b|\bGPT[-\w.]*\b|\bgpt[-\w.]*\b/i, suggestion: 'usuń z trwałej dokumentacji lub przenieś do notatek roboczych' },
  { pattern: /\bRecommended models?\b|\bModel:\b|\bDlaczego ten model\b/i, suggestion: 'usuń z trwałej dokumentacji lub przenieś do notatek roboczych' },
  { pattern: /\bprompts?\b/i, suggestion: 'opisy wejściowe albo usuń z trwałej dokumentacji' },
];

const diacriticRules = [
  { pattern: /\bbyc\b/i, suggestion: 'być' },
  { pattern: /\blagodn/i, suggestion: 'łagodn...' },
  { pattern: /\bwplyw/i, suggestion: 'wpływ...' },
  { pattern: /\bglown/i, suggestion: 'główn...' },
  { pattern: /\bregul/i, suggestion: 'reguł...' },
  { pattern: /\bstatow\b/i, suggestion: 'statów' },
  { pattern: /\bsklada/i, suggestion: 'składa...' },
  { pattern: /\bpodloz/i, suggestion: 'podłoż...' },
  { pattern: /\bsrodowisk/i, suggestion: 'środowisk...' },
  { pattern: /\bslonc/i, suggestion: 'słońc...' },
  { pattern: /\bksiezyc/i, suggestion: 'księżyc...' },
  { pattern: /\bsnieg/i, suggestion: 'śnieg...' },
  { pattern: /\bmgla\b/i, suggestion: 'mgła' },
  { pattern: /\b(?:gestosc|gestosci|gesty|gesta|gestych)\b/i, suggestion: 'gęst...' },
  { pattern: /\bciez/i, suggestion: 'cięż...' },
  { pattern: /\bzyci/i, suggestion: 'życi...' },
  { pattern: /\bjakosc/i, suggestion: 'jakość...' },
  { pattern: /\bspoj/i, suggestion: 'spój...' },
  { pattern: /\bsciez/i, suggestion: 'ścież...' },
  { pattern: /\bzrod/i, suggestion: 'źród...' },
  { pattern: /\bmeteorow\b/i, suggestion: 'meteorów' },
  { pattern: /\btworzyc\b/i, suggestion: 'tworzyć' },
  { pattern: /\bktore\b/i, suggestion: 'które' },
  { pattern: /\bbylyby\b/i, suggestion: 'byłyby' },
  { pattern: /\bwysokosci\b/i, suggestion: 'wysokości' },
  { pattern: /\bczestotliwosc\b/i, suggestion: 'częstotliwość' },
  { pattern: /\bpamiec/i, suggestion: 'pamięć...' },
  { pattern: /\bpeln/i, suggestion: 'pełn...' },
  { pattern: /\buzyw/i, suggestion: 'używ...' },
  { pattern: /\bkrawed/i, suggestion: 'krawęd...' },
  { pattern: /\bkalu/i, suggestion: 'kału...' },
  { pattern: /\b(?:blad(?!y)|bled)/i, suggestion: 'błęd...' },
  { pattern: /\bswiatl/i, suggestion: 'światł...' },
  { pattern: /\b(?:tecza|teczowy|teczowa|teczowe)\b/i, suggestion: 'tęcz...' },
  { pattern: /\bdzien\b/i, suggestion: 'dzień' },
  { pattern: /\bmoze\b/i, suggestion: 'może' },
  { pattern: /\bmusi\b.*\bmiec\b/i, suggestion: 'mieć' },
  { pattern: /\bsa\b/i, suggestion: 'są' },
];

const pluralizationRules = [
  { pattern: /\basset(?:y|ów|ow|ami|ach)\b/i, suggestion: 'zasoby/pliki graficzne' },
  { pattern: /\bfallback(i|ow|ami|ach)?\b/i, suggestion: 'tryby zapasowe/mechanizmy zastępcze' },
  { pattern: /\bsheet(?:y|ów|ow|ami|ach)\b/i, suggestion: 'arkusze animacji' },
  { pattern: /\bcutout(?:y|ów|ow|ami|ach)\b/i, suggestion: 'wycinki' },
  { pattern: /\bstage-specific\b/i, suggestion: 'osobne dla etapu' },
];

const runtimeRules = [
  { pattern: /Rownik/, suggestion: 'Równik' },
  { pattern: /Zroś/, suggestion: 'Nawilż' },
  { pattern: /Odżywki/, suggestion: 'Składniki' },
  { pattern: /Canvas niedostępny/, suggestion: 'Scena niedostępna' },
  { pattern: /Część grafik zapasowa/, suggestion: 'Część grafik działa w trybie zapasowym' },
  { pattern: /Wersja buildu/, suggestion: 'Wersja aplikacji' },
  { pattern: /zaopiekowan/i, suggestion: 'zaspokojona/zadbać o potrzebę' },
  { pattern: /dopisał[ao]?/i, suggestion: 'dodał/trafiło do dziennika' },
  { pattern: /spriteów/i, suggestion: 'animacji/rysunków' },
  { pattern: /\bDebug:/, suggestion: 'Diagnostyka:' },
  { pattern: /\bBackup\b/, suggestion: 'Kopia zapasowa/Kopia zapisu' },
  { pattern: /\bPreset\b/, suggestion: 'Zestaw/Scenariusz' },
  { pattern: /\bCooldowny\b/, suggestion: 'Czasy odnowienia' },
];

const allowSections = [
  {
    file: 'AGENTS.md',
    start: /^## Agent Workflow\s*$/i,
    end: /^## /,
    reason: 'repo workflow may mention model selection',
  },
];

function stripInlineTechnicalText(line) {
  return line
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[[^\]]+\]\([^)]+\)/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b[A-Z0-9_]{3,}\b/g, ' ')
    .replace(/(?:^|\s)[./\w-]+\/[./\w-]+/g, ' ');
}

function sectionAllows(file, line, activeAllowSection) {
  if (!activeAllowSection) return false;
  if (activeAllowSection.file !== file) return false;
  return activeAllowSection.reason;
}

function auditFile(file) {
  const absolute = path.join(ROOT, file);
  const text = fs.readFileSync(absolute, 'utf8');
  const lines = text.split(/\r?\n/);
  const findings = [];
  let inFence = false;
  let activeAllowSection = null;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      return;
    }

    const nextAllow = allowSections.find((section) => section.file === file && section.start.test(line));
    if (nextAllow) activeAllowSection = nextAllow;
    else if (activeAllowSection?.end.test(line)) activeAllowSection = null;

    if (inFence) return;

    const visible = stripInlineTechnicalText(line);
    const allowReason = sectionAllows(file, line, activeAllowSection);

    const ruleGroups = [
      ['visible-term', visibleTermRules],
      ['missing-diacritic', diacriticRules],
      ['pluralization', pluralizationRules],
    ];

    for (const [type, rules] of ruleGroups) {
      for (const rule of rules) {
        if (!rule.pattern.test(visible)) continue;
        if (allowReason && (type === 'visible-term' || type === 'pluralization')) continue;
        findings.push({
          file,
          line: lineNumber,
          type,
          match: visible.trim(),
          suggestion: rule.suggestion,
        });
      }
    }
  });

  return findings;
}

function extractRuntimeSnippets(line) {
  const snippets = [];
  const stringPattern = /(['"`])((?:\\.|(?!\1).)*)\1/g;
  let match;
  while ((match = stringPattern.exec(line))) {
    snippets.push(match[2]);
  }

  const htmlText = line
    .replace(/<script[\s\S]*$/i, ' ')
    .replace(/<style[\s\S]*$/i, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .trim();
  if (htmlText && /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(htmlText)) {
    snippets.push(htmlText);
  }

  return snippets;
}

function auditRuntimeFile(file) {
  const absolute = path.join(ROOT, file);
  const text = fs.readFileSync(absolute, 'utf8');
  const findings = [];

  text.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const snippets = extractRuntimeSnippets(line);
    for (const snippet of snippets) {
      for (const rule of runtimeRules) {
        if (!rule.pattern.test(snippet)) continue;
        findings.push({
          file,
          line: lineNumber,
          type: 'runtime-copy',
          match: snippet.trim(),
          suggestion: rule.suggestion,
        });
      }
    }
  });

  return findings;
}

const findings = [
  ...markdownFiles.flatMap(auditFile),
  ...runtimeFiles.flatMap(auditRuntimeFile),
];

if (findings.length > 0) {
  console.error(`Polish copy audit failed with ${findings.length} finding(s):`);
  for (const finding of findings) {
    console.error(
      `${finding.file}:${finding.line} [${finding.type}] ${finding.suggestion} :: ${finding.match}`,
    );
  }
  process.exitCode = 1;
} else {
  console.log(`Polish copy audit passed for ${markdownFiles.length} Markdown file(s) and ${runtimeFiles.length} runtime file(s).`);
}
