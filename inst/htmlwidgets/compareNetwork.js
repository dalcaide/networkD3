HTMLWidgets.widget({

  name: "compareNetwork",
  
  type: "output",

  renderValue: function(el, x) {
      var nets = new comNet(el,x);
      nets.drawNetworks();
  }

});
