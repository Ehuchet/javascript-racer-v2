//=========================================================================
// minimalist DOM helpers
//=========================================================================

var Dom = {

    get:function (id) {
        return ((id instanceof HTMLElement) || (id === document)) ? id : document.getElementById(id);
    },
    set:function (id, html) {
        Dom.get(id).innerHTML = html;
    },
    on:function (ele, type, fn, capture) {
        Dom.get(ele).addEventListener(type, fn, capture);
    },
    un:function (ele, type, fn, capture) {
        Dom.get(ele).removeEventListener(type, fn, capture);
    },
    show:function (ele, type) {
        Dom.get(ele).style.display = (type || 'block');
    },
    blur:function (ev) {
        ev.target.blur();
    },

    addClassName:function (ele, name) {
        Dom.toggleClassName(ele, name, true);
    },
    removeClassName:function (ele, name) {
        Dom.toggleClassName(ele, name, false);
    },
    toggleClassName:function (ele, name, on) {
        ele = Dom.get(ele);
        var classes = ele.className.split(' ');
        var n = classes.indexOf(name);
        on = (typeof on == 'undefined') ? (n < 0) : on;
        if (on && (n < 0))
            classes.push(name);
        else if (!on && (n >= 0))
            classes.splice(n, 1);
        ele.className = classes.join(' ');
    },

    storage:window.localStorage || {}

};

//=========================================================================
// general purpose helpers (mostly math)
//=========================================================================

var Util = {

    timestamp:function () {
        return new Date().getTime();
    },
    toInt:function (obj, def) {
        if (obj !== null) {
            var x = parseInt(obj, 10);
            if (!isNaN(x)) return x;
        }
        return Util.toInt(def, 0);
    },
    toFloat:function (obj, def) {
        if (obj !== null) {
            var x = parseFloat(obj);
            if (!isNaN(x)) return x;
        }
        return Util.toFloat(def, 0.0);
    },
    limit:function (value, min, max) {
        return Math.max(min, Math.min(value, max));
    },
    randomInt:function (min, max) {
        return Math.round(Util.interpolate(min, max, Math.random()));
    },
    randomChoice:function (options) {
        return options[Util.randomInt(0, options.length - 1)];
    },
    percentRemaining:function (n, total) {
        return (n % total) / total;
    },
    accelerate:function (v, accel, dt) {
        return v + (accel * dt);
    },
    interpolate:function (a, b, percent) {
        return a + (b - a) * percent
    },
    easeIn:function (a, b, percent) {
        return a + (b - a) * Math.pow(percent, 2);
    },
    easeOut:function (a, b, percent) {
        return a + (b - a) * (1 - Math.pow(1 - percent, 2));
    },
    easeInOut:function (a, b, percent) {
        return a + (b - a) * ((-Math.cos(percent * Math.PI) / 2) + 0.5);
    },
    exponentialFog:function (distance, density) {
        return 1 / (Math.pow(Math.E, (distance * distance * density)));
    },
    //easeIn:           function(a,b,percent)       { return a + (b-a)*Math.round(Math.pow(percent,2)*100)/100;                           },
    //easeOut:          function(a,b,percent)       { return a + (b-a)*Math.round((1-Math.pow(1-percent,2))*100)/100;                     },
    //easeInOut:        function(a,b,percent)       { return a + (b-a)*(Math.round((-Math.cos(percent*Math.PI)/2)*100)/100 + 0.5);        },
    //exponentialFog:   function(distance, density) { return 1 / Math.round((Math.pow(Math.E, (distance * distance * density)))*1.1)/1.1; },

    increase:function (start, increment, max) { // with looping
        var result = start + increment;
        while (result >= max)
            result -= max;
        while (result < 0)
            result += max;
        return result;
    },

    project:function (p, cameraX, cameraY, cameraZ, cameraDepth, width, height, roadWidth) {
        p.camera.x = (p.world.x || 0) - cameraX;
        p.camera.y = (p.world.y || 0) - cameraY;
        p.camera.z = (p.world.z || 0) - cameraZ;
        p.screen.scale = cameraDepth / p.camera.z;
        p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
        p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
        p.screen.w = Math.round((p.screen.scale * roadWidth * width / 2));
    },


    overlap:function (x1, w1, x2, w2, percent) {
        var half = (percent || 1) / 2;
        x1 = x1 + 2;
        x2 = x2 + 2;
        var min1 = x1 - (w1 * half);
        var max1 = x1 + (w1 * half);
        var min2 = x2 - (w2 * half);
        var max2 = x2 + (w2 * half);
        return !((max1 < min2) || (min1 > max2));
    },

    toggleFullscreen:function () {
        if (document['fullscreenElement'] || document['mozFullScreen'] || document['webkitIsFullScreen']) {
            // Opera 12.50 is first again
            if (document['exitFullscreen'])
                document['exitFullscreen']();
            else if (document['mozCancelFullScreen'])
                document['mozCancelFullScreen']();
            else if (document['webkitCancelFullScreen'])
                document['webkitCancelFullScreen']();
        }
        else {
            var c = document.getElementsByTagName('canvas')[0];
            if (c['requestFullscreen'])
                c['requestFullscreen']();
            else if (c['mozRequestFullScreen'])
                c['mozRequestFullScreen']();
            else if (c['webkitRequestFullScreen'])
                c['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']);
        }
        return false;
    }

};

