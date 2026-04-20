import * as esbuild from 'esbuild';
import { readFileSync, existsSync, statSync } from 'fs';

const isWatch = process.argv.includes('--watch');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

const sharedConfig = {
    format: 'cjs',
    platform: 'node',
    external: ['obsidian'],
    sourcemap: true,
    minify: !isWatch,
    target: 'node18',
};

const config = {
    entryPoints: ['src/main.ts'],
    bundle: true,
    ...sharedConfig,
    outfile: 'main.js',
    write: true,
};

const configDev = {
    ...config,
    sourcemap: 'inline',
};

if (isWatch) {
    const ctx = await esbuild.context(configDev);
    await ctx.watch();
    console.log('👀 Watching for changes...');
} else {
    await esbuild.build(config);
    console.log('✅ Build complete: main.js');
}

if (existsSync('styles.css')) {
    const stats = statSync('styles.css');
    if (stats.size > 0) {
        console.log('📄 styles.css linked');
    }
}
