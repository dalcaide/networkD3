HTMLWidgets.widget({

  name: "compareNetwork",
  
  type: "output",

  renderValue: function(el, x) {
   
   // Global variables
    var dataForShiny = [],
        options = x.options,
        color = eval(options.colourScale),
        zoom = d3.zoom();
    
   // Remove previous elements per iteration
   d3.select(el).selectAll("svg").remove();
   
   // Get the width and height
   var width = el.offsetWidth   / x.inputs.length,
       height = el.offsetHeight / x.inputs.length;
    
   for (var value in x.inputs ) {
    fnet (el, x.inputs[value]);
   }

    function fnet (el, data) {
     
    // Convert links and nodes data frames to d3 friendly format
    var links = HTMLWidgets.dataframeToD3(data.links),
        nodes = HTMLWidgets.dataframeToD3(data.nodes);

    // Create d3 force layout
    var force = d3.forceSimulation()
      .nodes(d3.values(nodes))
      .force("link", d3.forceLink(links).distance(options.linkDistance))
      .force("xAxis", d3.forceX(width / 2))
      .force("yAxis", d3.forceY(height / 2))
      .force("charge", d3.forceManyBody().strength(options.charge))
      .on("tick", tick);

      var drag = d3.drag()
        .on("start", dragstart)
        .on("drag", dragged)
        .on("end", dragended)
        
    // Create SVG element
    var svg = d3.select(el)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .attr("id", "thres" + data.threshold);

    // Add two g layers; the first will be zoom target if zoom = T
    // Fine to have two g layers even if zoom = F
    svg = svg
        .append("g")
        .attr("class","zoom-layer")
        .append("g")
        
    // Add zooming if requested
    if (options.zoom) {
      function redraw() {
        d3.select(el).select(".zoom-layer")
          .attr("transform", d3.event.transform);
      }
      zoom.on("zoom", redraw)

      d3.select(el).select("svg")
        .attr("pointer-events", "all")
        .call(zoom);

    } else {
      zoom.on("zoom", null);
    }

    // draw links
    var link = svg.selectAll(".link")
      .data(links)
      .enter().append("line")
      .attr("class", "link")
      .style("stroke", function(d) { return "black"/*d.colour*/ ; })
      //.style("stroke", options.linkColour)
      .style("opacity", options.opacity)
      .style("stroke-width", eval("(" + options.linkWidth + ")"))
      .on("mouseover", function(d) {
          d3.select(this)
            .style("opacity", 1);
      })
      .on("mouseout", function(d) {
          d3.select(this)
            .style("opacity", options.opacity);
      });

    // draw nodes
    var node = svg.selectAll(".node")
      .data(force.nodes())
      .enter().append("g")
      .attr("class", "node")
      .attr("size-pie", function(d){return nodeSize(d);})
      .on("mouseover", mouseover)
      .on("mouseout", mouseout)
      .on("click", click)
      .call(drag);
      
      // --- Restart the force simulation ---
      // It avoids a bug when we interact with Shiny
      force.alphaTarget(0.025).restart();
    
     
     console.log(links, nodes);
     
     
    // ---- Adding the pie chart if categories is available ----
    if (x.categories === null) {
      
      node.append("circle")
      .attr("r", function(d){ return nodeSize(d);})
      .attr("fill", function(d) { return color(d.group); })
      .attr("fill-copied", function(d) { return color(d.group); })
      .attr("class", "node-element")
      .attr("id", function(d) { return "node-" + d.name; })
      .style("stroke", "#000") // Change made: #fff
      .style("opacity", options.opacity)
      .style("stroke-width", "1.5px");
      
    } else {
      
      var pie = d3.pie()
      .sort(null)
      .value(function(d) { return d; });
      
      node
      .attr("id", function(d) {return "node-" + d.name})
      .selectAll(".arc")
      .data(function(d,i){ return pie(data.categories[i]) }).enter()
      .append("path")
      .attr("d", d3.arc()
        .outerRadius(function(d,i){ 
          nodesize = d3.select(this.parentNode).attr("size-pie"); 
          return nodesize;
        }).innerRadius(0)
      ).attr("fill", function(d) { return color(d.index); })
      .attr("fill-copied", function(d) { return color(d.index); })
      .attr("class", "node-element")
      .style("opacity", options.opacity);
      
    }
      
    node.append("svg:text")
      .attr("class", "nodetext")
      .attr("dx", 12)
      .attr("dy", ".35em")
      .text(function(d) { return d.name; })
      .style("font", options.fontSize + "px " + options.fontFamily)
      .style("opacity", options.opacityNoHover)
      .style("pointer-events", "none");
      
      if (options.shiny) {
      // Add id name to svg
      d3.select(el).select("svg").attr("id", options.id);
      // <-- NOTE: Adding the id is a way to identify the source of this data in shiny

      function receiveDataFromShiny (dataReceived) {
        for(var key in dataReceived){
          console.log(key,dataReceived[key]);
          var dataSelected = [].concat(dataReceived[key]);
          // <-- Avoid problems when there is only one node
          // Restore previous color
          d3.select("#" + key).selectAll(".node-element").attr("fill",function(d){ 
            return d3.select(this).attr("fill-copied") 
          });
          // Select new data
          dataSelected.forEach(function(d){
            if (data.categories === null) {
              d3.select("#" + key).select("#node-"+ d).attr("fill","yellow");
            } else {
              d3.select("#" + key).select("#node-"+ d).selectAll("path").attr("fill","yellow");
            }
          });
        }
      }
      
       Shiny.addCustomMessageHandler("myCallbackHandler", receiveDataFromShiny);
    }
    
    function sendDataToShiny (dataForShiny){ 
      var idName = d3.select(el).select("svg").attr("id");
      var dani = {"id":idName, "data": dataForShiny};
      //console.log(dani);
      return dani;
    }

    if (options.interaction == "brushing") { // <-- enable brushing interaction
      var brush = svg.append("g")
          .attr("class", "brush")
          .call(d3.brush()
              .extent([[0, 0], [width, height]])
              .on("brush", function() {
                  var extent = d3.event.selection;
                  dataForShiny = [];
                  node.each(function(d) {
                      var evaluation = extent[0][0] <= d.x && d.x < extent[1][0]
                          && extent[0][1] <= d.y && d.y < extent[1][1];
                      if (evaluation == true) {
                          dataForShiny.push(d.name)
                          d3.select(this).selectAll(".node-element").attr("fill","yellow")
                      } else {
                          d3.select(this).selectAll(".node-element").each(function(){
                            d3.select(this).attr("fill", d3.select(this).attr("fill-copied") ); 
                          });
                      }
  
                  });
              }).on("end", Shiny.onInputChange("mydata", sendDataToShiny(dataForShiny)))
            );
              
    } else if (options.interaction == "lasso") { // <-- lasso interaction
      // Lasso sub-functions
      var lasso_start = function() {
        lasso.items()
            .classed("not_possible",true)
            .classed("selected",false);
      };
      var lasso_draw = function() {
          // Style the possible dots
          lasso.possibleItems()
              .classed("not_possible",false)
              .classed("possible",true);
            // Style the not possible dot
          lasso.notPossibleItems()
              .classed("not_possible",true)
              .classed("possible",false);
      };
      var lasso_end = function() {
          // Reset the color of all dots
          lasso.items()
              .classed("not_possible",false)
              .classed("possible",false);
          // Style the selected dots
          lasso.selectedItems()
              .classed("selected",true);
          // Data for Shiny
          dataForShiny = [];    
          lasso.selectedItems().each(function(d){
            dataForShiny.push(d.name);
          });
          Shiny.onInputChange("mydata", sendDataToShiny(dataForShiny));
      };
      // Lasso function
      var lasso = d3.lasso()
          .closePathSelect(true)
          .closePathDistance(150)
          .items(node.selectAll(".node-element"))
          .targetArea(d3.select(el).select("svg"))
          .on("start",lasso_start)
          .on("draw",lasso_draw)
          .on("end",lasso_end);
  
      d3.select(el).select('svg').call(lasso);
    }
     
     function tick() {
      node.attr("transform", function(d) {
        if(options.bounded){ // adds bounding box
            d.x = Math.max(nodeSize(d), Math.min(width - nodeSize(d), d.x));
            d.y = Math.max(nodeSize(d), Math.min(height - nodeSize(d), d.y));
        }

        return "translate(" + d.x + "," + d.y + ")"});

      link
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });
    }
    
    function mouseover() {
      d3.select(this).select("circle").transition()
        .duration(750)
        .attr("r", function(d){return nodeSize(d)+5;});
      d3.select(this).select("text").transition()
        .duration(750)
        .attr("x", 13)
        .style("stroke-width", ".5px")
        .style("font", options.clickTextSize + "px ")
        .style("opacity", 1);
    }

    function mouseout() {
      d3.select(this).select("circle").transition()
        .duration(750)
        .attr("r", function(d){return nodeSize(d);});
      d3.select(this).select("text").transition()
        .duration(1250)
        .attr("x", 0)
        .style("font", options.fontSize + "px ")
        .style("opacity", options.opacityNoHover);
    }

    function click(d) {
      return eval(options.clickAction)
    }

    // add legend option
    if(options.legend){
        var legendRectSize = 18;
        var legendSpacing = 4;
        var legend = svg.selectAll('.legend')
          .data(color.domain())
          .enter()
          .append('g')
          .attr('class', 'legend')
          .attr('transform', function(d, i) {
            var height = legendRectSize + legendSpacing;
            var offset =  height * color.domain().length / 2;
            var horz = legendRectSize;
            var vert = i * height+4;
            return 'translate(' + horz + ',' + vert + ')';
          });

        legend.append('rect')
          .attr('width', legendRectSize)
          .attr('height', legendRectSize)
          .style('fill', color)
          .style('stroke', color);

        legend.append('text')
          .attr('x', legendRectSize + legendSpacing)
          .attr('y', legendRectSize - legendSpacing)
          .text(function(d) { return d; });
    }
     
   }
   
      // **** NodeSize: Compute the node radius ****
   function nodeSize(d) {
     if ( options.nodesize ) {
       return eval(options.radiusCalculation);
     } else {
       return 10
     }
   }
   // *******************************
   //  **** Drag functions ****
   function dragstart(d) {
      if (!d3.event.active) force.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(d) {
      d.fx = d3.event.x;
      d.fy = d3.event.y;
    }
    function dragended(d) {
      if (!d3.event.active) force.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }
    // *******************************
   
  }
});
