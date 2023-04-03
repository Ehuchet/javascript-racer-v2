/**
 * Created with JetBrains WebStorm.
 * User: Emmanuel
 * Date: 1/28/13
 * Time: 11:24 AM
 * To change this template use File | Settings | File Templates.
 */
var fps = 60; // how many 'update' frames per second
var step = 1 / fps; // how long is each frame (in seconds)
var width = 1024; // logical canvas width
var height = 768; // logical canvas height
var centrifugal = 0.15; // centrifugal force multiplier when going around curves
//var offRoadDecel = 0.99;                    // speed multiplier when off road (e.g. you lose 2% speed each update frame)
//var skySpeed = 0.0005;                   // background sky layer scroll speed when going around curve (or up hill)
//var hillSpeed = 0.0009;                   // background hill layer scroll speed when going around curve (or up hill)
//var treeSpeed = 0.0011;                   // background tree layer scroll speed when going around curve (or up hill)
//var galaxySpeed = 0.0003;                   // background galaxy layer scroll speed when going around curve (or up hill)
//var skyOffset = 0;                       // current sky scroll offset
//var hillOffset = 0;                       // current hill scroll offset
//var treeOffset = 0;                       // current tree scroll offset
//var galaxyOffset = 0;                       // current galaxy scroll offset

var segments = []; // array of road segments
var cars = []; // array of cars on the road
var seedSprites = []; // array of seed sprites on the road
var timeJumps = []; // array of timejump sprites on the road

var stats = Game.stats("fps"); // mr.doobs FPS counter
var canvas = Dom.get("canvas"); // our canvas...
//var canvasFrame = Dom.get('frame');       // our canvas...
var ctx = canvas.getContext("2d"); // ...and its drawing context
//efh offscreen render -- didn't help with moire during rotation and made FPS worse so revert
// repurpose offscreen canvas to clip timeMarker text
//		var canvas2 = document.createElement('canvas'); // offscreen canvas for prerendering
//			canvas2.setAttribute('width', width);
//      canvas2.setAttribute('height', height);
//			var ctx2 = canvas2.getContext('2d');

//temp canvas used to counterRotate player sprite if bike + autoSteer
//var canvas3 = document.createElement('canvas'); // offscreen canvas for prerendering
//	canvas3.setAttribute('width', SPRITES.PLAYER_STRAIGHT.w);
//  canvas3.setAttribute('height', SPRITES.PLAYER_STRAIGHT.h);
//var ctx3 = canvas3.getContext('2d');
//var rotationFrame = document.getElementById("rotationFrame");

var background = null; // our background image (loaded below)
var sprites = null; // our spritesheet (loaded below)
var resolution = null; // scaling factor to provide resolution independence (computed)
var autoSteer = false;
var bike = true;
var currentColor = null;

var roadWidth = 2000; // actually half the roads width, easier math if the road spans from -roadWidth to +roadWidth
var segmentLength = 200; // length of a single segment
var rumbleLength = 6; // number of segments per red/white rumble strip
var trackLength = null; // z length of entire track (computed)
var lanes = 1; // number of lanes
var fieldOfView = 100; // angle (degrees) for field of view
var cameraHeight = 1000; // z height of camera
var cameraDepth = null; // z distance camera is from screen (computed)
var drawDistance = 300; // number of segments to draw
var playerX = 0; // player x offset from center of road (-1 to 1 to stay independent of roadWidth)
var playerZ = null; // player relative z distance from camera (computed)
var fogDensity = 0; // exponential fog density
var position = 0; // current camera Z position (add playerZ to get player's absolute Z position)
var speed = 0; // current speed
var maxSpeed = segmentLength / step; // top speed (ensure we can't move more than 1 segment in a single frame to make collision detection easier)
var saveMaxSpeed = maxSpeed;
var accel = maxSpeed / 5; // acceleration rate - tuned until it 'felt' right
var breaking = -maxSpeed; // deceleration rate when braking
var decel = -maxSpeed / 5; // 'natural' deceleration rate when neither accelerating, nor braking
var offRoadDecel = -maxSpeed / 2; // off road deceleration is somewhere in between
var offRoadLimit = maxSpeed / 4; // limit when off road deceleration no longer applies (e.g. you can always go at least this speed even when off road)
var totalCars = 30; // total number of cars on the road
var currentLapTime = 0; // current lap time
var lastLapTime = null; // last lap time
var currentRotation = 0; //horizon tilt

var seedsObtained = 0;
var seedsTotal = 0;

var circles = []; // used for explosions
var circleCount = 500; // decreased if we're in lowres mode
var fragments = []; // alternative for explosions - uses sprites instead of drawing polygons
var fragmentCount = 100; // decreased if we're in lowres mode
var fragmentSprite = SPRITES.STAR1;

var keyLeft = false;
var keyRight = false;
var keyFaster = false;
var keySlower = false;

var keyCount = 0; // used to compute smoothness, based on number of keyup or touchup events per segment traveled (fewer jerky movements is better)

var hud = {
  speed: { value: null, dom: Dom.get("speed_value") },
  smoothness: { value: null, dom: Dom.get("smoothness_value") },
  seeds_collected: { value: null, dom: Dom.get("seeds_collected_value") },
  km_remaining: { value: null, dom: Dom.get("km_remaining_value") },
  time_marker: { value: null, dom: Dom.get("time_marker_value") },
  scale_factor: { value: null, dom: Dom.get("scale_factor_value") },
};

var timeScales = [];
timeScales.push(
  // timeScale 0 - space, largest scale
  {
    bg1: BACKGROUND.GALAXY,
    bg1Speed: 0.0003, // background layer scroll speed when going around curve (or up hill)
    bg1Offset: 0, // current scroll offset for background 1
    allowRotate: false,
    timeMarkerColor: "#FFFFFF",
    timeIncr: 500000000, // every .5 billion years
    timeSpacing: 200, // segments between markers
    roadType: 1, // how to draw road - 0 don't, 1 indiv segments, 2 big polygon
  }
);
timeScales.push(
  // timeScale 1 - space, next largest scale
  {
    bg1: BACKGROUND.GALAXY,
    bg1Speed: 0.0003, // background layer scroll speed when going around curve (or up hill)
    bg1Offset: 0, // current scroll offset for background 1
    allowRotate: false,
    timeMarkerColor: "#FFFFFF",
    timeIncr: 50000000, // every 50 million years
    timeSpacing: 200, // segments between markers
    roadType: 1, // how to draw road - 0 don't, 1 indiv segments, 2 big polygon
  }
);
timeScales.push(
  // timeScale 2 - desert world, no road, sandy ground
  {
    bg1: BACKGROUND.SKY,
    bg1Speed: 0.0005, // background layer scroll speed when going around curve (or up hill)
    bg1Offset: 0, // current scroll offset for background 1
    allowRotate: true,
    timeMarkerColor: "#FACC2E",
    timeIncr: 5000000, // every 5 million years
    timeSpacing: 200, // segments between markers
    roadType: 0, // how to draw road - 0 don't, 1 indiv segments, 2 big polygon
    groundColor: COLORS.LIGHT.road,
  }
);
timeScales.push(
  // timeScale 3 - water world, no road, blue "ground"
  {
    bg1: BACKGROUND.SKY,
    bg1Speed: 0.0005, // background layer scroll speed when going around curve (or up hill)
    bg1Offset: 0, // current scroll offset for background 1
    allowRotate: false,
    timeMarkerColor: "#FACC2E",
    timeIncr: 1000000, // every 1 million years
    timeSpacing: 200, // segments between markers
    roadType: 0, // how to draw road - 0 don't, 1 indiv segments, 2 big polygon
    groundColor: "#0077aa",
  }
);
timeScales.push(
  // timeScale 4 - regular world, grass "ground"
  {
    bg1: BACKGROUND.SKY,
    bg1Speed: 0.0005, // background layer scroll speed when going around curve (or up hill)
    bg1Offset: 0, // current scroll offset for background 1
    bg2: BACKGROUND.HILLS,
    bg2Speed: 0.0009, // background layer scroll speed when going around curve (or up hill)
    bg2Offset: 0, // current scroll offset for background 1
    bg3: BACKGROUND.TREES,
    bg3Speed: 0.0011, // background layer scroll speed when going around curve (or up hill)
    bg3Offset: 0, // current scroll offset for background 1
    allowRotate: true,
    timeMarkerColor: "#FFFFFF",
    timeIncr: 50000, // every 50k years
    timeSpacing: 200, // number of segments between successive timeScale Markers
    roadType: 2, // how to draw road - 0 don't, 1 indiv segments, 2 big polygon
    groundColor: COLORS.DARK.grass,
  }
);
timeScales.push(
  // timeScale 5 - regular world, grass "ground"
  {
    bg1: BACKGROUND.SKY,
    bg1Speed: 0.0005, // background layer scroll speed when going around curve (or up hill)
    bg1Offset: 0, // current scroll offset for background 1
    bg2: BACKGROUND.HILLS,
    bg2Speed: 0.0009, // background layer scroll speed when going around curve (or up hill)
    bg2Offset: 0, // current scroll offset for background 1
    bg3: BACKGROUND.TREES,
    bg3Speed: 0.0011, // background layer scroll speed when going around curve (or up hill)
    bg3Offset: 0, // current scroll offset for background 1
    allowRotate: true,
    timeMarkerColor: "#FFFFFF",
    timeIncr: 5000, // every 5k years
    timeSpacing: 200, // number of segments between successive timeScale Markers
    roadType: 2, // how to draw road - 0 don't, 1 indiv segments, 2 big polygon
    groundColor: COLORS.DARK.grass,
  }
);
timeScales.push(
  // timeScale 6 - regular world, grass "ground"
  {
    bg1: BACKGROUND.SKY,
    bg1Speed: 0.0005, // background layer scroll speed when going around curve (or up hill)
    bg1Offset: 0, // current scroll offset for background 1
    bg2: BACKGROUND.HILLS,
    bg2Speed: 0.0009, // background layer scroll speed when going around curve (or up hill)
    bg2Offset: 0, // current scroll offset for background 1
    bg3: BACKGROUND.TREES,
    bg3Speed: 0.0011, // background layer scroll speed when going around curve (or up hill)
    bg3Offset: 0, // current scroll offset for background 1
    allowRotate: true,
    timeMarkerColor: "#FFFFFF",
    timeIncr: 500, // every 500 years
    timeSpacing: 200, // number of segments between successive timeScale Markers
    roadType: 2, // how to draw road - 0 don't, 1 indiv segments, 2 big polygon
    groundColor: COLORS.DARK.grass,
  }
);
timeScales.push(
  // timeScale 7 - regular world, grass "ground"
  {
    bg1: BACKGROUND.SKY,
    bg1Speed: 0.0005, // background layer scroll speed when going around curve (or up hill)
    bg1Offset: 0, // current scroll offset for background 1
    bg2: BACKGROUND.HILLS,
    bg2Speed: 0.0009, // background layer scroll speed when going around curve (or up hill)
    bg2Offset: 0, // current scroll offset for background 1
    bg3: BACKGROUND.TREES,
    bg3Speed: 0.0011, // background layer scroll speed when going around curve (or up hill)
    bg3Offset: 0, // current scroll offset for background 1
    allowRotate: true,
    timeMarkerColor: "#FFFFFF",
    timeIncr: 5, // every 5 years
    timeSpacing: 200, // number of segments between successive timeScale Markers
    roadType: 2, // how to draw road - 0 don't, 1 indiv segments, 2 big polygon
    groundColor: COLORS.DARK.grass,
  }
);
timeScales.push(
  // timeScale 8 - regular world, grass "ground"
  {
    bg1: BACKGROUND.SKY,
    bg1Speed: 0.0005, // background layer scroll speed when going around curve (or up hill)
    bg1Offset: 0, // current scroll offset for background 1
    bg2: BACKGROUND.HILLS,
    bg2Speed: 0.0009, // background layer scroll speed when going around curve (or up hill)
    bg2Offset: 0, // current scroll offset for background 1
    bg3: BACKGROUND.TREES,
    bg3Speed: 0.0011, // background layer scroll speed when going around curve (or up hill)
    bg3Offset: 0, // current scroll offset for background 1
    allowRotate: true,
    timeMarkerColor: "#FFFFFF",
    timeIncr: 1, // every 1 year
    timeSpacing: 200, // number of segments between successive timeScale Markers
    roadType: 2, // how to draw road - 0 don't, 1 indiv segments, 2 big polygon
    groundColor: COLORS.DARK.grass,
  }
);

