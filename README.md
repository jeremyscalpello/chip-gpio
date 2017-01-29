# chip-gpio
GPIO access for CHIP on Node.JS

## Updates 

Support for the 4.4 kernel CHIPs has been added thanks to https://github.com/nkolban.

## Installation

    $ npm install chip-gpio --save

You must have build-essential installed for this module to install correctly, which can be installed using

	$ sudo apt-get install build-essential

Credit to fivdi for providing the epoll module for hardware interrupts and the onoff module which this was based on.

## Usage

The available pins are XIO-P0 to XIO-P7. Assume that there's an LED on GPIO #6 and a momentary push button on GPIO #7.

<img src="http://docs.getchip.com/images/chip_pinouts.jpg">

When the button is pressed the LED should turn on, when it's released the LED
should turn off. This can be achieved with the following code:

```js
var Gpio = require('chip-gpio').Gpio;
var btn = new Gpio(7, 'in', 'both', {
	debounceTimeout: 500
});
var led = new Gpio(6, 'out');

btn.watch(function (err, value) {
	if (err) {
		throw err;
	}
	led.write(led.read() == 1 ? 0 : 1);
});

function exit() {
	btn.unexport();
	led.unexport();
	process.exit();
}

process.on('SIGINT', exit);
```

Here two Gpio objects are being created. One called led for the LED on GPIO #6
which is an output, and one called btn for the momentary push button on
GPIO #7 which is an input. In addition to specifying that the button is an
input, the constructors optional third argument is used to specify that 'both'
rising and falling interrupt edges should be configured for the button GPIO as
both button presses and releases should be handled. Furthermore, the debounceTimeout
option is specified, meaning that a new interrupt cannot be generated before 500ms
after another

## How does it work?

Internally onoff uses sysfs files located at /sys/class/gpio to access GPIOs
and the [epoll module](https://github.com/fivdi/epoll) to detect hardware
interrupts. The Linux GPIO sysfs interface for userspace is documented
[here](https://www.kernel.org/doc/Documentation/gpio/sysfs.txt).
It's a relatively simple interface which can be used to ask the Linux kernel
to export control of a GPIO to userspace. After control of a GPIO has been
exported to userspace, the GPIO can be configured as an input or output.
Thereafter, the state of an input can be read, and the state of an output can
be written. Some systems will also allow the state of a output to be read.
The GPIO sysfs interface can also be used for interrupt detection.

## API

##### Gpio(gpio, direction[, edge])
Returns a new Gpio object that can be used to access a GPIO.
- gpio - An unsigned integer specifying the GPIO number. This can be either 0 
to 7 (which maps to the correct GPIO pins on the CHIP based on the pinout) or 
a higher number which directly attempts to export the provided pin without using 
the mapping.
- direction - A string specifying whether the GPIO should be configured as an
input or output. The valid values are: 'in', 'out', 'high', and 'low'. 'high'
and 'low' are variants of 'out' that configure the GPIO as an output with an
initial level of high or low respectively.
- [edge] - An optional string specifying the interrupt generating edge or
edges for the GPIO. The valid values are: 'none', 'rising', 'falling' or
'both'. The default value is 'none' indicating that the GPIO does not generate
interrupts. On Linux kernels prior to 3.13 it was possible for both inputs
and outputs to generate interrupts. The 3.13 kernel dropped support for
interrupt generating outputs, irrespective of whether the underlying hardware
supports them or not.

##### read()
Read GPIO value synchronously. Returns the number 0 or 1 to represent the
state of the GPIO.

##### write(value)
Write GPIO value synchronously.
- value - The number 0 or 1.

##### watch(callback)
Watch for hardware interrupts on the GPIO. The edge argument that was passed
to the constructor determines which hardware interrupts to watch for.
- callback - A callback that gets two arguments (err, value), where err is
reserved for an error object and value is the number 0 or 1 and represents the
state of the GPIO. The value can also be used to determine whether the
interrupt occurred on a rising or falling edge. A value of 0 implies a falling
edge interrupt and a value of 1 implies a rising edge interrupt.

##### unwatch([callback])
Stop watching for hardware interrupts on the GPIO. If callback is specified,
only that particular callback is removed. Otherwise all callbacks are removed.
- [callback] - The callback to remove.

##### direction()
Returns the string 'in' or 'out' indicating whether the GPIO is an input or
output.

##### setDirection(direction)
Set GPIO direction.
- direction - A string specifying whether the GPIO should be configured as an
input or output. The valid values are 'in' and 'out'.

##### edge()
Returns the string 'none', 'falling', 'rising', or 'both' indicating the
interrupt generating edge or edges for the GPIO.

##### setEdge(edge)
Set GPIO interrupt generating edge
- edge - A string specifying the interrupt generating edge or edges for the
GPIO. The valid values are: 'none', 'rising', 'falling' or 'both'. On Linux
kernels prior to 3.13 it was possible for both inputs and outputs to generate
interrupts. The 3.13 kernel dropped support for interrupt generating outputs,
irrespective of whether the underlying hardware supports them or not.

##### unexport()
Reverse the effect of exporting the GPIO to userspace