//=========================================================================
// POLYFILL for requestAnimationFrame
//=========================================================================

if (!window.requestAnimationFrame) { // http://paulirish.com/2011/requestanimationframe-for-smart-animating/
    window.requestAnimationFrame = window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.oRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (callback, element) {
            window.setTimeout(callback, 1000 / 60);
        }
}

//=========================================================================
// GAME LOOP helpers
//=========================================================================

var Game = {  // a modified version of the game loop from my previous boulderdash game - see http://codeincomplete.com/posts/2011/10/25/javascript_boulderdash/#gameloop

    run:function (options) {

        Game.loadImages(options.images, function (images) {

            options.ready(images); // tell caller to initialize itself because images are loaded and we're ready to rumble

            Game.setKeyListener(options.keys);

            var canvas = options.canvas, // canvas render target is provided by caller
                update = options.update, // method to update game logic is provided by caller
                render = options.render, // method to render the game is provided by caller
                step = options.step, // fixed frame step (1/fps) is specified by caller
                stats = options.stats, // stats instance is provided by caller
                now = null,
                last = Util.timestamp(),
                dt = 0,
                gdt = 0;

            //efh get touch events
            //Game.setCanvasListener(canvasFrame);
            var isTouchSupported = 'ontouchstart' in window;
            var startEvent = isTouchSupported ? 'touchstart' : 'mousedown';
            var moveEvent = isTouchSupported ? 'touchmove' : 'mousemove';
            var endEvent = isTouchSupported ? 'touchend' : 'mouseup';
            var doLeftStart = function (e) {
                e.preventDefault();
                keyLeft = true;
            };
            var doLeftEnd = function (e) {
                e.preventDefault();
                keyLeft = false;
                keyCount++;
            };
            var doFasterStart = function (e) {
                e.preventDefault();
                keyFaster = true;
            };
            var doFasterEnd = function (e) {
                e.preventDefault();
                keyFaster = false;
                keyCount++;
            };
            var doSlowerStart = function (e) {
                e.preventDefault();
                keySlower = true;
            };
            var doSlowerEnd = function (e) {
                e.preventDefault();
                keySlower = false;
                keyCount++;
            };
            var doRightStart = function (e) {
                e.preventDefault();
                keyRight = true;
            };
            var doRightEnd = function (e) {
                e.preventDefault();
                keyRight = false;
                keyCount++;
            };
            document.getElementById('left').addEventListener(startEvent, doLeftStart, false);
            document.getElementById('left').addEventListener(endEvent, doLeftEnd, false);
            document.getElementById('faster').addEventListener(startEvent, doFasterStart, false);
            document.getElementById('faster').addEventListener(endEvent, doFasterEnd, false);
            document.getElementById('slower').addEventListener(startEvent, doSlowerStart, false);
            document.getElementById('slower').addEventListener(endEvent, doSlowerEnd, false);
            document.getElementById('right').addEventListener(startEvent, doRightStart, false);
            document.getElementById('right').addEventListener(endEvent, doRightEnd, false);
            document.getElementById('frame').addEventListener(startEvent, Util.toggleFullscreen, false);
            // for now, turn off mouse/touch pads if not on mobile to clean up the view
            if (!isTouchSupported) {
                document.getElementById('left').style.display = 'none';
                document.getElementById('faster').style.display = 'none';
                document.getElementById('slower').style.display = 'none';
                document.getElementById('right').style.display = 'none';
            }

            function frame() {
                now = Util.timestamp();
                dt = Math.min(1, (now - last) / 1000); // using requestAnimationFrame have to be able to handle large delta's caused when it 'hibernates' in a background or non-visible tab
                gdt = gdt + dt;
                while (gdt > step) {
                    gdt = gdt - step;
                    update(step);
                }
                render();
                stats.update();
                last = now;
                requestAnimationFrame(frame, canvas);
            }

            frame(); // lets get this party started
            Game.playMusic();
        });
    },

    //---------------------------------------------------------------------------

    loadImages:function (names, callback) { // load multiple images and callback when ALL images have loaded
        var result = [];
        var count = names.length;

        var onload = function () {
            if (--count == 0)
                callback(result);
        };

        for (var n = 0; n < names.length; n++) {
            var name = names[n];
            result[n] = document.createElement('img');
            Dom.on(result[n], 'load', onload);
            result[n].src = "images/" + name + ".png";
        }
    },

    //---------------------------------------------------------------------------

    setKeyListener:function (keys) {
        var onkey = function (keyCode, mode) {
            var n, k;
            for (n = 0; n < keys.length; n++) {
                k = keys[n];
                k.mode = k.mode || 'up';
                if ((k.key == keyCode) || (k.keys && (k.keys.indexOf(keyCode) >= 0))) {
                    if (k.mode == mode) {
                        k.action.call();
                    }
                }
            }
        };
        Dom.on(document, 'keydown', function (ev) {
            onkey(ev.keyCode, 'down');
        });
        Dom.on(document, 'keyup', function (ev) {
            onkey(ev.keyCode, 'up');
        });
    },

/*
    setCanvasListener:function (canvasFrame) {
        var doTouchStart = function (event) {
            event.preventDefault();
            canvas_y = event.targetTouches[0].pageY;
            canvas_x = event.targetTouches[0].pageX;
            if (canvas_y < canvasFrame.height / 2)
                keyFaster = true;
            else // if (canvas_y >= canvas.height/2)
                keySlower = true;
            if (canvas_x < canvasFrame.width / 2)
                keyLeft = true;
            else // if (canvas_y >= canvas.height/2)
                keyRight = true;
        };
        var doTouchEnd = function () {
            keyFaster = false;
            keySlower = false;
            keyLeft = false;
            keyRight = false;
        };
        canvasFrame.addEventListener("touchstart", doTouchStart, false);
        canvasFrame.addEventListener("touchend", doTouchEnd, false);
        //canvas.addEventListener("touchstart", doTouchStart, false);
        //canvas.addEventListener("touchend", doTouchEnd, false);

    },
*/
    //---------------------------------------------------------------------------

    stats:function (parentId, id) { // construct mr.doobs FPS counter - along with friendly good/bad/ok message box

        var result = new Stats();
        result.domElement.id = id || 'stats';
        Dom.get(parentId).appendChild(result.domElement);

        var msg = document.createElement('div');
        msg.style.cssText = "border: 2px solid gray; padding: 5px; margin-top: 5px; text-align: left; font-size: 1.15em; text-align: right;";
        msg.innerHTML = "Your canvas performance is ";
        Dom.get(parentId).appendChild(msg);

        var value = document.createElement('span');
        value.innerHTML = "...";
        msg.appendChild(value);

        setInterval(function () {
            var fps = result.current();
            var ok = (fps > 50) ? 'good' : (fps < 30) ? 'bad' : 'ok';
            var color = (fps > 50) ? 'green' : (fps < 30) ? 'red' : 'gray';
            value.innerHTML = ok;
            value.style.color = color;
            msg.style.borderColor = color;
        }, 5000);
        return result;
    },

    //---------------------------------------------------------------------------

    playMusic:function () {
        var music = Dom.get('music');
        music.loop = true;
        music.volume = 0.05; // shhhh! annoying music!
        music.muted = (Dom.storage.muted === "true");
        music.play();
        Dom.toggleClassName('mute', 'on', music.muted);
        Dom.on('mute', 'click', function () {
            Dom.storage.muted = music.muted = !music.muted;
            Dom.toggleClassName('mute', 'on', music.muted);
        });
    },

    exit: function( status ) {
        // http://kevin.vanzonneveld.net
        // +   original by: Brett Zamir (http://brettz9.blogspot.com)
        // +      input by: Paul
        // +   bugfixed by: Hyam Singer (http://www.impact-computing.com/)
        // +   improved by: Philip Peterson
        // +   bugfixed by: Brett Zamir (http://brettz9.blogspot.com)
        // %        note 1: Should be considered expirimental. Please comment on this function.
        // *     example 1: exit();
        // *     returns 1: null

        var i;

        if (typeof status === 'string') {
            alert(status);
        }

        window.addEventListener('error', function (e) {e.preventDefault();e.stopPropagation();}, false);

        var handlers = [
            'copy', 'cut', 'paste',
            'beforeunload', 'blur', 'change', 'click', 'contextmenu', 'dblclick', 'focus', 'keydown', 'keypress', 'keyup', 'mousedown', 'mousemove', 'mouseout', 'mouseover', 'mouseup', 'resize', 'scroll',
            'DOMNodeInserted', 'DOMNodeRemoved', 'DOMNodeRemovedFromDocument', 'DOMNodeInsertedIntoDocument', 'DOMAttrModified', 'DOMCharacterDataModified', 'DOMElementNameChanged', 'DOMAttributeNameChanged', 'DOMActivate', 'DOMFocusIn', 'DOMFocusOut', 'online', 'offline', 'textInput',
            'abort', 'close', 'dragdrop', 'load', 'paint', 'reset', 'select', 'submit', 'unload'
        ];

        function stopPropagation (e) {
            e.stopPropagation();
            // e.preventDefault(); // Stop for the form controls, etc., too?
        }
        for (i=0; i < handlers.length; i++) {
            window.addEventListener(handlers[i], function (e) {stopPropagation(e);}, true);
        }

        if (window.stop) {
            window.stop();
        }

        throw '';
    }

};