var timeScale = 5;
var currentTimeScale = null; // current timescale object - properties describe how level looks
chgTimeScale();
var timeScaleJump = 0; // alpha value used to display explosion when we jump timescales
//var timeSpacing = 100; // number of segments between successive timeScale Markers
var timeStart = 35; // number of segments from start to display "today"
var timeBackward = true; // direction of travel (true means we're going back in time, false means returning to today)

//-------------------------------------------------------------------------
function chgTimeScale(incr) {
  incr = incr || 0;
  if (incr == 0) {
    timeScale = Util.randomInt(0, 8);
  } else {
    timeScale = timeScale + incr;
    timeScale = timeScale < 0 ? 8 : timeScale > 8 ? 0 : timeScale;
  }
  currentTimeScale = timeScales[timeScale];
  console.log ('position = ' position );
  if (timeScale == 3) {
    // water
    maxSpeed = maxSpeed / 2;
  } else {
    maxSpeed = saveMaxSpeed;
  }
}

//-------------------------------------------------------------------------
function createCircle() {
  var size = 2; //default starting size
  var rmax = 25; //default maximum radius
  var alpha = 0; //default starting alpha

  if (timeScaleJump > 0) {
    // create a bigger/whiter explosion for timescale jumps
    size = 4;
    rmax = 30;
    alpha = 0.75;
  }

  //Place the circles just below the center
  this.x = Math.round(canvas.width / 2);
  this.y = Math.round((canvas.height * 5) / 9);

  //Random velocities between -20 and +20 (negative value so that they move in both directions)
  this.vx = -20 + Math.random() * 40;
  this.vy = -20 + Math.random() * 40;

  //White or random colors
  if (timeScaleJump > 0) {
    this.r = 255;
    this.g = 255;
    this.b = 255;
  } else {
    this.r = Math.round(Math.random() * 255);
    this.g = Math.round(Math.random() * 255);
    this.b = Math.round(Math.random() * 255);
    //this.r = Util.randomInt(0, 255);
    //this.g = Util.randomInt(0, 255);
    //this.b = Util.randomInt(0, 255);
  }

  //Random starting radius and increase speed

  this.radius = Math.round(size + Math.random());
  this.vr = 0.05 + Math.random();
  this.rmax = rmax;

  //Random starting alpha and decrease speed
  this.a = Math.max(alpha + Math.random(), 1);
  this.va = 0.01 + Math.random() / 20;
}

//-------------------------------------------------------------------------
function createFragment() {
  var fsize = 0.005; //default starting %size
  var maxsize = 2.5; //default maximum %size
  this.a = 0.5 * Math.random(); //random starting alpha
  this.va = 0.0005 + Math.random() / 100; // alpha decrease factor
  this.vx = -20 + Math.random() * 40; // pace at which the sprite moves away from the centre
  this.vy = -20 + Math.random() * 40;
  this.vs = 1 + Math.random() * 0.1; // speed of sprite

  if (timeScaleJump > 0) {
    // create a bigger/whiter explosion for timescale jumps
    fsize = 0.003;
    maxsize = 2.5;
    this.a = 0.5 * Math.random(); //random starting alpha
    this.va = 0.0005 + Math.random() / 100;
    this.vx = -15 + Math.random() * 30;
    this.vy = -15 + Math.random() * 30;
    this.vs = 1 + Math.random() * 0.08;
  }

  //Place the fragments just below the center
  this.x = Math.round(canvas.width / 2);
  this.y = Math.round((canvas.height * 5) / 9);

  //Random starting width and increase speed
  var initsize = fsize + Math.random();
  this.w = Math.round(fragmentSprite.w * initsize);
  this.h = Math.round(fragmentSprite.h * initsize);
  this.maxw = fragmentSprite.w * maxsize;
}

//=========================================================================
// UPDATE THE GAME WORLD
//=========================================================================

