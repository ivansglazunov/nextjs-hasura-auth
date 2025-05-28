import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';
import Debug from './debug';
import { findProjectRoot } from './cli-hasyx';

const debug = Debug('assets');

// Function to find logo file by priority
const findLogoFile = (projectRoot: string): { path: string; type: string } | null => {
  const logoOptions = [
    { file: 'logo.svg', type: 'SVG' },
    { file: 'logo.png', type: 'PNG' },
    { file: 'logo.jpg', type: 'JPG' },
    { file: 'logo.jpeg', type: 'JPEG' }
  ];
  
  console.log('🔍 Searching for logo file...');
  debug('Starting logo file search');
  
  for (const option of logoOptions) {
    const logoPath = path.join(projectRoot, 'public', option.file);
    console.log(`   Checking: public/${option.file}`);
    debug(`Checking logo file: ${logoPath}`);
    
    if (fs.existsSync(logoPath)) {
      console.log(`✅ Found logo file: public/${option.file} (${option.type})`);
      debug(`Logo file found: ${logoPath} (${option.type})`);
      return { path: logoPath, type: option.type };
    } else {
      console.log(`   ❌ Not found: public/${option.file}`);
      debug(`Logo file not found: ${logoPath}`);
    }
  }
  
  console.log('❌ No logo file found in public/ directory');
  debug('No logo file found');
  return null;
};

