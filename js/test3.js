
var d = new Date("06-21-2013 00:00:00");
var ts = d.getTime();
var data = [];

for (var i = 0; i < 10; i++) {
  data.push({date: ts + 300 * i * 1000, total: 20 * Math.random()});
}

console.log("DATA");
console.log(data);


var margin = {top: 40, right: 40, bottom: 140, left: 40},
width = 600,
  height = 500;

var x = d3.time.scale()
  .domain([new Date(parseInt(data[0].date)), new Date(parseInt(data[data.length - 1].date))])
  .rangeRound([0, width - margin.left - margin.right]);

var y = d3.scale.linear()
  .domain([0, d3.max(data, function(d) {
    return d.total;
  })])
  .range([height - margin.top - margin.bottom, 0]);

var xAxis = d3.svg.axis()
  .scale(x)
  .orient('bottom')
  .ticks(5)
  .tickFormat(d3.time.format('%m/%d @ %I:%M %p'))
  .tickSize(0)
  .tickPadding(8);

var yAxis = d3.svg.axis()
  .scale(y)
  .orient('left')
  .tickPadding(8);

var svg = d3.select('body').append('svg')
  .attr('class', 'chart')
  .attr('width', width)
  .attr('height', height)
  .append('g')
  .attr('transform', 'translate(' + margin.left + ', ' + margin.top + ')');

svg.selectAll('.chart')
  .data(data)
  .enter().append('rect')
  .attr('class', 'bar')
  .attr('x', function(d) {
  var r = x(new Date(parseInt(d.date)));
  console.log(r);
  return r;
})
  .attr('y', function(d) {
  return height - margin.top - margin.bottom - (height - margin.top - margin.bottom - y(d.total));
})
  .attr('width', 10)
  .attr('height', function(d) {
  return height - margin.top - margin.bottom - y(d.total);
});

svg.append('g')
  .attr('class', 'x axis')
  .attr('transform', 'translate(0, ' + (height - margin.top - margin.bottom) + ')')
  .call(xAxis)
  .selectAll("text")
  .style("text-anchor", "end")
  .attr("dx", "-.8em")
  .attr("dy", ".15em")
  .attr("transform", function(d) {
  return "rotate(-65)";
});

svg.append('g')
  .attr('class', 'y axis')
  .call(yAxis);