//=========================================================================
// canvas rendering helpers
//=========================================================================

var Render = {

    polygon:function (ctx, x1, y1, x2, y2, x3, y3, x4, y4, color) {
        //try moving state change ctx.fillStyle to main reset so it's done once
        if (color != currentColor) {
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            currentColor = color;
        }
        //efh moire problem -double pen width and stroke color ala http://krazydad.com/tutorials/rainbow/
        // didn't help
        //ctx.strokeStyle = color;
        //
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.lineTo(x4, y4);
        ctx.closePath();
        ctx.fill();
        if (Dom.get('resolution').value != 'low' && (timeScale > 1)) // stroking polygons is cpu intensive so only do it if we have the cycles
            ctx.stroke();
    },

    //---------------------------------------------------------------------------

    bigpoly:function (ctx, xyArray1, xyArray2) { //, color) {

        /*if (color != currentColor) {
         ctx.fillStyle = color;
         ctx.strokeStyle = color;
         currentColor = color;
         }
         */

        ctx.beginPath();
        ctx.moveTo(xyArray2[0], xyArray2[1]);
        var i;
        for (i = 2; i < xyArray2.length - 1; i += 2) {
            ctx.lineTo(xyArray2[i], xyArray2[i + 1]);
        }
        ctx.lineTo(xyArray1[0], xyArray1[1]);
        for (i = 2; i < xyArray1.length - 1; i += 2) {
            ctx.lineTo(xyArray1[i], xyArray1[i + 1]);
        }
        //ctx.lineTo(xyArray1[0], xyArray1[1]);
        ctx.closePath();
        ctx.fill();
        if (Dom.get('resolution').value != 'low')
            ctx.stroke();

    },

    //---------------------------------------------------------------------------

    //segment:function (ctx, width, lanes, x1, y1, w1, x2, y2, w2, fog, color, scale, timeMarker) {
    segment:function (ctx, width, lanes, x1, y1, w1, x2, y2, w2, fog, color) {

        // save cpu cycles by not rendering rumble strips (rely on stationary sprites to show forward movement)
        /*
         var r1 = Render.rumbleWidth(w1, lanes),
         r2 = Render.rumbleWidth(w2, lanes),
         l1 = Render.laneMarkerWidth(w1, lanes),
         l2 = Render.laneMarkerWidth(w2, lanes),
         lanew1, lanew2, lanex1, lanex2, lane;
         */
        //efh horizon test - moved grass out to main redraw loop as one large polygon to try to avoid moire pattern during canvas rotation
        //ctx.fillStyle = color.grass;
        //ctx.fillRect(0, y2, width, y1 - y2);

        // save cpu cycles by not rendering rumble strips (rely on stationary sprites to show forward movement)
        //Render.polygon(ctx, x1-w1-r1, y1, x1-w1, y1, x2-w2, y2, x2-w2-r2, y2, color.rumble);
        //Render.polygon(ctx, x1+w1+r1, y1, x1+w1, y1, x2+w2, y2, x2+w2+r2, y2, color.rumble);
        //if (timeScale ==3) {  // water background
        //Render.polygon(ctx, x1-w1,    y1, x1+w1, y1, x2+w2, y2, x2-w2,    y2, 		'#0077aa');
        //} else {
        //Render.polygon(ctx, x1-w1,    y1, x1+w1, y1, x2+w2, y2, x2-w2,    y2, color.road);
        Render.polygon(ctx, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, color);
        //console.log(x1-w1,    y1, x1+w1, y1, x2+w2, y2, x2-w2,    y2);
        //}

        /*if (color.lane) {
         lanew1 = w1*2/lanes;
         lanew2 = w2*2/lanes;
         lanex1 = x1 - w1 + lanew1;
         lanex2 = x2 - w2 + lanew2;
         for(lane = 1 ; lane < lanes ; lanex1 += lanew1, lanex2 += lanew2, lane++)
         Render.polygon(ctx, lanex1 - l1/2, y1, lanex1 + l1/2, y1, lanex2 + l2/2, y2, lanex2 - l2/2, y2, color.lane);
         }*/
        /*
         if (timeMarker) {
         //var fontsize = Math.round(y1-y2)*10;
         //var fontsize = width;
         var fontsize = Math.round(scale*300000);
         //console.log(scale, fontsize, x1+w1+r1, y1);
         ctx.fillStyle    = '#fff';
         ctx.font = fontsize + "px sans-serif"
         ctx.fillText(timeMarker, x1+w1+r1, y1);
         }
         */
        //fog creates moire during canvas rotation so omit for now
        //Render.fog(ctx, 0, y1, width, y2-y1, fog);
    },

    //---------------------------------------------------------------------------

    timeMarker:function (ctx, width, lanes, x1, y1, w1, clipY, scale, color, timeMarker) {

        // don't really want to have to recalc r1 (already did it for segment), maybe figure out a way to save
        var fontsize = Math.round(scale * 300000);
        if (fontsize > (y1 - clipY)) {
            //var r1 = Math.round(Render.rumbleWidth(w1, lanes));
            //console.log(fontsize, x1+w1+r1, y1, clipY);
            ctx.save();
            ctx.fillStyle = color;
            ctx.font = fontsize + "px sans-serif";
            if (timeBackward)
                ctx.fillText(timeMarker, x1 + w1, y1);
            else
                ctx.fillText(timeMarker, x1 - w1, y1);
            //ctx.fillText(timeMarker, x1 + w1 + r1, y1);
            ctx.restore();
        }

        /*
         var r1 = Math.round(Render.rumbleWidth(w1, lanes));
         var fontsize = Math.round(scale*300000);
         var clipH = clipY ? Math.max(0, y1+1+fontsize-clipY) : 0;
         //var clipH = clipY ? Math.max(0, y1-clipY) : 0;
         if (clipH < fontsize) { // text is visible above hills
         //var fontsize = Math.round(y1-y2)*10;
         //var fontsize = width;
         //console.log(scale, fontsize, x1+w1+r1, y1);
         ctx2.clearRect(0, 0, canvas2.width,canvas2.height);
         ctx2.textBaseline = 'top';
         ctx2.fillStyle    = '#fff';
         ctx2.font = fontsize + "px sans-serif"
         ctx2.fillText(timeMarker, 1, 1);
         //ctx.fillText(timeMarker, x1+w1+r1, y1);
         console.log(fontsize, clipH, clipY, x1+w1+r1, y1);
         ctx.drawImage(canvas2, 0, 0, canvas2.width, clipH, x1+w1+r1, y1, canvas2.width, clipH);
         }
         */
    },

    //---------------------------------------------------------------------------

    background:function (ctx, background, width, height, layer, rotation, offset) {

        rotation = rotation || 0;
        offset = offset || 0;

        var imageW = layer.w / 2;
        var imageH = layer.h;

        var sourceX = layer.x + Math.floor(layer.w * rotation);
        var sourceY = layer.y;
        var sourceW = Math.min(imageW, layer.x + layer.w - sourceX);
        var sourceH = imageH;

        var destX = 0;
        var destY = offset;
        var destW = Math.floor(width * (sourceW / imageW));
        var destH = height;

        ctx.drawImage(background, sourceX, sourceY, sourceW, sourceH, destX, destY, destW, destH);
        if (sourceW < imageW)
            ctx.drawImage(background, layer.x, sourceY, imageW - sourceW, sourceH, destW - 1, destY, width - destW, destH);
    },

    //---------------------------------------------------------------------------

    sprite:function (ctx, width, height, resolution, roadWidth, sprites, sprite, scale, destX, destY, offsetX, offsetY, clipY, counterRotate, carPercent) {
        counterRotate = counterRotate || 0;
        carPercent = carPercent || 0;
        offsetY = offsetY || -.97; // -1 is 1x the height of the sprite in the up (negative) y direction, meaning the sprite will sit at ground level

        //  scale for projection AND relative to roadWidth (for tweakUI)
        var destW = (sprite.w * scale * width / 2) * (SPRITES.SCALE * roadWidth);
        var destH = (sprite.h * scale * width / 2) * (SPRITES.SCALE * roadWidth);
      //  if (timeScale  == 3)
      //  	destH = destH/2;

        destX = destX + (destW * (offsetX || 0));
        destY = destY + (destH * (offsetY || 0));

        //var clipH = clipY ? Math.max(0, destY+destH-clipY) : 0;
        var clipH = (timeScale < 2)? 0: (carPercent && timeScale==3) ? destH/2+destH/15*carPercent : clipY ? Math.max(0, destY + destH - clipY) : 0;

/*
        //perhaps clip bottom of sprite
        var clipH = 0;
        var xtraY = 0; // pixels to shift sprite downloads to accommodate offsetY
        //if (timeScale < 2) { // timescale < 2 is space, don't clip anything: sprites float above and below the road surface
        //    clipH = 0;
        //} else
        if (carPercent && timeScale==3) { // timescale 3 is water world - want player sprites to appear floating
            clipH = destH/2+destH/15*carPercent;
        } else if (clipY) { // sprite perhaps clipped by ground (looking over hills for eg) but if offset down slightly (eg: ground level of sprite image isn't the very bottom of the sprite graphic) then don't clip as much
            xtraY = -destH * (-1 -offsetY); // eg: offsetY = -.7 (shift slightly downwards) and destH = 100 makes xtraY 30px
            clipH = Math.max(0, destY + destH - xtraY - clipY);
        }
*/
        /*} else if (clipY && offsetY <= -1) { // regular clip of sprite by ground (looking over hills for eg)
            clipH = Math.max(0, destY + destH - clipY);
        } else if (clipY) { // possible clipping but sprite is also offset down slightly (eg: ground level of sprite image isn't the very bottom of the sprite graphic)
            xtraH = -destH * (-1 -offsetY);
            clipH = Math.max(0, destY + destH - clipY - xtraH);
        }*/

        if (clipH < destH) {
//			if (counterRotate) {
            //alert ("counterRotate");
//				ctx3.clearRect(0, 0, canvas3.width,canvas3.height);
//				alert ("cleared ctx3");
            //ctx3.drawImage(sprites, sprite.x, sprite.y, sprite.w, sprite.h - (sprite.h*clipH/destH), 0, 0, destW, destH - clipH);
            //console.log(sprite);
            //console.log(canvas3.width, canvas3.height, destX, destY, destW, destH);
            //ctx3.translate(0,0);

            //if (currentRotation<>0) alert (currentRotation);
//				ctx3.save();
//				ctx3.translate(canvas3.width/2,canvas3.height/2);
//				 var playerSegment = findSegment(position+playerZ);
//				ctx3.rotate(playerSegment.curve*(Math.PI/90));
//				ctx3.translate(-canvas3.width/2,-canvas3.height/2);
//				ctx3.drawImage(sprites, sprite.x, sprite.y, sprite.w, sprite.h - (sprite.h*clipH/destH), 0, 0, destW, destH - clipH);
//				//ctx3.drawImage(sprites, sprite.x, sprite.y, sprite.w, sprite.h, 0, 0, sprite.w, sprite.h);
//				
//				ctx3.restore();
//				//ctx.drawImage(canvas3, 0, 0, sprite.w, sprite.h - (sprite.h*clipH/destH), destX, destY, destW, destH - clipH);
//				ctx.drawImage(canvas3, destX, destY, destW, destH);
            //ctx.drawImage(canvas3, 0, 0, sprite.w, sprite.h - (sprite.h*clipH/destH), destX, destY, destW, destH - clipH);
            //ctx.drawImage(canvas3, 0, 0);//, sprite.w, sprite.h - (sprite.h*clipH/destH), destX, destY, destW, destH - clipH);
            //ctx.drawImage(canvas3, 0, 0, canvas3.width, canvas3.height - (sprite.h*clipH/destH), destX, destY, destW, destH - clipH);

            //ctx.save();
            if (counterRotate != 0) {
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(counterRotate);
                ctx.translate(-canvas.width / 2, -canvas.height / 2);
            }

            //ctx3.drawImage(sprites, sprite.x, sprite.y, sprite.w, sprite.h - (sprite.h*clipH/destH), 0, 0, destW, destH - clipH);
            //ctx3.drawImage(sprites, sprite.x, sprite.y, sprite.w, sprite.h, 0, 0, sprite.w, sprite.h);

            //ctx3.restore();

//				ctx.drawImage(sprites, sprite.x, sprite.y, sprite.w, sprite.h - (sprite.h*clipH/destH), destX, destY, destW, destH - clipH);

            //} else {
            ctx.drawImage(sprites, sprite.x, sprite.y, sprite.w, sprite.h - (sprite.h * clipH / destH), destX, destY, destW, destH - clipH);
//            ctx.drawImage(sprites, sprite.x, sprite.y, sprite.w, sprite.h - (sprite.h * clipH / (destH+xtraY)), destX, destY+xtraY, destW, destH - clipH);
            //}
            if (counterRotate != 0) {
                ctx.translate(canvas.width / 2, canvas.height / 2);
                ctx.rotate(-counterRotate);
                ctx.translate(-canvas.width / 2, -canvas.height / 2);
            }
            //ctx.restore();
        }
    },

    //---------------------------------------------------------------------------

    player:function (ctx, width, height, resolution, roadWidth, sprites, speedPercent, scale, destX, destY, steer, updown) {

        var bounce = (1.5 * Math.random() * speedPercent * resolution) * Util.randomChoice([-1, 1]);
        if (destY > 9000) { // flying
            destY = 9000;
            bounce = 0;
        }
        var sprite;
        var counterRotate = 0;
        //testing new wheelbarrow sprites
        var pushDown = (120 * resolution);
        scale = scale / 1.6;
        if (bike && timeScale > 1 && timeScale != 3) // avoid rotation when drawing space roads that include dark underneath segments (get moire otherwise), also for water world
            counterRotate = currentRotation * 1.5 * (Math.PI / 90);
        if (steer < 0) {
            sprite = (updown > 0) ? SPRITES.PLAYER3LEFT : SPRITES.PLAYER3LEFT;
        } else if (steer > 0) {
            sprite = (updown > 0) ? SPRITES.PLAYER3RIGHT : SPRITES.PLAYER3RIGHT;
        } else {
            sprite = (updown > 0) ? SPRITES.PLAYER3 : SPRITES.PLAYER3;
        }
        Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite, scale, destX, destY + bounce+ pushDown, -0.5, -1, 0, counterRotate);

        /*
        if (bike) {
            //scale = scale / 2;
            if (timeScale > 1 && timeScale != 3) // avoid rotation when drawing space roads that include dark underneath segments (get moire otherwise), also for water world
                counterRotate = currentRotation * 2 * (Math.PI / 90);
            if (autoSteer) {

                sprite = SPRITES.BIKE3_STRAIGHT;
            } else {
                if (steer < 0) {
                    sprite = SPRITES.BIKE3_LEFT;
                } else if (steer > 0) {
                    sprite = SPRITES.BIKE3_RIGHT;
                } else {
                    sprite = SPRITES.BIKE3_STRAIGHT;
                }
            }
            //if ((autoSteer && currentRotation < -0.3) || steer < 0)
            //	sprite = SPRITES.BIKE3_LEFT;
            //else if ((autoSteer && currentRotation > 0.3) || steer > 0)
            //	sprite = SPRITES.BIKE3_RIGHT;
            //else
            //	sprite = SPRITES.BIKE3_STRAIGHT;
        } else {
            if (steer < 0)
                sprite = (updown > 0) ? SPRITES.PLAYER_UPHILL_LEFT : SPRITES.PLAYER_LEFT;
            else if (steer > 0)
                sprite = (updown > 0) ? SPRITES.PLAYER_UPHILL_RIGHT : SPRITES.PLAYER_RIGHT;
            else
                sprite = (updown > 0) ? SPRITES.PLAYER_UPHILL_STRAIGHT : SPRITES.PLAYER_STRAIGHT;
        }
        Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite, scale, destX, destY + bounce, -0.5, -1, 0, counterRotate);
        */
    },

    //---------------------------------------------------------------------------

    fog:function (ctx, x, y, width, height, fog) {
        if (fog < 1) {
            ctx.globalAlpha = (1 - fog);
            ctx.fillStyle = COLORS.FOG;
            ctx.fillRect(x, y, width, height);
            ctx.globalAlpha = 1;
        }
    },

    rumbleWidth:function (projectedRoadWidth, lanes) {
        return projectedRoadWidth / Math.max(6, 2 * lanes);
    },
    laneMarkerWidth:function (projectedRoadWidth, lanes) {
        return projectedRoadWidth / Math.max(32, 8 * lanes);
    }

};

