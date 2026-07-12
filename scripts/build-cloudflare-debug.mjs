process.env.PIECZARGOTCHI_BUILD_OUTPUT_DIR = 'dist-debug';
process.env.PIECZARGOTCHI_CLOUDFLARE_DEBUG = '1';
process.env.PIECZARGOTCHI_CLOUDFLARE_EXPOSE_RUNTIME = '1';
process.env.PIECZARGOTCHI_ALLOW_DEBUG_BUILD = '1';

const { buildCloudflareStatic } = await import('./build-cloudflare-static.mjs');
await buildCloudflareStatic();
