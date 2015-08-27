Logging
=======
Logging module for Node.js, implementation of <https://perennial.atlassian.net/wiki/display/DV2/Logging>.

```sh
npm install https://github.com/Perennials/logging-node/tarball/master
```


TODO
----

- Things are very async and this make certain aspects inflexible because it is
  hard to sync everything if, for example, one needs wait for all logs to be
  completely written.
- It is possible to have deferred/buffering versions of everything, including
  the log and the session and they can open deferred records and so on...
  but a lot of work without direct application, except for a bit cleaner code.


Authors
-------
Borislav Peev (borislav.asdf at gmail dot com)