#!/bin/bash
if [[ $1 == 'debug' ]]; then
	CMD=node-debug
else
	CMD=node
fi

env cfg.from.env=cfg_env $CMD ./tests/tests.js nocolor -cfg.from.cli=cfg_cli