function update(dt) {
  var n, car, carW, sprite, spriteW;
  var playerSegment = findSegment(position + playerZ);
  //var playerW = SPRITES.PLAYER_STRAIGHT.w * SPRITES.SCALE;
  var playerW = SPRITES.PLAYER3.w * SPRITES.SCALE;
  var speedPercent = speed / maxSpeed;
  var dx = dt * 2 * speedPercent; // at top speed, should be able to cross from left to right (-1 to 1) in 1 second
  // test slipperyness
  //dx = dx * centrifugal/.15;
  var startPosition = position;

  //updateHud('scale_factor',playerSegment.p1.world.y); // test

  //    updateCars(dt, playerSegment, playerW);

  //position = Util.increase(position, dt * speed, trackLength);
  // remove looping, now reverse when we reach the end
  position = Util.limit(position + dt * speed, 0, trackLength);
  if (position == trackLength) {
    //kill the gas if we're back home
    if (!timeBackward) {
      speed = 0;
      Game.exit();
    }

    segments.reverse();
    var seg;
    // go thru and switch the segment geometry so we're now facing the other way
    for (var n = 0; n < segments.length; n++) {
      seg = segments[n];
      seg.index = segments.length - seg.index;
      savep1 = seg.p1;
      seg.p1 = seg.p2;
      seg.p2 = savep1;
      //reverse the z coord
      seg.p1.world.z = trackLength - seg.p1.world.z;
      seg.p2.world.z = trackLength - seg.p2.world.z;
      //seg.p1.world.x = -seg.p1.world.x;
      //seg.p2.world.x = -seg.p2.world.x;
      //p1:{ world:{ y:lastY(), z:n * segmentLength }, camera:{}, screen:{} },
      //p2:{ world:{ y:y, z:(n + 1) * segmentLength }, camera:{}, screen:{} },
      //curve:curve,
      //sprites:[],
      //cars:[],
      //color:Math.floor(n / rumbleLength) % 2 ? COLORS.DARK : COLORS.LIGHT
      seg.curve = -seg.curve;
    }
    // go thru and switch car indexes to reverse their direction
    for (var n = 0; n < cars.length; n++) {
      car = cars[n];
      car.z = trackLength - car.z;
      //oldSegment = findSegment(car.z);
      //car.offset = car.offset + updateCarOffset(car, oldSegment, playerSegment, playerW);
      //car.z = Util.increase(car.z, dt * car.speed, trackLength);
      //car.percent = Util.percentRemaining(car.z, segmentLength); // useful for interpolation during rendering phase
      //newSegment = findSegment(car.z);
      //if (oldSegment != newSegment) {
      //    var index = oldSegment.cars.indexOf(car);
      //    oldSegment.cars.splice(index, 1);
      //    newSegment.cars.push(car);
      //}
    }
    // go thru and mirror the other onroad sprites
    for (var n = 0; n < seedSprites.length; n++) {
      var spr = seedSprites[n];
      spr.offset = -spr.offset;
    }
    for (var n = 0; n < timeJumps.length; n++) {
      var spr = timeJumps[n];
      spr.offset = -spr.offset;
    }

    timeBackward = !timeBackward;
    if (timeBackward) ctx.textAlign = "left";
    else ctx.textAlign = "right";
    startPosition = 0;
    position = Util.limit(0 + dt * speed, 0, trackLength);
    currentRotation = 0;
    playerSegment = findSegment(playerZ);
  }

  updateCars(dt, playerSegment, playerW);

  updateHud(
    "smoothness",
    Math.round((position + (timeBackward ? 0 : trackLength)) / 10000 / keyCount)
  ); // test

  //if (!autoSteer) {
  if (keyLeft) playerX = playerX - dx;
  else if (keyRight) playerX = playerX + dx;
  //}

  playerX = playerX - dx * speedPercent * playerSegment.curve * centrifugal;
  // keep on path is done further down
  //if (autoSteer) {
  //   playerX = Util.limit(playerX, -.8, .8);     //keep on path
  //}

  if (keyFaster || autoSteer) speed = Util.accelerate(speed, accel, dt);
  else if (keySlower) speed = Util.accelerate(speed, breaking, dt);
  //else
  //  speed = Util.accelerate(speed, decel, dt);

  /* comment section since we now constrain player to road
     if ((playerX < -1) || (playerX > 1)) {

     if (speed > offRoadLimit)
     speed = Util.accelerate(speed, offRoadDecel, dt);

     // need to update collision test to account for new height attribute of sprite
     for(n = 0 ; n < playerSegment.sprites.length ; n++) {
     sprite  = playerSegment.sprites[n];
     spriteW = sprite.source.w * SPRITES.SCALE;
     if (Util.overlap(playerX, playerW, sprite.offset + spriteW/2 * (sprite.offset > 0 ? 1 : -1), spriteW)) {
     speed = maxSpeed/5;
     position = Util.increase(playerSegment.p1.world.z, -playerZ, trackLength); // stop in front of sprite (at front of segment)
     break;
     }
     }
     }
     */

  //if current segment includes a timemarker update the hud to show it
  if (playerSegment.timeMarker)
    updateHud(
      "time_marker",
      timeMarkerVal(timeScale, playerSegment.timeMarker)
    ); // test
  //Dom.show('time_marker');

  // new test for onroad sprite collision
  for (n = 0; n < playerSegment.sprites.length; n++) {
    //need to chg to use special array for stationary sprites that excludes off-road ones
    sprite = playerSegment.sprites[n];
    if (sprite.roadSprite) {
      spriteW = sprite.source.w * SPRITES.SCALE;
      //if (Util.overlap(playerX, playerW, sprite.offset + spriteW/2, spriteW, .8)) {
      //if (Util.overlap(playerX, playerW, sprite.offset + spriteW/2 * (sprite.offset > 0 ? 1 : -1), spriteW, .8)) {
      var spriteX = sprite.offset; //+ spriteW/2;
      //var spriteX = sprite.offset*(timeBackward?1:-1);
      //updateHud('scale_factor',playerX+","+ playerW+","+ spriteX +","+ spriteW+","+ sprite.source.w+","+ SPRITES.SCALE); // test
      if (Util.overlap(playerX, playerW, spriteX, spriteW, 0.8)) {
        //if (sprite.spriteType && currentRotation != 0) {
        if (sprite.timeJump) {
          // if we're leaning around a corner when we hit a timejump, reset the horizon tilt
          if (currentRotation != 0) {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate(currentRotation * (Math.PI / 90));
            ctx.translate(-canvas.width / 2, -canvas.height / 2);
            currentRotation = 0;
          }

          // try out an explosion of sorts
          //circles = baseCircles.slice(0);
          if (timeScaleJump <= 0) {
            //time scale jump
            timeScaleJump = 0.98;

            // use circles for low-res, fragments (sprites) otherwise
            if (width == 480) {
              circles = [];
              //noinspection JSDuplicatedDeclaration
              for (var i = 0; i < circleCount; i++) {
                //circles.push(new createCircle(false,10,300,.98));
                //circles.push(new createCircle(true, (1-(i/circleCount))));
                //noinspection JSPotentiallyInvalidConstructorUsage
                circles.push(new createCircle());
              }
            } else {
              fragments = [];
              for (var j = 0; j < fragmentCount; j++) {
                //noinspection JSPotentiallyInvalidConstructorUsage
                fragments.push(new createFragment());
              }
            }

            //timeScale = Util.randomInt(0,8);
            //if (sprite.offset > 0) { // hit billboard on right side of road, increase timescale
            //    chgTimeScale(1);
            //} else { // hit billboard on left side, decrease timescale
            //    chgTimeScale(-1);
            //}

            chgTimeScale(sprite.timeJump);

            // change total cars count to change world
            //window.setTimeout(reduceCars, 250);
            reduceCars();

            // randomly change timescale
            //timeScale = Util.randomInt(0,8);
            // change total cars count to change world
            //window.setTimeout(reduceCars, 750);
            //totalCars = totalCars-1;
            //resetRoad();
          }
        } else if (sprite.seedSprite) {
          // create flash when hitting seed, remove seed sprite from segment
          //noinspection JSDuplicatedDeclaration
          var seedFlash = circleCount / 10;
          //if (width == 480) {
          circles = [];
          for (var k = 0; k < seedFlash; k++) {
            //circles.push(new createCircle(false,10,300,.98));
            //circles.push(new createCircle(true, (1-(i/circleCount))));
            //noinspection JSPotentiallyInvalidConstructorUsage
            circles.push(new createCircle());
          }
          //} else {
          //    fragments = [];
          //    for (var j = 0; j < seedFlash; j++) {
          //        //noinspection JSPotentiallyInvalidConstructorUsage
          //        fragments.push(new createFragment());
          //    }
          //}
          playerSegment.sprites.splice(n, 1);
          seedsObtained++;
          updateHud("seeds_collected", seedsObtained + "/" + seedsTotal);

          // test slipperyness
          //if (seedsObtained == 3 || seedsObtained == 6 || seedsObtained == 9 || seedsObtained == 12 )
          //    centrifugal = 0.3;
          //else
          //    centrifugal = 0.15;
        }
        break;
      }
    }
  }

  // see if we are hitting any other players
  for (n = 0; n < playerSegment.cars.length; n++) {
    car = playerSegment.cars[n];
    carW = car.sprite.w * SPRITES.SCALE;
    if (speed > car.speed) {
      if (Util.overlap(playerX, playerW, car.offset, carW, 0.8)) {
        speed = car.speed * (car.speed / speed);
        position = Util.increase(car.z, -playerZ, trackLength);

        // if we're leaning around a corner when we hit, reset the horizon tilt
        if (currentRotation != 0) {
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.rotate(currentRotation * (Math.PI / 90));
          ctx.translate(-canvas.width / 2, -canvas.height / 2);
          currentRotation = 0;
        }

        // use circles for low-res explosion, fragments (sprites) otherwise
        if (width == 480) {
          if (circles.length < circleCount * 2) {
            //noinspection JSDuplicatedDeclaration
            for (var i = 0; i < circleCount; i++) {
              //circles.push(new createCircle());
              //noinspection JSPotentiallyInvalidConstructorUsage
              circles.push(new createCircle());
            }
          }
        } else {
          if (fragments.length < fragmentCount * 2) {
            //noinspection JSDuplicatedDeclaration
            for (var i = 0; i < fragmentCount; i++) {
              //noinspection JSPotentiallyInvalidConstructorUsage
              fragments.push(new createFragment());
            }
          }
        }

        break;
      }
    }
  }

  if (timeScaleJump > 0) {
    timeScaleJump -= dt / 2;
    //updateHud('scale_factor',timeScaleJump); // test
  }

  //playerX = Util.limit(playerX, -3, 3);     // dont ever let it go too far out of bounds
  playerX = Util.limit(playerX, -0.9, 0.9); // dont ever let it go too far out of bounds
  speed = Util.limit(speed, 0, maxSpeed); // or exceed maxSpeed

  currentTimeScale.bg1Offset = Util.increase(
    currentTimeScale.bg1Offset,
    (currentTimeScale.bg1Speed *
      playerSegment.curve *
      (position - startPosition)) /
      segmentLength,
    1
  );
  currentTimeScale.bg2Offset = Util.increase(
    currentTimeScale.bg2Offset,
    (currentTimeScale.bg2Speed *
      playerSegment.curve *
      (position - startPosition)) /
      segmentLength,
    1
  );
  currentTimeScale.bg3Offset = Util.increase(
    currentTimeScale.bg3Offset,
    (currentTimeScale.bg3Speed *
      playerSegment.curve *
      (position - startPosition)) /
      segmentLength,
    1
  );
  //skyOffset = Util.increase(skyOffset, skySpeed * playerSegment.curve * (position - startPosition) / segmentLength, 1);
  //hillOffset = Util.increase(hillOffset, hillSpeed * playerSegment.curve * (position - startPosition) / segmentLength, 1);
  //treeOffset = Util.increase(treeOffset, treeSpeed * playerSegment.curve * (position - startPosition) / segmentLength, 1);
  //galaxyOffset = Util.increase(galaxyOffset, galaxySpeed * playerSegment.curve * (position - startPosition) / segmentLength, 1);

  if (position > playerZ) {
    if (currentLapTime && startPosition < playerZ) {
      //          lastLapTime    = currentLapTime;
      //          currentLapTime = 0;
      /*
             if (lastLapTime <= Util.toFloat(Dom.storage.scale_factor)) {
             Dom.storage.scale_factor = lastLapTime;
             updateHud('scale_factor', formatTime(lastLapTime));
             Dom.addClassName('scale_factor', 'fastest');
             Dom.addClassName('time_marker', 'fastest');
             }
             else {
             Dom.removeClassName('scale_factor', 'fastest');
             Dom.removeClassName('time_marker', 'fastest');
             }
             */
      //          updateHud('time_marker', formatTime(lastLapTime));
      //          Dom.show('time_marker');
    } else {
      currentLapTime += dt;
    }
  }

  //      updateHud('speed',            5 * Math.round(speed/500));
  updateHud(
    "speed",
    Math.round(((5 * Math.round(speed / 500)) / maxSpeed) * 10000)
  );
  //      updateHud('seeds_collected', formatTime(currentLapTime));
  updateHud("km_remaining", Math.floor((trackLength - position) / 20000));
  updateHud("scale_factor", timeScale); // test
}

//-------------------------------------------------------------------------
function reduceCars() {
  totalCars = totalCars - 1;
  resetRoad();
}

//-------------------------------------------------------------------------

function updateCars(dt, playerSegment, playerW) {
  var n, car, oldSegment, newSegment;
  for (n = 0; n < cars.length; n++) {
    car = cars[n];
    oldSegment = findSegment(car.z);
    car.offset =
      car.offset + updateCarOffset(car, oldSegment, playerSegment, playerW);
    car.z = Util.increase(car.z, dt * car.speed, trackLength);
    car.percent = Util.percentRemaining(car.z, segmentLength); // useful for interpolation during rendering phase
    newSegment = findSegment(car.z);
    if (oldSegment != newSegment) {
      var index = oldSegment.cars.indexOf(car);
      oldSegment.cars.splice(index, 1);
      newSegment.cars.push(car);
    }
  }
}

function updateCarOffset(car, carSegment, playerSegment, playerW) {
  var i,
    j,
    dir,
    segment,
    otherCar,
    otherCarW,
    lookahead = 20,
    carW = car.sprite.w * SPRITES.SCALE;

  // optimization, dont bother steering around other cars when 'out of sight' of the player
  if (carSegment.index - playerSegment.index > drawDistance) return 0;

  for (i = 1; i < lookahead; i++) {
    segment = segments[(carSegment.index + i) % segments.length];

    if (
      segment === playerSegment &&
      car.speed > speed &&
      Util.overlap(playerX, playerW, car.offset, carW, 1.2)
    ) {
      if (playerX > 0.5) dir = -1;
      else if (playerX < -0.5) dir = 1;
      else dir = car.offset > playerX ? 1 : -1;
      //return dir * 1 / i * (car.speed - speed) / maxSpeed; // the closer the cars (smaller i) and the greated the speed ratio, the larger the offset
      return ((dir / i) * (car.speed - speed)) / maxSpeed; // the closer the cars (smaller i) and the greated the speed ratio, the larger the offset
    }

    for (j = 0; j < segment.cars.length; j++) {
      otherCar = segment.cars[j];
      otherCarW = otherCar.sprite.w * SPRITES.SCALE;
      if (
        car.speed > otherCar.speed &&
        Util.overlap(car.offset, carW, otherCar.offset, otherCarW, 1.2)
      ) {
        if (otherCar.offset > 0.5) dir = -1;
        else if (otherCar.offset < -0.5) dir = 1;
        else dir = car.offset > otherCar.offset ? 1 : -1;
        //return dir * 1 / i * (car.speed - otherCar.speed) / maxSpeed;
        return ((dir / i) * (car.speed - otherCar.speed)) / maxSpeed;
      }
    }
  }

  // if no cars ahead, but I have somehow ended up off road, then steer back on
  if (car.offset < -0.9) return 0.1;
  else if (car.offset > 0.9) return -0.1;
  else return 0;
}