//=============================================================================
// RACING GAME CONSTANTS
//=============================================================================

var KEY = {
    LEFT:37,
    UP:38,
    RIGHT:39,
    DOWN:40,
    A:65,
    D:68,
    S:83,
    W:87,
    F:70
};

var COLORS = {
    SKY:'#72D7EE',
    TREE:'#005108',
    //FOG:  'grey',
    FOG:'#005108',
    LIGHT:{ road:'#BAA378', grass:'#10AA10', rumble:'#555588', lane:'#CCCCCC'  },
    DARK:{ road:'#444422', grass:'#10AA10', rumble:'#BBBBee'                   },
    START:{ road:'white', grass:'white', rumble:'white'                     },
    FINISH:{ road:'black', grass:'black', rumble:'black'                     }
};
//  LIGHT:  { road: '#6B6B6B', grass: '#10AA10', rumble: '#555555', lane: '#CCCCCC'  },
//  DARK:   { road: '#696969', grass: '#009A00', rumble: '#BBBBBB'                   },

//var BACKGROUND = {
//  HILLS: { x:   5, y:   5, w: 1280, h: 480 },
//  SKY:   { x:   5, y: 495, w: 1280, h: 480 },
//  TREES: { x:   5, y: 985, w: 1280, h: 480 }
//};

