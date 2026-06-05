import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const distIndexPath = path.join(distDir, 'index.html');
const storiesPath = path.join(projectRoot, 'public', 'data', 'stories.json');
const siteUrl = getSiteUrl();

const html = await readFile(distIndexPath, 'utf8');
const storiesData = JSON.parse(await readFile(storiesPath, 'utf8'));

for (const story of storiesData.stories ?? []) {
  const slug = story.slug || story.id;
  const storyPath = `/stories/${encodeURIComponent(slug)}`;
  const title = `${story.title} | Palavras Brilhantes`;
  const description = story.description || 'Leia esta historia no Palavras Brilhantes.';
  const image = story.coverImage || story.pages?.[0]?.image || '/stories/tres-porquinhos/cover.png';
  const shareHtml = html
    .replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`)
    .replace(
      /<!-- share-meta:start -->[\s\S]*?<!-- share-meta:end -->/,
      buildShareMeta({
        title,
        description,
        imageUrl: absolutizeUrl(image),
        pageUrl: absolutizeUrl(storyPath),
        language: story.language || 'pt-BR',
      }),
    );
  const outputDir = path.join(distDir, 'stories', slug);

  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'index.html'), shareHtml);
}

console.log(`Generated ${storiesData.stories?.length ?? 0} story share pages.`);

function buildShareMeta({ title, description, imageUrl, pageUrl, language }) {
  const imageType = imageUrl.endsWith('.svg') ? 'image/svg+xml' : imageUrl.endsWith('.jpg') || imageUrl.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';

  return [
    '<!-- share-meta:start -->',
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:site_name" content="Palavras Brilhantes" />`,
    `<meta property="og:type" content="article" />`,
    `<meta property="og:locale" content="${escapeHtml(language.replace('-', '_'))}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:image" content="${escapeHtml(imageUrl)}" />`,
    `<meta property="og:image:secure_url" content="${escapeHtml(imageUrl)}" />`,
    `<meta property="og:image:type" content="${imageType}" />`,
    '<meta property="og:image:width" content="1024" />',
    '<meta property="og:image:height" content="1024" />',
    `<meta property="og:url" content="${escapeHtml(pageUrl)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />`,
    '<!-- share-meta:end -->',
  ].join('\n    ');
}

function absolutizeUrl(value) {
  if (/^https?:\/\//.test(value)) {
    return value;
  }

  if (!siteUrl) {
    return value;
  }

  return `${siteUrl}${value.startsWith('/') ? value : `/${value}`}`;
}

function normalizeSiteUrl(value) {
  return value.replace(/\/+$/, '');
}

function getSiteUrl() {
  const rawUrl =
    process.env.VITE_SITE_URL ||
    process.env.URL ||
    process.env.DEPLOY_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    '';

  if (!rawUrl) {
    return '';
  }

  const withProtocol = /^https?:\/\//.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  return normalizeSiteUrl(withProtocol);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
