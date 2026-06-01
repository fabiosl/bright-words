import { access, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const storiesPath = 'public/data/stories.json';
const data = JSON.parse(await readFile(storiesPath, 'utf8'));
const python = await findPython();

const voiceByLanguage = {
  'en-US': 'en-US-JennyNeural',
  'pt-BR': 'pt-BR-FranciscaNeural',
};

for (const story of data.stories) {
  const language = story.language === 'en-US' ? 'en-US' : 'pt-BR';
  const voice = voiceByLanguage[language];
  const audioDir = path.join('public', 'stories', story.id, 'audio');
  await mkdir(audioDir, { recursive: true });

  for (const [index, page] of story.pages.entries()) {
    const fileName = `page-${index + 1}.mp3`;
    const timingsFileName = `page-${index + 1}.timings.json`;
    const outputPath = path.join(audioDir, fileName);
    const timingsPath = path.join(audioDir, timingsFileName);
    page.audio = `/stories/${story.id}/audio/${fileName}`;
    page.audioTimings = `/stories/${story.id}/audio/${timingsFileName}`;

    if ((await exists(outputPath)) && (await exists(timingsPath))) {
      continue;
    }

    console.log(`Generating ${page.audio}`);
    await run(python, [
      path.join('scripts', 'generate-edge-audio.py'),
      '--voice',
      voice,
      '--rate=-8%',
      '--text',
      page.paragraph,
      '--write-media',
      outputPath,
      '--write-timings',
      timingsPath,
    ]);
  }
}

await writeFile(storiesPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

async function findPython() {
  const candidates = [
    process.env.PYTHON,
    path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe'),
    'python',
    'py',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate.includes(path.sep)) {
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        continue;
      }
    }

    return candidate;
  }

  throw new Error('Python was not found. Set PYTHON to a Python executable with edge-tts installed.');
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}
