const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/devtools/VariablesView.jsm");

let RDPMonitorView = {
  initialize: function (DebuggerServer, toolbox) {
    try {
      this._toolbox = toolbox;
      this._DebuggerServer = DebuggerServer;
      this._loggedConnection = null;
      this._initializePanes();
    } catch(e) {
      dump("EXCEPTION initializing RDPMonitorView: " + e + "\n");
    }
  },

  destroy: function () {
    this._destroyPanes();
  },

  get selectedConnection() {
    if (this._DebuggerServer) {
      return this._DebuggerServer._connections[this.Sidebar.selectedConnectionName];
    }
    return null;
  },

  enableLogging: function() {
    this.disableLogging();

    if (this.selectedConnection) {
      let conn = this.selectedConnection;
      this._loggedConnection = conn;

      conn.__transportSend = conn.transport.send.bind(conn.transport);
      conn.__onPacket = conn.onPacket.bind(conn);
      conn.__onClosed = conn.onClosed.bind(conn);

      conn.transport.send = (pkt) => this.onSend(conn, pkt);
      conn.onPacket = (pkt) => this.onPacket(conn, pkt);
      conn.onClosed = () => this.onClosed(conn);
    }
  },
  onSend: function(conn, pkt) {
    this.PacketList.addPacket(Date.now(), conn._prefix, "send", JSON.stringify(pkt));
    return conn.__transportSend(pkt);
  },
  onPacket: function(conn, pkt) {
    this.PacketList.addPacket(Date.now(), conn._prefix, "recv", JSON.stringify(pkt));
    return conn.__onPacket(pkt);
  },
  onClosed: function(conn) {
    return conn.__onClosed();
  },

  disableLogging: function() {
    if (this._loggedConnection) {
      let conn = this._loggedConnection;
      conn.transport.send = conn.__transportSend;
      conn.onPacket = conn.__onPacket;
      conn.onClosed = conn.__onClosed;
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
  },

  _emptyListView: function() {
    while (this._listView.firstChild) {
      this._listView.removeChild(this._listView.firstChild);
    }
  },

  onExport: function(evt) {

  },

  onDiagram: function(evt) {

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
      this._loggedConnection = this._DebuggerServer._connections[this.selectedConnectionName];
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

    let options = [""].concat(Object.keys(this._DebuggerServer._connections));

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
  }
};

RDPMonitorView.Sidebar = new SidebarView();
RDPMonitorView.PacketList = new PacketListView();