var BACKGROUND = {
GALAXY: { x:1291, y:0, w: 1280, h:480},
HILLS: { x:0, y:982, w: 1280, h:480},
SKY: { x:0, y:491, w: 1280, h:480},
TREES: { x:0, y:0, w: 1280, h:480}
};

var SPRITES = {
AGAVE: { x:1240, y:1182, w: 120, h:108},
ASTEROID1: { x:1293, y:725, w: 150, h:150},
AYERSROCK: { x:0, y:787, w: 496, h:117},
BILLBOARD1: { x:686, y:0, w: 566, h:311},
CACTUS: { x:1304, y:415, w: 95, h:299},
HICKORY: { x:1093, y:322, w: 200, h:343},
HILL1: { x:682, y:676, w: 600, h:100},
HILL2: { x:0, y:1209, w: 400, h:67},
ISLE: { x:0, y:1301, w: 250, h:43},
ISLE_MANGROVE: { x:0, y:1054, w: 330, h:124},
ISLE_PALM: { x:507, y:787, w: 300, h:173},
ISLE_PALM2: { x:682, y:322, w: 400, h:220},
JAPMAPLE: { x:1263, y:0, w: 200, h:175},
JUNIPER: { x:1304, y:186, w: 150, h:218},
OTHER1: { x:1401, y:978, w: 100, h:81},
OTHER2: { x:1401, y:886, w: 100, h:81},
OTHER3: { x:1410, y:599, w: 100, h:81},
OTHER4: { x:1410, y:507, w: 100, h:81},
OTHER5: { x:1410, y:415, w: 100, h:81},
PALM2: { x:818, y:787, w: 200, h:256},
PLAYER3: { x:1401, y:1070, w: 100, h:74},
PLAYER3LEFT: { x:874, y:1070, w: 100, h:74},
PLAYER3RIGHT: { x:763, y:1070, w: 100, h:74},
ROCKS1: { x:422, y:1301, w: 150, h:70},
ROCKS2: { x:261, y:1301, w: 150, h:70},
SEEDS1: { x:1371, y:1235, w: 50, h:69},
SEEDS2: { x:1137, y:1235, w: 50, h:69},
SEEDS3: { x:1076, y:1235, w: 50, h:69},
SEEDS4: { x:1015, y:1235, w: 50, h:69},
SEEDS5: { x:644, y:1235, w: 50, h:69},
SEEDS6: { x:583, y:1235, w: 50, h:69},
SEEDS7: { x:1401, y:1155, w: 50, h:69},
SEEDS8: { x:1454, y:771, w: 50, h:69},
SEEDS9: { x:1454, y:691, w: 50, h:69},
SHOAL: { x:371, y:725, w: 300, h:52},
SHRUB1: { x:763, y:1182, w: 150, h:92},
STAR1: { x:1029, y:998, w: 200, h:200},
STAR2: { x:552, y:998, w: 200, h:200},
STAR3: { x:341, y:998, w: 200, h:200},
STAR4: { x:1029, y:787, w: 200, h:200},
TIMEJUMPDOWN: { x:1240, y:1034, w: 150, h:137},
TIMEJUMPUP: { x:1240, y:886, w: 150, h:137},
TIMENET2: { x:0, y:0, w: 675, h:280},
TREE3: { x:371, y:322, w: 300, h:361},
TULIPIFERA: { x:0, y:322, w: 360, h:400},
YUCCA: { x:924, y:1155, w: 80, h:71}
};

