self.on("message", function(message) {
  let event = document.createEvent("CustomEvent");
  event.initCustomEvent("addon-message", true, true, message);
  document.documentElement.dispatchEvent(event);
});
