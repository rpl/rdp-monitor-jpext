const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/devtools/VariablesView.jsm");

let RDPMonitorView = {
  initialize: function (DebuggerServer, toolbox) {
    try {
      dump("DEBUG\n");
      this._toolbox = toolbox;
      this._DebuggerServer = DebuggerServer;
      this._loggingConnections = {};
      this._initializePanes();
    } catch(e) {
      dump("EXCEPTION initializing RDPMonitorView: " + e + "\n");
    }
  },

  destroy: function () {
    this._destroyPanes();
  },

  get selectedConnectionName() {
    let el = this.Sidebar.getFocusedItem();
    if (el) {
      return el._name.value;
    } else {
      return null;
    }
  },

  get selectedConnection() {
    return this._DebuggerServer._connections[this.selectedConnectionName];
  },

  enableLogging: function() {
    if (this.selectedConnectionName &&
        Object.keys(this._loggingConnections).indexOf(this.selectedConnectionName) < 0) {
      let conn = this.selectedConnection;
      this._loggingConnections[this.selectedConnectionName] = conn;

      conn.__transportSend = conn.transport.send.bind(conn.transport);
      conn.__onPacket = conn.onPacket.bind(conn);
      conn.__onClosed = conn.onClosed.bind(conn);

      conn.transport.send = (pkt) => this.onSend(conn, pkt);
      conn.onPacket = (pkt) => this.onPacket(conn, pkt);
      conn.onClosed = () => this.onClosed(conn);

      RDPMonitorView.Sidebar.loggingConnections = Object.keys(this._loggingConnections);
    }
  },
  onSend: function(conn, pkt) {
    dump("ON SEND\n");
    this.PacketList.addPacket(Date.now(), conn._prefix, "send", JSON.stringify(pkt));
    return conn.__transportSend(pkt);
  },
  onPacket: function(conn, pkt) {
    dump("ON PACKET\n");
    this.PacketList.addPacket(Date.now(), conn._prefix, "recv", JSON.stringify(pkt));
    return conn.__onPacket(pkt);
  },
  onClosed: function(conn) {
    dump("ON CLOSED\n");
    return conn.__onClosed();
  },

  disableLogging: function() {
    let connName = this.selectedConnectionName;
    let conn = this.selectedConnection;
    conn.transport.send = conn.__transportSend;
    conn.onPacket = conn.__onPacket;
    conn.onClosed = conn.__onClosed;
    delete this._loggingConnections[connName];

    RDPMonitorView.Sidebar.loggingConnections = Object.keys(this._loggingConnections);
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
  },

  onSelection: function(evt) {
    dump("DEBUG: " + this._listView.selectedIndex+"\n");
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
    child.setAttribute("value", message.slice(0,200));
    child.setAttribute("class", "message");

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
}

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
    this._DebuggerServer = DebuggerServer;
    this._debuggerServerVariablesView = new VariablesView(document.querySelector("#dbg-server-view"));
    this._debuggerServerVariablesView.contextMenuId = "variableViewContextMenu";
    this._selectedPacket = null;
    this.refresh();
  },
  refresh: function() {
    this._debuggerServerVariablesView.rawObject = {
      DebuggerServer: this._DebuggerServer,
      Connections: this._DebuggerServer._connections,
      SelectedPacket: this._selectedPacket,
      LoggingConnections: this._loggingConnections
    };
  },
  destroy: function() {

  },
  getFocusedItem: function() {
    if (this._debuggerServerVariablesView) {
      return this._debuggerServerVariablesView.getFocusedItem();
    }
    return null;
  },
  set selectedPacket(value) {
    this._selectedPacket = value;
    this.refresh();
    return value;
  },
  get selectedPacket() {
    return this._selectedPacket;
  },
  set loggingConnections(value) {
    this._loggingConnections = value;
    this.refresh();
    return value;
  },
  get loggingConnections() {
    return this._loggingConnections;
  }
};

RDPMonitorView.Sidebar = new SidebarView();
RDPMonitorView.PacketList = new PacketListView();
