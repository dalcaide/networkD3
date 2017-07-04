

comNet = function (el, x) {

    // Global variables
    this.options = x.options;
    this.color = eval(x.options.colourScale);
    this.zoom = d3.zoom();
    this.dataIdSelected = [];


    // Remove previous elements per iteration
    d3.select(el).selectAll("svg").remove();

    // Get the width and height
    this.width = el.offsetWidth / x.inputs.length;
    this.height = el.offsetHeight / x.inputs.length;
    this.x = x;
    this.el = el;
};

comNet.prototype.drawNetworks = function () {

    var me = this;

    me.createPanel();

    for (var value in me.x.inputs ) {
        me.createNetwork (me.el, me.x.inputs[value] );
    }

};

comNet.prototype.createPanel = function () {

    var me = this;

    d3.select("#controlPanel").remove();

    d3.select(me.el)
        .append("div")
        .attr("id", "controlPanel")
        .append("button")
        .attr("type", "button")
        .text("Clustering")
        .attr("id", "clustering")
        .on("click", function() { me.clusteringButton() });
};


comNet.prototype.clusteringButton = function () {

    var me = this;
    var cArray = ["clustering1", "clustering2", "clustering3", "clustering4"],
        cond = false,
        cond_i = 0;

    console.log("dani");
    while (cond == false && cond_i < cArray.length) {

        if (d3.selectAll("." + cArray[cond_i]).size() == 0 ) {
            cond = true;
        } else {
            cond_i++;
        }

    }

    console.log(cond_i, cArray[cond_i]);

    d3.selectAll(".selected")
        .classed("selected",false)
        .classed("possible",false)
        .classed(cArray[cond_i], true);

};

comNet.prototype.createNetwork = function (el, data) {

    var me = this;

    // Convert links and nodes data frames to d3 friendly format
    var links = HTMLWidgets.dataframeToD3(data.links),
        nodes = HTMLWidgets.dataframeToD3(data.nodes),
        idSvg = "t" + data.threshold.toString().replace('.','-');

    var pie = d3.pie()
        .sort(null)
        .value(function(d) { return d; });

    // Adding the id-element inside nodes Object
    nodes.forEach(function(d){
       d.nameList = data.nameList[d.name];
       d.categories = pie(data.categories[d.name]);
    });

    // Create SVG element
    var svg = d3.select(el)
        .append("svg")
        .attr("width", me.width)
        .attr("height", me.height)
        .attr("id", idSvg);

    // Add two g layers; the first will be zoom target if zoom = T
    // Fine to have two g layers even if zoom = F
    svg = svg
        .append("g")
        .attr("class","zoom-layer")
        .append("g");

    // Add zooming if requested
    if (me.options.zoom) {
        function redraw() {
            d3.select(el).select(".zoom-layer")
                .attr("transform", d3.event.transform);
        }
        me.zoom.on("zoom", redraw);

        d3.select(el).select("svg")
            .attr("pointer-events", "all")
            .call(me.zoom);

    } else {
        me.zoom.on("zoom", null);
    }
    me.drawNodes(idSvg, svg, nodes, links);

};