//-------------------------------------------------------------------------

function updateHud(key, value) {
  // accessing DOM can be slow, so only do it if value has changed
  if (hud[key].value !== value) {
    hud[key].value = value;
    Dom.set(hud[key].dom, value);
  }
}

function formatTime(dt) {
  var minutes = Math.floor(dt / 60);
  var seconds = Math.floor(dt - minutes * 60);
  var tenths = Math.floor(10 * (dt - Math.floor(dt)));
  if (minutes > 0)
    return minutes + "." + (seconds < 10 ? "0" : "") + seconds + "." + tenths;
  else return seconds + "." + tenths;
}

//=========================================================================
// RENDER THE GAME WORLD
//=========================================================================
// order of objects to render
// 1. backgrounds (sky, mountains, trees)
// 2. ground polygon (requires pass thru segments to find horizon line)
// 3. road segments (back to front, for
// 4. stationary sprites
// 5. time markers (treat similar to stationary sprites, clipped by road)
// 6. moving sprites
// 7. player sprite

function render() {
  var baseSegment = findSegment(position);
  var basePercent = Util.percentRemaining(position, segmentLength);
  var playerSegment = findSegment(position + playerZ);
  var playerPercent = Util.percentRemaining(position + playerZ, segmentLength);
  var playerY = Util.interpolate(
    playerSegment.p1.world.y,
    playerSegment.p2.world.y,
    playerPercent
  );
  var maxy = height;

  var x = 0;
  var dx = -(baseSegment.curve * basePercent);

  //efh moire test - rotate canvas first
  //ctx.save();

  //NB: do we actually need to clearRect? we're redrawing a full background every time anyway
  //ctx.clearRect(0, 0, width, height);
  //updateHud('scale_factor', baseSegment.index + "/" + segments.length); // test
  //updateHud('scale_factor',currentRotation); // test
  //updateHud('scale_factor',timeScale); // test

  //if (bike && (timeScale > 1) && (timeScale != 3)) { // avoid rotation when drawing space roads that include dark underneath segments (get moire otherwise); also for water world
  if (bike && currentTimeScale.allowRotate) {
    var rotation = 0;
    //updateHud('km_remaining', baseSegment.curve); // test
    //updateHud('scale_factor', currentRotation); // test
    if (baseSegment.curve == 0) {
      //rotation=-currentRotation;
      currentRotation = 0;
    } else {
      //newrot = -Math.round(baseSegment.curve*speed/maxSpeed*24*10)/10;
      //newrot = Math.round(baseSegment.curve * speed / maxSpeed * 1000) / 1000;
      // don't overrotate or we see the undrawn corner of canvas
      var newrot = Util.limit(
        Math.round(((baseSegment.curve * speed) / maxSpeed) * 1000) / 1000,
        -6,
        6
      );
      //updateHud('scale_factor', newrot); // test
      rotation = newrot - currentRotation;
      currentRotation = newrot;
    }
    if (rotation != 0) {
      //ctx.save(); // doesn't help with moire problem
      //console.log(rotation);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(-rotation * (Math.PI / 90));
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      //ctx.restore();

      //efh test dom css rotation instead of canvas rotation
      //					rotationFrame.style.webkitTransform = "rotate(" + rotation + "deg)";
      //					rotationFrame.style.MozTransform = "rotate(" + rotation + "deg)";
      //					rotationFrame.style.transform = "rotate(" + rotation + "deg)";

      //efh offscreen render
      //ctx2.translate(canvas.width/2,canvas.height/2);
      //ctx2.rotate(-rotation*(Math.PI/90));
      //ctx2.translate(-canvas.width/2,-canvas.height/2);
    }
  }

  //efh offscreen render
  //ctx.clearRect(0, 0, width, height);
  //ctx2.clearRect(0, 0, width, height);

  Render.background(
    ctx,
    background,
    width,
    height,
    currentTimeScale.bg1,
    currentTimeScale.bg1Offset,
    resolution * currentTimeScale.bg1Speed * playerY
  );
  if (currentTimeScale.bg2)
    Render.background(
      ctx,
      background,
      width,
      height,
      currentTimeScale.bg2,
      currentTimeScale.bg2Offset,
      resolution * currentTimeScale.bg2Speed * playerY
    );
  if (currentTimeScale.bg3)
    Render.background(
      ctx,
      background,
      width,
      height,
      currentTimeScale.bg3,
      currentTimeScale.bg3Offset,
      resolution * currentTimeScale.bg3Speed * playerY
    );

  /*
    if (timeScale == 2 || timeScale == 3) { // water and desert world - sky down to horizon
        Render.background(ctx, background, width, height, BACKGROUND.SKY, skyOffset, resolution * skySpeed * playerY);
    } else if (timeScale <= 1) { // space background
        Render.background(ctx, background, width, height, BACKGROUND.GALAXY, galaxyOffset, resolution * galaxySpeed * playerY);
    } else if (timeScale > 1) { // regular background
        Render.background(ctx, background, width, height, BACKGROUND.SKY, skyOffset, resolution * skySpeed * playerY);
        Render.background(ctx, background, width, height, BACKGROUND.HILLS, hillOffset, resolution * hillSpeed * playerY);
        Render.background(ctx, background, width, height, BACKGROUND.TREES, treeOffset, resolution * treeSpeed * playerY);
    }
    */
  //Render.background(ctx2, background, width, height, BACKGROUND.SKY,   skyOffset,  resolution * skySpeed  * playerY);
  //Render.background(ctx2, background, width, height, BACKGROUND.HILLS, hillOffset, resolution * hillSpeed * playerY);
  //Render.background(ctx2, background, width, height, BACKGROUND.TREES, treeOffset, resolution * treeSpeed * playerY);

  var n, i, segment, car, sprite, spriteScale, spriteX, spriteY;

  //efh horizon test - store array of segments to render later
  // no longer using segarray - set properties of segment objects to control display/color/etc
  //var segarray = [];
  for (n = 0; n < drawDistance; n++) {
    //segment = segments[(baseSegment.index + n) % segments.length];
    // remove looping, now we stop drawing when we reach the end
    //var segIndex = Util.increase(baseSegment.index, n , segments.length);
    segment = segments[Util.increase(baseSegment.index, n, segments.length)];
    //* (timeBackward?1:-1)
    //segment.looped = segment.index < baseSegment.index;
    segment.fog = Util.exponentialFog(n / drawDistance, fogDensity);
    segment.clip = maxy;

    //Util.project(segment.p1, (playerX * roadWidth) - x, playerY + cameraHeight, position - (segment.looped ? trackLength : 0), cameraDepth, width, height, roadWidth);
    //Util.project(segment.p2, (playerX * roadWidth) - x - dx, playerY + cameraHeight, position - (segment.looped ? trackLength : 0), cameraDepth, width, height, roadWidth);

    Util.project(
      segment.p1,
      playerX * roadWidth - x,
      playerY + cameraHeight,
      position,
      cameraDepth,
      width,
      height,
      roadWidth
    );
    Util.project(
      segment.p2,
      playerX * roadWidth - x - dx,
      playerY + cameraHeight,
      position,
      cameraDepth,
      width,
      height,
      roadWidth
    );

    x = x + dx;
    dx = dx + segment.curve;

    //        if ((segment.p1.camera.z <= cameraDepth)         || // behind us
    //            ((segment.p2.screen.y >= segment.p1.screen.y) && (! segment.timeMarker)) || // back face cull
    //            (segment.p2.screen.y >= segment.p1.screen.y) || // back face cull
    //            (segment.p2.screen.y >= maxy))                  // clip by (already rendered) hill
    //          continue;

    //efh horizst - don't render yet, save until we have horizon line, draw ground, then render segments
    //segarray.push(segment.index);
    segment.drawRoad = true;
    segment.color = COLORS.LIGHT.road; //'#BAA378';
    //ctx.fillStyle = COLORS.LIGHT.road; //'#BAA378';
    //ctx.strokeStyle = COLORS.LIGHT.road; //'#BAA378';
    if (timeScale < 2) {
      // show underside of road ahead if we're in space
      segment.color = COLORS.DARK.road; //'#BAA378';
      var frontSegment = cameraDepth + ((segmentLength * speed) / maxSpeed) * 2;
      //if (segment.p1.camera.z < frontSegment) {
      if (segment.p2.screen.y < segment.p1.screen.y) {
        segment.color = COLORS.LIGHT.road;
      }
      if (segment.p1.camera.z < frontSegment) {
        segment.drawRoad = false;
      }
    } else {
      if (
        segment.p1.camera.z < cameraDepth || // behind us
        segment.p2.screen.y >= segment.p1.screen.y || // back face cull
        segment.p2.screen.y >= maxy
      ) {
        // clip by (already rendered) hill
        //if ((timeScale < 2) && (segment.p2.screen.y >= segment.p1.screen.y)) {
        //					if (timeScale < 2) {
        //						// show underside of road ahead if we're in space
        //						segment.color = COLORS.DARK.road; //'#BAA378';
        //						if (segment.p1.camera.z < frontSegment) {
        //							segment.drawRoad = false;
        //						}
        //						if  (segment.p2.screen.y < segment.p1.screen.y) {
        //							segment.color = COLORS.LIGHT.road;
        //						}
        //
        //						//ctx.fillStyle = '#444444'; //COLORS.DARK.road; //'#BAA378';
        //						//ctx.strokeStyle = '#444444'; //COLORS.DARK.road; //'#BAA378';
        //					} else { // don't show
        segment.drawRoad = false;
        //					}
      } else {
        maxy = segment.p1.screen.y;
      }
    }
  }

  //efh horizon test - now that we know maxy, draw one large polygon for ground
  ctx.save();
  if (currentTimeScale.groundColor) {
    // draw ground
    ctx.fillStyle = currentTimeScale.groundColor;
    ctx.fillRect(0, maxy - 1, width, height);
  }

  /*
    if (timeScale < 2) {  // space, no ground
        // canvas bg is black so leave it alone
        //ctx.fillStyle = '#000000';
        //ctx.fillRect(0, 0, width, height);
    } else if (timeScale == 2) {  // sand background
        ctx.fillStyle = COLORS.LIGHT.road;
        ctx.fillRect(0, maxy-1, width, height);
    } else if (timeScale == 3) {  // water background
        ctx.fillStyle = '#0077aa';
        ctx.fillRect(0, maxy-1, width, height);
    } else {  // regular background
        ctx.fillStyle = COLORS.DARK.grass;
        ctx.fillRect(0, maxy, width, height);
    }
    */
  ctx.restore();
  //efh offscreen render
  //ctx2.fillStyle = COLORS.DARK.grass;
  //ctx2.fillRect(0, maxy, width, height);

  //test combining road segments into one polygon for drawing speed
  //if (timeScale > 3) {  // space (0&1) requires indiv road segments to clip flying sprites; sand or water background (2&3) don't show road
  if (currentTimeScale.roadType == 2) {
    // space (0&1) requires indiv road segments to clip flying sprites; sand or water background (2&3) don't show road
    //if ( timeScale > 3 && timeScale != 8) {  // test timescale 8 as indiv road segments as well to compare with 7 which is bigpoly
    var xyArray1 = [];
    var xyArray2 = [];
    var lastx1 = 0;
    var lastx2 = 0;
    for (n = drawDistance - 1; n > 0; n--) {
      var seg = segments[(baseSegment.index + n) % segments.length];
      if (seg.drawRoad) {
        // sand or water background don't show road
        if (lastx1 != seg.p2.screen.x - seg.p2.screen.w) {
          lastx1 = seg.p2.screen.x - seg.p2.screen.w;
          xyArray1.push(lastx1, seg.p2.screen.y);
        }
        if (lastx2 != seg.p2.screen.x + seg.p2.screen.w) {
          lastx2 = seg.p2.screen.x + seg.p2.screen.w;
          xyArray2.unshift(lastx2, seg.p2.screen.y);
        }

        xyArray1.push(seg.p1.screen.x - seg.p1.screen.w, seg.p1.screen.y);
        xyArray2.unshift(seg.p1.screen.x + seg.p1.screen.w, seg.p1.screen.y);
      }
    }
    ctx.fillStyle = COLORS.LIGHT.road;
    ctx.strokeStyle = COLORS.LIGHT.road;
    Render.bigpoly(ctx, xyArray1, xyArray2); //, COLORS.LIGHT.road);
  }

  // then draw segments (see modified render method to omit grass)
  //for(i = 0 ; i < segarray.length ; i++) {
  //for(i = (segarray.length-1) ; i >= 0 ; i--) {
  for (n = drawDistance - 1; n > 0; n--) {
    //segment = segments[segarray[i]];
    segment = segments[(baseSegment.index + n) % segments.length];
    //efh offscreen render
    //Render.segment(ctx2, width, lanes,

    // draw road segments

    //if (segment.drawRoad && timeScale <= 1) {  // space backgrounds only use indiv segments to overlay flying sprites (bigpoly doesn't work)
    if (segment.drawRoad && currentTimeScale.roadType == 1) {
      // space backgrounds only use indiv segments to overlay flying sprites (bigpoly doesn't work)
      //if (segment.drawRoad && (timeScale <= 1 || timeScale == 8)) {  // test timescale 8 as indiv road segments as well to compare with 7 which is bigpoly

      Render.segment(
        ctx,
        width,
        lanes,
        segment.p1.screen.x,
        segment.p1.screen.y,
        segment.p1.screen.w,
        segment.p2.screen.x,
        segment.p2.screen.y,
        segment.p2.screen.w,
        segment.fog,
        segment.color
      );
      //                      segment.color,
      //											segment.p1.screen.scale,
      //											segment.timeMarker);
    }

    // draw stationary sprites
    //if (timeScale > 1) {
    for (i = 0; i < segment.sprites.length; i++) {
      sprite = segment.sprites[i];
      if (sprite.roadSprite) {
        spriteScale = Util.interpolate(
          segment.p1.screen.scale,
          segment.p2.screen.scale,
          1
        );
        spriteX =
          Util.interpolate(segment.p1.screen.x, segment.p2.screen.x, 1) +
          (spriteScale * sprite.offset * roadWidth * width) / 2;
        spriteY = Util.interpolate(segment.p1.screen.y, segment.p2.screen.y, 1);
        Render.sprite(
          ctx,
          width,
          height,
          resolution,
          roadWidth,
          sprites,
          sprite.source,
          spriteScale,
          spriteX,
          spriteY,
          -0.5,
          sprite.offsetY,
          segment.clip
        );
      } else {
        spriteScale = segment.p1.screen.scale;
        spriteX =
          segment.p1.screen.x +
          (spriteScale * sprite.offset * roadWidth * width) / 2;
        spriteY = segment.p1.screen.y;
        Render.sprite(
          ctx,
          width,
          height,
          resolution,
          roadWidth,
          sprites,
          sprite.source,
          spriteScale,
          spriteX,
          spriteY,
          sprite.offset < 0 ? -1 : 0,
          sprite.offsetY,
          segment.clip
        );
        // change (sprite.offset < 0 ? -1 : 0) to just sprite.offset to allow sprites to be spread out further left and right
        //Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite.source, spriteScale, spriteX, spriteY, sprite.offset, sprite.offsetY, segment.clip);
      }
    }
    //}

    // draw time markers
    if (segment.timeMarker) {
      Render.timeMarker(
        ctx,
        width,
        lanes,
        segment.p1.screen.x,
        segment.p1.screen.y,
        segment.p1.screen.w,
        segment.clip,
        segment.p1.screen.scale,
        currentTimeScale.timeMarkerColor,
        // segment.timeMarker);
        timeMarkerVal(timeScale, segment.timeMarker)
      );
    }

    // draw moving sprites
    for (i = 0; i < segment.cars.length; i++) {
      car = segment.cars[i];
      sprite = car.sprite;
      spriteScale = Util.interpolate(
        segment.p1.screen.scale,
        segment.p2.screen.scale,
        car.percent
      );
      spriteX =
        Util.interpolate(
          segment.p1.screen.x,
          segment.p2.screen.x,
          car.percent
        ) +
        (spriteScale * car.offset * roadWidth * width) / 2;
      spriteY = Util.interpolate(
        segment.p1.screen.y,
        segment.p2.screen.y,
        car.percent
      );
      Render.sprite(
        ctx,
        width,
        height,
        resolution,
        roadWidth,
        sprites,
        car.sprite,
        spriteScale,
        spriteX,
        spriteY,
        -0.5,
        car.offsetY,
        segment.clip,
        0,
        car.percent
      );
    }

    // draw player sprite
    if (segment == playerSegment) {
      //efh offscreen render
      //Render.player(ctx2, width, height, resolution, roadWidth, sprites, speed/maxSpeed,
      Render.player(
        ctx,
        width,
        height,
        resolution,
        roadWidth,
        sprites,
        speed / maxSpeed,
        cameraDepth / playerZ,
        width / 2,
        height / 2 -
          ((cameraDepth / playerZ) *
            Util.interpolate(
              playerSegment.p1.camera.y,
              playerSegment.p2.camera.y,
              playerPercent
            ) *
            height) /
            2,
        speed * (keyLeft ? -1 : keyRight ? 1 : 0),
        playerSegment.p2.world.y - playerSegment.p1.world.y
      );
    }
  }

  /*
     // pass thru segments again (this time all of them) from back to front
     for(n = (drawDistance-1) ; n > 0 ; n--) {
     segment = segments[(baseSegment.index + n) % segments.length];

     for(i = 0 ; i < segment.sprites.length ; i++) {
     sprite      = segment.sprites[i];
     spriteScale = segment.p1.screen.scale;
     spriteX     = segment.p1.screen.x + (spriteScale * sprite.offset * roadWidth * width/2);
     //try the following to create a sense of sprites coming at you from the right
     //spriteX     = (segment.p1.screen.x + (spriteScale * sprite.offset * roadWidth * width/2))*2;
     spriteY     = segment.p1.screen.y;
     //spriteY     = segment.p1.screen.y + (spriteScale * sprite.height);

     //Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite.source, spriteScale, spriteX, spriteY, (sprite.offset < 0 ? -1 : 0), (sprite.offsety), segment.clip);
     // change (sprite.offset < 0 ? -1 : 0) to just sprite.offset to allow sprites to be spread out further left and right
     Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite.source, spriteScale, spriteX, spriteY, sprite.offset , sprite.offsety, segment.clip);

     //efh offscreen render
     //Render.sprite(ctx, width, height, resolution, roadWidth, sprites, sprite.source, spriteScale, spriteX, spriteY, (sprite.offset < 0 ? -1 : 0), -1, segment.clip);
     //Render.sprite(ctx2, width, height, resolution, roadWidth, sprites, sprite.source, spriteScale, spriteX, spriteY, (sprite.offset < 0 ? -1 : 0), -1, segment.clip);
     }

     //				if (segment.timeMarker) {
     //					Render.timeMarker(ctx, width, lanes,
     //										 segment.p1.screen.x,
     //										 segment.p1.screen.y,
     //										 segment.p1.screen.w,
     //										 segment.clip,
     //										 segment.p1.screen.scale,
     //										 segment.timeMarker);
     //				}

     for(i = 0 ; i < segment.cars.length ; i++) {
     car         = segment.cars[i];
     sprite      = car.sprite;
     spriteScale = Util.interpolate(segment.p1.screen.scale, segment.p2.screen.scale, car.percent);
     spriteX     = Util.interpolate(segment.p1.screen.x,     segment.p2.screen.x,     car.percent) + (spriteScale * car.offset * roadWidth * width/2);
     spriteY     = Util.interpolate(segment.p1.screen.y,     segment.p2.screen.y,     car.percent);
     //efh offscreen render
     Render.sprite(ctx, width, height, resolution, roadWidth, sprites, car.sprite, spriteScale, spriteX, spriteY, -0.5, -1, segment.clip);
     //Render.sprite(ctx2, width, height, resolution, roadWidth, sprites, car.sprite, spriteScale, spriteX, spriteY, -0.5, -1, segment.clip);
     }


     if (segment == playerSegment) {
     //efh offscreen render
     //Render.player(ctx2, width, height, resolution, roadWidth, sprites, speed/maxSpeed,
     Render.player(ctx, width, height, resolution, roadWidth, sprites, speed/maxSpeed,
     cameraDepth/playerZ,
     width/2,
     (height/2) - (cameraDepth/playerZ * Util.interpolate(playerSegment.p1.camera.y, playerSegment.p2.camera.y, playerPercent) * height/2),
     speed * (keyLeft ? -1 : keyRight ? 1 : 0),
     playerSegment.p2.world.y - playerSegment.p1.world.y);
     }
     }

     // finally add timeMarkers (in reverse from horizon forward)
     //			for(i = (segarray.length-1) ; i >= 0 ; i--) {
     //				segment = segments[segarray[i]];
     //				if (segment.timeMarker) {
     //					Render.timeMarker(ctx, width, lanes,
     //										 segment.p1.screen.x,
     //										 segment.p1.screen.y,
     //										 segment.p1.screen.w,
     //										 segment.p1.screen.scale,
     //										 segment.timeMarker);
     //				}
     //			}


     //efh moire test - restore canvas
     //ctx.restore();

     //efh offscreen render
     // now copy offscreen canvas to onscreen one
     //ctx.clearRect(0, 0, width, height); //unnecessary?
     //ctx.drawImage(canvas2, 0, 0, width, height);
     //ctx.drawImage(canvas2, 0, 0);
     */

  // if any explosion remaining display it
  ctx.save();
  //comment out resolution test - display circles and/or fragments, whatever exists in either array
  // low res uses circles
  //if (width == 480) {

  // this line causes firefox desktop 17.0.1 and 18beta to come to a crawl while circles are displayed
  //ctx.globalCompositeOperation = "lighter";
  //ctx.globalCompositeOperation = "destination-out";
  //noinspection JSDuplicatedDeclaration
  for (var j = 0; j < circles.length; j++) {
    var c = circles[j];

    //Create the circles
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2, false);
    ctx.fillStyle = "rgba(" + c.r + ", " + c.g + ", " + c.b + ", " + c.a + ")";
    ctx.fill();

    c.x += c.vx;
    c.y += c.vy;
    //c.radius -= .05;
    c.radius += c.vr;
    c.a -= c.va;
    //c.flashAlpha -= c.vfa;
    //if(c.radius < 0)
    if (c.radius > c.rmax || c.a < 0) circles.splice(j, 1);
    //		circles[j] = new create();
  }
  //} else {

  //noinspection JSDuplicatedDeclaration
  for (var j = 0; j < fragments.length; j++) {
    var f = fragments[j];

    //Create the fragments
    ctx.globalAlpha = f.a;
    ctx.drawImage(
      sprites,
      fragmentSprite.x,
      fragmentSprite.y,
      fragmentSprite.w,
      fragmentSprite.h,
      f.x - f.w / 2,
      f.y - f.h / 2,
      f.w,
      f.h
    );
    ctx.globalAlpha = 1;

    f.x = Math.round(f.x + f.vx);
    f.y = Math.round(f.y + f.vy);
    //f.y += f.vy;
    f.w = f.w * f.vs;
    f.h = f.h * f.vs;
    f.a -= f.va;
    if (f.w > f.maxw || f.a < 0) fragments.splice(j, 1);
  }
  //}

  if (timeScaleJump > 0) {
    ctx.fillStyle = "rgba(255,255,255," + timeScaleJump + ")";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.restore();

  //ctx.restore();
}

