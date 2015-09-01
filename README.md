Logging
=======
Logging module for Node.js, implementation of <https://perennial.atlassian.net/wiki/display/DV2/Logging>.

```sh
npm install https://github.com/Perennials/logging-node/tarball/master
```

TODO
----

- Docs.
- When hooking `http.ClientRequest` the headers are not logged.
- When hooking `http.IncommingMessage` the body should be human readable, not
  chuncked or compressed, but I'm not sure because for repeating the request
  is better to have the exact replica, for human ispection and testing it
  needs to be readable and the `content-length` needs to be adjusted.

Authors
-------
Borislav Peev (borislav.asdf at gmail dot com)