comNet.prototype.drawNodes = function (idSvg, svg,
                                       nodes,
                                       links) {

    var me = this;

    // Draw links
    var link = svg.selectAll(".link")
        .data(links)
        .enter().append("line")
        .attr("class", "link")
        .style("stroke-dasharray", function(d){
            if (d.linkType == 0) {
                return 3;
            } else {
                return 0;
            }
        }).style("stroke", me.options.linkColour )
        .style("opacity", me.options.opacity)
        .style("stroke-width", eval("(" + me.options.linkWidth + ")"))
        .on("mouseover", function(d) {
            d3.select(this)
                .style("opacity", 1);
        })
        .on("mouseout", function(d) {
            d3.select(this)
                .style("opacity", me.options.opacity);
        });



    // Create d3 force layout
    var force = d3.forceSimulation()
        .nodes(d3.values(nodes))
        .force("link", d3.forceLink(links).distance(me.options.linkDistance))
        .force("xAxis", d3.forceX(me.width / 2))
        .force("yAxis", d3.forceY(me.height / 2))
        .force("charge", d3.forceManyBody().strength(me.options.charge))
        .on("tick", tick);

    var drag = d3.drag()
        .on("start", dragstart)
        .on("drag", dragged)
        .on("end", dragended);


    // draw nodes
    var node = svg.selectAll(".node")
        .data(force.nodes())
        .enter().append("g")
        .attr("class", "node")
        .attr("size-pie", function(d){return me.nodeSize(d);})
        .on("mouseover", mouseover)
        .on("mouseout", mouseout)
        .on("click", click)
        .call(drag);

    // --- Restart the force simulation ---
    // It avoids a bug when we interact with Shiny
    force.alphaTarget(0.025).restart();


    // ---- Adding the pie chart if categories is available ----

/*
        node.append("circle")
            .attr("r", function(d){ return me.nodeSize(d);})
            .attr("fill", "#000")
            .attr("fill-copied", function(d) { return me.color(d.group); })
            .attr("class", "node-element")
            .attr("id", function(d) { return "node-" + d.name; })
            .attr("stroke", function(d) { return me.color(d.group); })
            .style("opacity", me.options.opacity)
            .style("stroke-width", "2.5px");
*/


        var pie = d3.pie()
            .sort(null)
            .value(function(d) { return d; });

        node
            .attr("id", function(d) {return "node-" + d.name})
            .selectAll(".arc")
            .data(function(d){ return d.categories }).enter()
            .append("path")
            .attr("d", d3.arc()
                .outerRadius(function(d,i){
                    nodesize = d3.select(this.parentNode).attr("size-pie");
                    return nodesize;
                }).innerRadius(0)
            ).attr("fill", "#BEBEBE")
            //.attr("stroke", function(d) { return me.color(d.index); })
            //.attr("fill-copied", function(d) { return me.color(d.index); })
            .attr("class", "node-element")
            .style("opacity", me.options.opacity);


    node.append("svg:text")
        .attr("class", "nodetext")
        .attr("dx", 12)
        .attr("dy", ".35em")
        .text(function(d) { return d.name; })
        .style("font", me.options.fontSize + "px " + me.options.fontFamily)
        .style("opacity", me.options.opacityNoHover)
        .style("pointer-events", "none");


    function tick() {
        node.attr("transform", function(d) {
            if(me.options.bounded){ // adds bounding box
                d.x = Math.max(me.nodeSize(d), Math.min(width - me.nodeSize(d), d.x));
                d.y = Math.max(me.nodeSize(d), Math.min(height - me.nodeSize(d), d.y));
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
            .attr("r", function(d){return me.nodeSize(d)+5;});
        d3.select(this).select("text").transition()
            .duration(750)
            .attr("x", 13)
            .style("stroke-width", ".5px")
            .style("font", me.options.clickTextSize + "px ")
            .style("opacity", 1);
    }

    function mouseout() {
        d3.select(this).select("circle").transition()
            .duration(750)
            .attr("r", function(d){return me.nodeSize(d);});
        d3.select(this).select("text").transition()
            .duration(1250)
            .attr("x", 0)
            .style("font", me.options.fontSize + "px ")
            .style("opacity", me.options.opacityNoHover);
    }

    function click(d) {
        return eval(me.options.clickAction)
    }

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

    me.interactions(idSvg);


};


comNet.prototype.interactions = function (idSvg) {

    var me = this;

    // Lasso function
    var lasso = d3.lasso()
        .closePathSelect(true)
        .closePathDistance(150)

        .items(d3.select(me.el)
            .select("#" + idSvg)
            .selectAll(".node"))

        .targetArea(d3.select(me.el)
            .selectAll("#" + idSvg))

        .on("start", function() { me.lasso_start(lasso) })
        .on("draw",  function() { me.lasso_draw (lasso) })
        .on("end",   function() { me.lasso_end  (lasso) });

    // Call laso interaction
    d3.select(me.el)
        .select("#" + idSvg)
        .call(lasso);


};


comNet.prototype.lasso_start = function (lasso) {
    lasso.items()
        .selectAll(".node-element")
        .classed("possible",false)
        .classed("selected",false);
};

comNet.prototype.lasso_draw = function(lasso) {
    // Style the possible dots
    lasso.possibleItems()
        .selectAll(".node-element")
        .classed("not_possible",false)
        .classed("possible",true);
    // Style the not possible dot
    lasso.notPossibleItems()
        .selectAll(".node-element")
        .classed("not_possible",true)
        .classed("possible",false);
};

comNet.prototype.lasso_end = function(lasso) {

    var me = this;
    // Reset the color of all dots
    lasso.items()
        .selectAll(".node-element")
        .classed("not_possible",false)
        .classed("possible",false);
    // Style the selected dots
    lasso.selectedItems()
        .selectAll(".node-element")
        .classed("selected",true);

    me.dataIdSelected = [];
    lasso.selectedItems().each(function(d){
        me.dataIdSelected = me.dataIdSelected.concat(d.nameList);
    });
    me.interactionNodeSelection();

};


comNet.prototype.interactionNodeSelection = function (){
    var me = this;


    d3.select(me.el).selectAll(".node").each(function(d){

        // --> Restore the previous fill
        d3.select(this)
            .selectAll(".node-element")
            .classed("selected", false);

        // --> If selection highlight
        function isInSelection(element) {
            return me.dataIdSelected.includes(element);
        }

        if( d.nameList.findIndex(isInSelection) > -1 ) {
            d3.select(this)
                .selectAll(".node-element")
                .classed("selected", true);
        }
    });
};


comNet.prototype.nodeSize = function (d) {
    var me = this;
    if ( me.options.nodesize ) {
        return eval(options.radiusCalculation);
    } else {
        return 10
    }
};

/*
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
*/

/*
 comNet.prototype.recieveFromShiny = function (){

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

 };
 */

/*




 */