function findSegment(z) {
  return segments[Math.floor(z / segmentLength) % segments.length];
}

//=========================================================================
// BUILD ROAD GEOMETRY
//=========================================================================

function lastY() {
  return segments.length == 0 ? 0 : segments[segments.length - 1].p2.world.y;
}

function addSegment(curve, y) {
  var n = segments.length;
  segments.push({
    index: n,
    p1: { world: { y: lastY(), z: n * segmentLength }, camera: {}, screen: {} },
    p2: { world: { y: y, z: (n + 1) * segmentLength }, camera: {}, screen: {} },
    curve: curve,
    sprites: [],
    cars: [],
    color: Math.floor(n / rumbleLength) % 2 ? COLORS.DARK : COLORS.LIGHT,
  });
}

function addSprite(n, sprite, offset, offsety, spriteOptions) {
  // increase negative offsety parm to allow sprites to be positioned above the ground
  // ground level is effectively -1 but needs to be slightly less to prevent illusion of sprites floating so try -.97
  offsety = offsety || -0.97;
  spriteOptions = spriteOptions || {};
  //offsety = offsety || -1;
  var roadSprite = offset > -1 && offset < 1;
  var seedSprite = spriteOptions.seed || false;
  var timeJump = spriteOptions.timejump || false;
  //if (offset > -1 && offset < 1)
  //    roadSprite = true;
  //segments[n].sprites.push({ source:sprite, offset:offset, offsetY:offsety, roadSprite:roadSprite });
  var spr = {
    source: sprite,
    offset: offset,
    offsetY: offsety,
    roadSprite: roadSprite,
    seedSprite: seedSprite,
    timeJump: timeJump,
  };
  segments[n].sprites.push(spr);
  if (seedSprite) seedSprites.push(spr);
  if (timeJump) timeJumps.push(spr);
}

