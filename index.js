'use strict';

var fs = require('fs');
var Epoll = require('epoll').Epoll;
var os = require("os");
var MAPPING;

if (os.release().startsWith("4.4.13-ntc-mlc")) {
  MAPPING = [1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020];
} else if (os.release().startsWith("4.4")) {
  MAPPING = [1016, 1017, 1018, 1019, 1020, 1021, 1022, 1023];
} else {
  MAPPING = [408, 409, 410, 411, 412, 413, 414, 415];
}

var GPIO_ROOT = '/sys/class/gpio/';

function pollerEventHandler(err, fd, events) {
	var value = this.read();
	var callbacks = this.listeners.slice(0);

	if (this.opts.debounceTimeout > 0) {
		setTimeout(function () {
			if (this.listeners.length > 0) {
				this.read();
				this.poller.modify(this.valueFd, Epoll.EPOLLPRI | Epoll.EPOLLONESHOT);
			}
		}.bind(this), this.opts.debounceTimeout);
	}

	callbacks.forEach(function (callback) {
		callback(err, value);
	});
}

function Gpio(gpio, direction, edge, options) {
	var valuePath;
	var directionSet = false;
	var tries = 0;

	if (!(this instanceof Gpio)) {
		return new Gpio(gpio, direction, edge, options);
	}

	if (typeof edge === 'object' && !options) {
		options = edge;
		edge = undefined;
	}

	options = options || {};

        //
        // MenloParkInnovcation: If the port specified is greater than the MAPPING
        // maximum, take it as a direct map.
        //
        // This is to allow access to all C.H.I.P. ports.
        //

	if (gpio == null) {
		throw new Error('Invalid GPIO Pin')
	}

        if (gpio > MAPPING.length) {
            this.gpio = gpio;
        }
        else {
            this.gpio = MAPPING[gpio];
        }

	this.gpioPath = GPIO_ROOT + 'gpio' + this.gpio + '/';
	this.opts = {};
	this.opts.debounceTimeout = options.debounceTimeout || 0;
	this.listeners = [];
	this.readBuffer = new Buffer(16);
	valuePath = this.gpioPath + 'value';

	if (!fs.existsSync(this.gpioPath)) {
		fs.writeFileSync(GPIO_ROOT + 'export', this.gpio);
		directionSet = false;
		while (!directionSet) {
			try {
				tries += 1;
				fs.writeFileSync(this.gpioPath + 'direction', direction);
				directionSet = true;
			} catch (e) {
				if (tries === 10000) {
					throw e;
				}
			}
		}
		if (edge) {
			fs.writeFileSync(this.gpioPath + 'edge', edge);
		}
	} else {
		try {
			fs.writeFileSync(this.gpioPath + 'direction', direction);
		} catch (ignore) {}
		try {
			if (edge) {
				fs.writeFileSync(this.gpioPath + 'edge', edge);
			}
		} catch (ignore) {}
	}

	this.valueFd = fs.openSync(valuePath, 'r+'); // Cache fd for performance.
	this.read();
	this.poller = new Epoll(pollerEventHandler.bind(this));
};

exports.Gpio = Gpio;

Gpio.prototype.read = function () {
	fs.readSync(this.valueFd, this.readBuffer, 0, 1, 0);
	var valString = fs.readFileSync(this.gpioPath + 'value', 'utf8');
	return parseInt(valString.split('\n')[0]);
	//return this.readBuffer[0] === new Buffer('1')[0] ? 1 : 0;
};

Gpio.prototype.write = function (value) {
	if (value != 0 && value != 1) {
		throw new Error('Invalid Value')
	}
	return fs.writeFileSync(this.gpioPath + 'value', value);
};

Gpio.prototype.unexport = function () {
	this.unwatch();
	fs.closeSync(this.valueFd);
	fs.writeFileSync(GPIO_ROOT + 'unexport', this.gpio);
};

Gpio.prototype.watch = function (callback) {
	var events;
	this.listeners.push(callback);
	if (this.listeners.length === 1) {
		events = Epoll.EPOLLPRI;
		if (this.opts.debounceTimeout > 0) {
			events |= Epoll.EPOLLONESHOT;
		}
		this.poller.add(this.valueFd, events);
	}
};

Gpio.prototype.unwatch = function (callback) {
	if (this.listeners.length > 0) {
		if (typeof callback !== 'function') {
			this.listeners = [];
		} else {
			this.listeners = this.listeners.filter(function (listener) {
				return callback !== listener;
			});
		}
		if (this.listeners.length === 0) {
			this.poller.remove(this.valueFd);
		}
	}
};

Gpio.prototype.direction = function () {
	return fs.readFileSync(this.gpioPath + 'direction').toString().trim();
};

Gpio.prototype.setDirection = function (direction) {
	fs.writeFileSync(this.gpioPath + 'direction', direction);
};

Gpio.prototype.edge = function () {
	return fs.readFileSync(this.gpioPath + 'edge').toString().trim();
};

Gpio.prototype.setEdge = function (edge) {
	fs.writeFileSync(this.gpioPath + 'edge', edge);
};
