/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

let Cu = Components.utils;
let Cc = Components.classes;
let Ci = Components.interfaces;
let CC = Components.Constructor;

let promise;

function debug(aMsg) {
  /*
  Cc["@mozilla.org/consoleservice;1"]
    .getService(Ci.nsIConsoleService)
    .logStringMessage("--*-- RDPTestHelperActor : " + aMsg);
   */
  dump("--*-- RDPTestHelperActor : " + aMsg + "\n");
}

debug("loading");

function RDPTestHelperActor(aConnection) {
  debug("init");
  //NOTE: promises could be useful for more complex use cases
  promise = Cu.import("resource://gre/modules/commonjs/sdk/core/promise.js").Promise;
}

function quit (aForceQuit)
{
  var appStartup = Components.classes['@mozilla.org/toolkit/app-startup;1'].
    getService(Components.interfaces.nsIAppStartup);

  // eAttemptQuit will try to close each XUL window, but the XUL window can cancel the quit
  // process if there is unsaved data. eForceQuit will quit no matter what.
  var quitSeverity = aForceQuit ? Components.interfaces.nsIAppStartup.eForceQuit :
                                  Components.interfaces.nsIAppStartup.eAttemptQuit;
  appStartup.quit(quitSeverity);
}

RDPTestHelperActor.prototype = {
  actorPrefix: "rdpTestHelper",

  _sendError: function wa_actorSendError(info) {
    var { error, message, type } = info;
    debug("Sending error: " + aMsg);
    this.conn.send(
      { from: this.actorID,
        type: type,
        error: error,
        message: message
      });
  },

  exitApp: function() {
    debug("exitApp");

    quit(true);
  },

  openTab: function (aRequest) {
    debug("openTab");

    let url = aRequest.url;
    if (!url) {
      this._sendError({error: "missingParameter",
                       message: "missing parameter url"});
    }

    let defer = promise.defer();

    var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
          .getService(Components.interfaces.nsIWindowMediator);
    var mainWindow = wm.getMostRecentWindow("navigator:browser");
    var tabs = mainWindow.gBrowser.tabs;
    var tab = mainWindow.gBrowser.addTab(aRequest.url);

    var newTabBrowser = mainWindow.gBrowser.getBrowserForTab(tab);
    newTabBrowser.addEventListener("load", function oneshot() {
      newTabBrowser.removeEventListener("load", oneshot, true);
      mainWindow.gBrowser.selectedTab = tab;
      defer.resolve({ url: url, message: "tab opened",
                      tabIndex: Array.prototype.slice.call(tabs).indexOf(tab) });
    }, true);

    return defer.promise;
  }
};

/**
 * The request types this actor can handle.
 */
RDPTestHelperActor.prototype.requestTypes = {
  "openTab": RDPTestHelperActor.prototype.openTab,
  "exitApp": RDPTestHelperActor.prototype.exitApp
};

DebuggerServer.addGlobalActor(RDPTestHelperActor, "RDPTestHelperActor");

debug("loaded");