function addRoad(enter, hold, leave, curve, y) {
  var startY = lastY();
  if (timeScale == 3) y = 0;
  // water background - flatten surface
  //var endY = (timeScale == 3) ? startY + (Util.toInt((y / 10), 0) * segmentLength) : startY + (Util.toInt(y, 0) * segmentLength);
  var endY = startY + Util.toInt(y, 0) * segmentLength;
  var n,
    total = enter + hold + leave;
  for (n = 0; n < enter; n++)
    addSegment(
      Util.easeIn(0, curve, n / enter),
      Util.easeInOut(startY, endY, n / total)
    );
  for (n = 0; n < hold; n++)
    addSegment(curve, Util.easeInOut(startY, endY, (enter + n) / total));
  for (n = 0; n < leave; n++)
    addSegment(
      Util.easeInOut(curve, 0, n / leave),
      Util.easeInOut(startY, endY, (enter + hold + n) / total)
    );
}

var ROAD = {
  LENGTH: { NONE: 0, SHORT: 25, MEDIUM: 50, LONG: 100 },
  HILL: { NONE: 0, LOW: 20, MEDIUM: 40, HIGH: 60 },
  CURVE: { NONE: 0, EASY: 2, MEDIUM: 4, HARD: 6 },
};

function addStraight(num) {
  num = num || ROAD.LENGTH.MEDIUM;
  addRoad(num, num, num, 0, 0);
}

function addHill(num, height) {
  num = num || ROAD.LENGTH.MEDIUM;
  height = height || ROAD.HILL.MEDIUM;
  addRoad(num, num, num, 0, height);
}

function addCurve(num, curve, height) {
  num = num || ROAD.LENGTH.MEDIUM;
  curve = curve || ROAD.CURVE.MEDIUM;
  height = height || ROAD.HILL.NONE;
  addRoad(num, num, num, curve, height);
}

function addLowRollingHills(num, height) {
  num = num || ROAD.LENGTH.SHORT;
  height = height || ROAD.HILL.LOW;
  addRoad(num, num, num, 0, height / 2);
  addRoad(num, num, num, 0, -height);
  addRoad(num, num, num, ROAD.CURVE.EASY, height);
  addRoad(num, num, num, 0, 0);
  addRoad(num, num, num, -ROAD.CURVE.EASY, height / 2);
  addRoad(num, num, num, 0, 0);
}

function addSCurves() {
  addRoad(
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    -ROAD.CURVE.EASY,
    ROAD.HILL.NONE
  );
  addRoad(
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.CURVE.MEDIUM,
    ROAD.HILL.MEDIUM
  );
  addRoad(
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.CURVE.EASY,
    -ROAD.HILL.LOW
  );
  addRoad(
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    -ROAD.CURVE.EASY,
    ROAD.HILL.MEDIUM
  );
  addRoad(
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    ROAD.LENGTH.MEDIUM,
    -ROAD.CURVE.MEDIUM,
    -ROAD.HILL.MEDIUM
  );
}

function addBumps() {
  addRoad(10, 10, 10, 0, 5);
  addRoad(10, 10, 10, 0, -2);
  addRoad(10, 10, 10, 0, -5);
  addRoad(10, 10, 10, 0, 8);
  addRoad(10, 10, 10, 0, 5);
  addRoad(10, 10, 10, 0, -7);
  addRoad(10, 10, 10, 0, 5);
  addRoad(10, 10, 10, 0, -2);
}

function addDownhillToEnd(num) {
  num = num || 200;
  addRoad(num, num, num, -ROAD.CURVE.EASY, -lastY() / segmentLength);
}

function resetRoad() {
  segments = [];
  currentRotation = 0;
  keyCount = 0;

  addStraight(ROAD.LENGTH.SHORT);
  //for (n = 0; n < 2; n++) {
  addCurve(ROAD.LENGTH.MEDIUM, -ROAD.CURVE.MEDIUM, -ROAD.HILL.MEDIUM);
  addCurve(ROAD.LENGTH.MEDIUM, ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM);
  addLowRollingHills();
  if (Util.randomInt(0, 1) == 0) {
    addCurve(ROAD.LENGTH.LONG * 4, ROAD.CURVE.EASY, -ROAD.HILL.LOW);
    addCurve(ROAD.LENGTH.LONG * 4, ROAD.CURVE.HARD, -ROAD.HILL.HIGH * 3);
  }
  if (Util.randomInt(0, 1) == 0) {
    addCurve(ROAD.LENGTH.LONG, ROAD.CURVE.HARD, -ROAD.HILL.HIGH);
    addCurve(ROAD.LENGTH.LONG, -ROAD.CURVE.HARD, -ROAD.HILL.HIGH);
  } else {
    addCurve(ROAD.LENGTH.MEDIUM, ROAD.CURVE.MEDIUM, -ROAD.HILL.LOW);
    addCurve(ROAD.LENGTH.MEDIUM, -ROAD.CURVE.MEDIUM, -ROAD.HILL.LOW);
  }
  if (Util.randomInt(0, 1) == 0) {
    addSCurves();
  } else {
    addBumps();
  }

  if (Util.randomInt(0, 1) == 0) {
    addHill(ROAD.LENGTH.MEDIUM, ROAD.HILL.HIGH * 2);
    addHill(ROAD.LENGTH.MEDIUM, -ROAD.HILL.HIGH * 2);
  } else {
    addSCurves();
  }
  if (Util.randomInt(0, 1) == 0) {
    addCurve(ROAD.LENGTH.MEDIUM, ROAD.CURVE.MEDIUM, ROAD.HILL.LOW);
    addBumps();
  } else {
    addLowRollingHills();
  }
  if (Util.randomInt(0, 1) == 0) {
    addCurve(ROAD.LENGTH.LONG * 2, ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM);
    addStraight();
  } else {
    addCurve(ROAD.LENGTH.LONG * 2, -ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM);
    addHill(ROAD.LENGTH.LONG, ROAD.HILL.HIGH * 1.5);
    addHill(ROAD.LENGTH.LONG, -ROAD.HILL.HIGH * 1.5);
  }
  addCurve(ROAD.LENGTH.MEDIUM, -ROAD.CURVE.MEDIUM, -ROAD.HILL.MEDIUM);
  addCurve(ROAD.LENGTH.SHORT, ROAD.CURVE.MEDIUM, ROAD.HILL.LOW);
  addCurve(ROAD.LENGTH.LONG, -ROAD.CURVE.MEDIUM, -ROAD.HILL.MEDIUM);
  addCurve(ROAD.LENGTH.SHORT, ROAD.CURVE.HARD, ROAD.HILL.LOW);
  addCurve(ROAD.LENGTH.MEDIUM, -ROAD.CURVE.MEDIUM, -ROAD.HILL.MEDIUM);
  if (Util.randomInt(0, 1) == 0) {
    addHill(ROAD.LENGTH.MEDIUM, ROAD.HILL.HIGH);
    addSCurves();
    addSCurves();
  } else {
    addSCurves();
    addStraight(ROAD.LENGTH.LONG);
  }
  if (Util.randomInt(0, 1) == 0) {
    addCurve(ROAD.LENGTH.LONG, -ROAD.CURVE.MEDIUM, ROAD.HILL.NONE);
    addHill(ROAD.LENGTH.MEDIUM, ROAD.HILL.HIGH);
    addCurve(ROAD.LENGTH.LONG, ROAD.CURVE.MEDIUM, -ROAD.HILL.LOW);
  } else {
    addBumps();
    addHill(ROAD.LENGTH.LONG, -ROAD.HILL.MEDIUM);
  }
  if (Util.randomInt(0, 1) == 0) {
    addStraight();
    addSCurves();
  } else {
    addBumps();
    addHill(ROAD.LENGTH.LONG, ROAD.HILL.MEDIUM);
  }
  //}

  addDownhillToEnd();

  resetSprites();
  resetCars();
  resetBikeCheckbox(document.getElementById("bike"));

  // turn off start line
  //segments[findSegment(playerZ).index + 2].color = COLORS.START;
  //segments[findSegment(playerZ).index + 3].color = COLORS.START;

  // test add some timeMarkers
  //segments[160].timeMarker = "1960";
  //segments[300].timeMarker = "1900";
  //segments[500].timeMarker = "1800";
  //segments[1000].timeMarker = "2000 BCE";
  //segments[2000].timeMarker = "96 mya";

  var tSpacing = currentTimeScale.timeSpacing;
  for (n = timeStart; n < segments.length; n += tSpacing) {
    //segments[n].timeMarker = timeMarkerVal(timeScale, n);
    segments[n].timeMarker = n;
  }

  // end line
  for (var n = 0; n < rumbleLength; n++)
    segments[segments.length - 1 - n].color = COLORS.FINISH;

  trackLength = segments.length * segmentLength;
}

