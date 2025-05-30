import fs from 'fs-extra';
import path from 'path';
import spawn from 'cross-spawn';
import Debug from './debug';
import dotenv from 'dotenv';

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
  
  const projectRoot = process.cwd();
  
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

  // Move PWA icons from root icons/ to public/icons/ if they exist
  try {
    console.log('🌐 Processing PWA icons...');
    
    const rootIconsDir = path.join(projectRoot, 'icons');
    const publicIconsDir = path.join(projectRoot, 'public', 'icons');
    
    // Ensure public/icons directory exists
    await fs.ensureDir(publicIconsDir);
    
    if (fs.existsSync(rootIconsDir)) {
      console.log('📁 Moving PWA icons to public/icons/...');
      debug('Moving PWA icons from root icons/ to public/icons/');
      
      // Get all files from root icons directory
      const iconFiles = await fs.readdir(rootIconsDir);
      
      let movedCount = 0;
      for (const file of iconFiles) {
        if (file.startsWith('icon-') && (file.endsWith('.webp') || file.endsWith('.png'))) {
          const sourceFile = path.join(rootIconsDir, file);
          const targetFile = path.join(publicIconsDir, file);
          
          try {
            await fs.move(sourceFile, targetFile, { overwrite: true });
            console.log(`   ✅ Moved ${file}`);
            debug(`Moved PWA icon: ${file}`);
            movedCount++;
          } catch (moveError) {
            console.warn(`   ⚠️ Failed to move ${file}:`, moveError);
            debug(`Failed to move PWA icon ${file}: ${moveError}`);
          }
        }
      }
      
      if (movedCount > 0) {
        console.log(`✅ Moved ${movedCount} PWA icons to public/icons/`);
        debug(`Moved ${movedCount} PWA icons to public/icons/`);
        
        // Try to remove empty root icons directory
        try {
          const remainingFiles = await fs.readdir(rootIconsDir);
          if (remainingFiles.length === 0) {
            await fs.remove(rootIconsDir);
            console.log('🗑️ Removed empty root icons/ directory');
            debug('Removed empty root icons directory');
          }
        } catch (removeError) {
          debug(`Could not remove root icons directory: ${removeError}`);
        }
      }
    } else {
      console.log('📱 No root icons/ directory found, checking existing PWA icons...');
      debug('No root icons directory found');
    }
    
    // Check if we have the minimum required PWA icons
    const icon192 = path.join(publicIconsDir, 'icon-192.png');
    const icon512 = path.join(publicIconsDir, 'icon-512.png');
    const icon192webp = path.join(publicIconsDir, 'icon-192.webp');
    const icon512webp = path.join(publicIconsDir, 'icon-512.webp');
    
    const hasRequiredIcons = (fs.existsSync(icon192) || fs.existsSync(icon192webp)) && 
                            (fs.existsSync(icon512) || fs.existsSync(icon512webp));
    
    if (!hasRequiredIcons) {
      console.log(`📱 Generating missing PWA icons from ${logoType} logo...`);
      debug(`Generating PWA icons from ${logoType} logo`);
      
      // Try to use sharp to convert logo to PNG
      try {
        const sharp = require('sharp');
        
        // Generate 192x192 icon if missing
        if (!fs.existsSync(icon192) && !fs.existsSync(icon192webp)) {
          await sharp(logoPath)
            .resize(192, 192)
            .png()
            .toFile(icon192);
          console.log('✅ Generated icon-192.png');
          debug('Generated 192x192 PWA icon');
        }
        
        // Generate 512x512 icon if missing
        if (!fs.existsSync(icon512) && !fs.existsSync(icon512webp)) {
          await sharp(logoPath)
            .resize(512, 512)
            .png()
            .toFile(icon512);
          console.log('✅ Generated icon-512.png');
          debug('Generated 512x512 PWA icon');
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
    
    // Update manifest.webmanifest to use correct icon paths
    try {
      console.log('📝 Updating PWA manifest...');
      const manifestPath = path.join(projectRoot, 'public', 'manifest.webmanifest');
      
      if (fs.existsSync(manifestPath)) {
        const manifestContent = await fs.readFile(manifestPath, 'utf8');
        const manifest = JSON.parse(manifestContent);
        
        // Check what icons we actually have
        const availableIcons = await fs.readdir(publicIconsDir);
        const webpIcons = availableIcons.filter(f => f.startsWith('icon-') && f.endsWith('.webp'));
        const pngIcons = availableIcons.filter(f => f.startsWith('icon-') && f.endsWith('.png'));
        
        // Prefer WebP icons if available, fallback to PNG
        const iconsToUse = webpIcons.length > 0 ? webpIcons : pngIcons;
        
        if (iconsToUse.length > 0) {
          console.log(`   Using ${iconsToUse.length} ${webpIcons.length > 0 ? 'WebP' : 'PNG'} icons`);
          
          // Update manifest icons
          manifest.icons = [];
          
          for (const iconFile of iconsToUse) {
            const sizeMatch = iconFile.match(/icon-(\d+)\./);
            if (sizeMatch) {
              const size = sizeMatch[1];
              const isWebP = iconFile.endsWith('.webp');
              
              manifest.icons.push({
                src: `/icons/${iconFile}`,
                type: isWebP ? 'image/webp' : 'image/png',
                sizes: `${size}x${size}`,
                purpose: 'any maskable'
              });
            }
          }
          
          // Update shortcuts icon reference too
          if (manifest.shortcuts && manifest.shortcuts.length > 0) {
            const icon192File = iconsToUse.find(f => f.includes('192')) || iconsToUse[0];
            manifest.shortcuts[0].icons = [{
              src: `/icons/${icon192File}`,
              sizes: '192x192'
            }];
          }
          
          // Write updated manifest
          await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
          console.log('✅ Updated PWA manifest with correct icon paths');
          debug('Updated PWA manifest with correct icon paths');
        }
      } else {
        console.log('   ⚠️ manifest.webmanifest not found, skipping update');
        debug('manifest.webmanifest not found');
      }
    } catch (manifestError) {
      console.warn('⚠️ Error updating PWA manifest:', manifestError);
      debug(`Error updating PWA manifest: ${manifestError}`);
    }
    
  } catch (error) {
    console.warn('⚠️ Error processing PWA icons:', error);
    debug(`Error processing PWA icons: ${error}`);
  }

  // Generate favicon if needed
  try {
    const faviconPath = path.join(projectRoot, 'public', 'favicon.ico');
    if (!fs.existsSync(faviconPath)) {
      console.log(`🔖 Generating favicon from ${logoType} logo...`);
      debug(`Generating favicon from ${logoType} logo`);
      
      try {
        const sharp = require('sharp');
        
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
      } catch (sharpError) {
        console.warn('⚠️ Sharp not available for favicon generation:', sharpError);
        debug(`Sharp error for favicon: ${sharpError}`);
      }
    }
  } catch (error) {
    console.warn('⚠️ Error generating favicon:', error);
    debug(`Error generating favicon: ${error}`);
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