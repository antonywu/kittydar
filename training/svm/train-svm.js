var fs = require("fs"),
    path = require("path"),
    nomnom = require("nomnom"),
    svm = require("svm"),
    utils = require("../../utils"),
    features = require("../../features"),
    collect = require("../collect");

var opts = nomnom.options({
  pos: {
    abbr: 'p',
    list: true,
    required: true,
    help: "Directory of positive training images"
  },
  neg: {
    abbr: 'n',
    list: true,
    required: true,
    help: "Directory of negative training images"
  },
  testPos: {
    list: true,
    help: "Directory of positive test images"
  },
  testNeg: {
    list: true,
    help: "Directory of negative test images"
  },
  outfile: {
    default: __dirname + "/svm.json",
    help: "file to save SVM JSON to"
  },
  sample: {
    flag: true,
    help: "whether to sub-sample the negative images",
    hidden: true
  },
  limit: {
    default: 10000,
    help: "maximum number of images to use from each directory"
  }
}).colors().parse();

var params = {
  HOG: {
    cellSize: 4,
    blockSize: 2,
    blockStride: 1,
    bins: 7,
    norm: "L2"
  },
  svm: {
    numpasses: 3,
    C: 0.001,
    kernel: 'linear'
  }
};

trainSVM(params)

function trainSVM(params) {
  var samples = opts.sample ? 1 : 0;
  var data = collect.collectData(opts.pos, opts.neg, samples,
                                 opts.limit, params, "svm");

  var inputs = data.inputs;
  var labels = data.labels;

  console.log("training on", inputs.length);

  var SVM = new svm.SVM();

  console.time("TRAIN");
  var stats = SVM.train(inputs, labels, params.svm);
  console.timeEnd("TRAIN");

  console.log("stats:", stats);
  console.log("parameters:", params);

  var obj = SVM.toJSON();
  var json = JSON.stringify(obj, 4);

  fs.writeFile(opts.outfile, json, function (err) {
    if (err) throw err;
    console.log('saved svm JSON to', opts.outfile);
  });

  testSVM(SVM);
}

function testSVM(SVM) {
  var data = collect.collectData(opts.testPos, opts.testNeg, opts.sample ? 1 : 0);

  console.time("TEST")
  var truePos = 0, trueNeg = 0, falsePos = 0, falseNeg = 0;
  for (var i = 0; i < data.length; i++) {
    var output = data[i].output[0];
        input = data[i].input;
    var result = SVM.predict([input])[0];

    if (result == 1 && output == 1) {
      truePos++;
    }
    else if (result == -1 && output == 0) {
      trueNeg++;
    }
    else if (result == 1 && output == 0) {
      falsePos++;
    }
    else if (result == -1 && output == 1) {
      falseNeg++;
    }
  }
  console.timeEnd("TEST");

  console.log("precision: " + truePos / (truePos + falsePos))
  console.log("recall:    " + truePos / (truePos + falseNeg))

  console.log(truePos + " true positives");
  console.log(trueNeg + " true negatives");
  console.log(falsePos + " false positives");
  console.log(falseNeg + " false negatives");
  console.log(data.length + " total");
}