function timeMarkerVal(timeScale, n) {
  var timeToday = new Date().getFullYear();
  var tIncr = currentTimeScale.timeIncr; // eg 5 = every 5 years, 10000000 = every 10 million years
  var tSpacing = currentTimeScale.timeSpacing;
  var ya = n - timeStart;
  var tSuffix = "";
  var tMarker = (ya * tIncr) / tSpacing;
  if (tIncr == 500) {
    //special formating for BCE/CE dates
    //var testYear = ya * 500;
    if (tMarker >= 10000) {
      tMarker = Math.round((tMarker / 1000) * 1000) / 1000;
      tSuffix = " t.y.a.";
    } else if (tMarker >= 2500) {
      tMarker = tMarker - 2000;
      tSuffix = " BCE";
    } else {
      tMarker = 2000 - tMarker;
      tSuffix = " CE";
    }
  } else if (tMarker >= 1000000000) {
    tSuffix = " b.y.a.";
    tMarker = Math.round((tMarker / 1000000000) * 100) / 100;
  } else if (tMarker >= 1000000) {
    tSuffix = " m.y.a.";
    tMarker = Math.round((tMarker / 1000000) * 100) / 100;
  } else if (tMarker >= 1000) {
    tSuffix = " t.y.a.";
    tMarker = Math.round((tMarker / 1000) * 100) / 100;
  } else {
    tMarker = timeToday - tMarker;
  }
  if (n == timeStart) {
    return "Today";
  } else {
    return tMarker + tSuffix;
  }

  /*
    var timeToday = 2013;
    var tIncr = currentTimeScale.timeIncr;
    var tSpacing = currentTimeScale.timeSpacing;

    var ya = (n - timeStart) / tSpacing;
    if (n == timeStart) {
        return "Today";
    } else if (timeScale == 0) { // every .5 billion years
        return Math.round(ya / 2 * 10) / 10 + " b.y.a.";
        //return Math.round(((n - timeStart) / (timeSpacing * 2)) * 10) / 10 + " b.y.a.";
        //return "-"+Math.round(((n-timeStart)/(timeSpacing*2))*10)/10 + "b";
    } else if (timeScale == 1) { // every 50 million years
        //var ya = ((n - timeStart) / (timeSpacing / 50));
        ya = ya * 50;
        return (ya >= 1000) ? (Math.round(ya / 1000 * 100) / 100) + " b.y.a." : ya + " m.y.a.";
        //return "-"+((n-timeStart)/(timeSpacing/50)) + "m";
    } else if (timeScale == 2) { // every 5 million years
        //var ya = ((n - timeStart) / (timeSpacing / 5));
        ya = ya * 5;
        return (ya >= 1000) ? (Math.round(ya / 1000 * 1000) / 1000) + " b.y.a." : ya + " m.y.a.";
        //return ((n-timeStart)/(timeSpacing/5)) + " m.y.a.";
        //return "-"+((n-timeStart)/(timeSpacing/5)) + "m";
    } else if (timeScale == 3) { // every 1 million years
        //return ((n - timeStart) / timeSpacing) + " m.y.a.";
        return ya + " m.y.a.";
        //return "-"+((n-timeStart)/timeSpacing) + "m";
    } else if (timeScale == 4) { // every 50k years
        //var ya = ((n - timeStart) / (timeSpacing / 50));
        ya = ya * 50;
        return (ya >= 1000) ? (Math.round(ya / 1000 * 100) / 100) + " m.y.a." : ya + " t.y.a.";
        //return ((n-timeStart)/(timeSpacing/50)) + " t.y.a.";
        //return "-"+((n-timeStart)/(timeSpacing/50)) + "k";
    } else if (timeScale == 5) { // every 5k years
        //return ((n - timeStart) / (timeSpacing / 5)) + " t.y.a.";
        return (ya * 5) + " t.y.a.";
        //return "-"+((n-timeStart)/(timeSpacing/5)) + "k";
    } else if (timeScale == 6) { // every 500 years
        //if (n - timeStart > 2000)
        //	return n - timeStart - 2000 + " BCE";
        //else
        //	return 2000 + timeStart - n + " CE";

        //var ya = (n - timeStart) / (timeSpacing / 500);
        ya = ya * 500;
        if (ya >= 10000) {
            return (Math.round(ya / 1000 * 1000) / 1000) + " t.y.a.";
        } else if (ya > 2000) {
            return n - timeStart - 2000 + " BCE";
        } else {
            return 2000 + timeStart - n + " CE";
        }
    } else if (timeScale == 7) {  // every 5 years
        //return timeToday - ((n - timeStart) / 100);
        return timeToday - (ya * 5);
    } else if (timeScale == 8) {  // every year
        //return timeToday - ((n - timeStart) / 500);
        return timeToday - ya;
    } else {
        return "";
    }
    */
}

function resetSprites() {
  var n, i;

  addSprite(120, SPRITES.TIMENET2, 0);

  addSprite(280, SPRITES.BILLBOARD1, -1);
  addSprite(480, SPRITES.BILLBOARD1, 1);

  //addSprite(150,  SPRITES.TIMENET2, -1);
  //addSprite(180,  SPRITES.TIMENET2, -.8);
  //addSprite(210,  SPRITES.TIMENET2, -.7);
  //addSprite(240,  SPRITES.TIMENET2, -.6);
  //addSprite(270,  SPRITES.TIMENET2, -.5);

  //addSprite(20,  SPRITES.BILLBOARD07, -1);
  //addSprite(40,  SPRITES.BILLBOARD06, -1);
  //addSprite(60,  SPRITES.BILLBOARD08, -1);
  //addSprite(80,  SPRITES.BILLBOARD09, -1);
  //addSprite(100, SPRITES.BILLBOARD01, -.5,-1);
  //addSprite(120, SPRITES.BILLBOARD02, -.2,-2);
  //addSprite(140, SPRITES.BILLBOARD03, -.2,-2.8);
  //addSprite(160, SPRITES.BILLBOARD04, -.2,-4);
  //addSprite(180, SPRITES.BILLBOARD05, -.2,-6);

  //addSprite(100, SPRITES.BILLBOARD01, -.8);
  // addSprite(120, SPRITES.BILLBOARD02, -.6);
  /* addSprite(100, SPRITES.BILLBOARD05, -.5);
     addSprite(130, SPRITES.BILLBOARD05, -.2);
     addSprite(160, SPRITES.BILLBOARD05, 0);
     addSprite(190, SPRITES.BILLBOARD05, .2);
     addSprite(220, SPRITES.BILLBOARD05, .5);
     */

  //for (n = 900; n < (segments.length - 750); n += 1500) {
  //    addSprite(n, SPRITES.BILLBOARD05, -.5, -1, {timejump:true});
  //    addSprite(n + 750, SPRITES.BILLBOARD01, .5, -1, {timejump:true});
  //}

  for (n = 900; n < segments.length; n += 900) {
    if (Math.random() >= 0.85) {
      addSprite(n, SPRITES.TIMEJUMPUP, Util.randomInt(-9, 9) / 10, -1, {
        timejump: 1,
      });
    } else if (Math.random() <= 0.15) {
      addSprite(n, SPRITES.TIMEJUMPDOWN, Util.randomInt(-9, 9) / 10, -1, {
        timejump: -1,
      });
    }

    //addSprite(n + 500, Util.randomChoice(SPRITES.SEEDS), .2, -1, {seed:true});
  }

  seedsObtained = 0;
  seedsTotal = 0;
  for (n = 500; n < segments.length; n += 500) {
    addSprite(
      n,
      Util.randomChoice(SPRITES.SEEDS),
      Util.randomInt(-9, 9) / 10,
      -1,
      { seed: true }
    );
    seedsTotal++;
    //addSprite(n + 500, Util.randomChoice(SPRITES.SEEDS), .2, -1, {seed:true});
  }
  updateHud("seeds_collected", "0/" + seedsTotal);

  /*
     addSprite(240,                  SPRITES.BILLBOARD07, -1.2);
     addSprite(240,                  SPRITES.BILLBOARD06,  2.2);
     addSprite(segments.length - 25, SPRITES.BILLBOARD07, -1.2);
     addSprite(segments.length - 25, SPRITES.BILLBOARD06,  2.2);

     for(n = 50 ; n < 200 ; n += 4 + Math.floor(n/100)) {
     addSprite(n, SPRITES.PALM_TREE, 1.5 + Math.random()*0.5);
     addSprite(n, SPRITES.PALM_TREE,   1 + Math.random()*2);
     }
     */
  /*  for(n = 250 ; n < 600 ; n += 5) {
     addSprite(n,     SPRITES.COLUMN, 1.8);
     addSprite(n + Util.randomInt(0,5), SPRITES.TREE1, -1 - (Math.random() * 2));
     addSprite(n + Util.randomInt(0,5), SPRITES.TREE2, -1 - (Math.random() * 2));
     }
     */

  var skip = timeScale < 2 ? 9 : timeScale == 3 ? 24 : 3; // density of stationary sprites
  for (n = 200; n < segments.length; n += skip) {
    //addSprite(n, Util.randomChoice(SPRITES.PLANTS), Util.randomChoice([1,-1]) * (2 + Math.random() * 5));
    //addSprite(n, Util.randomChoice(SPRITES.PLANTS), Util.randomChoice([1,-1]) * (1 + Math.random() * 5));
    //var spr = (timeScale < 2)?SPRITES.BUSH2: (timeScale ==3)? Util.randomChoice(SPRITES.BOULDERS):Util.randomChoice(SPRITES.PLANTS);
    var spr =
      timeScale < 2
        ? Util.randomChoice(SPRITES.STARS)
        : timeScale == 2
        ? Util.randomChoice(SPRITES.DESERT)
        : timeScale == 3
        ? Util.randomChoice(SPRITES.WATER)
        : Util.randomChoice(SPRITES.PLANTS);
    var offsetY =
      timeScale < 2
        ? Util.randomChoice([1, -1]) * Math.random() * 6
        : spr.oy
        ? spr.oy
        : -0.97;
    // change the factor after Math.random() below to spread the sprites wider or narrower
    addSprite(
      n,
      spr,
      Util.randomChoice([1, -1]) * (1 + Math.random() * 10),
      offsetY
    );
  }

  if (timeScale > 3) {
    // add a bunch more landscape sprites to "regular" levels
    var side, sprite, offset;
    for (n = 200; n < segments.length - 50; n += 100) {
      side = Util.randomChoice([1, -1]);
      //  addSprite(n + Util.randomInt(0, 50), Util.randomChoice(SPRITES.BILLBOARDS), -side);
      // change the X in  i<X below to increase or decrease the extra sprites
      for (i = 0; i < 10; i++) {
        sprite = Util.randomChoice(SPRITES.PLANTS);
        //increase second parm constant to spread sprites further out left and right
        offset = side + side * Util.randomInt(1, 50);
        //offset = side * (1.5 + Math.random());
        addSprite(n + Util.randomInt(0, 50), sprite, offset);
      }
    }
  }
}

