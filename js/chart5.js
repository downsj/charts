var Chart = new Class({
  // The current selection
  selection: null,
  // The data bound to the selection
  data: null,
  // Set the default dimensions and margins for the focus, context, and scroll area
  fWidth: 1000,
  fHeight: 250,
  cHeight: 50,
  sHeight: 50,
  iHeight: 15,
  iMargins: {top: 10, bottom: 10},
  fMargins: {top: 10, bottom: 20, left: 30, right: 30},
  cMargins: {top: 10, bottom: 20},
  sMargins: {top: 20, bottom: 10},
  // Reference to the info container which is used to display the date and value
  // of the currently "selected" data point in the focus
  info: null,
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
  // Data used to animate the focus
  focusAniData: null,
  // The maximum expected value in the data set
  range: 100,
  // Data used to define the properties of the scroll bar 
  sbData: {x: 0, y: 0, width: 1000, height: 20},
  // Define what happens when the user moves the scroll bar
  drag: null,
  // Used to draw the path in the focus
  fLine: null,
  // Used to draw the same path as fLine, but shifted to the right for animation purposes
  fLineAni: null,
  // The brushed use to select a region in the context view
  bC: null,
  // A convenience variable used keep track of the first index in the data array
  // that is being graphed in the context
  cStartIndex: 0,
  // These variables keep track of the starting and ending index of the focus data
  // in the data array. This is useful to have on hand so we can check if the data
  // in the focus has been scaled or shifted
  fStartIndex: 0,
  fEndIndex: 0,
  // When we add a new data point, we may need to shift or scale the focus path.
  // These variables will be used to do just that. 
  shiftAmt: 0,
  scaleAmt: 0,
  // An svg path used to draw the line graph in the focus
  pF: null,
  // An invisible rectangle for capturing mouse events in the focus
  mouseRect: null,
  // A little icon that shows the currently selected point in the focus
  pointSelector: null,
  initialize: function(selection, config) {
    // It doesn't really make sense to use the same configuration for multiple charts
    // so just draw the chart in the first selection
    this.selection = selection[0][0];
    this.data = this.selection.__data__;

    // Use the configuration object to set the properties of the chart
    for (var prop in config) {
      this[prop] = config[prop];
    }

    // Calculate the total dimensions of the svg element
    this.svgWidth = this.fWidth + this.fMargins.left + this.fMargins.right;
    this.svgHeight = this.iMargins.top + this.iHeight + this.iMargins.bottom;
    this.svgHeight += this.fMargins.top + this.fHeight + this.fMargins.bottom;
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


    var yShift = this.iMargins.top;
    // Add the info. view
    this.info = svg.append("g")
      .attr("transform", "translate(" + this.fMargins.left + "," + yShift + ")")
      .attr("class", "infog");

    // Add a text element to the info 
    this.info.append("text");

    yShift += this.iMargins.bottom + this.fMargins.top;
    // Add the focus view, which will show a detailed line graph of a small portion of the data
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

  }.protect(),
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
  }.protect(),
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
  }.protect(),
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
    }).bind(this))
      .interpolate("linear");

    // Append a path to the focus
    this.pF = this.focus.append("g")
      .attr("clip-path", "url(#clip)")
      .append("path")
      .attr("class", "line");

    this.pFD = this.focus.append("g")
      .attr("clip-path", "url(#clip)")
      .append("path")
      .attr("class", "line1");
    
    this.pFD1 = this.focus.append("g")
      .attr("clip-path", "url(#clip)")
      .append("path")
      .attr("class", "line2");

    // An insisible rectangle that goes over the focus and detect mouse events
    this.mouseRect = this.focus.append("rect")
      .attr("width", this.fWidth)
      .attr("height", this.fHeight)
      .attr("class", "overlay")
      .on("mousemove", (function() {
      var rect = this.mouseRect[0][0];
      this.focusMouseMove(rect);
    }).bind(this))
      .on("mouseover", (function() {
      // When the mouse enters the focus, display the point selector
      this.pointSelector.style("display", null);
    }).bind(this))
      .on("mouseout", (function() {
      // When the mouse exits the focus, hide the point selector
      this.pointSelector.style("display", "none");
    }).bind(this));

    // Create the point selector which will be used to highlight a point in
    // the focus view
    this.pointSelector = this.focus.append("g")
      .attr("class", "point-selector")
      .append("circle")
      .attr("r", 2);

    this.updateFocus();
  }.protect(),
  // Updates the line path in the focus when the scroll bar or brush change
  updateFocus: function(animate) {
    // Animation flag
    animate = animate || false;
    console.log("UPDATE FOCUS: " + animate);
    console.log("DOMAIN:" + this.sFX.domain());
    // Refresh the focus data
    this.updateFocusData(animate);

    // Redraw the line graph
    if (animate) {
      var d = this.sFX.domain();
      this.sFX
        .domain([0, this.focusData.length - 1]);

      //this.pFD.data([this.focusData])
       // .attr("transform", null)
        //.attr("d", this.fLine);

      this.sFX.domain(d);

      // Shift the path if need be
      this.pF.data([this.focusAniData])
        .attr("transform", null)
        .attr("d", this.fLine)
        .transition()
        .duration(500)
        .ease("linear")
        .attr("transform", "translate(" + this.sFX(-this.shiftAmt) + ")")
        .each("end", (function() {
        // After the shift animation ends, scale if need be
        if (this.scaleAmt !== 1) {
          this.focusAniData = this.focusAniData.slice(this.shiftAmt, this.focusAniData.length);
          console.log("DATA");
          console.log(this.focusAniData);
          console.log(this.focusData);
          //this.pFD1.data([this.focusAniData])
            //.attr("d", this.fLine);
          
          this.pF.data([this.focusAniData])
            .attr("d", this.fLine)
            .attr("transform",null)
            .transition()
            .duration(500)
            .ease("linear")
            .attr("transform", "scale(" + this.scaleAmt + ",1)")
            .each("end", (function() {
            this.animationEnd();
          }).bind(this));
        }
      }).bind(this))
        .each("start", (function() {
        this.animationStart();
      }).bind(this));
    }
    else {
      this.pF.data([this.focusData])
        .attr("transform", null)
        .attr("d", this.fLine);
    }

    // Update the focus x axis
    this.focus.select(".x-axis").call(this.aFX);
  }.protect(),
  // Updates the focus data when the scroll bar or brush change
  updateFocusData: function(animate) {
    animate = animate || false;

    // Use the position and extent of the brush to select a subset of data points from 
    // contextData
    var bStart = Math.min(this.sCXD(this.bC.extent()[0]), this.sCXD(this.bC.extent()[1]));
    bStart = Math.round(bStart);
    var bEnd = Math.max(this.sCXD(this.bC.extent()[0]), this.sCXD(this.bC.extent()[1]));
    bEnd = Math.round(bEnd);

    // Make sure that the data is in the correct range
    bStart = Math.max(0, bStart);
    bEnd = Math.min(this.contextData.length, bEnd + 1);

    // Check how many data points are between bStart and bEnd
    var newLen = bEnd - bStart;

    // Compute the absolute index into the data array
    var startIndex = this.cStartIndex + bStart;
    var endIndex = this.cStartIndex + bEnd;

    this.focusData = this.data.slice(startIndex, endIndex);

    console.log("S: " + startIndex + " E: " + endIndex);
    console.log("OS: " + this.fStartIndex + " OE: " + this.fEndIndex);

    // When we animate the focus after a data point is added, we basically want 
    // to redraw the same path as before and then shift or scale it so that we
    // see our new data point in the correct place
    this.shiftAmt = 0;
    if (animate) {
      // Check if the data was shifted
      this.shiftAmt = startIndex - this.fStartIndex;

      var oldLen = this.fEndIndex - this.fStartIndex;

      // Suppose that we shift the data to the left by this.shiftAmt. Then we
      // we may need to scale the data to add or remove some data points on the
      // right part of the focus
      this.scaleAmt = oldLen / newLen;

      this.focusAniData = data.slice(this.fStartIndex, endIndex);
      console.log("SCALE AMT: " + this.scaleAmt);
      console.log("SHIFT: " + this.shiftAmt);
      console.log("FOCUS ANI");
      console.log(this.focusAniData);
    }

    // Use these values to get the focus data points
    this.fStartIndex = startIndex;
    this.fEndIndex = endIndex;

    if (!animate) {
      this.sFX
        .domain([0, newLen - 1])
        .range([0, this.fWidth]);
    }

    this.sFXA
      .domain([startIndex, endIndex - 1])
      .range([0, this.fWidth]);

  }.protect(),
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
  }.protect(),
  initScales: function() {
    this.sCX = d3.scale.linear();
    this.sCXA = d3.scale.linear();
    this.sCXD = d3.scale.linear();
    this.sCY = d3.scale.linear();
    this.sCY = d3.scale.linear();
    this.sFX = d3.scale.linear();
    this.sFXA = d3.time.scale();
    this.sFY = d3.scale.linear();
    this.sFYA = d3.scale.linear();
    this.sSP = d3.scale.linear();
    this.sSD = d3.scale.linear();
  }.protect(),
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
  }.protect(),
  // Updates the sSD scale  
  setSSD: function() {
    this.sSD
      .domain([0, this.fWidth])
      .range([0, this.data.length]);
  }.protect(),
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

    // Check if the scroll bar is at the rightmost edge of the scroll track
    var scrollEdge = this.sbData.x + this.sbData.width === this.fWidth;

    // If both are true, then animate the focus
    //this.updateFocus(scrollEdge && brushEdge);

    // TODO: FIX ANIMATION WHEN SCROLL IS NOT ON EDGE

    this.updateFocus(true);
  },
  addRandPoint: function() {
    var t = this.data[this.data.length - 1].ts;
    this.addDataPoint({ts: t + 180000, value: this.range * Math.random()});
  },
  addPoint: function(n) {
    var t = this.data[this.data.length - 1].ts;
    this.addDataPoint({ts: t + 180000, value: n % this.range});
  },
  focusMouseMove: function(rect) {
    // First, find the index of the nearest data point to the mouse along
    // the x axis
    var x = d3.mouse(rect)[0];
    var index = Math.round(this.sFX.invert(x));
    // Find the location of this point in the focus
    var xt = this.sFX(index);
    var yt = this.sFY(this.focusData[index].value);

    // Update the position of the point selector
    this.pointSelector.attr("transform", "translate(" + xt + "," + yt + ")");
    var format = d3.time.format("%m/%d @ %I:%M %p");

    // Display the date and value for the point in the info view
    var dateText = format(new Date(this.focusData[index].ts));
    this.info.select("text").text(dateText + " : " + Math.round(this.focusData[index].value));
  },
  // Called as the add point animation starts
  animationStart: function() {
    // We don't want the tooltip to appear during the animation. Otherwise
    // it would look positively silly!
    this.pointSelector.style("display", "none");
  },
  // Called immediately after the add point animation ends
  animationEnd: function() {
    // Update the sFX scale. We only want to change the scale after the animation is complete.
    this.sFX
      .domain([0, this.focusData.length - 1])
      .range([0, this.fWidth]);
  }
});







