var Chart = new Class({
// The name of the chart
  name: null,
  // Boolean that determines if all of the chart elements have been setup yet
  init: false,
  // The current selection
  selection: null,
  // The data bound to the selection
  data: null,
  // Set the default dimensions and margins for the focus, context, and scroll area
  fWidth: 1000,
  fHeight: 250,
  cHeight: 50,
  sHeight: 50,
  fMargins: {left: 30, right: 30, top: 10, bottom: 20},
  cMargins: {top: 20, bottom: 20},
  sMargins: {top: 20, bottom: 10},
  // Reference to focus container
  focus: null,
  // Reference to context container
  context: null,
  // Reference to scroll container
  scroll: null,
  // Reference to the scroll bar itself
  scrollBar: null,
  // Define a few scales 
  // Input: array index -> Output: x coordinate in focus
  sFX: null,
  // Input: a data value -> Output: y coordinate in the focus
  sFY: null,
  // Used to draw tick marks for the focus y axis
  sFYA: null,
  // Used to generate the tick marks on the focus x axis
  sFXA: null,
  // Input: array index -> Output: x coordinate in context
  sCX: null,
  // Input: x coordinate in context -> Output: closest corresponding data points in contextData
  // Used to convert between the brush extent and data indexes in contextData
  sCXD: null,
  // Used to compute tick marks for the context x axis
  sCXA: null,
  // Input: data value -> Output: y coordinate in context
  sCY: null,
  // Used for animation purposes to shift coordinates in the focus
  sFShift: null,
  // Used to compute the width of the scroll bar
  // Input: number of data points in context -> Output: width of scroll bar in pixels
  sSP: null,
  // Does basically the opposite of the previous scale. Converts from pixel coordinates to data indexes in the complete array of data. Its purpose is to address a bug where the brush won't recompute its extent when its underlying scale changes
  // Input: pixel coordinate of either the start or end of the scroll bar -> Output: the index in the data array corresponding to that pixel
  sSD: null,
  // Define the axes
  // The x axis for the focus
  aFX: null,
  // The y axis for the focus
  aFY: null,
  // The x axis for the context (it won't have a y axis)
  aCX: null,
  // A bunch of additional params
  // The width of the bars in the focus view
  cBarWidth: 1,
  // The number of points to display in the focus on initialization
  focusPoints: 20,
  // The number of points to display in the context by default
  contextPoints: 500,
  // The data points being displayed in the context
  contextData: null,
  // The data points being displayed in the focus
  focusData: null,
  // The maximum expected value in the data set
  range: 100,
  // Data used to define the properties of the scroll bar 
  sbData: {x: 0, y: 0, width: 1000, height: 20},
  // Define what happens when the user moves the scroll bar
  drag: null,
  // Used to draw the path in the focus
  fLine: null,
  // The brushed use to select a region in the context view
  bC: null,
  // A convenience variable used keep track of the first index in the data array
  // that is being graphed in the context
  cStartIndex: 0,
  // An svg path used to draw the line graph in the focus
  pF: null,
  initialize: function(selection,config) {
    // It doesn't really make sense to use the same configuration for multiple charts
    // so just draw the chart in the first selection
    this.selection = selection[0][0];
    this.data = this.selection.__data__;

    // Calculate the total dimensions of the svg element
    this.svgWidth = this.fWidth + this.fMargins.left + this.fMargins.right;
    this.svgHeight = this.fMargins.top + this.fHeight + this.fMargins.bottom;
    this.svgHeight += this.cMargins.top + this.cHeight + this.cMargins.bottom;
    this.svgHeight += this.sMargins.top + this.sHeight + this.sMargins.bottom;

    // Initialize the layout of the chart
    // Now add the svg element and append the containers
    var svg = selection.append("svg")
      .attr("width", this.svgWidth)
      .attr("height", this.svgHeight);

    // The clip path prevents anything from being drawn outside of its borders
    svg.append("defs").append("clipPath")
      .attr("id", "clip")
      .append("rect")
      .attr("width", this.fWidth)
      .attr("height", this.fHeight);

    // Add the focus view, which will show a detailed line graph of a small portion of the data
    var yShift = this.fMargins.top;
    this.focus = svg.append("g")
      .attr("transform", "translate(" + this.fMargins.left + "," + yShift + ")")
      .attr("class", "focusg");

    // Add the context view, which will show a bar graph of a large segment of the data
    yShift += this.fHeight + this.fMargins.bottom + this.cMargins.top;
    this.context = svg.append("g")
      .attr("transform", "translate(" + this.fMargins.left + "," + yShift + ")")
      .attr("class", "contextg");

    // Add a container for a scroll bar, which will be used to load in more data into the context view
    yShift += this.cHeight + this.cMargins.bottom + this.sMargins.top;
    this.scroll = svg.append("g")
      .attr("transform", "translate(" + this.fMargins.left + "," + yShift + ")")
      .attr("class", "scrollg");

    this.initScales();
    this.initAxes();
    this.initScroll();
    this.initContext();
    this.initFocus();

  },
  initScroll: function() {
    // Compute the width of the scroll bar
    this.sbData.width = this.getScrollBarWidth();
    // Place the scroll bar as far right as it can go
    this.sbData.x = this.fWidth - this.sbData.width;

    // Initialize the drag behavior for the scroll bar
    this.drag = d3.behavior.drag()
      .origin(Object)
      .on("drag", (function(d, i) {
      this.dragMove(d, i);
    }).bind(this));

    // Add the scroll track
    this.scroll.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("height", this.sbData.height)
      .attr("width", this.fWidth)
      .attr("class", "scroll-track");

    // Add the scroll bar itself
    this.scrollBar = this.scroll.append("rect")
      .data([this.sbData])
      .attr("height", this.sbData.height)
      .attr("width", this.sbData.width)
      .attr("fill", "black")
      .attr("class", "scroll-bar")
      .attr("transform", "translate(" + this.sbData.x + "," + this.sbData.y + ")")
      .call(this.drag);
  },
  // Update the context view
  initContext: function() {
    // Configure the context y scale
    this.sCY
      .domain([0, this.range])
      .range([0, this.cHeight]);

    // Configure the sSD scale, which converts between x coordinates in the context
    // and data indexes into contextData
    this.setSSD();

    // Draw the bars in the context
    this.updateContext();

    // Add an x axis to the context
    this.context.append("g")
      .attr("class", "x-axis")
      .attr("transform", "translate(0," + this.cHeight + ")")
      .call(this.aCX);

    // Define a scale for use in the brush. 
    var scale = d3.scale.linear()
      .domain([0, this.fWidth])
      .range([0, this.fWidth]);

    // Add a brush on top of the bars
    this.bC = d3.svg.brush()
      .x(scale)
      .on("brush", (this.onBrush).bind(this));

    // Append the brush to the context
    this.context.append("g")
      .attr("class", "brush")
      .call(this.bC)
      .selectAll("rect")
      .attr("y", "-10")
      .attr("height", this.cHeight + 10);

    // Set the brush region so the we see the last 20 data points. If there aren't 20 points, then
    // just show all them.
    var len = this.sCX(this.focusPoints);
    this.bC.extent([Math.max(0, this.fWidth - len), this.fWidth]);

    // This will actually draw the brush in the context. Creating the brush won't draw it automatically.
    this.context.call(this.bC);
  },
  // Updates the context data based on the position and size of the scroll bar and 
  // redraws the bars in the context view accordingly
  updateContext: function() {
    this.updateContextData();

    // Bind the contextData to the bars by time stamp
    var bars = this.context.selectAll(".bar")
      .data(this.contextData, function(d) {
      return d.ts;
    });

    bars
      .attr("x", (function(d, i) {
      return this.sCX(i);
    }).bind(this))
      .attr("y", (function(d, i) {
      return this.cHeight - this.sCY(d.value);
    }).bind(this))
      .attr("height", (function(d) {
      return this.sCY(d.value);
    }).bind(this));

    bars.enter().append("rect")
      .attr("x", (function(d, i) {
      return this.sCX(i);
    }).bind(this))
      .attr("y", (function(d, i) {
      var val = this.cHeight - this.sCY(d.value);
      return val;
    }).bind(this))
      .attr("height", (function(d) {
      return this.sCY(d.value);
    }).bind(this))
      .attr("width", this.cBarWidth)
      .attr("class", "bar");

    bars.exit().remove();

    // Update the context x axis
    this.context.select(".x-axis").call(this.aCX);
  },
  initFocus: function() {
    // Configure the focus axes
    this.sFY
      .domain([0, this.range])
      .range([this.fHeight, 0]);

    this.sFYA
      .domain([0, this.range])
      .range([this.fHeight, 0]);

    this.sCXD
      .domain([0, this.fWidth])
      .range([0, this.contextData.length]);

    // Add the focus axes
    this.focus.append("g")
      .attr("class", "y-axis")
      .call(this.aFY);

    this.focus.append("g")
      .attr("class", "x-axis")
      .attr("transform", "translate(0," + this.fHeight + ")")
      .call(this.aFX);

    // Define a function for drawing lines between data points in the focus
    this.fLine = d3.svg.line()
      .x((function(d, i) {
      return this.sFX(i);
    }).bind(this))
      .y((function(d, i) {
      return this.sFY(d.value);
    }).bind(this));

    // Append a path to the focus
    this.pF = this.focus.append("g")
      .attr("clip-path", "url(#clip)")
      .append("path")
      .attr("class", "line");

    this.updateFocus();
  },
  // Updates the line path in the focus when the scroll bar or brush change
  updateFocus: function() {
    // Refresh the focus data
    this.updateFocusData();

    // Redraw the line graph
    this.pF.data([this.focusData])
      .attr("transform", null)
      .attr("d", this.fLine);

    // Update the focus x axis
    this.focus.select(".x-axis").call(this.aFX);
  },
  // Updates the focus data when the scroll bar or brush change
  updateFocusData: function() {
    // Use the position and extent of the brush to select a subset of data points from 
    // contextData
    var bStart = Math.min(this.sCXD(this.bC.extent()[0]), this.sCXD(this.bC.extent()[1]));
    bStart = Math.round(bStart);
    var bEnd = Math.max(this.sCXD(this.bC.extent()[0]), this.sCXD(this.bC.extent()[1]));
    bEnd = Math.round(bEnd);
    // Make sure that the data is in the correct range
    bStart = Math.max(0, bStart);
    bEnd = Math.min(this.contextData.length, bEnd + 1);
    var bLen = bEnd - bStart;

    // Use these values to get the focus data points
    this.focusData = this.contextData.slice(bStart, bEnd);

    // Also update the focus scales
    this.sFX
      .domain([0, bLen - 1])
      .range([0, this.fWidth]);

    this.sFXA
      .domain([this.cStartIndex + bStart, this.cStartIndex + bEnd - 1])
      .range([0, this.fWidth]);

    /*console.log("B-START");
    console.log(bStart);
    console.log("B-END");
    console.log(bEnd);
    console.log(this.bC.extent());*/
  },
  dragMove: function(d, i) {
    // The new desired x position of the scroll bar
    var newX = d.x += d3.event.dx;

    // Make sure the scroll bar doesn't go off of the scroll track
    newX = Math.max(0, newX);
    newX = Math.min(this.fWidth - this.sbData.width, newX);
    d.x = newX;

    this.scrollBar.attr("transform", function(d, i) {
      return "translate(" + [d.x, 0] + ")";
    });

    this.updateContext();
    this.updateFocus();
  },
  // Computes the width of the scroll bar based on the number of points to be 
  // displayed in the context and the total number of data points
  getScrollBarWidth: function() {
    return Math.min(this.fWidth, this.fWidth * (this.contextPoints / this.data.length));
  },
  // Updates the context data points based on the width and position of the scroll bar
  updateContextData: function() {
    // From the x position of the scroll bar, compute the index of the first data point that should 
    // appear in the context
    var start = Math.round(this.sSD(this.sbData.x));
    // Keep track of this value, because we need it to update the x axis in the focus 
    // when the brush changes
    this.cStartIndex = start;

    // Then find the ending index
    var end = Math.min(this.data.length, start + this.contextPoints);

    // It's fine if the ending index is out of bounds. Javascript will do the right thing.
    this.contextData = this.data.slice(start, end);

    // Also update the scales for the context
    // Update the sCX to make sure the data points are graphed at regular intervals along the x axis
    this.sCX
      .domain([0, this.contextData.length - 1])
      .range([0, this.fWidth]);

    // Update the scale underlying the context x axis  
    this.sCXA
      .domain([start, end - 1])
      .range([0, this.fWidth]);
  },
  initScales: function() {
    this.sCX = d3.scale.linear();
    this.sCXA = d3.scale.linear();
    this.sCXD = d3.scale.linear();
    this.sCY = d3.scale.linear();
    this.sCY = d3.scale.linear();
    this.sFShift = d3.scale.linear();
    this.sFX = d3.scale.linear();
    this.sFXA = d3.scale.linear();
    this.sFY = d3.scale.linear();
    this.sFYA = d3.scale.linear();
    this.sSP = d3.scale.linear();
    this.sSD = d3.scale.linear();
  },
  initAxes: function() {
    // Define the axes
    // The x axis for the focus
    this.aFX = d3.svg.axis()
      .scale(this.sFXA)
      .orient("bottom");
    // The y axis for the focus
    this.aFY = d3.svg.axis()
      .scale(this.sFYA)
      .orient("left");
    // The x axis for the context (it won't have a y axis)
    this.aCX = d3.svg.axis()
      .scale(this.sCXA)
      .orient("bottom");
  },
  // Updates the sSD scale  
  setSSD: function() {
    this.sSD
      .domain([0, this.fWidth])
      .range([0, this.data.length]);
  },
  // Called when the brush is moved or resized
  onBrush: function() {
    this.updateFocus();
  },
  // Adds a new data point into the data array and then updataes the chart
  addDataPoint: function(point) {
    this.data.push(point);

    // Resize the scroll bar 
    var newWidth = this.getScrollBarWidth();
    // If, when we add the new data point, the scroll bar is at the rightmost edge of the scroll track,
    //  force the scroll bar to stay at the rightmost edge so we can see the new data point
    if (this.sbData.x + this.sbData.width === this.fWidth) 
      this.sbData.x = this.fWidth - newWidth;
    this.sbData.width = newWidth;

    this.scrollBar.data([this.sbData])
      .attr("width", this.sbData.width)
      .attr("transform", "translate(" + this.sbData.x + "," + this.sbData.y + ")");

    // Since we added a new data point into the data array, we need to update the sSD scale
    this.setSSD();
    this.updateContext();

    // Since we added another data point, we need to update this scale so that the focus
    // draws correctly
    this.sCXD
      .domain([0, this.fWidth])
      .range([0, this.contextData.length]);

    this.updateFocus();
  },
  addRandPoint: function() {
    var t = this.data.length;
    this.addDataPoint({ts: t, value: this.range * Math.random()});
  }
});