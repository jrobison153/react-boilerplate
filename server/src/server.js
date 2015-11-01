/**
 * web Server
 */

'use strict';

var config = require('./server_config.json');
var express = require('express');
var Q = require('q');
var portscanner = require('portscanner');

var server = null;

/* global console */
/* global process */

function start() {

    var serverStartedDfd = Q.defer();

    if (server === null) {
        var app = express();

        app.use('/', express.static('dist'));

        getPort().done(function (port) {

            server = app.listen(port, function () {
                console.log('Server running on port ' + server.address().port);

                serverStartedDfd.resolve(port);
            });
        }, function (err) {
            console.log("Failed to start server: " + err);
            serverStartedDfd.reject(err);
        });
    }
    else {
        serverStartedDfd.resolve(server.address().port);
    }

    return serverStartedDfd.promise;
}

function stop() {
    server.close();
}

function getPort() {
    var gotPortDfd = Q.defer();

    if (!!process.env.PORT) {
        gotPortDfd.resolve(process.env.PORT);
    }
    else {
        portscanner.findAPortNotInUse(config.portRangeStart, config.portRangeEnd, '127.0.0.1', function (err, port) {
            if (!err) {
                gotPortDfd.resolve(port);
            }
            else {
                gotPortDfd.reject(err);
            }
        });
    }


    return gotPortDfd.promise;
}


module.exports = {
    start: start,
    stop: stop
};