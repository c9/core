module.exports = function (grunt) {

  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    sweetjs: {
      options: {
        readableNames: true
      },
      build: {
        src: '<%= pkg.name %>.sweet.js',
        dest: '<%= pkg.name %>.js'
      },
    },
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n',
        compress: false
      },
      build: {
        src: '<%= pkg.name %>.js',
        dest: '<%= pkg.name %>.min.js'
      }
    },
    browserify: {
      test: {
        src: ['<%= pkg.name %>.min.js', 'test/test.js'],
        dest: 'test/bundle.js'
      }
    },
    mochaTest: {
      test: {
        options: {
          reporter: 'spec',
          require: 'coverage/blanket'
        },
        src: ['test/test.js'],
      },
      coverage: {
        options: {
          reporter: 'html-cov',
          quiet: true,
          captureFile: 'coverage/report.html'
        },
        src: ['test/test.js']
      }
    },
    connect: { server: { options: { base: "", port: 9999 } } },
    'saucelabs-mocha': {
      all: {
        options: {
          username: 'rusha',
          urls: ['http://127.0.0.1:9999/test/test.html'],
          build: process.env.CI_BUILD_NUMBER,
          testname: 'Sauce Unit Test for Rusha',
          browsers: [
            ["Windows 8", "firefox", 32],
            ["Windows 8", "chrome", 37]
          ]
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-sweet.js');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-mocha-test');
  grunt.loadNpmTasks('grunt-contrib-connect');
  grunt.loadNpmTasks('grunt-saucelabs');

  grunt.registerTask('test', [
    'sweetjs', 'uglify',
    'browserify',
    'mochaTest'
  ]);

  grunt.registerTask('test-saucelabs', [
    'sweetjs', 'uglify',
    'browserify',
    'connect', 'saucelabs-mocha'
  ]);

  grunt.registerTask('build', ['sweetjs', 'uglify']);

};
