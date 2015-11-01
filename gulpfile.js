/**
 * Created by jrobison on 4/25/2015.
 */
'use strict';

/* global console */
/* global process */
/* global __dirname */
/* jshint expr:true */

var gulp = require('gulp');
var browserify = require('browserify');
var fs = require('fs');
var babelify = require('babelify');
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var chalk = require('chalk');
var jsxHint = require('jshint-jsx').JSXHINT;
var runSequence = require('run-sequence');
var server = require('./server/src/server');
var uglify = require('uglify-js');
var path = require('path');
var del = require('del');
var minimist = require('minimist');
var gulpif = require('gulp-if');
var minifyCss = require('gulp-minify-css');
var rename = require('gulp-rename');
var karma = require('karma').server;
var Q = require('q');


var options = minimist(process.argv.slice(2));

gulp.task('default', ['build']);


gulp.task('build', function () {
    runSequence('clean-dist', 'lint', ['browserify', 'index', 'copy-css', 'process-css', 'copy-js', 'images', 'copy-misc']);
});


gulp.task('clean-dist', function (cb) {
    var deleteGlob = path.join('.', 'dist', '*');

    del([deleteGlob], function (err, paths) {
        console.log("Removed files:\n", paths.join('\n'));
        cb();
    });
});

gulp.task('index', function () {
    return gulp.src('./app/index.html').pipe(gulp.dest('./dist'));
});

gulp.task('copy-css', function () {
    var filesToCopy = [];

    if (options.debug) {
        filesToCopy = ['./node_modules/bootstrap/dist/css/bootstrap.css', './node_modules/bootstrap/dist/css/bootstrap.css.map'];
    }
    else {
        filesToCopy = ['./node_modules/bootstrap/dist/css/bootstrap.min.css'];
    }

    return gulp.src(filesToCopy).pipe(rename(function (path) {
        if (path.extname === '.css') {
            path.basename = path.basename.match(/([^\.]*)/)[1]; //remove everything after the first '.'
        }
    })).pipe(gulp.dest('./dist'));
});

gulp.task('process-css', function () {
    return gulp.src(['./app/styles/main.css', './node_modules/normalize.css/normalize.css'])
        .pipe(gulpif(options.debug, minifyCss()))
        .pipe(gulp.dest('./dist'));
});

gulp.task('copy-js', function () {
    var filesToCopy = [];

    if (options.debug) {
        filesToCopy = ['./node_modules/bootstrap/dist/js/bootstrap.js', './node_modules/jquery/dist/jquery.js'];

    }
    else {
        filesToCopy = ['./node_modules/bootstrap/dist/js/bootstrap.min.js', './node_modules/jquery/dist/jquery.min.js'];
    }

    return gulp.src(filesToCopy).pipe(rename(function (path) {
        path.basename = path.basename.match(/([^\.]*)/)[1]; //remove everything after the first '.'
        path.extname = '.js';
    })).pipe(gulp.dest('./dist'));
});

gulp.task('images', function () {
    return gulp.src('./app/images/*')
        .pipe(gulp.dest('./dist/images'));
});

gulp.task('copy-misc', function () {
    return gulp.src('./app/favicon.ico').pipe(gulp.dest('dist'));
});

gulp.task('browserify', function () {

    return browserifyCode('./app/scripts/Application.jsx', path.join('dist', 'debtstacker.js'));
});


gulp.task('lint', function () {
    return gulp.src(['./app/**/*.js', './app/**/*.jsx', './server/src/*.js', '!app/lib/**'])
        .pipe(jshint({
            linter: jsxHint
        }))
        .
        pipe(jshint.reporter(stylish)).on('error', function (err) {
            console.log(err.toString());
        });
});

gulp.task('watch', function () {

    gulp.watch('./app/styles/*.css', ['copy-css', 'process-css']).on('change', function () {
        console.log(chalk.green.bold('CSS changed, build kicked off'));
    });

    gulp.watch('./app/index.html', ['index']).on('change', function () {
        console.log(chalk.green.bold('index.html changed, build kicked off'));
    });

    gulp.watch(['./app/**/*.jsx', './app/**/*.js'], ['build']).on('change', function (event) {
        console.log(chalk.green.bold('File ' + event.path + ' changed, build kicked off'));
    });
});

gulp.task('startServer', function () {
    return server.start();
});

gulp.task('test-unit', function (done) {

    karma.start({
        configFile: path.join(__dirname, '/app/test/karma.conf'),
        singleRun: options.singleRun,
        browsers: process.env.JENKINS_BUILD ? ['PhantomJS'] : ['Chrome']
    }, done);
});

gulp.task('test-smoke', function () {

    return server.start().then(function (httpServerPort) {
        /*
         Override node 'require' to automatically transform sources with babel
         */
        require('babel/register');

        var smoke = require('./app/test/smoke/smokeTest');

        return smoke.runTest(httpServerPort);
    }).then(function () {
        server.stop();
    }).catch(function (err) {
        console.log(err.toString());
    });
});

gulp.task('test-full', function (done) {
    options.singleRun = true;
    runSequence('test-unit', 'test-acceptance', 'test-smoke', done);
});

function browserifyCode(entryFile, destinationFile) {
    var bundledJs = '';
    var browserifyDoneDfd = Q.defer();
    browserify({debug: options.debug})
        .transform(babelify)
        .require(entryFile, {entry: true})
        .bundle()
        .on('error', function (err) {
            console.log('Error: ' + err.message);
            browserifyDoneDfd.reject(err);
        })
        .on('data', function (chunk) {
            bundledJs += chunk;
        })
        .on('end', function () {

            var finalProcessedJs = '';

            if (options.debug) {
                finalProcessedJs = bundledJs;
            }
            else {
                finalProcessedJs = uglify.minify(bundledJs.toString(), {fromString: true}).code;
            }

            var mainJsFd = fs.openSync(destinationFile, 'w');

            fs.writeSync(mainJsFd, finalProcessedJs);

            fs.closeSync(mainJsFd);

            browserifyDoneDfd.resolve();
        });

    return browserifyDoneDfd.promise;
}