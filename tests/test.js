#!/usr/bin/env node

global.debug = console.error.bind(console);
global.print = console.log.bind(console);
var fs = global.fs = require('fs');

global.Analyzer = require('../lib/pitch.js');
global.WavReader = require('../lib/wavreader.js');

global.format_float = function (n) {
    return n.toFixed(6);
};

global.die = function (code) {
    debug.apply(null, [].slice.call(arguments, 1));
    process.exit(code || 0);
};

global.read = function (path, encoding) {
    return fs.readFileSync(path, arguments.length === 1 ? 'UTF-8' : encoding);
};

global.write = function (path, data, encoding) {
    return fs.writeFileSync(path, data, arguments.length === 2 ? 'UTF-8' : encoding);
};

var ProgressBar;

try {
    ProgressBar = require('progress-bar');
} catch (e) {}

var pb;

global.updateProgress = function (value) {
    if (!ProgressBar) return;

    if (!pb) {
        pb = ProgressBar.create(process.stderr, 50);
        pb.format = "$bar; $percentage;% complete.";
    }

    pb.update(value);
};

global.openWriteStream = function (path) {
    return path === '-' ? process.stdout : fs.createWriteStream(path, {
        encoding: 'UTF-8',
        flags: 'w+'
    });
};

process.stdout.destroySoon = process.stdout.destroy = function () {};

var BUFFER_LEN = 1024;

function process_data (data, analyzer, stream) {
    analyzer.input(data);
    analyzer.process();
    var tone = analyzer.findTone();
    var freq = tone ? tone.freq : 0.0;

    stream.write(format_float(freq) + '\n');
}

var argv = [].slice.call(process.argv);

if (argv.length !== 4) {
    die(1, "Usage: test.js <infile> <outfile>");
}

var inpath = argv[2];
var outpath = argv[3];


debug("Generating test file `", outpath, "` from input data in `", inpath, "`");

var infile, outfile;

try {
    infile = new WavReader(inpath);
} catch (e) {
    //throw e;
    die(2, "Couldn't decode file `", inpath, "`");

}

// http://download.wavetlan.com/SVV/Media/HTTP/http-wav.htm
if (infile.channelCount !== 1) {
    die(3, "Input file `", inpath, "` is not mono (has", infile.channelCount, "channels)");
}

try {
    outfile = openWriteStream(outpath);
} catch (e) {
    die(4, "Couldn't open file `", outpath, "` for writing");
}

var analyzer = new Analyzer({sampleRate: infile.sampleRate});

var data;

while (data = infile.readBuffer(BUFFER_LEN)) {
    updateProgress((infile.dataOffset - infile.dataStart) / (infile.dataEnd - infile.dataStart));
    process_data(data, analyzer, outfile);
}

outfile.destroySoon();

debug("\nDone");
