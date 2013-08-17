console.log("STARTING");

var { Cu, Cc, Ci } = require("chrome");
const self = require("sdk/self");

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyGetter(this, 'DebuggerServer', function() {
   Cu.import('resource://gre/modules/devtools/dbg-server.jsm');
   return DebuggerServer;
});

// Register DevTools Tab

Cu.import("resource:///modules/devtools/gDevTools.jsm");

/* Depending on the version of Firefox, promise module can have different path */
try { Cu.import("resource://gre/modules/commonjs/promise/core.js"); } catch(e) {}
try { Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js"); } catch(e) {}

XPCOMUtils.defineLazyGetter(this, "osString",
                            function() Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS);

const rdpmonitorProps = "chrome://rdp-moditor/locale/rdp-monitor.properties";
let rdpmonitorStrings = Services.strings.createBundle(rdpmonitorProps);

let devtoolTabDefinition = {
  id: "rdp-monitor",
  key: "R",
  ordinal: 0,
  modifiers: osString == "Darwin" ? "accel,alt" : "accel,shift",
  //icon: self.data.url("tool-webconsole.png"),
  url: "chrome://rdp-monitor/content/rdp-monitor.xul",
  label: "RDP Monitor",
  tooltip: "RDP Monitor tooltip",

  isTargetSupported: function(target) {
    return true; //target.isLocalTab;
  },

  build: function(iframeWindow, toolbox) {
    // init devtool tab
    console.log("BUILD", iframeWindow.RDPMonitorView);
    iframeWindow.RDPMonitorView.initialize(DebuggerServer, toolbox);
    console.log("BUILD2");
    return Promise.resolve(iframeWindow.RDPMonitorView);
  }
};

function startup() {
  gDevTools.registerTool(devtoolTabDefinition);
}

function shutdown() {
  gDevTools.unregisterTool(devtoolTabDefinition);
}

startup();

exports.onUnload = function() {
  shutdown();
};

// TODO: call shutdown on unload

// GCLI

var Gcli = require("gcli");

Gcli.addCommand({
  name: 'rdp-monitor',
  description: 'Commands to control the RDP Monitor DevTools'
});

Gcli.addCommand({
  name: "rdp-monitor open",
  description: "Open the RDP Monitor DevTools Tab",
  exec: function(args, context) {
    // TODO: open devtools tab
  }
});
