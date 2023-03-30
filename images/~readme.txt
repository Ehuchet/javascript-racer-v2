To use bhsprites (modified version of Stitches code from http://draeton.github.com/stitches/)
- ensure chrome shortcut has --allow-file-access-from-files option to prevent null origin error running locally
- open bhsprites/bhsprites.html
- click Choose File, navigate to sprites folder and select all png files, click Open
- click Generate
- click Sprite to open new window containing generated png file, Ctrl-S to save file
- move and rename new spritesheet file as 'sprites.png' in the images directory
- click Stylesheet to open new window containing generated css rules, Ctrl-A / Ctrl-C to copy to clipboard
- paste to replace SPRITES object near bottom of common.js



old method (online):
To use CSS Sprite Generator:
- compress all individual sprite images into a zip file
- go to http://spritegen.website-performance.org/
- click Choose File button, select zip file
- change offsets to 10px from 50, leave other defaults
- click Create Sprite button at bottom
- when complete, download the generated spritesheet file
- select all text in the CSS Rules box, Copy, Paste into blank Kedit file
- if necess enter 'SET MACROPATH C:\Users\Emmanuel\Documents\bighistory.me codebase\bh racer\images' on cmdline
- enter 'macro sprites' on cmdline
- select all but final comma, copy, paste into SPRITES object near bottom of common.js
- move and rename new spritesheet file as 'sprites.png' in the images directory

