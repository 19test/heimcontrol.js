if (typeof define !== 'function') {
  var define = require('amdefine')(module);
}

/**
 * Webcam Plugin. Plugin that uses streamer to create images from the webcam and pushes them to the clients
 *
 * @class Webcam
 * @constructor 
 */

define([ 'child_process', 'delivery', 'fs' ], function( ChildProcess, Delivery, Fs ) {

  var Webcam = function(app) {

    this.name = 'Webcam';
    this.id = 'webcam';
    this.collection = 'Webcam';
    this.icon = 'icon-play-circle';

    this.app = app;
    this.pluginHelper = app.get('plugin helper');

    this.webcamList = [];
    this.webcams = {};

    this.deliveryList = [];

    this.init();

    var that = this;

    app.get('events').on('settings-saved', function() {
      that.init();
    });

    app.get('sockets').on('connection', function(socket) {
      var delivery = Delivery.listen(socket);
      that.deliveryList.push(delivery);

      socket.on('disconnect', function() {
        that.deliveryList.forEach(function(delivery) {
          if (delivery.socket.id == socket.id) {
            var i = that.deliveryList.indexOf(delivery);
            that.deliveryList.splice(i,1);
          }
        });
      });

    });
  };

  /**
   * Initialize the webcams
   * 
   * @method init
   */
  Webcam.prototype.init = function() {

    var that = this;
    this.webcamList.forEach(function(webcam) {
      clearInterval(webcam);
    });
    this.webcamList = [];

    return this.app.get('db').collection(that.collection, function(err, collection) {
      collection.find({}).toArray(function(err, result) {
        if ((!err) && (result.length > 0)) {
          result.forEach(function(item) {
            function capture() {
              if (that.app.get('clients').length > 0) {
                var filename = '/tmp/' + item._id + '.jpeg';
                that.streamer(item.input, filename, '1280x720', function(err, result) {
                  if (err) {
                    console.log(err);
                  } else {
                    that.deliveryList.forEach(function(delivery) {
                      delivery.send({
                        name: item._id + '.jpg',
                        path : filename,
                      });
                    });
                  }
                });             
              }
            }
            var intervalId = setInterval(capture, parseInt(item.interval)*1000);
            that.webcamList.push(intervalId);
          });
        }
      });
    });
  }

  /**
   * Create an image using streamer
   *
   * @method streamer
   * @param {String} input The input to use, e.g. '/dev/video0'
   * @param {String} output The output file, e.g. '/tmp/image.jpg'
   * @param {String} resolution The resolution to use, e.g. '1280x720'
   * @param {Function} callback The callback method to execute after manipulation
   * @param {String} callback.err null if no error occured, otherwise the error
   * @param {Object} callback.result The result of the exec call
   */
  Webcam.prototype.streamer = function(input, output, resolution, callback) {

    var exec = ChildProcess.exec;
    var cmd = 'streamer -c ' + input + ' -o ' + output + ' -s ' + resolution;
    exec(cmd, function(err, stdout, stderr) {
      if(err) {
        callback(err);
      } else {
        callback(null, stdout);
      }
    });    
  }
  /**
   * Manipulate the items array before render
   *
   * @method beforeRender
   * @param {Array} items An array containing the items to be rendered
   * @param {Function} callback The callback method to execute after manipulation
   * @param {String} callback.err null if no error occured, otherwise the error
   * @param {Object} callback.result The manipulated items
   */
  Webcam.prototype.beforeRender = function(items, callback) {
    var that = this;
    var devList = Fs.readdirSync('/dev/');
    var deviceList = [];
    devList.forEach(function(dev) {
      if (dev.substr(0,5) == 'video') {
        deviceList.push('/dev/' + dev);
      }
    })
    items.forEach(function(item) {
      console.log(deviceList.indexOf(item.input));
      if (deviceList.indexOf(item.input)==-1) {
        console.log('Webcam Plugin: Device "' + item.input + '" not found.');
        var i = items.indexOf(item);
        items.splice(i,1);
      } else {
        item.deviceList = deviceList;
    }
    });
    return callback(null, items);
  }

  var exports = Webcam;

  return Webcam;

});
