#!/bin/bash
if [[ $1 == 'debug' ]]; then
	node-debug ./tests/tests.js nocolor
else
	node ./tests/tests.js nocolor
fi