/**
 * Copy Assets Script
 * ElectronアプリのHTML/CSSファイルをdistディレクトリにコピー
 */

import fs from 'fs-extra';

async function copyAssets() {
  console.log('📁 Copying assets...');
  
  try {
    // dist/electronディレクトリの作成
    await fs.ensureDir('dist/electron');
    
    // HTMLとCSSファイルのコピー
    console.log('📄 Copying HTML and CSS files...');
    await fs.copy('src/electron/assets', 'dist/electron/assets');
    
    // package.jsonのコピー（Electronアプリ用）
    console.log('📦 Copying package.json...');
    const packageJson = await fs.readJson('package.json');
    const electronPackageJson = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      main: 'electron/main/index.js',
      author: packageJson.author,
      license: packageJson.license
    };
    await fs.writeJson('dist/electron/package.json', electronPackageJson, { spaces: 2 });
    
    console.log('✅ Assets copied successfully!');
    
  } catch (error) {
    console.error('❌ Error copying assets:', error);
    process.exit(1);
  }
}

copyAssets();