//SPRITES.SCALE = 0.3 * (1 / SPRITES.PLAYER_STRAIGHT.w) // the reference sprite width should be 1/3rd the (half-)roadWidth
SPRITES.SCALE = 0.3 * (1 / SPRITES.PLAYER3.w); // the reference sprite width should be 1/3rd the (half-)roadWidth

//SPRITES.BILLBOARDS = [SPRITES.BILLBOARD01, SPRITES.BILLBOARD02, SPRITES.BILLBOARD03, SPRITES.BILLBOARD04, SPRITES.BILLBOARD05, SPRITES.BILLBOARD06, SPRITES.BILLBOARD07, SPRITES.BILLBOARD08, SPRITES.BILLBOARD09];
SPRITES.SEEDS = [SPRITES.SEEDS1, SPRITES.SEEDS2, SPRITES.SEEDS3, SPRITES.SEEDS4, SPRITES.SEEDS5, SPRITES.SEEDS6, SPRITES.SEEDS7, SPRITES.SEEDS8, SPRITES.SEEDS9 ];
SPRITES.PLANTS = [SPRITES.TULIPIFERA, SPRITES.TREE3, SPRITES.HICKORY, SPRITES.JAPMAPLE, SPRITES.SHRUB1, SPRITES.JUNIPER, SPRITES.HILL1, SPRITES.HILL2, SPRITES.ROCKS2];
//SPRITES.PLANTS = [SPRITES.TREE1, SPRITES.TREE2, SPRITES.DEAD_TREE1, SPRITES.DEAD_TREE2, SPRITES.PALM_TREE, SPRITES.BUSH1, SPRITES.BUSH2, SPRITES.CACTUS, SPRITES.STUMP, SPRITES.BOULDER1, SPRITES.BOULDER2, SPRITES.BOULDER3];
//SPRITES.CARS = [SPRITES.CAR01, SPRITES.CAR02, SPRITES.CAR03, SPRITES.CAR04, SPRITES.SEMI, SPRITES.TRUCK];
SPRITES.CARS = [SPRITES.OTHER1, SPRITES.OTHER2, SPRITES.OTHER3, SPRITES.OTHER4, SPRITES.OTHER5];
SPRITES.STARS = [SPRITES.ASTEROID1, SPRITES.STAR1, SPRITES.STAR2, SPRITES.STAR3, SPRITES.STAR4, SPRITES.STAR1, SPRITES.STAR2, SPRITES.STAR3, SPRITES.STAR4];
//SPRITES.BOULDERS = [SPRITES.BOULDER1, SPRITES.BOULDER2, SPRITES.BOULDER3];
SPRITES.DESERT = [SPRITES.AGAVE, SPRITES.AYERSROCK, SPRITES.CACTUS, SPRITES.ROCKS1, SPRITES.YUCCA, SPRITES.AGAVE, SPRITES.AGAVE, SPRITES.AGAVE, SPRITES.ROCKS1, SPRITES.YUCCA, SPRITES.YUCCA, SPRITES.YUCCA, SPRITES.YUCCA ];
SPRITES.WATER = [SPRITES.SHOAL, SPRITES.SHOAL, SPRITES.ISLE_MANGROVE, SPRITES.ISLE_PALM, SPRITES.ISLE_PALM2, SPRITES.ISLE_PALM2];