function resetCars() {
  cars = [];
  var car, segment, offset, z, sprite, speed;
  var offsety = timeScale == 3 ? -0.35 : -0.97;
  for (var n = 0; n < totalCars; n++) {
    offset = Math.random() * Util.randomChoice([-0.8, 0.8]);
    z = Math.floor(Math.random() * segments.length) * segmentLength;
    sprite = Util.randomChoice(SPRITES.CARS);
    //speed = maxSpeed / 4 + Math.random() * maxSpeed / (sprite == SPRITES.SEMI ? 4 : 2);
    speed = maxSpeed / 4 + (Math.random() * maxSpeed) / 2;
    car = {
      offset: offset,
      z: z,
      sprite: sprite,
      offsetY: offsety,
      speed: speed,
    };
    segment = findSegment(car.z);
    segment.cars.push(car);
    cars.push(car);
  }
}

//=========================================================================
// THE GAME LOOP
//=========================================================================

Game.run({
  canvas: canvas,
  render: render,
  update: update,
  stats: stats,
  step: step,
  images: ["background", "sprites"],
  keys: [
    {
      keys: [KEY.LEFT, KEY.A],
      mode: "down",
      action: function () {
        keyLeft = true;
      },
    },
    {
      keys: [KEY.RIGHT, KEY.D],
      mode: "down",
      action: function () {
        keyRight = true;
      },
    },
    {
      keys: [KEY.UP, KEY.W],
      mode: "down",
      action: function () {
        keyFaster = true;
      },
    },
    {
      keys: [KEY.DOWN, KEY.S],
      mode: "down",
      action: function () {
        keySlower = true;
      },
    },
    {
      keys: [KEY.LEFT, KEY.A],
      mode: "up",
      action: function () {
        keyLeft = false;
        keyCount++;
      },
    },
    {
      keys: [KEY.RIGHT, KEY.D],
      mode: "up",
      action: function () {
        keyRight = false;
        keyCount++;
      },
    },
    {
      keys: [KEY.UP, KEY.W],
      mode: "up",
      action: function () {
        keyFaster = false;
        keyCount++;
      },
    },
    {
      keys: [KEY.DOWN, KEY.S],
      mode: "up",
      action: function () {
        keySlower = false;
        keyCount++;
      },
    },
    {
      keys: [KEY.F],
      mode: "up",
      action: function () {
        Util.toggleFullscreen();
      },
    },
  ],
  ready: function (images) {
    background = images[0];
    sprites = images[1];
    reset();
    /*
         Dom.storage.scale_factor = Dom.storage.scale_factor || 180;
         updateHud('scale_factor', formatTime(Util.toFloat(Dom.storage.scale_factor)));
         */
  },
});

function reset(options) {
  options = options || {};
  canvas.width = width = Util.toInt(options.width, width);
  canvas.height = height = Util.toInt(options.height, height);

  lanes = Util.toInt(options.lanes, lanes);
  totalCars = Util.toInt(options.totalCars, totalCars);
  roadWidth = Util.toInt(options.roadWidth, roadWidth);
  cameraHeight = Util.toInt(options.cameraHeight, cameraHeight);
  drawDistance = Util.toInt(options.drawDistance, drawDistance);
  fogDensity = Util.toInt(options.fogDensity, fogDensity);
  fieldOfView = Util.toInt(options.fieldOfView, fieldOfView);
  segmentLength = Util.toInt(options.segmentLength, segmentLength);
  rumbleLength = Util.toInt(options.rumbleLength, rumbleLength);
  cameraDepth = 1 / Math.tan(((fieldOfView / 2) * Math.PI) / 180);
  playerZ = cameraHeight * cameraDepth;
  resolution = height / 480;
  refreshTweakUI();

  //if ((segments.length == 0) || (options.segmentLength) || (options.rumbleLength))
  if (segments.length == 0 || options.segmentLength) resetRoad(); // only rebuild road when necessary
}

function resetAutoSteerCheckbox(chkBox) {
  autoSteer = chkBox.checked;
}

function resetBikeCheckbox(chkBox) {
  bike = chkBox.checked;
  reset({ cameraHeight: 650, roadWidth: 3000 });
  /*
    if (bike) {
        reset({ cameraHeight:650, roadWidth:3000 });
        //cameraHeight   = 650;
        //roadWidth = 3000;
    } else {
        reset({ cameraHeight:1000, roadWidth:2000 });
        //cameraHeight   = 1000;
        //roadWidth = 2000;
    }
    */
  refreshTweakUI();
}

//=========================================================================
// TWEAK UI HANDLERS
//=========================================================================

Dom.on("resolution", "change", function (ev) {
  var w, h, ratio;
  switch (ev.target.options[ev.target.selectedIndex].value) {
    case "fine":
      w = 1280;
      h = 960;
      ratio = w / width;
      circleCount = 200;
      break;
    case "high":
      w = 1024;
      h = 768;
      ratio = w / width;
      circleCount = 200;
      break;
    case "medium":
      w = 640;
      h = 480;
      ratio = w / width;
      circleCount = 200;
      break;
    case "low":
      w = 480;
      h = 360;
      ratio = w / width;
      circleCount = 100;
      break;
  }
  reset({ width: w, height: h });
  Dom.blur(ev);
});

Dom.on("lanes", "change", function (ev) {
  Dom.blur(ev);
  reset({ lanes: ev.target.options[ev.target.selectedIndex].value });
});
Dom.on("autoSteer", "change", function (ev) {
  Dom.blur(ev);
  resetAutoSteerCheckbox(document.getElementById("autoSteer"));
});
Dom.on("bike", "change", function (ev) {
  Dom.blur(ev);
  resetBikeCheckbox(document.getElementById("bike"));
});
Dom.on("totalCars", "change", function (ev) {
  Dom.blur(ev);
  reset({
    totalCars: Util.limit(
      Util.toInt(ev.target.value),
      Util.toInt(ev.target.getAttribute("min")),
      Util.toInt(ev.target.getAttribute("max"))
    ),
  });
  resetRoad();
});
Dom.on("roadWidth", "change", function (ev) {
  Dom.blur(ev);
  reset({
    roadWidth: Util.limit(
      Util.toInt(ev.target.value),
      Util.toInt(ev.target.getAttribute("min")),
      Util.toInt(ev.target.getAttribute("max"))
    ),
  });
});
Dom.on("cameraHeight", "change", function (ev) {
  Dom.blur(ev);
  reset({
    cameraHeight: Util.limit(
      Util.toInt(ev.target.value),
      Util.toInt(ev.target.getAttribute("min")),
      Util.toInt(ev.target.getAttribute("max"))
    ),
  });
});
Dom.on("drawDistance", "change", function (ev) {
  Dom.blur(ev);
  reset({
    drawDistance: Util.limit(
      Util.toInt(ev.target.value),
      Util.toInt(ev.target.getAttribute("min")),
      Util.toInt(ev.target.getAttribute("max"))
    ),
  });
});
Dom.on("fieldOfView", "change", function (ev) {
  Dom.blur(ev);
  reset({
    fieldOfView: Util.limit(
      Util.toInt(ev.target.value),
      Util.toInt(ev.target.getAttribute("min")),
      Util.toInt(ev.target.getAttribute("max"))
    ),
  });
});
Dom.on("fogDensity", "change", function (ev) {
  Dom.blur(ev);
  reset({
    fogDensity: Util.limit(
      Util.toInt(ev.target.value),
      Util.toInt(ev.target.getAttribute("min")),
      Util.toInt(ev.target.getAttribute("max"))
    ),
  });
});

function refreshTweakUI() {
  Dom.get("lanes").selectedIndex = lanes - 1;
  document.getElementById("autoSteer").checked = autoSteer;
  document.getElementById("bike").checked = bike;
  Dom.get("currentTotalCars").innerHTML = Dom.get("totalCars").value =
    totalCars;
  Dom.get("currentRoadWidth").innerHTML = Dom.get("roadWidth").value =
    roadWidth;
  Dom.get("currentCameraHeight").innerHTML = Dom.get("cameraHeight").value =
    cameraHeight;
  Dom.get("currentDrawDistance").innerHTML = Dom.get("drawDistance").value =
    drawDistance;
  Dom.get("currentFieldOfView").innerHTML = Dom.get("fieldOfView").value =
    fieldOfView;
  Dom.get("currentFogDensity").innerHTML = Dom.get("fogDensity").value =
    fogDensity;
}

//=========================================================================
