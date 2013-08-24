this.EXPORTED_SYMBOLS = [
  "setLoggingCallback",
  "startLogDebuggerConnection",
  "stopLogDebuggerConnection",
  "loggedDebuggerConnection",
  "clearLoggedDebuggerMessages"
];

var loggedConnection, loggedConnectionDirection,
    loggingCallback, loggedMessages = [];

this.setLoggingCallback = function (cb) {
  loggingCallback = cb;
};

this.startLogDebuggerConnection = function(conn, direction, prefix) {
  if (loggedConnection != conn) {
    stopLogDebuggerConnection(loggedConnection);

    loggedConnection = conn;
    loggedConnectionDirection = direction;

    if (typeof conn._prefix == "undefined" && prefix) {
      conn._prefix = prefix;
    }

    // NOTE: on the server side a connection transport is conn.transport,
    // on the client side a client transport is client._transport.
    let transport = !conn.transport ? conn._transport : conn.transport;

    conn.__transportSend = transport.send.bind(transport);
    conn.__onPacket = conn.onPacket.bind(conn);
    conn.__onClosed = conn.onClosed.bind(conn);

    transport.send = function(pkt) { return onSend(conn, pkt); };
    conn.onPacket = function(pkt) { return onReceive(conn, pkt); };
    conn.onClosed = function(status) { return onClosed(conn, status); };
  }
};

this.stopLogDebuggerConnection = function(conn) {
  if (!conn) {
    conn = loggedConnection;
  }

  if (conn && loggedConnection === conn) {
    let transport = !conn.transport ? conn._transport : conn.transport;

    // NOTE: transport could be null if the connection is closed
    if (transport) {
      transport.send = conn.__transportSend;
    }
    conn.onPacket = conn.__onPacket;
    conn.onClosed = conn.__onClosed;
    loggedConnection = null;
    loggedConnectionDirection = null;
  }
};

this.loggedDebuggerConnection = function() {
  return { client: loggedClient, direction: loggedConnectionDirection };
};

this.clearLoggedDebuggerMessages = function() {
  loggedMessages = [];
};

function handleMessage(msg) {
  loggedMessages.push(msg);

  try {
    if (typeof loggingCallback == "function") {
      loggingCallback(msg);
    }
  } catch(e) {
    // TODO: log exceptions
  }
}

function onSend(conn, pkt) {
  let msg = {
    timestamp: Date.now(),
    direction: "send",
    packet: pkt,
    connection: conn
  };

  handleMessage(msg);

  return conn.__transportSend(pkt);
}

function onReceive(conn, pkt) {
  let msg = {
    timestamp: Date.now(),
    direction: "recv",
    packet: pkt,
    connection: conn
  };

  handleMessage(msg);

  return conn.__onPacket(pkt);
}

function onClosed(conn, status) {
  let msg = {
    timestamp: Date.now(),
    direction: "closed",
    packet: {status: status},
    connection: conn
  };

  handleMessage(msg);

  return conn.__onClosed(status);
}
