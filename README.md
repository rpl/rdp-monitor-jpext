RDP Monitor - Firefox DevTools Panel Addon
==========================================

Status: **WORKING PROTOTYPE**

This restartless Firefox extension adds a new panel into the new Developer Toolbox,
to quickly log and inspect Remote Debugger Protocol message exchanging, which is
useful to better understand how it works or to helps Firefox DevTools
developers to debug their changes to the developer tools actors and clients.

* [Demo Screencast](http://youtu.be/f0oRcVVp8gQ)
* [Last XPI build](https://github.com/rpl/rdp-monitor-jpext/releases/download/0.1.2/rdp-monitor-0.1.2.xpi)

By default it doesn't log anything, then we can choose which connection we want to be
logged by selecting it from the connections selector.

Currently in the connections selector lists the current toolbox target
(which is an outgoing connection even if it's local)
and all the incoming connections to the local DebuggerServer.

NEXT
----

* export logged RDP messages to file
* clean up d3js-based diagram renderer
* clean up rdp monitor panel code and ui (e.g. style packet list, refactor devtool panels)
* When bug 898485 will be fixed and ConnectionManager merged into mozilla-central, we can
  list all the outgoing connections in the connections selector.
