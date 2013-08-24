const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/devtools/VariablesView.jsm");

// NOTE: very crude hack, needed so other addons (e.g. FirefoxOS Simulator)
// can request logging of their debugger clients
// TODO: port to ConnectionManager (http://bugzilla.mozilla.org/898485)
Cu.import("resource://rdp-monitor-at-alcacoop-dot-it/rdp-monitor/data/modules/RDPMonitor.jsm");

let RDPMonitorView = {
  initialize: function (options, toolbox) {
    try {
      this._toolbox = toolbox;
      this._DebuggerServer = options.DebuggerServer;
      this._targetClient = options.targetClient;
      this._loggedConnection = null;
      this._initializePanes();
      this._openDiagramCb = options.onOpenDiagram;
      setLoggingCallback(this.handleLogMessage.bind(this));
    } catch(e) {
      dump("EXCEPTION initializing RDPMonitorView: " + e + "\n");
    }
  },

  onDiagram: function (pkt_list) {
    if (this._openDiagramCb) {
      this._openDiagramCb(pkt_list);
    }
  },

  destroy: function () {
    setLoggingCallback(null);
    this._destroyPanes();
  },

  get connectionsList() {
    return ["TargetClient"].concat(Object.keys(this._DebuggerServer._connections || {}));
  },

  get selectedConnection() {
    if (this.Sidebar.selectedConnectionName === "TargetClient") {
      return this._targetClient;
    }
    if (this._DebuggerServer && this._DebuggerServer._connections) {
      return this._DebuggerServer._connections[this.Sidebar.selectedConnectionName];
    }
    return null;
  },

  enableLogging: function() {
    this.disableLogging();

    if (this.selectedConnection) {
      let conn = this.selectedConnection;
      this._loggedConnection = conn;

      startLogDebuggerConnection(conn);
    }
  },
  handleLogMessage: function(msg) {
    if (!this._loggedConnection) {
      // WORKAROUND: set debugger client into the sidebar when an external addon
      // request logging using the shared jsm
      this._loggedConnection = msg.connection;
      this.Sidebar.loggedConnection = msg.connection;
    }
    this.PacketList.addPacket(msg.timestamp, msg.connection._prefix,
                              msg.direction, JSON.stringify(msg.packet));
  },

  disableLogging: function() {
    if (this._loggedConnection) {
      stopLogDebuggerConnection();
      delete this._loggedConnection;
    }
  },

  _initializePanes: function () {
    this.Sidebar.initialize(this._DebuggerServer);
    this.PacketList.initialize();
  },

  _destroyPanes: function () {

  },
};

function PacketListView() {
}

PacketListView.prototype = {
  initialize: function() {
    this._loggedPackets = [];
    this._listView = document.querySelector("#pkt-list");
    this._listView.addEventListener("select", (e) => this.onSelection(e));

    this._clearBtn = document.querySelector("#pkt-list-clear-btn");
    this._clearBtn.addEventListener("command", (e) => this.onClear(e));

    this._exportBtn = document.querySelector("#pkt-list-export-btn");
    this._exportBtn.addEventListener("command", (e) => this.onExport(e));

    this._diagramBtn = document.querySelector("#pkt-list-diagram-btn");
    this._diagramBtn.addEventListener("command", (e) => this.onDiagram(e));
  },

  onClear: function(evt) {
    this._emptyListView();
    this._loggedPackets = [];
    clearLoggedDebuggerMessages();
  },

  _emptyListView: function() {
    while (this._listView.firstChild) {
      this._listView.removeChild(this._listView.firstChild);
    }
  },

  onExport: function(evt) {

  },

  onDiagram: function(evt) {
    RDPMonitorView.onDiagram(this._loggedPackets);
  },

  onSelection: function(evt) {
    RDPMonitorView.Sidebar.selectedPacket = this._loggedPackets[this._listView.selectedIndex];
  },

  addPacket: function(timestamp, connection, direction, message) {
    let node = document.createElement("richlistitem");

    let child = document.createElement("label");
    child.setAttribute("value", timestamp);
    child.setAttribute("class", "timestamp");

    node.appendChild(child);

    child = document.createElement("label");
    child.setAttribute("value", connection);
    child.setAttribute("class", "connection");

    node.appendChild(child);

    child = document.createElement("label");
    child.setAttribute("value", direction);
    child.setAttribute("class", "direction");

    node.appendChild(child);

    child = document.createElement("description");
    child.setAttribute("value", message);
    child.setAttribute("class", "message");
    child.setAttribute("flex", "1");
    child.setAttribute("crop", "right");

    node.appendChild(child);

    this._listView.appendChild(node);
    this._loggedPackets.push({
      timestamp: timestamp,
      connetion: connection,
      direction: direction,
      message: JSON.parse(message)
    });

    return node;
  }
};

function ToolbarView() {
}

ToolbarView.prototype = {
  initialize: function () {

  },
  destroy: function () {

  }
};

function SidebarView() {
}

SidebarView.prototype = {
  initialize: function(DebuggerServer) {
    this._connSelectorView = document.querySelector("#logged-conn-selector");
    this._connSelectorView.addEventListener("select",
                                            () => this.onSelectConn(),
                                            true);
    this._DebuggerServer = DebuggerServer;
    this._debuggerServerVariablesView = new VariablesView(document.querySelector("#dbg-server-view"));
    this._debuggerServerVariablesView.contextMenuId = "variableViewContextMenu";
    this._selectedPacket = null;
    this.refresh();
  },
  onSelectConn: function() {
    let selected = this._connSelectorView.selectedItem;
    if (!selected || selected.getAttribute("label") == "") {
      // disable logging
      RDPMonitorView.disableLogging();
      this._loggedConnection = null;
    } else {
      // enable logging
      RDPMonitorView.enableLogging();
      this._loggedConnection = RDPMonitorView.selectedConnection;
    }
    this._renderVariablesView();
  },
  refresh: function() {
    this._renderConnSelectorView();
    this._renderVariablesView();
  },
  _renderVariablesView: function() {
    this._debuggerServerVariablesView.rawObject = {
      DebuggerServer: this._DebuggerServer,
      SELECTED_PACKET: this._selectedPacket,
      LOGGED_CONNECTION: this._loggedConnection
    };
  },
  _renderConnSelectorView: function() {
    let menulist = this._connSelectorView;

    let menupopup = menulist.querySelector("menupopup");
    while(menupopup.hasChildNodes()){
      menupopup.removeChild(menupopup.firstChild);
    }

    let options = [""].concat(RDPMonitorView.connectionsList);

    options.forEach(function(value) {
      let menuitem = document.createElement("menuitem");
      menuitem.setAttribute("label", value);
      if ((this._loggedConnection && value == this._loggedConnection._prefix) ||
          (!this._loggedConnection && value == "")) {
        menuitem.setAttribute("selected", true);
        menulist.setAttribute("label", value);
      }
      menupopup.appendChild(menuitem);
    });
  },

  get selectedConnectionName() {
    return this._connSelectorView.getAttribute("label");
  },

  destroy: function() {

  },
  set selectedPacket(value) {
    this._selectedPacket = value;
    this.refresh();
    return value;
  },
  get selectedPacket() {
    return this._selectedPacket;
  },
  get loggedConnection() {
    return this._loggedConnection;
  },
  set loggedConnection(value) {
    this._loggedConnection = value;
    this.refresh();
    return value;
  }
};

RDPMonitorView.Sidebar = new SidebarView();
RDPMonitorView.PacketList = new PacketListView();