export const assetsCommand = async () => {
  debug('Executing "assets" command.');
  console.log('🎨 Generating app icons and splash screens from logo file...');
  
  const projectRoot = findProjectRoot();
  
  // Find logo file by priority
  const logoInfo = findLogoFile(projectRoot);
  
  if (!logoInfo) {
    console.error('❌ No logo file found in public/ directory.');
    console.error('   Please ensure one of the following files exists:');
    console.error('   - public/logo.svg (preferred)');
    console.error('   - public/logo.png');
    console.error('   - public/logo.jpg');
    console.error('   - public/logo.jpeg');
    debug('No logo file found, exiting');
    process.exit(1);
  }
  
  const logoPath = logoInfo.path;
  const logoType = logoInfo.type;
  
  console.log(`🎯 Using logo file: ${path.relative(projectRoot, logoPath)} (${logoType})`);
  debug(`Using logo file: ${logoPath} (${logoType})`);
  
  // Check if @capacitor/assets is available
  try {
    console.log('📦 Generating Capacitor assets...');
    debug('Running: npx @capacitor/assets generate');
    
    const assetsResult = spawn.sync('npx', ['@capacitor/assets', 'generate'], {
      stdio: 'inherit',
      cwd: projectRoot,
    });
    
    debug('Capacitor assets result:', JSON.stringify(assetsResult, null, 2));
    
    if (assetsResult.error) {
      console.warn('⚠️ Failed to run @capacitor/assets generate:', assetsResult.error);
      console.warn('   You may need to install @capacitor/assets: npm install @capacitor/assets --save-dev');
      debug(`@capacitor/assets failed to start: ${assetsResult.error}`);
    } else if (assetsResult.status !== 0) {
      console.warn(`⚠️ @capacitor/assets generate exited with status ${assetsResult.status}`);
      debug(`@capacitor/assets exited with non-zero status: ${assetsResult.status}`);
    } else {
      console.log('✅ Capacitor assets generated successfully!');
      debug('@capacitor/assets generation successful.');
    }
  } catch (error) {
    console.warn('⚠️ Error running @capacitor/assets:', error);
    debug(`Error running @capacitor/assets: ${error}`);
  }
  
  // Generate PWA icons manually if needed
  try {
    console.log('🌐 Ensuring PWA icons are available...');
    const iconsDir = path.join(projectRoot, 'public', 'icons');
    await fs.ensureDir(iconsDir);
    
    // Check if icons already exist
    const icon192 = path.join(iconsDir, 'icon-192.png');
    const icon512 = path.join(iconsDir, 'icon-512.png');
    
    if (!fs.existsSync(icon192) || !fs.existsSync(icon512)) {
      console.log(`📱 Generating PWA icons from ${logoType} logo...`);
      debug(`Generating PWA icons from ${logoType} logo`);
      
      // Try to use sharp to convert logo to PNG
      try {
        const sharp = require('sharp');
        
        // Generate 192x192 icon
        if (!fs.existsSync(icon192)) {
          await sharp(logoPath)
            .resize(192, 192)
            .png()
            .toFile(icon192);
          console.log('✅ Generated icon-192.png');
          debug('Generated 192x192 PWA icon');
        }
        
        // Generate 512x512 icon
        if (!fs.existsSync(icon512)) {
          await sharp(logoPath)
            .resize(512, 512)
            .png()
            .toFile(icon512);
          console.log('✅ Generated icon-512.png');
          debug('Generated 512x512 PWA icon');
        }
        
        // Generate favicon
        const faviconPath = path.join(projectRoot, 'public', 'favicon.ico');
        if (!fs.existsSync(faviconPath)) {
          console.log(`🔖 Generating favicon from ${logoType} logo...`);
          debug(`Generating favicon from ${logoType} logo`);
          
          const favicon32 = await sharp(logoPath)
            .resize(32, 32)
            .png()
            .toBuffer();
          
          // Try to convert to ICO format
          try {
            const pngToIco = require('png-to-ico');
            const icoBuffer = await pngToIco(favicon32);
            await fs.writeFile(faviconPath, icoBuffer);
            console.log('✅ Generated favicon.ico');
            debug('Generated favicon.ico');
          } catch (icoError) {
            console.warn('⚠️ Could not generate favicon.ico, using PNG fallback');
            await fs.writeFile(path.join(projectRoot, 'public', 'favicon.png'), favicon32);
            debug(`ICO conversion failed: ${icoError}`);
          }
        }
        
      } catch (sharpError) {
        console.warn('⚠️ Sharp not available for icon generation:', sharpError);
        console.warn('   Install sharp for automatic icon generation: npm install sharp');
        debug(`Sharp error: ${sharpError}`);
      }
    } else {
      console.log('✅ PWA icons already exist');
      debug('PWA icons already exist, skipping generation');
    }
    
  } catch (error) {
    console.warn('⚠️ Error generating PWA icons:', error);
    debug(`Error generating PWA icons: ${error}`);
  }
  
  // Set Telegram bot profile picture if token is available
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      console.log('🤖 Setting Telegram bot profile picture...');
      debug('Setting Telegram bot profile picture');
      
      let imageToUse: string | null = null;
      
      // If we have a PNG logo, use it directly
      if (logoType === 'PNG') {
        imageToUse = logoPath;
        console.log(`📸 Using existing PNG logo for Telegram bot`);
        debug('Using existing PNG logo for Telegram bot');
      } else {
        // Convert logo to PNG for Telegram
        const logoImagePath = path.join(projectRoot, 'public', 'logo.png');
        
        if (fs.existsSync(logoImagePath)) {
          imageToUse = logoImagePath;
          console.log(`📸 Using existing logo.png for Telegram bot`);
          debug('Using existing logo.png for Telegram bot');
        } else {
          try {
            console.log(`🔄 Converting ${logoType} logo to PNG for Telegram bot...`);
            debug(`Converting ${logoType} logo to PNG for Telegram bot`);
            
            const sharp = require('sharp');
            await sharp(logoPath)
              .resize(512, 512)
              .png()
              .toFile(logoImagePath);
            imageToUse = logoImagePath;
            console.log('✅ Generated logo.png for Telegram bot');
            debug('Generated logo.png from logo for Telegram');
          } catch (sharpError) {
            console.warn('⚠️ Could not generate logo.png for Telegram bot');
            debug(`Sharp error for Telegram logo: ${sharpError}`);
            imageToUse = null;
          }
        }
      }
      
      if (imageToUse && fs.existsSync(imageToUse)) {
        console.log(`📤 Uploading profile picture to Telegram bot...`);
        debug(`Uploading profile picture: ${imageToUse}`);
        
        // Use curl to set bot profile picture
        const setPhotoResult = spawn.sync('curl', [
          '-X', 'POST',
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setUserProfilePhotos`,
          '-F', `photo=@${imageToUse}`
        ], {
          stdio: 'pipe',
          cwd: projectRoot,
        });
        
        if (setPhotoResult.status === 0) {
          console.log('✅ Telegram bot profile picture updated');
          debug('Telegram bot profile picture set successfully');
        } else {
          console.warn('⚠️ Failed to set Telegram bot profile picture');
          debug(`Telegram bot photo setting failed with status: ${setPhotoResult.status}`);
        }
      } else {
        console.warn('⚠️ No suitable image file available for Telegram bot profile picture');
        debug('No suitable image file for Telegram bot');
      }
      
    } catch (error) {
      console.warn('⚠️ Error setting Telegram bot profile picture:', error);
      debug(`Error setting Telegram bot profile: ${error}`);
    }
  }
  
  console.log('✨ Assets generation complete!');
  console.log(`   Logo source: ${path.relative(projectRoot, logoPath)} (${logoType})`);
  debug('Finished "assets" command.');
}; 