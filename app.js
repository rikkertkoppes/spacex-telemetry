const {
    desktopCapturer
} = require('electron');

let output = document.querySelector('#output');

getOwnWindow().then(win => {
    let video = document.querySelector('video');
    return init(win, video);
}).catch(e => {
    console.log('getUserMediaError: ' + JSON.stringify(e, null, '---'));
}).then(video => {
    initCapture(video, {
        '#time': [100, 44, 200, 23],
        '#speed': [70, 224, 105, 23],
        '#alt': [265, 222, 105, 23]
    });
});

/**
 * gets the application window handle
 */
function getOwnWindow() {
    return new Promise((resolve, reject) => {
        desktopCapturer.getSources({
            types: ['window']
        }, function(error, sources) {
            if (error) {
                reject(error);
            } else {
                resolve(sources.filter(s => s.name === document.title)[0]);
            }
        });

    });
}

/**
 * inits the video capture and streams to video element
 */
function init(win, video) {
    return new Promise((resolve, reject) => {
        console.log("Desktop sharing started.. desktop_id:" + win.id);
        navigator.webkitGetUserMedia({
            audio: false,
            video: {
                mandatory: {
                    chromeMediaSource: 'desktop',
                    chromeMediaSourceId: win.id,
                    minWidth: window.outerWidth,
                    minHeight: window.outerHeight,
                    maxWidth: window.outerWidth,
                    maxHeight: window.outerHeight,
                }
            }
        }, gotStream, reject);

        function gotStream(stream) {
            video.src = URL.createObjectURL(stream);
            resolve(video);
        }
    })
}

/**
 * capture the given slices to canvas elements
 */
function initCapture(video, specs) {
    /**
     * convert the specs to an array of
     * {
     *     el: the canvas element given by the key selector
     *     ctx: the drawing context of the canvas
     *     bb: the bb [x,y,w,h] given by the value
     * }
     */
    var data = Object.keys(specs).map(selector => {
        var el = document.querySelector(selector);
        var bb = specs[selector];
        el.width = bb[2];
        el.height = bb[3];
        var ctx = el.getContext('2d');
        return {
            el,
            ctx,
            bb
        };
    });

    // draw each slice
    function draw() {
        data.forEach(spec => {
            slice(spec.bb, video, spec);
        });
        requestAnimationFrame(draw);
    }

    draw();
    // scan();
}

function slice(bb, video, {ctx, el}) {
    var [x, y, w, h] = bb;
    ctx.drawImage(video, x, y, w, h, 0, 0, w, h);
    //get it back as data, make bw and put it
    var [idata, slices] = bw(ctx.getImageData(0, 0, w, h), bb);
    ctx.putImageData(idata, 0, 0);
    slices.forEach((slice, i) => {
        if (slice.start && slice.width) {
            //TODO draw image on backbuffer, then recognize
            ctx.drawImage(el, slice.start, 0, slice.width, h, i* 16, 0, 16, 16);
        }
    })
}

function bw(idata, bb) {
    var data = idata.data;
    var whitest = 0;
    var blackest = 255;
    for (var i = 0; i < data.length; i += 4) {
        var r = data[i];
        var g = data[i + 1];
        var b = data[i + 2];
        var brightness = (3 * r + 4 * g + b) >>> 3;
        whitest = Math.max(whitest, brightness);
        blackest = Math.min(blackest, brightness);
        var bw = brightness;
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
    }
    var threshold = (whitest + blackest) / 2;
    var segments = {cols: [], rows: []};
    for (var i = 0; i < data.length; i += 4) {
        var bw = br = data[i];
        var range = 20;
        if (br < (threshold - range)) {
            bw = 255;
        }
        if (br > (threshold + range)) {
            bw = 0;
        }
        //calculate segmentation
        var col = (i / 4) % bb[2];
        // var row = Math.floor((i / 4) / bb[2]);
        if (segments.cols[col] === undefined) {
            segments.cols[col] = 255;
        }
        // if (segments.rows[row] === undefined) {
        //     segments.rows[row] = 255;
        // }
        segments.cols[col] = Math.min(segments.cols[col], bw);
        // segments.rows[row] = Math.min(segments.rows[row], bw);
        data[i] = bw;
        data[i + 1] = bw;
        data[i + 2] = bw;
    }
    // convert segmentation to something we can use
    // array of 
    // {
    //      start: number
    //      end: number
    // }
    // 
    // visualize segments masks
    for (var i = 0; i < data.length; i += 4) {
        var col = (i / 4) % bb[2];
        if (!segments.cols[col]) {
            data[i+1] = 0;
        }
    }

    var slices = segments.cols.reduce((slices, isWhite, col) => {
        var last = slices[slices.length-1];
        if (!isWhite && !last.start) {
            last.start = col;
        }
        if (isWhite && last.start) {
            last.end = col;
            last.width = last.end - last.start;
            slices.push({});
        }
        return slices;
    }, [{}]);
    // console.log(JSON.stringify(slices));
    // //visualize segmentation
    // for (var i = 0; i < segments.cols.length; i += 1) {
    //     var index = data.length + 4 * (i - segments.cols.length);
    //     data[index] = 255; //segments[i];
    //     data[index + 1] = segments.cols[i];
    //     data[index + 2] = segments.cols[i];
    // }
    // for (var i = 0; i < segments.rows.length; i += 1) {
    //     var index = 4 * (i * bb[2] - 1);
    //     data[index] = 255; //segments[i];
    //     data[index + 1] = segments.rows[i];
    //     data[index + 2] = segments.rows[i];
    // }
    idata.data = data;
    return [idata, slices];
}

function scan() {
    Tesseract.recognize(canvas, {
        tessedit_char_whitelist: '0123456789'
    })
    .then(function(result) {
        var chars = result.text.replace(/\D/g, '');
        if (chars.length === 6) {
            let hh = chars.substr(0, 2);
            let mm = chars.substr(2, 2);
            let ss = chars.substr(4, 2);
            output.innerHTML = hh + ':' + mm + ':' + ss;
        }
        scan();
    })
}