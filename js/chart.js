function bChart(title) {
  // The name of the chart
  var name = title;
  // Boolean that determines if all of the chart elements have been setup yet
  var init = false;
  // The current selection
  var selection;

  // Set the default dimensions and margins for the focus, context, and scroll area
  var fWidth = 1000,
    fHeight = 250,
    cHeight = 60,
    sHeight = 50;

  var fMargins = {left: 30, right: 30, top: 10, bottom: 20},
  cMargins = {top: 20, bottom: 20},
  sMargins = {top: 20, bottom: 10};

  // Calculate the total dimensions of the svg element
  var svgWidth = fWidth + fMargins.left + fMargins.right,
    svgHeight = fMargins.top + fHeight + fMargins.bottom + cMargins.top + cHeight + cMargins.bottom + sMargins.top + sHeight + sMargins.bottom;

  // Define a few scales 
  // Input: array index -> Output: x coordinate in focus
  var sFX = d3.scale.linear();
  // Input: a data value -> Output: y coordinate in the focus
  var sFY = d3.scale.linear();
  // Used to generate the tick marks on the focus x axis
  var sFXA = d3.scale.linear();
  // Input: array index -> Output: x coordinate in context
  var sCX = d3.scale.linear();
  // Input: data value -> Output: y coordinate in context
  var sCY = d3.scale.linear();
  // Used for animation purposes to shift coordinates in the focus
  var sFShift = d3.scale.linear();
  // Used to compute the width of the scroll bar
  // Input: number of data points in context -> Output: width of scroll bar in pixels
  var sSP = d3.scale.linear();
  // Does basically the opposite of the previous scale. Converts from pixel coordinates to data indexes in the complete array of data. Its purpose is to address a bug where the brush won't recompute its extent when its underlying scale changes
  // Input: pixel coordinate of either the start or end of the scroll bar -> Output: the index in the data array corresponding to that pixel
  var sSD = d3.scale.linear();

  // Define the axes
  // The x axis for the focus
  var aFX = d3.svg.axis()
    .scale(sFXA)
    .orient("bottom");
  // The y axis for the focus
  var aFY = d3.svg.axis()
    .scale(sFY)
    .orient("left");
  // The x axis for the context (it won't have a y axis)
  var aCX = d3.svg.axis()
    .scale(sCXA)
    .orient("bottom");

  // A bunch of additional params
  // The width of the bars in the focus view
  var cBarWidth = 1;
  // The number of points to display in the focus on initialization
  var focusPoints = 20;
  // The number of points to display in the context by default
  var contextPoints = 500;
  // The data points being displayed in the context
  var contextData;
  // The data points being displayed in the focus
  var focusData;
  // The maximum expected value in the data set
  var range = 100;

  // Data used to define the properties of the scroll bar 
  var sbData = {x: 0, y: 0, width: fWidth, height: 20};
  // Define what happens when the user moves the scroll bar
  var drag = d3.behavior.drag()
    .origin(Object)
    .on("drag", dragMove);

  // Used to draw the path in the focus
  var fLine = d3.svg.line()
    .x(function(d, i) {
    return sFX(i);
  })
    .y(function(d, i) {
    return sFY(d.value);
  });

  function chart(selection) {
    this.selection = selection;

    selection.each(function(data) {
      // If the chart hasn't already been initialized then add all of the containers and such
      if (!init) {
        // Now add the svg element and append the containers
        var svg = d3.select("body").append("svg")
          .attr("width", svgWidth)
          .attr("height", svgHeight);

        // The clip path prevents anything from being drawn outside of its borders
        svg.append("defs").append("clipPath")
          .attr("id", "clip")
          .append("rect")
          .attr("width", fWidth)
          .attr("height", fHeight);

        // Add the focus view, which will show a detailed line graph of a small portion of the data
        var yShift = fMargins.top;
        var focus = svg.append("g")
          .attr("transform", "translate(" + fMargins.left + "," + yShift + ")")
          .attr("class", "focus");

        // Add the context view, which will show a bar graph of a large segment of the data
        yShift += fHeight + fMargins.bottom + cMargins.top;
        var context = svg.append("g")
          .attr("transform", "translate(" + fMargins.left + "," + yShift + ")")
          .attr("class", "context");

        // Add a container for a scroll bar, which will be used to load in more data into the context view
        yShift += cHeight + cMargins.bottom + sMargins.top;
        var scrollCont = svg.append("g")
          .attr("transform", "translate(" + fMargins.left + "," + yShift + ")")
          .attr("class", "scroll-container");

        initScroll();
      }
    });

    init = true;
  }

  // Setup the scroll bar
  function initScroll() {
    selection.each(function(data) {
      var scroll = getScroll();

      // Compute the width of the scroll bar
      sbData.width = getScrollBarWidth(data);
      // Place the scroll bar as far right as it can go
      sbData.x = fWidth - sbData.width;

      // Add the scroll track
      scroll.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("height", sbData.height)
        .attr("width", fWidth)
        .attr("class", name + "-st");

      // Add the scroll bar itself
      scroll.append("rect")
        .data([sbData])
        .attr("height", sbData.height)
        .attr("width", sbData.width)
        .attr("fill", "black")
        .attr("class", name + "sb")
        .attr("transform", "translate(" + sbData.x + "," + sbData.y + ")")
        .call(drag);
    });
  }

  // Set up the context view
  function initContext() {
    // The context relies on the scroll bar, so we'll set that up first
    initScroll();

    selection.each(function(data) {
      // Get current context data
      updateContextData();

      // Then graph it!
      var context = getContext();
      context.selectAll("." + name + "-bar")
        .data(contextData)
        .enter().append("rect")
        .attr("x", function(d, i) {
        return sCX(i);
      })
        .attr("y", function(d, i) {
        return cHeight - sCY(d.value);
      })
        .attr("width", cBarWidth)
        .attr("height", function(d) {
        return sCY(d.value);
      })
        .attr("class", name + "-bar");
    });
  }
  
  // Setup the focus view
  function initFocus(){
    
  }

  // Updates the context data points based on the width and position of the scroll bar
  function updateContextData() {
    selection.each(function(data) {
      // From the x position of the scroll bar, compute the index of the first data point
      var start = Math.round(sSD(sbData.x));
      // Then find the ending index
      var end = start + contextPoints;
      // It's fine if the ending index is out of bounds. Javascript will do the right thing.
      contextData = data.slice(start, start + contextPoints);
    });
  }

  // Computes the width of the scroll bar based on the number of points to be 
  // displayed in the context and the total number of data points
  function getScrollBarWidth(data) {
    return Math.min(fWidth, fWidth * (contextPoints / data.length));
  }

  function getSVG() {
    return d3.selectAll("." + name + "-svg");
  }

  function getFocus() {
    return d3.selectAll("." + name + "-focus");
  }

  function getContext() {
    return d3.selectAll("." + name + "-context");
  }

  function getScroll() {
    return d3.selectAll("." + name + "-scroll");
  }

  function scrollBar() {

  }

}

