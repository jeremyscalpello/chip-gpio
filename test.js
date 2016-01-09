var Gpio = require('./index').Gpio;
var gpio = new Gpio(7, 'in', 'both', {
	debounceTimeout: 500
});
var led = new Gpio(6, 'out');

gpio.watch(function (err, value) {
	if (err) {
		throw err;
	}
	console.log("state changed: " + value);
});

led.write(1);
setInterval(function () {
	led.write(led.read() == 1 ? 0 : 1);
}, 1000);

function exit() {
	gpio.unexport();
	process.exit();
}

process.on('SIGINT', exit);
