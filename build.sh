#!/bin/bash
if [[ $1 == 'debug' ]]; then
	CMD=node-debug
else
	CMD=node
fi

$CMD ./tests/tests.js nocolor